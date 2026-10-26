# Development guide

Setup and operational details for Fit Tracker. For an overview of the project, see the [README](../README.md).

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values:

   | Variable | Where to find it |
   | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | Supabase dashboard → your project → Settings → API |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → your project → Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → your project → Settings → API (server/test-only — never prefix with `EXPO_PUBLIC_`, must never ship in the app bundle) |
   | `SUPABASE_PROJECT_REF` | Supabase dashboard → your project → Settings → General |
   | `SUPABASE_DB_PASSWORD` | The database password you set when you created the project (reset it from Settings → Database if you don't have it) |
   | `SUPABASE_ACCESS_TOKEN` | A personal access token from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
   | `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | Only for `npm run seed-demo` (see [Demo account](#demo-account)) |

   `.env.local` is gitignored and must never be committed.

3. **Turn off "Confirm email"**: in the Supabase dashboard, go to **Authentication → Providers → Email** and disable **Confirm email**. This is required for sign-up/sign-in to work as implemented. It is **not** controlled by any file in this repo — the local `supabase/config.toml`'s `enable_confirmations = false` only applies to a local Supabase stack (`supabase start`), and this project targets a hosted project instead, so that setting is inert here. `supabase db push` (see [Migrations](#migrations)) never pushes auth settings, so this must be done manually in the dashboard for every hosted project.

## Linking

Link the local project to your hosted Supabase project so the CLI can push migrations to it. Source `.env.local` into your shell first so the variables are available:

```bash
# from the repo root, with .env.local's variables loaded into your shell
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
```

## Running

- Start the app: `npx expo start`
- Type-check: `npm run typecheck`
- Format: `npm run format` (check only: `npm run format:check`)
- Unit tests (pure logic, no env vars or network needed): `npm run test:unit`
- Integration tests: `npm run test:integration`

  Integration tests are everything under `tests/db/` plus any `*.integration.test.ts` (the split lives in [`jest.config.js`](../jest.config.js)). They create and delete real users and rows, so they need a Supabase to talk to: locally they hit the project referenced in `.env.local`. `npm test` runs both suites.

### CI

Every pull request and every push to `main` runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- **checks**: type-check and unit tests.
- **integration**: boots a throwaway local Supabase stack in Docker (`supabase start`), which applies every migration from scratch, then runs the integration suite against it. CI never touches the hosted project and needs no secrets.

## Migrations

Development and the app target a hosted Supabase project; only CI uses a throwaway local stack. Migrations live in [`supabase/migrations/`](../supabase/migrations) and are applied with:

```bash
npx supabase db push
```

`db push` is **forward-only**: it applies any migration files that haven't been applied yet, but unlike `supabase db reset` it does not wipe and reapply everything from scratch, and it does not roll anything back.

- Never edit an already-applied migration file — create a new one instead:

  ```bash
  npx supabase migration new <name>
  ```

- Then edit the generated file under `supabase/migrations/` and run `npx supabase db push` again.

## Importing the initial routine

Seed a user's starter routines ("Full Body" and "Split 5 días") from the bundled markdown source, [`scripts/data/rutina_gym_top_set_back_off.md`](../scripts/data/rutina_gym_top_set_back_off.md):

```bash
npx tsx scripts/import-routine.ts <your-login-email>
```

- Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see [Setup](#setup)).
- You must sign up for an account in the app first — the script looks up an existing user by email, it doesn't create one.
- It's idempotent by routine name: running it again for a user who already has "Full Body" or "Split 5 días" prints a skip message instead of duplicating.

## Demo account

Create (or reset) a demo user with about 12 weeks of realistic training history — Full Body for 4 weeks, then Split 5 días, with progressive overload, occasional missed sets, a deload week, warmups and time-based core work — so the Progreso charts, trend arrows and records have data to show:

```bash
npm run seed-demo
```

- Reads `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` from `.env.local` (see `.env.example`). Sign in to the app with those to explore it.
- Every run **deletes the demo user and all of its data** and recreates it from scratch. As a safeguard it refuses to run unless the email contains "demo".
- The history is generated by a pure, seeded function ([`scripts/generateDemoHistory.ts`](../scripts/generateDemoHistory.ts)), so it's reproducible and unit-tested; it's dated relative to the current week, and nothing is generated for today, so you can log today's session yourself.

## Scheduled demo reset

`.github/workflows/demo-reset.yml` runs `npm run seed-demo` against the hosted project every **Monday and Thursday at 06:00 UTC** (cron `0 6 * * 1,4`), and on demand from the Actions tab (manual dispatch). Each run deletes and recreates the demo user, so a phone signed in as the demo is signed out and anything a visitor changed is lost.

The reset is also the keep-alive: a free-tier Supabase project pauses after about a week without activity, and two resets a week are real database activity, with margin for one failed run. The trade-off of using one workflow for both: if the schedule stops, both stop together.

The workflow needs four repository secrets. Add them in GitHub → the repo's **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | The hosted project's URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The hosted project's service-role key |
| `DEMO_USER_EMAIL` | The demo email published in the README (must contain "demo") |
| `DEMO_USER_PASSWORD` | The demo password published in the README |

The workflow fails with a clear message if one is missing.

Known limit: GitHub disables scheduled workflows after 60 days without activity in the repository. If that happens, re-enable the workflow from the Actions tab (or push a commit). This is documented, not solved.

## Shared project

The APK and the demo account use the same hosted Supabase project as real users. Row Level Security isolates each user's data, and friends testing the app need real accounts there anyway, so there is no separate showcase project. The consequence: anyone who installs the APK can sign up.

## Building the APK

Android builds run in Expo's cloud with EAS. `eas.json`'s `preview` profile produces an installable APK.

```bash
npx eas-cli login --sso      # once, as the Expo account owner
npx eas-cli init             # once: links the EAS project id into app.json
npx eas-cli build -p android --profile preview
```

The build needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon key is public by design (RLS protects the data), so it can live in the build profile or in EAS environment variables. Never the service-role key.

## Shipping updates

Installed APKs update themselves over the air with EAS Update. Builds from the `preview` profile listen on the `preview` channel, so after merging a change that is JavaScript only:

```bash
npx eas-cli update --channel preview --message "<what changed>"
```

The app downloads the update in the background and applies it on the next launch.

Changes to the native side (a new library with native code, an Expo SDK upgrade, or changes to `app.json` plugins) need a new APK instead. The runtime version uses the `fingerprint` policy, which hashes the native configuration, so an update is never delivered to a build whose native code doesn't match it.
