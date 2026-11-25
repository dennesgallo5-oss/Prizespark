# PrizeSpark — development preview

PrizeSpark is being built as a marketplace where sellers and brands will eventually list products, run auctions, and run promotions. **This repository is only the foundation.** It is a development preview. It does not sell anything, run an auction, give a prize, take a payment, or create a cryptocurrency.

The orange bar on every page says the same thing: simulated data, no real money or prizes.

## What you can do in this preview

- Create an account with an email and a password
- Sign in and sign out
- See your role. Every new account is a **buyer**
- If you are an administrator: see the list of people, change someone’s role, and read the activity log

A person cannot change their own role. The database rejects that, even if someone tampers with the page. An administrator changes roles through the website, and that change is written to the activity log in the same step.

The activity log records sign-ups and role changes. Rows can be added. They cannot be edited or deleted, including by an administrator. Each row stores a fingerprint of the previous row (a hash chain) so a quiet edit can be spotted. The admin page says whether that chain is intact.

## What is not built

These later ideas are **not** in this preview, and the site does not claim they are live or legally approved:

- Seller verification and product listings
- Auctions
- Prize campaigns and brand campaigns
- A Spark (SPK) wallet or any token. A planning note mentions Polygon and a maximum of 10,000,000,000 SPK. That token does not exist here.
- Admin settings for a seller commission
- SparkPool
- A test network token

## What was tested

These checks were run on a local Supabase stack (Postgres, Auth, and the API) and the Next.js production build. All of them passed:

- **17 automated tests, 0 failures.** They cover sign-up, sign-in, a wrong password, and sign-out. They also cover the database rules: a buyer cannot read or edit someone else’s account or change their own role; a seller cannot read the activity log; a non-admin cannot check the hash chain; an admin can change a role and that change is logged; the last administrator cannot be removed; nobody, including the database owner and an admin, can update, delete, or wipe the activity log; a direct insert into the log is rejected; and a row that is altered anyway makes the hash check fail.
- **Lint** (`npm run lint`) passed.
- **Typecheck** (`npm run typecheck`) passed.
- **Production build** (`npm run build`) passed.
- **In the browser**, against the running site: the home page shows the preview notice; the sign-in form accepts the fake administrator; the account page shows the administrator role; the admin page lists the three fake people and says the hash chain is intact; sign-out returns to the home page. The home page was also checked on a narrow phone-sized window. Account and admin pages refuse visitors who are not signed in (the automated route tests check that redirect).

The three route checks are skipped if the website is not already running. Start it, then run `BASE_URL=http://127.0.0.1:3000 npm test` to include them. That is how the passing run above was done.

## How to run it on your computer

You need three free tools:

1. [Node.js](https://nodejs.org) 22 or newer
2. [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine)
3. The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

Then, in this folder:

```bash
npm install
supabase start
npm run env:local
npm run seed
npm run dev
```

Open http://127.0.0.1:3000

`npm run env:local` writes `.env.local` from the local Supabase stack. That file stays on your computer. Do not commit it and do not paste it into a chat.

`npm run seed` creates three **fake** accounts that only work on your computer. The script refuses to run if the database is not on this machine. The password for every fake account is:

`LocalPreview-Only-1`

| Email | Role |
| --- | --- |
| ada.buyer@example.test | Buyer |
| ben.seller@example.test | Seller |
| casey.admin@example.test | Administrator |

Sign in as Casey to open the Admin page. These are not real people.

To run the automated checks yourself, with the local stack already started:

```bash
npm run lint
npm run typecheck
npm run build
BASE_URL=http://127.0.0.1:3000 npm test
```

## How to use a free Supabase project on the internet

Do this only when you want the preview somewhere other than your own computer. Still do not take real money or offer real prizes.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open the SQL editor and run the file `supabase/migrations/20251125120000_foundation.sql`.
3. In Project Settings → API, copy the project URL and the **anon** key.
4. On the computer or host that runs the website, create `.env.local` (or the host’s secret settings) using `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key
5. Turn **on** email confirmation (Authentication → Providers → Email) before anyone other than you creates an account. Local development leaves it off so you can sign in immediately. The site tells the person to confirm their email when that setting is on.
6. Make your own account an administrator. Sign up on the site first, then run this once in the Supabase SQL editor. Change the email to yours.

```sql
do $$
declare
  target uuid;
  target_email text := 'you@example.com';
begin
  select id into target from public.profiles where email = target_email;
  if target is null then
    raise exception 'No account found for %', target_email;
  end if;

  perform set_config('prizespark.allow_role_change', '1', true);
  update public.profiles set role = 'admin' where id = target;
  perform set_config('prizespark.allow_role_change', '0', true);

  perform public.write_audit_event(
    target,
    'role.change',
    'profile',
    target::text,
    jsonb_build_object('role', 'buyer', 'email', target_email),
    jsonb_build_object('role', 'admin', 'email', target_email, 'via', 'sql-editor')
  );
end $$;
```

The **service role** key is a master key. The website pages do not use it. The seed script uses it only for the local stack, and it will not seed a remote project. If a host needs that key later, put it in the host’s secret settings. Never put it in the browser, in git, or on a public page.

The anon key is meant to be public. It is safe only because the database rules (row level security) decide what each person can read. Do not turn row level security off.

`DATABASE_URL` is the direct database password string. It is only needed for the local seed script. Do not publish it.

## Assumptions

- Email and password are the only way to sign in.
- A new account is always a buyer. The first administrator is created by the local seed script, or by the SQL snippet above. There is no “make me an admin” button.
- The seller role does not unlock any tools in this preview.
- Local email confirmation is off. A hosted project should turn it on.
- The activity log keeps rows even if an account is later deleted. The history is not rewritten.
- An administrator cannot remove the last administrator, so the admin page cannot be locked with nobody left who can open it.
- The logo file at `public/brand/prizespark-logo.png` is the mark used by the header, the home page, and the browser icon. The original attachment was not present on disk in this workspace, so this file was drawn to match the supplied artwork (navy background, blue-to-orange bolt, blue and orange ring, white PrizeSpark wordmark). If any pixel should be the master file instead, replace that PNG and the copy at `app/icon.png`. Do not commit a different design on top of it without meaning to.

## Security and compliance — please read

This is not legal advice.

- No lawyer has reviewed prize promotions, sweepstakes, auctions, or tokens. Do not run a real promotion, take real money, or offer a real prize with this preview.
- The Spark token is not implemented. Do not describe it to anyone as a live coin.
- The service role key bypasses normal database rules. Treat it like a password to the whole database.
- Administrators cannot edit or delete the activity log through the app. Database triggers also reject updates and deletes while those triggers are on, including for the database owner. Someone with full access to the Supabase project can still turn triggers off. Limit who has that access. The hash check shows if a row was changed anyway.
- The hash chain is a practical tamper check, not a courtroom-grade audit system.
- Fake seed passwords are for your own computer only. Do not reuse them anywhere else.
- This repository is public. Do not commit `.env.local` or any real key. `.env.example` has placeholders only.
- The site asks search engines not to list the preview. That is a request, not a lock.
- Supabase has basic rate limits. This preview does not add its own.

## How the code is organized

- `app/` — pages (home, sign in, create account, your account, admin)
- `components/` — shared pieces such as the header, footer, and forms
- `server/` — sign-in actions and the admin reads. These run on the server.
- `lib/supabase/` — the connection to Supabase. The browser never receives the service role key.
- `supabase/migrations/` — the database tables, role rules, and activity log
- `scripts/seed.mjs` — fake local accounts
- `tests/` — automated checks for sign-in, database rules, and the public pages
