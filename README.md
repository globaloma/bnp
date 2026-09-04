# BNP Fulfillment

Marketing site and partner dashboard for BNP Fulfillment, an Abuja-based
order fulfillment and warehousing service.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui, motion
- Supabase for auth, Postgres, and file storage
- Resend for transactional email (partner application notifications)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values described below
npm run dev
```

Open http://localhost:3000.

## Environment variables

See `.env.example`. You'll need:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, from a Supabase project's Settings → API page
- `RESEND_API_KEY`, from resend.com, for the partner application email
- `APPLICATION_FROM_EMAIL` / `APPLICATION_TO_EMAIL` to control where applications are sent

## Database

Schema lives in `supabase/migrations/`, applied in order. Run each file's SQL
in the Supabase SQL Editor (or via the Supabase CLI) against a fresh project.
It sets up `partners`, `products`, `orders`, `wallet_transactions`, `returns`,
`reward_events`, row-level security so each partner only sees their own data,
a trigger that creates a pending partner profile on signup, and the
`product-images` / `claim-images` storage buckets.

New partners land in `pending` status after signup. Approve one by setting
`status = 'active'` on their row in the `partners` table.

## Project structure

- `src/app/(marketing)` — public site
- `src/app/(auth)` — sign up / sign in
- `src/app/dashboard` — the partner portal, one folder per section
- `src/components/marketing`, `src/components/dashboard`, `src/components/ui`
- `src/lib` — Supabase clients, schemas, shared data access
- `reference/` — the original static HTML this project replaced, kept for content reference

## Deployment

Deployed on Vercel, connected to this repository. Set the environment
variables above in the Vercel project settings; there is no separate build
step beyond the default Next.js one.
