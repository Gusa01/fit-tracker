# Showcase (README, cleanup, APK, demo reset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repo into a portfolio showcase. That means:
- a behavior-preserving code cleanup;
- a portfolio README with architecture and engineering decisions;
- an MIT license;
- a scheduled demo-reset workflow that also keeps Supabase awake;
- the EAS config for an Android APK.

**Architecture:**
- **Cleanup:** one formatting commit, so whitespace noise is isolated, then three focused cleanup tasks: types and casts, the app layer, and scripts plus tests.
- **Docs:** written last, from the code as it stands.
- **APK build and Release:** blocked on owner steps, and run by the controller after this plan's PR (Task 8).

**Tech Stack:** Expo SDK 57 / React Native 0.86, expo-router (typed routes), TypeScript, Supabase, Jest, GitHub Actions, EAS Build, Prettier.

**Spec:** `docs/design/specs/2026-10-23-fit-tracker-showcase-design.md`

## Global Constraints

- **Workspace:** work in `B:\Gusa\Dev\fit-tracker` on branch `showcase`. Do not switch branches, and do not push.
- **Behavior must not change.** `npm run typecheck` exits 0, `npm run test:unit` passes, and no Spanish UI copy changes.
- **Git history is never rewritten.** No amend of pushed commits, no rebase, no force-push. Keep `Co-Authored-By` trailers; every new commit ends with the trailer for the model that wrote it.
- **The README does not mention AI.**
- **Never format, re-encode or edit `supabase/migrations/**` or `patches/**`.** The migrations are applied to the hosted project.
- **Specs and plans live in `docs/design/`.** Nothing may reference `docs/superpowers/`.
- **Code style:** single quotes, ~120 columns, 2-space indent, LF line endings.
- **Demo credentials, exactly:** email `demo.fittracker@example.com`, password `fittracker123`.
- **Canonical repo:** `Gusa01/gym-tracker` (https://github.com/Gusa01/gym-tracker).
- **Author:** Agustín Castromil. LinkedIn: https://www.linkedin.com/in/agustin-castromil. GitHub: https://github.com/Gusa01.
- **Off limits:** never run integration tests locally, never touch the hosted Supabase project, and never run `eas build`, `eas init` or `gh release`.

## Review Focus

1. **The formatting commit rewrites line endings in an applied migration**, and the hosted `db push` history no longer matches.
   - Pinned by Task 1 Step 4: `git diff --stat main -- supabase/migrations patches` must be empty.
2. **Removing route `as any` casts typechecks locally with generated router types, but CI has no `.expo/types`** (it is gitignored), or the reverse.
   - Pinned by Task 2 Step 4: typecheck runs both with and without `.expo/types/router.d.ts` present.
3. **Moving the routine markdown leaves one reader on the old path**, which breaks `seed-demo` in CI or the importer integration test.
   - Pinned by Task 4 Step 3: a grep for the old root path must be empty, and the parse unit test must pass.
4. **The demo-reset workflow runs with a missing secret and still reports success**, so the keep-alive silently stops.
   - Pinned by Task 6 Step 1: an explicit check step fails the job, naming the missing secret.
5. **The README's demo credentials or links drift from reality.**
   - Pinned by Task 5 Step 3: a link and credential check against the Global Constraints values.

---

## File Structure

| File | Responsibility |
|---|---|
| `.prettierrc`, `.prettierignore`, `.gitattributes` | Formatting and line-ending rules |
| `app/**`, `src/**` | Cleanup only (Tasks 2–3) |
| `scripts/**`, `tests/**` | Cleanup (Task 4) |
| `scripts/data/rutina_gym_top_set_back_off.md` (moved) | Starter routine, read by the importer and the demo seed |
| `LICENSE` (create) | MIT |
| `docs/development.md` (create) | Long setup and operations docs, moved out of the README |
| `README.md` (rewrite) | Portfolio README |
| `.github/workflows/demo-reset.yml` (create) | Demo reset twice a week, doubling as keep-alive |
| `eas.json` (create), `app.json` | APK build config |

---

### Task 1: Formatting baseline

**Files:** create `.prettierrc` and `.prettierignore`; modify `.gitattributes` and `package.json`; mechanically reformat `app/`, `src/`, `scripts/` and `tests/`.

- [ ] **Step 1: Add Prettier**
  - Install: `npm i -D prettier` (latest 3.x).
  - `.prettierrc`: `{ "singleQuote": true, "printWidth": 120, "trailingComma": "es5", "semi": true, "tabWidth": 2, "endOfLine": "lf" }`.
  - `.prettierignore`: `node_modules`, `supabase/migrations`, `patches`, `package-lock.json`, `.expo`, `assets`, `docs`.
  - Add the scripts `"format": "prettier --write app src scripts tests"` and `"format:check": "prettier --check app src scripts tests"`.
- [ ] **Step 2: Line endings.** `.gitattributes` becomes:
  ```
  * text=auto eol=lf
  supabase/migrations/** -text
  patches/*.patch text eol=lf
  *.png binary
  *.gif binary
  ```
- [ ] **Step 3: Apply.** Run `npm run format`, then `git add --renormalize .`.
- [ ] **Step 4: Verify.**
  - `git diff --cached --stat main -- supabase/migrations patches` prints nothing.
  - `npm run typecheck` exits 0.
  - `npm run test:unit` passes.
  - `npx patch-package` prints `react-native-draggable-flatlist@4.0.3 ✔`.
  - `npm run format:check` exits 0.
- [ ] **Step 5: Commit.**
  ```bash
  git add -A
  git commit -m "style: add Prettier and normalize formatting and line endings"
  ```
  The commit must contain only formatting changes and the five config edits; no logic changes.

### Task 2: Types and casts

**Files:**
- `src/lib/history/queries.ts`, `src/lib/progression/queries.ts`, `src/lib/routines/queries.ts`, `src/lib/sessions/queries.ts`.
- Every file with a route `as any`: `app/**`, plus `src/components/HomeProgressCard.tsx`.
- Any other `as any` or `@ts-ignore` that `git grep -n "as any\|@ts-ignore\|@ts-expect-error" -- app src` shows.

**Interfaces:**
- Produces: a local `interface <Thing>Row` per query file, describing the raw Supabase row shape, used instead of `(data as any[])`. No exported API changes.

- [ ] **Step 1: Query row types.** In each query file:
  - Declare the raw row shape that the `.select(...)` string returns, as a local interface.
  - Type the mapping callback with it (`(data ?? []) as SessionRow[]`).
  - Remove the `as any`.
  - Joined relations Supabase returns as an object or array are typed as they come back.
- [ ] **Step 2: Typed routes.**
  - Regenerate the router types by running `npx expo start` until `.expo/types/router.d.ts` is rewritten (it then contains `/(app)/(tabs)`), then stop it.
  - Remove each route-string `as any`.
  - If a route still fails to typecheck, use the expo-router `Href` form with `pathname` and `params`, e.g. `router.push({ pathname: '/(app)/(tabs)/history/[sessionId]', params: { sessionId: item.id } })`.
  - A cast that truly must stay gets a one-line `// why` comment.
- [ ] **Step 3: Remaining casts.** For each remaining `as any` or `@ts-ignore` in `app/` and `src/`, either replace it with a real type or keep it with a one-line reason.
- [ ] **Step 4: Verify.**
  - `npm run typecheck` exits 0.
  - Then temporarily rename `.expo/types/router.d.ts`, run `npm run typecheck` again (it must exit 0, which is what CI sees), and restore the file.
  - `npm run test:unit` passes.
  - `git grep -c "as any" -- app src` reports only the casts that carry a reason.
- [ ] **Step 5: Commit**: `refactor: type Supabase rows and routes instead of casting to any`.

### Task 3: App-layer cleanup

**Files:**
- Modify: `app/**` and `src/**`, excluding `src/lib/**/queries.ts`, which belongs to Task 2.
- Create: `src/components/ChipRow.tsx`.

**Interfaces:**
- Consumes: `Chip` from `src/components/ui`.
- Produces: `ChipRow<T extends string>({ label?: string, options: readonly T[], labelFor: (value: T) => string, selected: T | null, onSelect: (value: T | null) => void, allLabel?: string })`.
  - It renders an optional label and a wrapping row of `Chip`s.
  - When `allLabel` is given, it renders a leading "all" chip that selects `null`.
  - Tapping the selected chip calls `onSelect(null)` only when `allLabel` is given; otherwise selection is required.

- [ ] **Step 1: Deduplicate the chip rows.**
  - Replace the muscle and equipment chip rows in `ExercisePicker.tsx` (filter mode, with "Todos…" chips) and `ExerciseForm.tsx` (required selection) with `ChipRow`.
  - The labels and copy stay identical.
- [ ] **Step 2: Sweep the rest of `app/` and `src/`**, applying spec §5:
  - delete comments that narrate what the code does, and keep the ones that explain why;
  - delete checks that can't fail;
  - inline one-use wrappers that add nothing;
  - remove unused params, imports, styles and exports. Known: `makeStyles(_c)` that ignores colors (drop the parameter and the `useMemo`, and use a module-level `StyleSheet`), the no-op `gap: 0` in `history/index.tsx`, and stray double blank lines;
  - rename only names that disagree with what the thing does.

  Do not change behavior, layouts, copy or the public signatures used by tests.
- [ ] **Step 3: Verify.** `npm run typecheck` exits 0, `npm run test:unit` passes, `npm run format:check` exits 0, and `git grep -n "_c)" -- app src` is empty.
- [ ] **Step 4: Commit**: `refactor: share the chip row and remove dead code and narrating comments`.

### Task 4: Scripts and tests cleanup, routine file move

**Files:**
- Move: `rutina_gym_top_set_back_off.md` → `scripts/data/rutina_gym_top_set_back_off.md`, with `git mv`.
- Modify: `scripts/import-routine.ts`, `scripts/seed-demo-user.ts`, `scripts/parseRoutineMarkdown.test.ts` and `tests/scripts/import-routine.integration.test.ts`, which read that path, plus a §5 sweep of `scripts/` and `tests/`.

- [ ] **Step 1:** Run `git mv`, then update the four readers. Scripts use `path.join(__dirname, 'data', 'rutina_gym_top_set_back_off.md')`; tests use the equivalent path relative to their own location.
- [ ] **Step 2:** Run the §5 sweep over `scripts/` and `tests/`: narrating comments, dead code, duplicated setup that an existing helper already covers. Test names and assertions stay.
- [ ] **Step 3: Verify.**
  - `git grep -n "'..', 'rutina_gym\|\.\./\.\./rutina_gym\|^rutina_gym" -- scripts tests` is empty.
  - `npx jest scripts/parseRoutineMarkdown.test.ts` passes.
  - `npm run typecheck` exits 0, `npm run test:unit` passes, and `npm run format:check` exits 0.
- [ ] **Step 4: Commit**: `refactor: move the starter routine under scripts/data and tidy scripts and tests`.

### Task 5: LICENSE, development docs and README

**Files:** create `LICENSE` and `docs/development.md`; rewrite `README.md`.

- [ ] **Step 1: `LICENSE`.** Standard MIT text, `Copyright (c) 2026 Agustín Castromil`.
- [ ] **Step 2: `docs/development.md`.**
  - Move today's README sections, keeping the content but updating paths: Setup (the env table and the "Confirm email" note), Linking, Running, CI, Migrations, Importing the initial routine (new path), Demo account.
  - Add a "Scheduled demo reset" section:
    - what `demo-reset.yml` does and when (Monday and Thursday, 06:00 UTC);
    - that it also keeps the free-tier project from pausing;
    - the four repository secrets (`EXPO_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`) and where to add them;
    - that GitHub disables scheduled workflows after 60 days without repo activity.
  - Add a "Shared project" note: the APK and the demo use the same hosted project as real users. RLS isolates users, and anyone with the APK can sign up.
  - Add "Building the APK": `npx eas-cli login --sso` (owner), `npx eas-cli init`, then `npx eas-cli build -p android --profile preview`.
- [ ] **Step 3: `README.md`.** Write it from the code as it stands, following spec §4's sections in order.
  - **Facts:**
    - Mermaid layer diagram: `app/` screens → `src/hooks` → `src/lib/<domain>` (pure logic) → Supabase (Postgres + RLS) and SQLite (cache + offline write queue).
    - Folder tree with one-line notes.
    - 7–9 Engineering decisions (problem → decision → trade-off), each verified against the code and linking to the relevant file.
    - Demo credentials exactly as in Global Constraints, with "resets every Monday and Thursday".
  - **Placeholders:** two clearly marked HTML comments, `<!-- GIF: docs/media/demo.gif -->` and `<!-- APK: link to the latest GitHub Release -->`. No broken images or links.
  - Plain, specific tone with no emoji walls, and no mention of AI.
  - "En español": one paragraph.
  - Author and license from Global Constraints.
  - Link to `docs/development.md` for setup.
  - Check every relative link resolves: `git ls-files` contains each linked path.
- [ ] **Step 4: Verify.**
  - `git grep -n "docs/superpowers\|Claude\|AI\b\|artificial" -- README.md docs/development.md LICENSE` prints nothing.
  - Every relative link target exists.
  - `npm run test:unit` still passes.
- [ ] **Step 5: Commit**: `docs: portfolio README, development guide and MIT license`.

### Task 6: Demo-reset workflow

**Files:** create `.github/workflows/demo-reset.yml`.

- [ ] **Step 1: Write the workflow.**
  - Name: `Demo reset`.
  - Triggers: `on: schedule: - cron: '0 6 * * 1,4'` and `workflow_dispatch`.
  - One job on `ubuntu-latest`, with `concurrency: demo-reset` and `permissions: contents: read`.
  - Steps:
    1. Checkout (`actions/checkout@v4`).
    2. `actions/setup-node@v4` with Node 24 and the npm cache.
    3. A **check step** that, for each of the four secrets passed as env, fails with `::error::Missing secret <NAME>` and `exit 1` when it is empty.
    4. `npm ci`.
    5. `npm run seed-demo`, with the four secrets as env.
  - Pass the secrets only through `env:`, never on the command line.
- [ ] **Step 2: Verify.**
  - Run `npx --yes @action-validator/cli .github/workflows/demo-reset.yml`, or, if that is unavailable, parse it with `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/demo-reset.yml','utf8'))"` (install nothing new: use `npx --yes yaml` only if needed).
  - Also confirm by reading `scripts/seed-demo-user.ts` that it reads exactly these four env names.
- [ ] **Step 3: Commit**: `ci: reset the demo account twice a week, keeping the Supabase project awake`.

### Task 7: EAS build configuration

**Files:** create `eas.json`; modify `app.json` if needed.

- [ ] **Step 1: `eas.json`:**
  ```json
  {
    "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
    "build": {
      "preview": { "distribution": "internal", "android": { "buildType": "apk" }, "env": { "EXPO_PUBLIC_SUPABASE_URL": "<from .env.local>", "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<from .env.local>" } },
      "production": { "autoIncrement": true, "android": { "buildType": "app-bundle" }, "env": { "EXPO_PUBLIC_SUPABASE_URL": "<same>", "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<same>" } }
    }
  }
  ```
  - Copy the two values from `.env.local`. Both are public by design: RLS protects the data.
  - Never copy `SUPABASE_SERVICE_ROLE_KEY` or any other variable.
  - The app's display name stays the same; `expo.version` stays `1.0.0`.
- [ ] **Step 2: Verify.**
  - `npx expo config --type public` exits 0.
  - `node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8'))"` exits 0.
  - `git grep -n "service_role\|SERVICE_ROLE" -- eas.json app.json` is empty.
- [ ] **Step 3: Commit**: `build: EAS profiles for an installable Android APK`.

### Task 8: Owner steps, APK, Release and GIF (controller, after the PR merges)

This task runs in a second PR and is not dispatched to a subagent.

1. The owner runs `npx eas-cli@latest login --sso`. The controller verifies with `npx eas-cli whoami`.
2. Run `npx eas-cli init` (it writes `extra.eas.projectId` into `app.json`) and commit it.
3. Run `npx eas-cli build -p android --profile preview`, wait for it, and download the APK.
4. The owner installs the APK and smoke-tests it: demo sign-in, log a set, a test reminder arrives, the notification icon shows.
5. **With the owner's confirmation**, run `gh release create v1.0.0 <apk> --title "Fit Tracker 1.0.0"`. The notes cover what the app is, how to install a sideloaded APK, and the demo credentials.
6. The owner adds the four GitHub secrets. Then run `gh workflow run demo-reset.yml` and check it succeeds.
7. The owner sends a 20–30 s screen recording. **With the owner's confirmation**, install ffmpeg and convert it: `ffmpeg -i in.mp4 -vf "fps=12,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" docs/media/demo.gif`, which should come out under about 5 MB.
8. Replace the two README placeholders with the GIF and `https://github.com/Gusa01/gym-tracker/releases/latest`, then open the PR.
