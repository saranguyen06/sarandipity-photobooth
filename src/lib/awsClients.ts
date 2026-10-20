import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityClient, GetIdCommand } from '@aws-sdk/client-cognito-identity'
import { fromCognitoIdentity } from '@aws-sdk/credential-providers'
import { getCurrentSession } from './cognito'
import { getConfig } from './config'

export interface AwsClients {
  /**
   * The caller's Cognito *identity ID* (e.g. "us-east-1:1b2c...").
   *
   * This is NOT the same as the User Pool `sub`. It's the value AWS substitutes
   * for ${cognito-identity.amazonaws.com:sub} in our IAM policies, so S3 keys
   * and DynamoDB partition keys must start with exactly this value or AWS will
   * deny the request.
   */
  identityId: string
  s3: S3Client
  ddb: DynamoDBDocumentClient
}

// The identity ID never changes for a given user, so look it up once per
// signed-in user rather than on every call.
let cachedIdentity: { userSub: string; identityId: string } | null = null

export function clearIdentityCache(): void {
  cachedIdentity = null
}

/**
 * Exchanges the current Cognito sign-in for short-lived AWS credentials and
 * returns clients that use them, plus the caller's identity ID.
 *
 * Clients are rebuilt on every call (rather than cached) because the
 * underlying ID token expires after about an hour; getCurrentSession()
 * refreshes it, so each call starts from fresh credentials.
 */
export async function getAwsClients(): Promise<AwsClients> {
  const { region, userPoolId, identityPoolId } = getConfig()

  const session = await getCurrentSession()
  if (!session) throw new Error('You must be signed in to do that.')

  const idToken = session.getIdToken()
  const logins = {
    [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken.getJwtToken(),
  }
  const userSub = idToken.payload.sub as string

  let identityId: string
  if (cachedIdentity && cachedIdentity.userSub === userSub) {
    identityId = cachedIdentity.identityId
  } else {
    const identityClient = new CognitoIdentityClient({ region })
    const result = await identityClient.send(
      new GetIdCommand({ IdentityPoolId: identityPoolId, Logins: logins })
    )
    if (!result.IdentityId) throw new Error('Could not resolve your AWS identity.')
    identityId = result.IdentityId
    cachedIdentity = { userSub, identityId }
  }

  const credentials = fromCognitoIdentity({
    clientConfig: { region },
    identityId,
    logins,
  })

  return {
    identityId,
    s3: new S3Client({ region, credentials }),
    ddb: DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials })),
  }
}
