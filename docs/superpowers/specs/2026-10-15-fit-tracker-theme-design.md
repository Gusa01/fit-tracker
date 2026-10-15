# Fit Tracker — Dark Mode, Accent Color & App Icon — Design Spec

Date: 2026-10-15

## 1. Purpose

The app is light-only, with about 230 hard-coded colors spread over 26 files (`'#111'` alone appears 62 times) and no app icon (`app.json` points to an `assets/` folder that doesn't exist). The user wants a dark mode and an accent color, as part of making the app look finished for the portfolio.

This spec adds a light and a dark theme built from shared color tokens, a blue accent, a theme selector, a light visual polish through shared components, and an app icon, splash screen and Android notification icon.

## 2. Decisions taken with the user

| # | Decision |
|---|---|
| Accent | Blue (keeps green/red for trend arrows and amber for the streak meaningful) |
| Mode | Selector in Ajustes: Sistema / Claro / Oscuro, default Sistema |
| Scope | Colors plus a consistent polish through shared components |
| Icon | A simple icon in the accent color (stylized dumbbell), matching splash, monochrome notification icon |

## 3. Tokens

`src/theme/colors.ts` exports two palettes with the same keys. Every screen and component reads colors only from these tokens.

| token | light | dark | used for |
|---|---|---|---|
| `background` | `#F7F8FA` | `#0B0F14` | screen background |
| `surface` | `#FFFFFF` | `#151A21` | cards, sheets, inputs |
| `surfaceMuted` | `#EEF1F5` | `#1E252E` | chips, toggles' track, pressed rows |
| `border` | `#DDE2E8` | `#2A323D` | card and input borders, dividers |
| `text` | `#111827` | `#F3F4F6` | primary text |
| `textMuted` | `#6B7280` | `#9CA3AF` | secondary text |
| `accent` | `#2563EB` | `#3B82F6` | primary buttons, active chips/toggles, links, chart line |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | text on accent |
| `accentMuted` | `#DBEAFE` | `#1E3A5F` | selected-row backgrounds, highlights |
| `success` | `#16A34A` | `#22C55E` | trend up, "completado" |
| `successMuted` | `#F0FDF4` | `#052E1A` | success banners (logged sets, corrections) |
| `danger` | `#DC2626` | `#F87171` | trend down, delete, errors |
| `dangerMuted` | `#FEF2F2` | `#3B1414` | error banners |
| `warning` | `#D97706` | `#F59E0B` | streak, deload/switch banners |
| `warningMuted` | `#FFFBEB` | `#2D2006` | streak card, warning banners |
| `overlay` | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.6)` | modal backdrops |

Every text/background pair used must meet WCAG AA (4.5:1 for body text); a unit test checks the pairs `text`/`background`, `text`/`surface`, `textMuted`/`surface`, `onAccent`/`accent`, `danger`/`surface`, `success`/`surface`, `warning`/`warningMuted` in both palettes, and the palettes are adjusted until it passes.

## 4. Theme selection

- Preference stored in AsyncStorage `fit-tracker:theme-preference`: `'system' | 'light' | 'dark'`, default `'system'`; unreadable → `'system'`.
- `ThemeProvider` (in the root layout) resolves the active scheme from the preference and `useColorScheme()`, and exposes `useTheme(): { colors, scheme, preference, setPreference }`.
- `app.json` `userInterfaceStyle` becomes `"automatic"` so the system scheme reaches the app.
- The expo-router navigation theme (drawer, headers) follows the active palette; the status bar uses light content in dark mode and dark content in light mode.
- Ajustes gets a section "Apariencia" with a three-option control: Sistema / Claro / Oscuro.

## 5. Shared components and polish

New components in `src/components/ui/`, used by every screen in place of ad-hoc styles:

- `Screen`: background color, standard padding.
- `Card`: surface, border, 12 px radius, 16 px padding.
- `Button`: variants `primary` (accent), `secondary` (outlined), `danger`, `ghost`; disabled state at 50% opacity; 48 px minimum height.
- `AppText`: variants `title` (20/700), `heading` (16/700), `body` (15/400), `muted` (13/400, textMuted), `label` (14/600).
- `Chip`: selectable pill for filters and toggles (active = accent fill).
- `Banner`: `success` / `warning` / `danger` / `info` with the muted background and matching text.

Polish rules: one corner radius (12 for cards, 8 for chips and inputs), spacing on a 4-px scale, touch targets ≥ 44 px, consistent screen padding (16). Existing `ThemedText` / `ThemedView` (unused Expo template leftovers) are removed.

Screens migrated: Home (and its cards), Rutinas (list, new, editor, day editor, exercise form, pickers), Sesión (cards, steppers, PR banner), Progreso (list, sparklines, detail, chart), Historial (list, detail, set editor), Ajustes, sign-in/sign-up, drawer content. Charts take their colors from tokens (`accent` line, `textMuted` axes, `border` rules); sparklines keep trend colors.

No hard-coded color literal may remain in `app/` or `src/` outside `src/theme/` (enforced by a test that scans the source).

## 6. App icon, splash and notification icon

- Created as SVG in `assets/source/` and rendered to PNG by a script (`npm run build-icons`, using a node SVG renderer as a dev dependency): `assets/icon.png` (1024²), `assets/adaptive-icon.png` (foreground on transparent, background color `accent`), `assets/splash.png` (icon centered on the light background; dark splash variant via `expo-splash-screen` config), `assets/favicon.png`, and `assets/notification-icon.png` (white silhouette on transparent, 96²).
- Design: a stylized dumbbell in white on the accent blue, rounded square; no text.
- `app.json`: icon, adaptive icon (background `#2563EB`), splash (light/dark backgrounds from the tokens), and the `expo-notifications` plugin configured with `icon: ./assets/notification-icon.png` and `color: #2563EB`.

## 7. Non-goals

- No custom fonts.
- No per-user accent choice (blue only).
- No layout redesign of screens beyond the shared components and spacing rules.
- No animated theme transitions.

## 8. Testing

### Unit
- Contrast: every pair in §3 meets 4.5:1 in both palettes.
- Theme preference storage: default `'system'`, round trip, corrupted value → `'system'`.
- Scheme resolution: `system` follows the device scheme; `light`/`dark` override it.
- No color literals: a test scans `app/` and `src/` (excluding `src/theme/`) for hex and `rgb(a)` literals and fails if any remain.

### Manual (device)
1. With the phone in dark mode and "Sistema", the app is dark; switching to "Claro" in Ajustes turns it light immediately, and the choice survives a restart.
2. Every screen (Inicio, Rutinas, Sesión, Progreso, Historial, Ajustes, login) is readable in both modes: no white boxes in dark mode, no invisible text.
3. Charts and sparklines are readable in both modes.
4. The app icon and splash show the blue dumbbell; the notification icon is a clean white silhouette in the status bar.
