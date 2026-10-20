# Snapshot Booth

A retro-style online photobooth. Take single shots or classic 3-photo strips through your webcam, apply vintage filters, download or share the result, and save favorites to your account. It works on desktop and mobile browsers.

Built with **React, TypeScript, and Vite**, and hosted entirely on **AWS**: CloudFront and S3 serve the app, Cognito handles accounts, S3 stores photos, DynamoDB stores photo metadata, and **AWS CDK** defines all of it as code. There is no server of our own.

This file is the single reference for the project: how to run it, how it is put together, why each technology was chosen, and how the code works.

## Contents

1. [Quick start](#1-quick-start)
2. [Architecture](#2-architecture)
3. [Tech stack and why](#3-tech-stack-and-why)
4. [The AWS services, in plain terms](#4-the-aws-services-in-plain-terms)
5. [Security model](#5-security-model)
6. [How the code works](#6-how-the-code-works)
7. [Design choices](#7-design-choices)
8. [Production notes and known limitations](#8-production-notes-and-known-limitations)
9. [Project structure](#9-project-structure)

---

## 1. Quick start

You need an AWS account, the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with credentials (`aws configure`), and Node.js.

### Deploy

```bash
npm install
(cd infra && npm install)

# One-time per AWS account and region
(cd infra && npx cdk bootstrap)

# Build the app and deploy infrastructure + site together
npm run deploy
```

`npm run deploy` runs `npm run build` and then `cdk deploy`. It prints a **`SiteUrl`** (a `https://d....cloudfront.net` address); open it and the app is live. To ship a change later, run `npm run deploy` again: it rebuilds, uploads the new files, and clears the CDN cache.

The first deploy takes several minutes because CloudFront distributions are slow to create. Later deploys are much faster.

If you run `cdk deploy` or `cdk synth` directly instead, run `npm run build` first. The stack uploads the contents of `dist/`, and CDK fails with "asset not found" if it doesn't exist.

> **Status:** the code type-checks, builds, and the CDK stack synthesizes to a valid template, but it has not yet been deployed to a live AWS account. Expect to fix a few small things on the first real deploy, and click through the whole flow once (sign up, confirm email, take a photo, save, view in gallery, delete) before relying on it.

### Run locally

Local development talks to your deployed AWS resources, so deploy first, then download the config the site is serving:

```bash
curl -o public/config.json https://<your-SiteUrl-domain>/config.json
npm run dev
```

`public/config.json` is gitignored. Camera access works on `localhost` without HTTPS. Sign-up sends a 6-digit confirmation code to your email; enter it on the next screen before signing in.

### Tear it down

```bash
cd infra && npx cdk destroy
```

This permanently deletes the buckets, the table, and all user accounts and photos (see [section 8](#8-production-notes-and-known-limitations)).

---

## 2. Architecture

```
                         ┌──────────────────────────────┐
                         │        CloudFront (HTTPS)     │
                         │   default      /photos/*      │
                         └───────┬───────────────┬───────┘
                                 │               │  (strips the /photos prefix)
                      private S3 │               │ private S3
                      site bucket│               │ photos bucket
                                 │               │
   Browser ──────────────────────┘               │
     │  loads app, /config.json                   │ loads photos
     │                                            │
     ├── sign up / sign in ───────► Cognito User Pool
     │                                   │ ID token
     ├── exchange token ──────────► Cognito Identity Pool ──► temporary AWS credentials
     │                                                              │
     └── save / list / delete ─────────────────────────────────────┤ (scoped to this user by IAM)
                                          S3 photos bucket ◄───────┤
                                          DynamoDB table  ◄────────┘
```

The browser talks directly to AWS. There is no API server of ours in the middle, so access control lives in IAM policies instead of backend code (see [section 5](#5-security-model)).

### Walkthrough of the main flows

**Loading the app.** The browser fetches the built React app from CloudFront, which reads it from the private site bucket. Before rendering anything, `main.tsx` fetches `/config.json` (written by the deploy) to learn the real Cognito, bucket, and table identifiers.

**Signing up and in.** `Signup` calls Cognito, which emails a 6-digit code. The user confirms it, and the app then signs in (confirming an account does not log you in). Sign-in uses SRP, so the password is never sent over the wire.

**Taking a photo.** Entirely client-side. The webcam stream plays in a `<video>`; on shutter, a countdown runs, a frame is drawn onto an in-memory `<canvas>` with the chosen filter applied, and the result becomes a JPEG data URL. Strip mode repeats this three times and composites the frames onto one canvas.

**Saving a photo.** The app gets AWS credentials scoped to the user, uploads the JPEG to S3 under `<identityId>/<uuid>.jpg`, then writes a metadata row to DynamoDB (`userId`, `id`, `storageKey`, `kind`, `createdAt`).

**Viewing the gallery.** The app queries DynamoDB for that user's rows, sorts them newest first, and renders each photo from `https://<cdn>/photos/<storageKey>`. CloudFront strips `/photos` and fetches the object from the private photos bucket.

**Deleting a photo.** The app deletes the S3 object and then the DynamoDB row.

### Deployment as one stack

A single CDK stack (`infra/lib/snapshot-booth-stack.ts`) creates everything:

| Resource | What it does |
|---|---|
| Cognito User Pool | Accounts, email confirmation, sign-in |
| Cognito Identity Pool | Exchanges a signed-in user for short-lived, per-user AWS credentials |
| IAM role (authenticated) | The permission rules that keep users apart |
| S3 photos bucket (private) | Photo files, one folder per user |
| DynamoDB table | Photo metadata |
| S3 site bucket (private) | The built React app |
| CloudFront distribution | HTTPS; serves the site and `/photos/*`; handles SPA routing |
| CloudFront Function | Strips `/photos` so URLs map to object keys |
| Bucket deployment | Uploads `dist/` plus a generated `config.json`, invalidates the CDN cache |

Neither bucket is public. CloudFront reads both through Origin Access Control.

---

## 3. Tech stack and why

| Layer | Choice | Short reason |
|---|---|---|
| Build tool | Vite | Instant dev server, simple production build, and no need for a full framework. |
| UI | React 19 | The app splits naturally into stateful components (booth, gallery, forms). |
| Language | TypeScript | Browser and AWS APIs return `null` or specific shapes that are easy to get wrong; the compiler catches that. |
| Routing | React Router | Three real pages, one gated behind login. |
| Camera and imaging | Native `getUserMedia` and `<canvas>` | Built in, no dependencies, and fully capable of filters and strip compositing. |
| Styling | Plain CSS with custom properties | The retro look is bespoke enough that a utility framework wouldn't save time. |
| Auth | Cognito User Pool | Managed accounts and sign-in that browser code can call directly. |
| AWS access | Cognito Identity Pool + IAM | Turns a login into per-user, scoped AWS credentials. |
| Files | S3 | Standard, cheap, durable file storage. |
| Database | DynamoDB | Simple "all photos for one user" access pattern, and it works with IAM-scoped browser credentials. |
| Infrastructure | AWS CDK (TypeScript) | The backend is reproducible code in the same language as the app. |
| Hosting | S3 + CloudFront | Static files behind a CDN, with free HTTPS, in the same stack as the backend. |

### The reasoning behind each choice

**Vite.** It serves source as native ES modules in development, so startup and updates are near-instant. This app has no SEO needs (it's a tool behind a login) and no server routes, so Next.js would add a Node server and a different routing model for no benefit. Create React App is effectively unmaintained.

**React.** The booth manages its own multi-step capture flow, the gallery manages its own list, and the forms manage their own fields. React's component model fits that shape. Vue and Svelte are both capable, but React has the largest library ecosystem, which this project leans on (AWS SDKs, routing). Vanilla JS would mean hand-rolling the re-rendering and coordination React gives for free.

**TypeScript.** The code touches APIs with easy-to-forget edge cases: `canvas.getContext('2d')` can return `null`, a `MediaStream` needs its tracks stopped explicitly, AWS responses have specific shapes. TypeScript turns "forgot this can be null" or "typo'd a field" into compile errors instead of bugs found on a specific device.

**React Router.** With only `/`, `/login`, `/signup`, and a protected `/gallery`, the standard router is enough. TanStack Router is excellent and fully type-safe, but heavier than this route list needs.

**Native camera and canvas.** `getUserMedia` and `<canvas>` ship in every modern browser. `ctx.filter` accepts the same syntax as CSS `filter`, so one string drives both the live preview and the saved image. `react-webcam` would save a little boilerplate but gives less direct control over the `<video>` element the capture code needs. Fabric.js or Konva are overkill for "draw a frame, apply a filter, composite three rectangles and some text".

**Plain CSS.** Almost every element (viewfinder frame, film strip, shutter button) is a one-off visual, which is exactly where Tailwind stops saving time. A component library like Material UI would fight the retro look constantly.

**Cognito.** Authentication is easy to get subtly wrong (password hashing, tokens, email verification, rate limiting), and Cognito can be called straight from browser JavaScript. Auth0, Clerk, or Firebase Auth are arguably easier to set up; Cognito was chosen because the goal was to learn the AWS ecosystem, not because it's objectively best. Rolling your own is a much larger security surface.

**Identity Pool and IAM.** Once the browser talks to S3 and DynamoDB directly, something has to convert "this person is signed in" into "this person may call these specific APIs, for their own data only". That is the Identity Pool's job. The alternative is a small backend (API Gateway + Lambda) that holds the broad permissions while the browser calls your API with its Cognito token. That is a valid and arguably more conventional design; this project deliberately explores the no-backend pattern, which moves more responsibility onto getting IAM policies exactly right.

**S3.** The standard place for files on AWS. Storing images in DynamoDB is an anti-pattern (400 KB item limit, wrong pricing model), and EFS is for servers sharing a filesystem.

**DynamoDB.** It integrates with IAM-scoped credentials the same way S3 does, and the data model is one item type always looked up by user, which is its sweet spot. RDS would keep a relational model but has no way to hand a browser credentials scoped to one user's rows, so it would force a backend server in front of it, and it bills for constant uptime. Aurora Serverless bills per use but still needs a connection-based access layer.

**CDK.** Creating a User Pool, two buckets, a table, a distribution, and precise IAM policies by clicking through the console is slow and unrepeatable. `cdk deploy` rebuilds the whole thing from one command, and the stack file doubles as accurate documentation. Terraform is the industry-standard alternative and is cloud-agnostic; CDK was chosen to keep everything in TypeScript. Raw CloudFormation is what CDK compiles to, and writing it by hand is verbose.

**S3 + CloudFront hosting.** A static app needs only files behind a CDN. CloudFront gives HTTPS on a free `*.cloudfront.net` domain, which camera access requires off `localhost`, and keeps hosting in the same stack as the backend. The project originally ran on Vercel, which is less to set up and operate; the move was made to keep everything in one cloud account and one deployable stack, and to learn how AWS hosting works. Amplify Hosting is AWS's managed equivalent and a good choice if you don't want to hand-build the CloudFront pieces. What you take on by leaving a managed host: single-page-app routing, cache invalidation, and getting config to the app are now your responsibility (all handled in the stack, described below).

---

## 4. The AWS services, in plain terms

**Cognito User Pool** is the login system. It stores accounts (emails and hashed passwords) and handles sign-up, the emailed confirmation code, and sign-in.

**Cognito Identity Pool** is the bridge. The User Pool proves *who* someone is but grants no permission to do anything in AWS. The Identity Pool takes that proof and returns a temporary AWS "access pass" for that specific person, along with a stable **identity ID** that identifies them to IAM.

**S3** is file storage. Each photo is an object in a bucket with its own key. This project uses two buckets: one for user photos and one for the built website.

**DynamoDB** is a fast key-value style database. Here it stores *metadata* about each photo (who owns it, when it was taken, where the file lives), not the photo itself. It has no joins or `ORDER BY`; you design around how you look data up.

**IAM** is the permission system under everything. Every AWS call is checked against an IAM policy. It is the security guard at every door, and in this project it does the job Postgres Row Level Security would do in a traditional setup.

**CloudFront** is AWS's CDN. It serves files from locations close to users, provides HTTPS, and here also acts as the only reader of the two private buckets.

**CDK** is not a runtime service but a tool: it lets you describe all of the above as TypeScript and create it with one command.

---

## 5. Security model

The React app runs in the browser with no server of ours in between, so whatever AWS credentials it holds are visible to anyone with dev tools open. Those credentials therefore have to be useless for anything except the signed-in user's own data.

**The trust chain:**

```
1. Cognito User Pool        →  proves who you are (email + password via SRP)
2. Cognito Identity Pool    →  exchanges that proof for your identity ID + temporary AWS credentials
3. S3 / DynamoDB clients    →  built using those credentials; every request is checked by IAM
```

`src/lib/cognito.ts` handles step 1. `src/lib/awsClients.ts` handles steps 2 and 3.

**The policy.** The credentials assume one IAM role shared by all signed-in users. Its permissions are the whole security model:

- **S3:** `PutObject` and `DeleteObject` only on `photos-bucket/${cognito-identity.amazonaws.com:sub}/*`.
- **DynamoDB:** `PutItem`, `GetItem`, `Query`, `DeleteItem` only when the item's partition key equals `${cognito-identity.amazonaws.com:sub}`, enforced with the `dynamodb:LeadingKeys` condition.

`${cognito-identity.amazonaws.com:sub}` is an **IAM policy variable**. AWS fills it in with the caller's own identity ID on every request, so one shared policy still confines each user to their own S3 folder and their own DynamoDB partition. This is the AWS equivalent of a database policy like `using (auth.uid() = user_id)`, evaluated by IAM instead of Postgres.

**Important detail: identity ID, not User Pool `sub`.** The policy variable is the Cognito *identity ID* (like `us-east-1:1b2c...`), which is a different value from the User Pool's `sub`. The app must use the identity ID as the first segment of every S3 key and as the DynamoDB `userId`. `getAwsClients()` returns it for exactly this reason. Using the User Pool `sub` instead would be denied by AWS on every request, and type-checking can't catch it because both are plain strings.

**What the browser can and can't do.** The role has no `s3:GetObject`: the browser never reads from S3 directly, only uploads and deletes. Reading happens through CloudFront. The practical consequence is that even though the bucket name, table name, and temporary credentials are all visible in dev tools, the credentials cannot read or write anyone else's data, because AWS refuses the request before it reaches storage.

---

## 6. How the code works

### 6.1 Runtime config (`src/lib/config.ts`, `main.tsx`)

The AWS resource IDs don't exist until the stack is deployed, so they can't be baked into the build. Instead, the deploy writes `config.json` next to the app, and `loadConfig()` fetches it at startup, validates that every required field is a string, and caches it. `main.tsx` waits for it before rendering anything, and shows a readable "Can't start the booth" card if it fails.

Two details worth knowing:

- Single-page-app hosts answer a missing file with `index.html` instead of a 404, so `response.json()` throws. `loadConfig()` catches that and gives a clear message instead of a cryptic parse error.
- `getConfig()` is a synchronous accessor, valid once `loadConfig()` has resolved. It throws if called too early, which turns an ordering bug into a loud error.

The config contains `region`, `userPoolId`, `userPoolClientId`, `identityPoolId`, `photosBucket`, `photosTable`, and `cdnUrl`. `photoUrl(storageKey)` builds `https://<cdn>/photos/<key>`.

### 6.2 Auth state (`context/AuthContext.tsx`)

The current user is needed in the navbar, the booth (to decide whether "Save" is available), the result panel, the gallery, and the protected route. Passing it down as a prop through all of those would thread it through components that don't care, so it lives in React Context and any component calls `useAuth()`.

On mount, the provider asks Cognito for an existing session (so a page refresh stays signed in) and sets `loading` to false when that resolves. `useAuth()` throws if used outside the provider, which turns a forgotten `<AuthProvider>` into an immediate error instead of a confusing `undefined` later. On sign-out it also clears the cached identity ID.

### 6.3 Cognito wrapper (`lib/cognito.ts`)

Every function wraps a callback-style SDK call in a `Promise`, so the rest of the app can use `async`/`await`. The user pool object is created lazily, because its IDs come from `config.json`.

Sign-up is two steps: `signUp`, then `confirmSignUp` with the emailed code. Sign-in uses **SRP (Secure Remote Password)**: the library and Cognito exchange mathematical challenges that prove you know the password without it ever being transmitted. `getCurrentSession()` transparently uses the stored refresh token to renew expired tokens.

### 6.4 AWS clients (`lib/awsClients.ts`)

`getAwsClients()` returns `{ identityId, s3, ddb }`. It gets the current Cognito session, builds the `logins` map (`cognito-idp.<region>.amazonaws.com/<userPoolId>` → the ID token), asks the Identity Pool for the identity ID with `GetIdCommand`, and builds credentials with `fromCognitoIdentity`.

Two caching decisions:

- The **identity ID** is cached per signed-in user, because it never changes.
- The **clients are rebuilt on every call**, because the underlying credentials last about an hour and then stop working, and a long-lived client would fail with `AccessDenied` instead of refreshing quietly. Because `getCurrentSession()` refreshes tokens first, each call starts from fresh credentials. The cost is one extra Cognito round-trip per operation, which is fine at this scale.

### 6.5 Route protection (`components/ProtectedRoute.tsx`)

Three states, handled explicitly: still `loading` (show a loading message, so the login page doesn't flash before the session resolves), no user (`<Navigate to="/login" replace />`; `replace` keeps the redirect out of history so Back doesn't loop), or a user (render the children). It wraps only the `/gallery` route.

### 6.6 Camera hook (`hooks/useCamera.ts`)

This is the trickiest browser lifecycle in the app.

- **Refs, not state.** `videoRef` and `streamRef` are `useRef`, because changing them shouldn't trigger a re-render; they're just stable handles for attaching the stream and stopping its tracks later.
- **The `cancelled` flag.** `getUserMedia` waits on a permission prompt. If the component unmounts while it's pending, the `await` resolves into a component that's gone. Without the flag, you'd attach a stream to a `null` ref or leave a camera track running (the camera light stays on). The flag stops the late stream and the cleanup function stops the tracks.
- **Error handling** narrows on `DOMException` and distinguishes "permission denied" (`NotAllowedError`) from "no camera available", so the on-screen message is accurate.

### 6.7 Filters (`utils/filters.ts`)

Filters are data, not code: an array of `{ id, label, css }`, where `css` is a CSS `filter` string (Classic, Noir, Sepia, Vintage, Faded). The same string is used twice: as an inline style on the live `<video>`, and as `ctx.filter` on the capture canvas, so what you see is what gets saved. Adding a filter is a one-line change.

### 6.8 Capturing a frame (`utils/photoStrip.ts` → `captureFrame`)

- It creates an in-memory `<canvas>` (never attached to the page) sized to the video's real dimensions.
- `getContext('2d')` can return `null`, so TypeScript forces a check.
- It sets `ctx.filter`, then draws the video frame.
- **Mirroring:** the preview is flipped with CSS (`transform: scaleX(-1)`) so it feels like a mirror, but the underlying frame data isn't flipped. The canvas re-applies the flip so the saved photo matches what the person saw (otherwise background text would come out backwards).
- `canvas.toDataURL('image/jpeg', 0.92)` produces the image with no server round-trip.

### 6.9 Photo strip (`composeStrip`)

It draws the vertical strip entirely with 2D canvas calls: a cream paper background, a sprinkle of low-opacity pixels for paper grain, circles down both edges for sprocket holes, each frame with a drop shadow and thin border, and a footer with a label and date in the typewriter font. It's `async` because each captured frame must be loaded back into an `Image` first (`Promise.all` waits for all three).

### 6.10 Booth capture flow (`components/Booth/Booth.tsx`)

Capture is inherently sequential (countdown → flash → capture → repeat → compose → show), so it's one `async` function that awaits each step, rather than several booleans that could drift out of sync:

```ts
for (let shot = 1; shot <= shotsNeeded; shot++) {
  setShotIndex(shot)
  await runCountdown(3)
  await fireFlash()
  const { dataUrl } = captureFrame(videoRef.current, filter.css)
  framesRef.current.push(dataUrl)
  if (shot < shotsNeeded) await sleep(500)
}
```

`framesRef` is a ref because it's just an accumulator; only derived state (`shotIndex`, `result`) needs to cause re-renders. The `await sleep()` calls between state updates are what make the countdown numbers and flash actually paint in sequence. An early-return guard (`if (!ready || capturing ...) return`) makes the shutter safe to spam-click.

### 6.11 Saving (`components/Booth/ResultPanel.tsx`)

Download turns the data URL into a `Blob` and triggers a browser download. Share passes a `File` to `navigator.share()` where supported and falls back to download. Save gets `{ identityId, s3, ddb }`, uploads to S3 with key `<identityId>/<uuid>.jpg`, then writes the DynamoDB row. Two writes are both necessary: S3 holds the bytes, and the table records ownership and metadata so the gallery can ask "all photos for me" without listing a bucket. The app stores the S3 key, not a URL; the URL is derived at display time.

### 6.12 Gallery (`components/Gallery/Gallery.tsx`)

It uses `QueryCommand` with `userId = :uid` (a direct partition lookup), not a `Scan` (which reads the whole table and filters afterward). DynamoDB has no `ORDER BY`, so results are sorted client-side by `createdAt`. That's fine for dozens to hundreds of photos per user; a global secondary index would only be worth adding at a scale this app won't hit. The `useEffect` has a `cancelled` flag like the camera hook.

`useMemo` assigns each photo a random tilt once, keyed on the photo list. Without it, `Math.random()` would rerun on every re-render and every remaining photo would jump to a new angle whenever one was deleted. Delete removes the S3 object, then the DynamoDB row, then updates local state.

### 6.13 TypeScript patterns used throughout

- **Union types for fixed values:** `type CaptureKind = 'single' | 'strip'` makes a typo like `'panorama'` a compile error.
- **Interfaces for shared shapes:** `Photo`, `FilterPreset`, `CapturedFrame`, `AuthUser` live in `types.ts`, so queries and component props agree on what a photo is.
- **Typed refs:** `useRef<HTMLVideoElement | null>(null)` is honest that the ref starts empty and forces a check at each use.
- **Sparing non-null assertions:** used only where it's guaranteed (for example `user!` after an `if (!user) return` that TypeScript can't follow across a closure).
- **Throw/catch around SDK calls:** the AWS and Cognito wrappers throw, and each caller handles the error in one place and shows a message.
- **Typed config:** `AppConfig` describes `config.json`, and `loadConfig()` validates the real data against it at runtime, since TypeScript can't check a fetched file.

### 6.14 CloudFront details (`infra/lib/snapshot-booth-stack.ts`)

- **Single-page-app routing.** React Router handles `/gallery` in the browser, but no such file exists. CloudFront is configured to answer a 403 or 404 from the site bucket with `index.html` and a 200 status, so a direct visit or refresh still loads the app. A side effect: a request for a photo that doesn't exist also returns `index.html`, so an `<img>` for a deleted photo just shows as broken.
- **Two origins.** The default behavior serves the site bucket. The `/photos/*` behavior serves the photos bucket, with a small CloudFront Function that strips the `/photos` prefix so `/photos/<identityId>/<id>.jpg` maps to the object `<identityId>/<id>.jpg`.
- **Same-domain photos.** Because photos come from the same domain as the app, no CORS is needed to display them, and the gallery's download link works (browsers ignore the `download` attribute on cross-origin URLs).
- **Writes bypass CloudFront.** Uploads and deletes go straight from the browser to S3 with the user's credentials, which is why the photos bucket has a CORS rule allowing only `PUT` and `DELETE`.
- **Deployment.** `BucketDeployment` uploads `dist/` and a generated `config.json` built from the stack's own resource IDs (so it can't drift out of sync), then invalidates `/*` so changes show up immediately.

---

## 7. Design choices

### Visual design

The app is meant to feel like the inside of a real photobooth, not a generic camera page.

- **Palette** (CSS custom properties on `:root`): curtain maroon `#5B1A24` backdrop, aged brass `#C89B3C` accents and buttons, darkroom black `#1B1512` ink, photo-paper cream `#EFE3C8` strips and cards, and flashbulb white `#FFF8E7` for the flash and highlights.
- **Type:** *Fraunces* italic for headlines (a hand-signed, vintage-snapshot feel), *Special Elite* typewriter for labels, dates, and the strip footer, and *Work Sans* for readable body text.
- **Signature elements:** a velvet-curtain backdrop, a brass-cornered viewfinder around the live feed, a chunky brass shutter button, a film-strip with sprocket holes and a typewriter timestamp, and saved photos in the gallery tilted slightly like instant prints tossed on a table.
- **Quality floor:** responsive down to phone width, visible keyboard focus on form fields, and `prefers-reduced-motion` respected.

### Product and engineering decisions

| Decision | Why | Trade-off |
|---|---|---|
| No backend server | A static app plus IAM-scoped browser access means nothing to write, host, or scale. | Access control lives in IAM policies, which take care to get exactly right. |
| Image processing in the browser | Canvas does filters and strip compositing, with no upload-then-process step. | Quality and speed depend on the user's device. |
| Same filter string for preview and capture | WYSIWYG: the saved photo matches the live preview. | None meaningful. |
| Filters as data | Adding one is a one-line change. | None meaningful. |
| One shared Context for auth only | Auth is the only truly global state; everything else is local to one component. No state library needed. | If global state grows, revisit. |
| Private buckets, photos served via CloudFront | Nothing is publicly listable, same-origin display and download, and the browser role needs no read access to S3. | Photo URLs don't expire (see section 8). |
| Store the S3 key, derive the URL | The URL format can change (CDN domain, signed URLs) without rewriting stored data. | A tiny bit of work at render time. |
| Runtime `config.json` instead of build-time env vars | The IDs only exist after deploy; generating the file from the same stack guarantees it matches. Avoids a deploy-then-copy-then-rebuild cycle. | One extra request at startup, and local dev needs the file downloaded once. |
| Rebuild AWS clients per call | Credentials expire hourly; this always starts from a fresh session. | One extra Cognito round-trip per operation. |
| DynamoDB `Query` + client-side sort | Direct partition lookup, no index to maintain. | Sorting happens after fetching all of a user's items. |
| Partition key = identity ID, sort key = UUID | Keeps each user's items together (required by the `LeadingKeys` policy) and avoids collisions between photos saved in the same millisecond. | None meaningful. |
| CDK instead of console clicks | Reproducible, reviewable, and self-documenting. | Learning curve; `cdk destroy` is powerful. |
| Chose AWS over a simpler managed backend | The goal was to learn how the pieces work underneath. A service like Clerk or Supabase would be easier. | More to build and more to get wrong. |

### Why Supabase was replaced (history)

The first version used Supabase, which provides auth, database, and storage in one client, with security enforced by Postgres Row Level Security. AWS has no single equivalent: Cognito, S3, and DynamoDB are separate services with no built-in notion of "this user's row". Making browser-to-AWS access as safe as Supabase's required building the missing piece, which is the Identity Pool credential exchange plus per-user IAM policies. That is the real substance of the migration. Everything unrelated to the backend (camera, canvas, capture flow, styling) is unchanged from the Supabase version.

---

## 8. Production notes and known limitations

This stack is tuned for a hobby project. Before it holds data you care about:

- **Data deletion.** `RemovalPolicy.DESTROY` and `autoDeleteObjects: true` mean `cdk destroy` permanently deletes users, photos, and metadata. Switch the user pool, table, and photos bucket to `RETAIN`.
- **CORS origins.** The photos bucket allows `PUT`/`DELETE` from any origin (`*`). Naming the CloudFront domain would create a circular dependency inside one stack. It's low-risk because every write still needs valid, per-user signed credentials, but a custom domain defined up front would let you tighten it.
- **Photo privacy.** Anyone with a photo's exact URL can view it, and URLs don't expire. They contain an identity ID plus a random UUID, so they aren't guessable. For fully private photos you'd use CloudFront signed URLs or cookies.
- **No custom domain.** It would need a Route 53 hosted zone and an ACM certificate created in `us-east-1` (CloudFront only accepts certificates from there).
- **Cost.** Not free like a hobby hosting plan, but pennies at this scale. CloudFront has a generous always-free tier.
- **Bundle size.** The AWS SDK dominates the JavaScript bundle (about 150 kB gzipped). Fine for now; code-splitting would help if it matters.
- **Caching.** Every deploy invalidates `/*`, so changes appear right away.
- **Not yet verified live.** See the status note in section 1.

---

## 9. Project structure

```
src/
  components/
    Auth/        Login and signup forms (signup includes Cognito's confirmation-code step)
    Booth/       Camera viewfinder, capture flow, result panel
    Gallery/     Saved-photos grid and photo card
    Navbar.tsx
    ProtectedRoute.tsx
  context/
    AuthContext.tsx   The one piece of global state: who is signed in
  hooks/
    useCamera.ts      getUserMedia lifecycle
  lib/
    config.ts         Loads /config.json at startup; builds photo URLs
    cognito.ts        Cognito User Pool auth (sign up, confirm, sign in, session refresh)
    awsClients.ts     Cognito session → identity ID + temporary credentials → S3 and DynamoDB clients
  utils/
    filters.ts        Filter presets (pure data)
    photoStrip.ts     Canvas capture, strip compositing, download helpers
  types.ts            Shared TypeScript interfaces
  App.tsx             Routes
  main.tsx            Loads config, then mounts React
infra/
  bin/snapshot-booth.ts           CDK app entry
  lib/snapshot-booth-stack.ts     The whole backend and hosting as one stack
```
