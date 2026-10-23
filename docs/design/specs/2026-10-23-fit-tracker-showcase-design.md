# Fit Tracker — Showcase (README, APK, keep-alive, code cleanup) — Design Spec

Date: 2026-10-23

## 1. Intent

Fit Tracker is the owner's portfolio piece for junior developer jobs, and an app they use at the gym. This
sub-project turns the repo into a showcase. A technical reader arrives from the owner's CV or LinkedIn; in the
first minute they should come away with this: **the owner writes clean, well-structured code, knows
architecture patterns and good practices, and makes decisions with clear reasons.** Features come second. The
GIF and the APK are proof that it works, not the main point.

The owner's story, which the README opens with:
- They logged their routines in a spreadsheet. Using a spreadsheet on the phone at the gym was a pain, and they
  lost track of their progression (what they lifted last time, when to go up).
- So they started an app to solve their own problem, with the plan to keep improving it: first friends use it and
  give feedback, and eventually it could become a sellable product.

The tone is product, not coursework: *built to solve my own problem, designed to grow into a product.*

## 2. Goals

1. **Portfolio README** (rewritten), in English with a short Spanish paragraph.
2. **Code cleanup pass** over `app/`, `src/`, `scripts/` and `tests/`, so the code reads like a careful senior
   wrote it (§5).
3. **Android APK** built with EAS and published as a GitHub Release, downloadable from the README.
4. **Keep the hosted Supabase project awake, and reset the demo account on a schedule** with GitHub Actions.
5. **MIT license.**
6. **A GIF** of the app for the README, made from a screen recording the owner provides.

## 3. Non-goals and anti-goals

- No iOS build, no Play Store listing, no web deploy.
- No separate Supabase project for the showcase. The owner decided the APK and the demo account use the same
  hosted project as their own data, because RLS already isolates users and friends will need real accounts there
  anyway. Anyone who installs the APK can sign up. `docs/development.md` notes this trade-off.
- No new app features. Cleanup is behavior-preserving.
- **The README does not mention AI.** The owner's decision: they don't want to hide it, and they don't want to
  feature it either.
- **Git history stays as it is**, including the `Co-Authored-By` trailers. Never rewrite or force-push history.
- The cleanup is about code quality, not about disguising authorship. Fix only what a demanding human reviewer
  would flag on its own merits.
- Anti-goal: a README that reads like generated marketing, with walls of emoji, badges for everything, or
  superlatives. Plain, confident and specific.

## 4. README

Sections, in order:

1. **Title and one-line pitch.** Below them: the GIF; a "Download the APK" link to the latest Release; the demo
   credentials (email `demo.fittracker@example.com`, password `fittracker123`), with a note that the demo resets
   twice a week; and the existing CI badge. The canonical repo is `Gusa01/gym-tracker` (the local `origin` still points at the old
   `fit-tracker` name through a redirect; update it). All links use the canonical name.
2. **Why I built it.** The story from §1, in the owner's voice, short.
3. **What it does.** About 6–8 bullets:
   - today's workout and logging between sets, offline;
   - progression suggestions (top set / back-off, double progression, deload);
   - progress charts and live PRs;
   - session history with set corrections;
   - reminders and the weekly streak;
   - an exercise catalog with synonyms;
   - dark mode;
   - drag to reorder.
4. **Architecture.** A Mermaid diagram (GitHub renders it) of the layers: screens (expo-router) → hooks → pure
   domain logic (`src/lib/**`) → data, which is Supabase (Postgres + RLS) plus local SQLite with the offline
   write queue. Then a short annotated folder tree (`app/`, `src/components`, `src/hooks`, `src/lib/<domain>`,
   `src/theme`, `supabase/migrations`, `scripts`, `tests`).
5. **Engineering decisions.** The centerpiece. 7–9 entries, each 2–4 sentences, as problem → decision →
   trade-off accepted. Candidates (the builder picks the strongest and checks each against the code):
   - domain logic as pure functions, unit-tested without a device;
   - offline-first: SQLite cache plus a serialized write queue with upserts;
   - security in the database: RLS, `security_invoker` views, service-only functions;
   - the catalog merge that kept every user's history;
   - progression rules (top set / back-off, deload) as data plus pure functions;
   - reminders pre-planned 14 days ahead, because local notifications can't run code when they fire;
   - design tokens, with a contrast test and a no-color-literals test;
   - graceful degradation when a native module is missing (Expo Go);
   - integration tests on a throwaway Postgres in CI.

   The source of truth is the code and the specs in `docs/design/`. The owner's Spanish study doc covers the same
   material but isn't needed.
6. **Testing and CI.** Unit tests (pure logic) versus integration tests (real Postgres, RLS), and what CI runs on
   every PR.
7. **Tech stack.** One line each: Expo SDK 57 / React Native, TypeScript, expo-router, Supabase, expo-sqlite,
   react-native-gifted-charts, Jest.
8. **Running locally.** A condensed version of today's setup section. The long operational details (linking,
   migrations, importing a routine, the demo account) move to `docs/development.md` and the README links to it.
9. **Roadmap.** Short: testing with friends, then iOS, then sharing routines, then what would make it sellable.
   Builder's wording; keep it honest and small.
10. **En español.** One paragraph: what the app is, why it was built, and that the README and the code are in
    English.
11. **Author.** Agustín Castromil, with links to LinkedIn (https://www.linkedin.com/in/agustin-castromil) and
    GitHub (https://github.com/Gusa01). **License:** MIT, linking to
    `LICENSE`.

Screenshots: one row of 3–4 screenshots, light and dark, provided by the owner, is welcome if they send them.
Leave the slots out if not.

## 5. Code cleanup pass

Scope: `app/`, `src/`, `scripts/`, `tests/`. Behavior must not change. Typecheck, unit tests and CI integration
tests stay green.

Look for, and fix where it improves the code:
- Comments that narrate what the code does. Keep comments that explain *why*, a constraint, or a gotcha. Remove
  section-banner comments and comments restating a name.
- Defensive checks that can't fail, impossible fallbacks, try/catch blocks that only re-throw or log the same
  thing.
- Over-abstraction: one-use helpers or wrappers that add nothing, options nobody passes.
- Generic or over-long names; names that disagree with what the thing does.
- Duplicated blocks. Known example: the muscle/equipment chip rows in `ExercisePicker` and `ExerciseForm`.
- `as any` casts. Most are route strings; regenerate typed routes (`expo-router` typed routes) and remove the
  casts that then typecheck. A cast that must stay gets a one-line reason.
- Unused parameters, imports, styles and exports. Known examples: `makeStyles(_c)` that ignores colors, a stray
  `gap: 0`, double blank lines.
- Inconsistent formatting. There is no Prettier config, and the code is mostly single quotes and ~120 columns.
  Add a `.prettierrc` matching the dominant style and format the repo in **one** commit, so the formatting diff is
  separate from the logic changes.
- Inconsistent line endings (the repo mixes CRLF and LF). Normalize with `.gitattributes` (`* text=auto eol=lf`)
  in the same formatting commit.
- **Excluded from formatting and line-ending rewrites:** `supabase/migrations/**` (already applied to the hosted
  project, so they stay byte-identical) and `patches/**` (kept LF on purpose so patch-package applies).
  *(Builder's call.)*
- `rutina_gym_top_set_back_off.md` at the repo root (the routine the importer and the demo seed read) moves to
  `scripts/data/`, with its two readers updated, so the root stays clean. *(Builder's call.)*

- **Rename `docs/design/` to `docs/design/`** (specs and plans keep their content and history via `git mv`;
  fix any links to them). The owner's decision: the folder name says nothing to a reader.

Out of scope: architecture changes, renaming public modules for taste, rewriting tests that pass and read fine.

## 6. Android APK and Release

- `eas.json` with a `preview` profile that builds an installable **APK** (`android.buildType: "apk"`), plus a
  `production` profile for later.
- Build-time env: the app needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon key is
  public by design (RLS protects the data), so it may live in `eas.json` `env` or EAS environment variables.
  **Never** the service-role key.
- Version 1.0.0. The `versionCode` is managed by EAS (`cli.appVersionSource: "remote"`, `autoIncrement` on
  `production`), so it doesn't need to be bumped by hand. *(Builder's call.)*
- **Blocked on the owner:** they must create an Expo account (expo.dev) and run `npx eas login` themselves. Then
  the builder runs `npx eas init` (links the project id into `app.json`) and `npx eas build -p android --profile
  preview`, which runs in Expo's cloud.
- Release: `gh release create v1.0.0` with the APK attached and short notes (what it is, how to install a
  sideloaded APK, the demo credentials). Publishing is outward-facing: **confirm with the owner before creating the
  release.**
- Check on a device before releasing: reminders work in the APK (they don't in Expo Go), and the notification
  icon shows.

## 7. Keep-alive and demo reset (GitHub Actions)

- The free-tier Supabase project pauses after about a week without activity. A scheduled workflow
  (`.github/workflows/demo-reset.yml`) runs `npm run seed-demo` **twice a week** (Monday and Thursday) and on
  manual dispatch. The reset itself is real database activity, so it doubles as the keep-alive, with margin for
  one failed run. *(Builder's call: one workflow instead of a separate ping. Cost: if a scheduled run silently
  stops, both stop together.)*
- Secrets the **owner** adds in GitHub → Settings → Secrets → Actions: `EXPO_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`. The workflow fails with a clear message if
  one is missing. The README's setup docs list them.
- The script already refuses to run unless the email contains "demo", which is the safeguard against wiping a real
  user.
- The reset deletes and recreates the demo user, so a phone signed in as the demo gets signed out and anything a
  visitor changed is lost. That's acceptable; the README says when it resets (Monday and Thursday). The secrets use
  the same email and password as the README. *(Builder's call.)*
- Known limit: GitHub disables scheduled workflows after 60 days without repo activity. Documented in
  `docs/development.md`, not solved.

## 8. GIF

- The owner records a short screen capture on the phone (about 20–30 s): Home → start the workout → log a set
  (PR banner) → Progreso chart → toggle dark mode.
- The builder converts it with ffmpeg to an optimized GIF, about 320 px wide and ideally under 5 MB, saved as
  `docs/media/demo.gif`. Installing ffmpeg is a download: **ask the owner first.**
- Until the recording exists, the README keeps a clearly marked placeholder comment, never a broken image.

## 9. Order of work

1. Code cleanup (the formatting commit first, then the logic cleanups).
2. LICENSE, `docs/development.md`, README, without the GIF and APK link yet.
3. Demo-reset workflow.
4. `eas.json` and app config for the build.
5. Owner steps: Expo account + `eas login`, add the GitHub secrets, record the video.
6. APK build → device check → Release (with confirmation) → GIF → final README links.

One PR for steps 1–4. A small follow-up PR adds the GIF and the Release link.

## 10. Testing

- Typecheck, unit tests and CI integration tests green after the cleanup, with no snapshot or behavior changes.
- `demo-reset.yml` is verified with a manual `workflow_dispatch` run after the owner adds the secrets.
- The APK is installed on the owner's phone and smoke-tested (sign in with the demo account, log a set, a reminder
  arrives) before the Release.
- README: links resolve, the Mermaid diagram renders on GitHub, and the demo credentials work.
