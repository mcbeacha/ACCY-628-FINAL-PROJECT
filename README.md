# Rebel Law Group

Academic **ACCY 628** web application: Rebel Law Group — a fictional law firm contract-to-cash simulation covering engagement management, time & expenses, retainers, invoicing, AR, simulated accounting, and management profitability analytics.

**All data is fictional.** No real client funds, payments, or audited financial results.

## Stack

- Next.js (App Router) + React 19
- Tailwind CSS + daisyUI
- Recharts (management charts)
- Supabase Auth + Postgres + Row Level Security

## Local setup

1. Copy environment variables:

```bash
copy .env.local.example .env.local
```

2. In Supabase → **Project Settings → API**, copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** key (or **publishable** key) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Never** put the `service_role` key in `NEXT_PUBLIC_*` variables or frontend code.

3. Install and run:

```bash
npm install
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Demo Mode (recommended for presentations)

Set in `.env.local`:

```text
NEXT_PUBLIC_DEMO_MODE=true
```

When Demo Mode is on:

- The login/signup screens are skipped.
- The app opens as **Managing Partner** (Margaret Sinclair) by default.
- Use **View App As** in the header to switch among five fictional roles.
- The role preference is stored in browser `localStorage` as `rebel-law-demo-role` (role key only — no passwords).
- **Reset Demo View** returns to Managing Partner.

Demo Mode silently signs in as the matching seeded Supabase user so existing Row Level Security continues to apply. It is a **presentation tool**, not real authentication.

To restore normal email/password login:

```text
NEXT_PUBLIC_DEMO_MODE=false
```

Restart `npm run dev` after changing `.env.local`.

## Demo accounts

Password for all seeded users:

```text
RebelDemo2026!
```

| Role | Email |
|------|--------|
| Managing Partner | partner@rebellaw.demo |
| Attorney | jharper@rebellaw.demo |
| Attorney | achen@rebellaw.demo |
| Paralegal | prose@rebellaw.demo |
| Billing staff | billing@rebellaw.demo |
| Client | nvale@northvale.demo |
| Client | cbrook@harbor.demo |

Public signups receive the **Client** role only.

## Feature areas

1. **Phase 1** — Auth, roles, clients, matters, assignments, tasks, activity, billing readiness  
2. **Phase 2A** — Time, expenses, rates, retainers, trust ledger, unbilled  
3. **Phase 2B** — Invoices, payments, AR, write-downs/write-offs, journal entries, client portal billing  
4. **Phase 2C** — Profitability, utilization, realization, dashboards, reports, data quality, controls  

## Vercel deployment

The app is **ready** for Vercel. Do **not** deploy secrets.

### 1. Connect the repository

1. Push this project to GitHub (if not already).  
2. Sign in at [https://vercel.com](https://vercel.com).  
3. **Add New… → Project** and import the GitHub repository.  
4. Framework preset: **Next.js** (auto-detected).  
5. Root directory: repository root (or the folder that contains `package.json` if monorepo).

### 2. Environment variables in Vercel

In **Project → Settings → Environment Variables**, add for Production (and Preview if desired):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as local Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as local anon/public key |
| `NEXT_PUBLIC_DEMO_MODE` | `true` for presentation (skip login); `false` for normal auth |

Do **not** add `SUPABASE_SERVICE_ROLE_KEY` unless you have a private server-only API route that requires it (this app does **not** use a service role key).

### 3. Deploy

Click **Deploy**. Wait for the build to succeed. Open the production URL Vercel provides.

### 4. Supabase Auth redirect URLs

In Supabase → **Authentication → URL Configuration**:

1. **Site URL**: your Vercel production URL (e.g. `https://your-app.vercel.app`)  
2. **Redirect URLs** allow list:  
   - `https://your-app.vercel.app/**`  
   - `https://your-app.vercel.app/auth/callback`  
   - `http://localhost:3000/**` (for local dev)

If email magic links are used later, they must match these URLs.

### 5. Test production

1. Open the production URL.  
2. Sign in with a demo account.  
3. Confirm dashboard, invoices, and a profitability page load.  
4. Confirm no browser console errors about missing env vars.

### Common issues

- **Blank login / auth errors**: env vars missing on Vercel or wrong project.  
- **Redirect loop**: Site URL / callback URL mismatch in Supabase.  
- **RLS errors**: expected for roles that cannot access certain tables; menus hide those links.

## Profitability formulas (summary)

Displayed with tooltips in the app:

- **Matter revenue** = finalized invoice totals (not drafts/canceled; not raw deposits)  
- **Collected** = payments applied + retainer applied  
- **Direct labor** = approved hours × preserved internal cost rate  
- **Gross profit** = revenue − labor − approved matter expenses  
- **Gross margin** = GP ÷ revenue (or “Not Available” if revenue is 0)  
- **Utilization** = billable hours ÷ (available weekly hours × weeks)  

## Academic notice

All financial and operational results use fictional data created for an academic project.
