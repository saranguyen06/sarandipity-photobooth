# Sara-ndipity Booth

A retro-style online photobooth. Take single shots or classic 3-photo strips, apply vintage filters, and save your favorites to your account. Built with React, TypeScript, and Vite; backed by Supabase for auth and photo storage.

## 1. Local setup

```bash
npm install
cp .env.example .env
```

You'll fill in `.env` with your Supabase project values in the next step.

## 2. Set up Supabase (auth + storage)

1. Create a free project at [supabase.com](https://supabase.com).
2. In your project, go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates:
   - a `photos` table (with Row Level Security so users only ever see their own rows)
   - a public `photos` storage bucket (with policies so users can only upload/delete inside their own folder)
3. Go to **Project Settings → API** and copy:
   - **Project URL** → paste into `.env` as `VITE_SUPABASE_URL`
   - **anon public** key → paste into `.env` as `VITE_SUPABASE_ANON_KEY`
4. (Optional) Go to **Authentication → Providers → Email** and turn **off** "Confirm email" if you want new accounts to be usable immediately without clicking a confirmation link — handy while testing. Leave it on for a real deployment.

## 3. Run it locally

```bash
npm run dev
```

Open the printed `localhost` URL. Your browser will ask for camera permission — allow it. Camera access works on `localhost` without HTTPS; once deployed, Vercel serves everything over HTTPS automatically, which is required for camera access on any other domain.

## 4. Deploy to Vercel

**Option A — via GitHub (recommended):**

1. Push this project to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import that repository (your Hobby account works fine — no config changes needed).
3. Vercel auto-detects Vite. Before deploying, add your environment variables under **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. Every future push to your main branch redeploys automatically.

**Option B — via Vercel CLI:**

```bash
npm i -g vercel
vercel login
vercel
```

Follow the prompts (link or create a project). Then add your env vars and deploy to production:

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod
```

The included `vercel.json` makes sure client-side routes like `/gallery` load correctly on direct visits and refreshes.

## Project structure

```
src/
  components/
    Auth/        Login and signup forms
    Booth/       Camera viewfinder, capture flow, result panel
    Gallery/     Saved-photos grid
  context/       Auth session context (Supabase)
  hooks/         useCamera — getUserMedia lifecycle management
  lib/           Supabase client
  utils/         Filter presets, canvas capture + photo-strip compositing
supabase/
  schema.sql     Database table, RLS policies, storage bucket + policies
```

## Notes

- Filters are plain CSS filter strings applied live to the `<video>` preview and baked into the captured image via canvas — what you see is what gets saved.
- Photo strips composite 3 sequential shots into one vertical image with sprocket-hole edges and a timestamp, drawn entirely on canvas (no server round-trip).
- Downloads and native share (on supported mobile browsers) work without an account. Saving to "My Photos" requires signing in.
