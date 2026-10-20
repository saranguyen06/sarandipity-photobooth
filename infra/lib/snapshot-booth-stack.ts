import * as path from 'path'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'

export class SnapshotBoothStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // -----------------------------------------------------------------
    // 1. Cognito User Pool — sign up / sign in, email as the username.
    // -----------------------------------------------------------------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'snapshot-booth-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // fine for a personal/hobby project
    })

    // Public browser client — no client secret, since a secret embedded in
    // frontend JS isn't actually secret. Auth uses SRP (see src/lib/cognito.ts).
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: { userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
    })

    // -----------------------------------------------------------------
    // 2. Cognito Identity Pool — exchanges a signed-in user's ID token for
    //    short-lived AWS credentials tied to that user's identity ID.
    // -----------------------------------------------------------------
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: 'snapshot_booth_identity_pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    })

    // -----------------------------------------------------------------
    // 3. Photos bucket — PRIVATE. Users upload/delete directly with their
    //    scoped credentials; everyone reads through CloudFront (section 6),
    //    which is the only other thing allowed to read from it.
    // -----------------------------------------------------------------
    const photosBucket = new s3.Bucket(this, 'PhotosBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // The browser PUTs/DELETEs straight to S3 from the CloudFront domain, so
      // S3 must answer the CORS preflight. Reads don't need CORS (they go
      // through CloudFront on the same origin as the app), so only these two
      // methods are allowed. Origins are '*' because naming the CloudFront
      // domain here would create a circular dependency (the distribution
      // already depends on this bucket). That's low-risk: every write must
      // still carry valid, per-user IAM-signed credentials.
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.DELETE],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // dev convenience — remove for a real production bucket
    })

    // -----------------------------------------------------------------
    // 4. DynamoDB table for photo metadata.
    // -----------------------------------------------------------------
    const table = new dynamodb.Table(this, 'PhotosTable', {
      tableName: 'snapshot-booth-photos',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // -----------------------------------------------------------------
    // 5. IAM role for signed-in users. Both statements key off the caller's
    //    own Cognito identity ID (an IAM policy variable AWS fills in per
    //    request), so each user can only touch their own S3 prefix and their
    //    own DynamoDB partition. The browser only writes and deletes;
    //    reading photos happens via CloudFront, so no s3:GetObject here.
    // -----------------------------------------------------------------
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    })

    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [`${photosBucket.bucketArn}/\${cognito-identity.amazonaws.com:sub}/*`],
      })
    )

    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:DeleteItem'],
        resources: [table.tableArn],
        conditions: {
          'ForAllValues:StringEquals': {
            'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
          },
        },
      })
    )

    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: { authenticated: authenticatedRole.roleArn },
    })

    // -----------------------------------------------------------------
    // 6. Hosting: a private site bucket behind CloudFront.
    //    CloudFront gives HTTPS (required for camera access off localhost)
    //    and reaches both buckets through Origin Access Control, so neither
    //    bucket needs to be public.
    // -----------------------------------------------------------------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Photo URLs look like /photos/<identityId>/<id>.jpg, but the objects are
    // stored under <identityId>/<id>.jpg, so strip the /photos prefix before
    // the request reaches the photos bucket.
    const stripPhotosPrefix = new cloudfront.Function(this, 'StripPhotosPrefix', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        `function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/photos/, '');
  return request;
}`
      ),
    })

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Snapshot Booth',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/photos/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(photosBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          functionAssociations: [
            {
              function: stripPhotosPrefix,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
      // Single-page-app routing: a direct visit or refresh on /gallery has no
      // matching file in the bucket (S3 answers 403/404), so serve index.html
      // and let React Router take over. This replaces vercel.json's rewrite.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    })

    // Uploads the built app (../dist) plus a generated config.json containing
    // the resource IDs created above, then invalidates the CloudFront cache.
    // Sources are applied in order, so this config.json always wins over any
    // copy that happens to be in dist/.
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../dist')),
        s3deploy.Source.jsonData('config.json', {
          region: this.region,
          userPoolId: userPool.userPoolId,
          userPoolClientId: userPoolClient.userPoolClientId,
          identityPoolId: identityPool.ref,
          photosBucket: photosBucket.bucketName,
          photosTable: table.tableName,
          cdnUrl: `https://${distribution.distributionDomainName}`,
        }),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // -----------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Where the app is live. /config.json here is also what local dev downloads.',
    })
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
  }
}
