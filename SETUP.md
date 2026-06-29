# Hire ATS — Setup Guide

Turn the single-page prototype into a live, shared web app in about 20 minutes.

---

## What you'll set up

| Service | What it does | Cost |
|---|---|---|
| **Supabase** | Database, auth, real-time sync | Free (500 MB, 50k monthly users) |
| **Vercel** | Hosts the frontend at a URL | Free |
| **GitHub** | Connects Vercel to your code | Free |

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub
2. Click **New project**, give it a name (e.g. `hire-ats`), choose a region close to you, set a database password, click **Create new project**
3. Wait ~1 minute for the project to spin up

---

## Step 2 — Run the database schema

1. In your Supabase project sidebar, click **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `supabase/migrations/001_schema.sql` and paste it in
4. Click **Run** (green button)

You should see "Success. No rows returned."

---

## Step 3 — Get your API keys

1. In Supabase sidebar, click **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon / public** key (long JWT string under "Project API keys")

---

## Step 4 — Set up your local environment

In the project folder (`hire-ats/`):

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste in your values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 5 — Test locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). You should see the login page. Create an account — this will be your personal login.

---

## Step 6 — Deploy to Vercel

### Option A: Via GitHub (recommended)

1. Push the `hire-ats` folder to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-ORG/hire-ats.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo
3. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL` → your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
4. Click **Deploy**

Vercel gives you a URL like `hire-ats-yourteam.vercel.app`. Every push to `main` auto-deploys.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

Follow the prompts, add the env vars when asked.

---

## Step 7 — Enable AI features (optional)

The AI features (job description generator, offer letter generator, candidate summarizer) run through a Supabase Edge Function so your Anthropic API key never hits the browser.

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   supabase login
   ```
2. Link to your project:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   ```
   (find the ref in Supabase Settings → General — it's the string in your project URL)
3. Set your Anthropic API key as a secret:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Deploy the function:
   ```bash
   supabase functions deploy ai-generate
   ```

If you skip this step, the AI buttons will show an error message but everything else works fine.

---

## Step 8 — Invite your HR team

1. In Supabase sidebar, go to **Authentication → Users**
2. Click **Invite user** and enter each team member's email
3. They'll receive a link to set their password and access the app

Alternatively, you can enable self-signup: **Authentication → Providers → Email** — enable "Confirm email" and share the Vercel URL with your team.

---

## Optional: Custom domain

In Vercel dashboard → your project → **Settings → Domains** → add your domain (e.g. `hire.yourdomain.com`).

---

## Troubleshooting

**"Missing VITE_SUPABASE_URL" error** — make sure `.env.local` exists and both variables are set. Restart the dev server after editing.

**Login doesn't work** — check Supabase → Authentication → Providers → Email is enabled (it is by default).

**Data doesn't appear** — check that you ran the SQL migration (Step 2) and that RLS policies were created. In Supabase → Table Editor you should see the tables: `jobs`, `candidates`, `applications`, `notes`, `interviews`, `offers`.

**AI features fail** — the Edge Function might not be deployed. Check Supabase → Edge Functions in your dashboard. If the function doesn't appear, run `supabase functions deploy ai-generate` again.

**Real-time sync not working** — check that the `alter publication supabase_realtime add table ...` lines ran in Step 2. You can verify in Supabase → Database → Replication.

---

## Project structure

```
hire-ats/
├── src/
│   ├── App.jsx              # Auth gate
│   ├── context/
│   │   └── AppContext.jsx   # All data loading + Supabase mutations
│   ├── lib/
│   │   └── supabase.js      # Supabase client + AI helper
│   ├── components/
│   │   ├── Layout.jsx       # Sidebar + topbar
│   │   ├── Login.jsx        # Login / signup page
│   │   ├── views/           # Dashboard, Pipeline, Jobs, Schedule, Offers, Reports
│   │   └── modals/          # All modal dialogs
│   └── index.css            # All styles
├── supabase/
│   ├── migrations/
│   │   └── 001_schema.sql   # Run this once in Supabase SQL Editor
│   └── functions/
│       └── ai-generate/     # Edge function — proxies Anthropic API
├── .env.example             # Copy to .env.local and fill in
├── vercel.json              # SPA routing config
└── package.json
```
