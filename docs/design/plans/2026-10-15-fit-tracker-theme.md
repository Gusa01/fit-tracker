# Theme, Dark Mode, App Icon & Bottom Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A light and a dark theme from shared color tokens with a blue accent and a Sistema/Claro/Oscuro selector, shared UI components applied across every screen, an app icon/splash/notification icon, and a bottom tab bar replacing the side drawer.

**Architecture:** `src/theme/` holds two palettes with identical keys, a contrast checker, the stored preference and a `ThemeProvider`/`useTheme` resolving the active scheme. Screens build their styles from `useTheme().colors` (a `makeStyles(colors)` function per file) and shared components in `src/components/ui/`. Navigation moves to an expo-router `Stack` holding a `(tabs)` group plus the full-screen session. A source scan test forbids color literals outside `src/theme/`.

**Tech Stack:** Expo SDK 57 / React Native 0.86, expo-router (Tabs + Stack), @react-navigation/native theme, @expo/vector-icons (Ionicons), AsyncStorage, @resvg/resvg-js (dev, icon rendering), Jest + ts-jest.

**Spec:** `docs/design/specs/2026-10-15-fit-tracker-theme-design.md`

**Depends on:** the exercise-catalog branch (it adds `ExerciseThumbnail`, the credits screen and changes the picker); this branch starts from it.

## Global Constraints

- Work in `B:\Gusa\Dev\fit-tracker` on branch `theme` (created from `exercise-catalog`). Do not switch branches or push.
- Token names and values exactly as spec §3 (light / dark): background `#F7F8FA`/`#0B0F14`, surface `#FFFFFF`/`#151A21`, surfaceMuted `#EEF1F5`/`#1E252E`, border `#DDE2E8`/`#2A323D`, text `#111827`/`#F3F4F6`, textMuted `#6B7280`/`#9CA3AF`, accent `#2563EB`/`#3B82F6`, onAccent `#FFFFFF`/`#FFFFFF`, accentMuted `#DBEAFE`/`#1E3A5F`, success `#16A34A`/`#22C55E`, successMuted `#F0FDF4`/`#052E1A`, danger `#DC2626`/`#F87171`, dangerMuted `#FEF2F2`/`#3B1414`, warning `#D97706`/`#F59E0B`, warningMuted `#FFFBEB`/`#2D2006`, overlay `rgba(0,0,0,0.3)`/`rgba(0,0,0,0.6)`. If the contrast test fails, adjust the failing value minimally and record it.
- Theme preference key `fit-tracker:theme-preference`, values `'system' | 'light' | 'dark'`, default `'system'`.
- Tabs in order: Inicio (`home`), Rutinas (`list`), Progreso (`trending-up`), Historial (`time`), Ajustes (`settings`); Ionicons, outline inactive / filled active, label under the icon; active `accent`, inactive `textMuted`.
- Radii: 12 cards, 8 chips/inputs; spacing on a 4-px scale; touch targets ≥ 44 px; screen padding 16.
- No color literal (hex or `rgb(a)(`) in `app/` or `src/` outside `src/theme/`.
- All user-facing copy is Spanish, exactly as written here.
- Every commit message ends with a `Co-Authored-By:` trailer naming the model that wrote it.
- Verification: `npm run typecheck`, `npm run test:unit`, `npx jest <path>`. Never touch the hosted Supabase.

## Review Focus

1. A screen that builds a `StyleSheet` at module scope with token colors → stays light after switching to dark: pinned by the "no module-scope token styles" rule in Task 4's checklist and the literal scan (Task 9) — every themed file uses `makeStyles(colors)` inside the component.
2. Corrupted theme preference in storage → falls back to "Sistema", no crash: pinned in Task 1.
3. Opening a session from a push notification or Home while the tabs keep state → the session screen shows full screen, and finishing returns to Inicio: pinned by Task 3's route checks and the device checklist.
4. Charts in dark mode drawing axes/labels in black → unreadable: pinned by passing token colors into ProgressChart/Sparkline in Task 7 (and the literal scan).
5. A modal backdrop or sheet hard-coded white → white box in dark mode: pinned by the literal scan (Task 9).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/theme/colors.ts` (create) | `lightColors`, `darkColors`, `ColorTokens` |
| `src/theme/contrast.ts` (create) | WCAG contrast ratio |
| `src/theme/preference.ts` (create) | stored preference + `resolveScheme` |
| `src/theme/ThemeProvider.tsx` (create) | context, `useTheme`, navigation theme, status bar |
| `src/components/ui/*.tsx` (create) | Screen, Card, Button, AppText, Chip, Banner |
| `app/(app)/(tabs)/...` (move + create) | tab layout and the five sections |
| `app/(app)/_layout.tsx` (rewrite) | Stack: `(tabs)` + `session` |
| every file in the color list (modify) | tokens via `makeStyles(colors)` |
| `assets/source/*.svg`, `scripts/build-icons.ts`, `assets/*.png` (create) | icons |
| `tests/theme/*.test.ts`, `tests/theme/no-color-literals.test.ts` (create) | tests |

---

### Task 1: Tokens, contrast and preference (pure)

**Files:**
- Create: `src/theme/colors.ts`, `src/theme/contrast.ts`, `src/theme/preference.ts`
- Test: `tests/theme/colors.test.ts`, `tests/theme/preference.test.ts`

**Interfaces:**
- Produces: `type ColorTokens = { background; surface; surfaceMuted; border; text; textMuted; accent; onAccent; accentMuted; success; successMuted; danger; dangerMuted; warning; warningMuted; overlay: string }`; `lightColors`, `darkColors: ColorTokens`; `contrastRatio(fg: string, bg: string): number` (hex only); `type ThemePreference = 'system' | 'light' | 'dark'`; `loadThemePreference(): Promise<ThemePreference>`; `saveThemePreference(p): Promise<void>`; `resolveScheme(preference: ThemePreference, system: 'light' | 'dark' | null | undefined): 'light' | 'dark'`.

- [ ] **Step 1: Write the failing tests**

`tests/theme/colors.test.ts`:

```typescript
import { lightColors, darkColors } from '../../src/theme/colors';
import { contrastRatio } from '../../src/theme/contrast';

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});

describe('palettes', () => {
  it('have identical keys', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  const pairs: Array<[keyof typeof lightColors, keyof typeof lightColors]> = [
    ['text', 'background'],
    ['text', 'surface'],
    ['textMuted', 'surface'],
    ['textMuted', 'background'],
    ['onAccent', 'accent'],
    ['danger', 'surface'],
    ['success', 'surface'],
    ['warning', 'warningMuted'],
    ['text', 'surfaceMuted'],
    ['text', 'accentMuted'],
  ];

  for (const [name, palette] of [['light', lightColors], ['dark', darkColors]] as const) {
    it(`meet WCAG AA (4.5:1) in ${name} mode`, () => {
      for (const [fg, bg] of pairs) {
        const ratio = contrastRatio(palette[fg], palette[bg]);
        expect({ pair: `${fg} on ${bg}`, ok: ratio >= 4.5, ratio: Math.round(ratio * 100) / 100 }).toMatchObject({ ok: true });
      }
    });
  }
});
```

`tests/theme/preference.test.ts`:

```typescript
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadThemePreference, saveThemePreference, resolveScheme } from '../../src/theme/preference';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('theme preference', () => {
  it('defaults to system, round-trips, and falls back on garbage', async () => {
    expect(await loadThemePreference()).toBe('system');
    await saveThemePreference('dark');
    expect(await loadThemePreference()).toBe('dark');
    await AsyncStorage.setItem('fit-tracker:theme-preference', 'purple');
    expect(await loadThemePreference()).toBe('system');
  });
});

describe('resolveScheme', () => {
  it('follows the device for system and overrides otherwise', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest tests/theme`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/theme/colors.ts`:

```typescript
export interface ColorTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentMuted: string;
  success: string;
  successMuted: string;
  danger: string;
  dangerMuted: string;
  warning: string;
  warningMuted: string;
  overlay: string;
}

export const lightColors: ColorTokens = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F5',
  border: '#DDE2E8',
  text: '#111827',
  textMuted: '#6B7280',
  accent: '#2563EB',
  onAccent: '#FFFFFF',
  accentMuted: '#DBEAFE',
  success: '#16A34A',
  successMuted: '#F0FDF4',
  danger: '#DC2626',
  dangerMuted: '#FEF2F2',
  warning: '#D97706',
  warningMuted: '#FFFBEB',
  overlay: 'rgba(0,0,0,0.3)',
};

export const darkColors: ColorTokens = {
  background: '#0B0F14',
  surface: '#151A21',
  surfaceMuted: '#1E252E',
  border: '#2A323D',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  accent: '#3B82F6',
  onAccent: '#FFFFFF',
  accentMuted: '#1E3A5F',
  success: '#22C55E',
  successMuted: '#052E1A',
  danger: '#F87171',
  dangerMuted: '#3B1414',
  warning: '#F59E0B',
  warningMuted: '#2D2006',
  overlay: 'rgba(0,0,0,0.6)',
};
```

`src/theme/contrast.ts`:

```typescript
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two #RRGGBB colors. */
export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
```

`src/theme/preference.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'fit-tracker:theme-preference';

export async function loadThemePreference(): Promise<ThemePreference> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEY, preference);
}

export function resolveScheme(preference: ThemePreference, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}
```

- [ ] **Step 4: Run them; if a contrast pair fails, adjust that token minimally**

Run: `npx jest tests/theme`
Expected: PASS. Any token you change: update both `colors.ts` and record old → new value and the ratio in the report.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck`; `npm run test:unit`

```bash
git add src/theme tests/theme
git commit -m "feat: light and dark color tokens with contrast checks and a stored theme preference"
```

---

### Task 2: ThemeProvider, shared UI components, Apariencia setting

**Files:**
- Create: `src/theme/ThemeProvider.tsx`, `src/components/ui/Screen.tsx`, `Card.tsx`, `Button.tsx`, `AppText.tsx`, `Chip.tsx`, `Banner.tsx`, `src/components/ui/index.ts`
- Modify: `app/_layout.tsx`, `app.json`, `app/(app)/settings.tsx`
- Delete: `components/ThemedText.tsx`, `components/ThemedView.tsx` (confirm nothing imports them first)

**Interfaces:**
- Consumes (Task 1): tokens, preference functions.
- Produces: `ThemeProvider` component; `useTheme(): { colors: ColorTokens; scheme: 'light' | 'dark'; preference: ThemePreference; setPreference(p: ThemePreference): void }`; components `Screen`, `Card`, `Button({ title, onPress, variant?: 'primary'|'secondary'|'danger'|'ghost', disabled?, loading? })`, `AppText({ variant?: 'title'|'heading'|'body'|'muted'|'label', color?: keyof ColorTokens, ... TextProps })`, `Chip({ label, selected, onPress })`, `Banner({ tone: 'success'|'warning'|'danger'|'info', children })`.

- [ ] **Step 1: Install navigation theme + icons if missing**

Check `node_modules/@react-navigation/native` and `node_modules/@expo/vector-icons`; for any missing one run `npx expo install @react-navigation/native @expo/vector-icons`. Note the result.

- [ ] **Step 2: ThemeProvider**

`src/theme/ThemeProvider.tsx`:

```tsx
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { ColorTokens, darkColors, lightColors } from './colors';
import { loadThemePreference, resolveScheme, saveThemePreference, ThemePreference } from './preference';

interface ThemeValue {
  colors: ColorTokens;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    loadThemePreference().then(setPreferenceState);
  }, []);

  const scheme = resolveScheme(preference, system);
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeValue>(
    () => ({
      colors,
      scheme,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        saveThemePreference(next).catch((err) => console.warn('Could not save theme preference', err));
      },
    }),
    [colors, scheme, preference]
  );

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
```

If expo-router already provides its own navigation container theme handling, keep this wrapper (expo-router reads the nearest `@react-navigation/native` ThemeProvider) and note any adjustment needed.

- [ ] **Step 3: Wire the root layout and app.json**

`app/_layout.tsx`: wrap the existing tree (inside `GestureHandlerRootView` → `SafeAreaProvider`) in `<ThemeProvider>`, and give the `SafeAreaView` `style={{ flex: 1, backgroundColor: colors.background }}` using a tiny inner component (`function ThemedRoot({ children })` that calls `useTheme()`), since `useTheme` needs the provider above it.

`app.json`: `"userInterfaceStyle": "automatic"`.

- [ ] **Step 4: UI components**

Each component calls `useTheme()` and builds its styles from `colors` with `useMemo` (never a module-scope `StyleSheet` with colors). Specs:
- `Screen({ children, scroll?: boolean, padded = true })`: `flex: 1`, `backgroundColor: colors.background`, padding 16 when `padded`; `ScrollView` with `contentContainerStyle` padding when `scroll`.
- `Card({ children, style })`: `backgroundColor: colors.surface`, `borderColor: colors.border`, `borderWidth: 1`, `borderRadius: 12`, `padding: 16`, `gap: 8`.
- `Button`: `minHeight: 48`, `borderRadius: 8`, centered; `primary` bg `accent` text `onAccent`; `secondary` border `accent` text `accent`; `danger` bg `danger` text `onAccent`; `ghost` no border, text `accent`; disabled/loading → `opacity: 0.5`, `ActivityIndicator` when loading.
- `AppText`: `title` 20/700, `heading` 16/700, `body` 15/400, `muted` 13/400 (`textMuted`), `label` 14/600; default color `text` unless `muted`; optional `color` token override.
- `Chip`: `paddingVertical: 8`, `paddingHorizontal: 12`, `borderRadius: 8`, `minHeight: 36`; selected → bg `accent`, text `onAccent`; else bg `surfaceMuted`, text `text`.
- `Banner`: `success` (`successMuted` / `success`), `warning` (`warningMuted` / `warning`), `danger` (`dangerMuted` / `danger`), `info` (`accentMuted` / `accent`); radius 8, padding 12; children text in the tone's strong color.
- `src/components/ui/index.ts` re-exports all six.

- [ ] **Step 5: Apariencia section in Ajustes**

In `app/(app)/settings.tsx`, add at the top a section "Apariencia" with three `Chip`s: "Sistema", "Claro", "Oscuro", bound to `useTheme().preference` / `setPreference('system' | 'light' | 'dark')`.

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck`; `npm run test:unit`

```bash
git add -A src/theme src/components/ui app/_layout.tsx app.json "app/(app)/settings.tsx" components package.json package-lock.json
git commit -m "feat: theme provider, shared UI components and the Apariencia setting"
```

---

### Task 3: Bottom-tab navigation

**Files:**
- Move (with `git mv`): `app/(app)/index.tsx` → `app/(app)/(tabs)/index.tsx`; `app/(app)/routines/` → `app/(app)/(tabs)/routines/`; `app/(app)/progress/` → `app/(app)/(tabs)/progress/`; `app/(app)/history/` → `app/(app)/(tabs)/history/`; `app/(app)/settings.tsx` → `app/(app)/(tabs)/settings/index.tsx`; `app/(app)/credits.tsx` → `app/(app)/(tabs)/settings/credits.tsx`
- Create: `app/(app)/(tabs)/_layout.tsx`, `app/(app)/(tabs)/settings/_layout.tsx`
- Rewrite: `app/(app)/_layout.tsx`
- Delete: `src/components/AppDrawerContent.tsx`
- Modify: every `router.push/replace/navigate` call site and relative import path in moved files (one more `../` level).

**Interfaces:**
- Consumes (Task 2): `useTheme`, `Button`.
- Produces: routes `/(app)/(tabs)/`, `/(app)/(tabs)/routines/...`, `/(app)/(tabs)/progress/...`, `/(app)/(tabs)/history/...`, `/(app)/(tabs)/settings`, `/(app)/(tabs)/settings/credits`, `/(app)/session/[sessionId]`.

- [ ] **Step 1: Move the files**

Use `git mv` for every move listed above. Then fix relative imports in each moved file (they are one directory deeper: `../../` → `../../../`, `../../../` → `../../../../`). Run `npm run typecheck` until clean.

- [ ] **Step 2: The app stack**

`app/(app)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Full screen, no tab bar, so a set isn't logged on a stray tab tap between sets. */}
      <Stack.Screen name="session" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
```

- [ ] **Step 3: The tab bar**

`app/(app)/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outline: IconName, filled: IconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="routines" options={{ title: 'Rutinas', tabBarIcon: tabIcon('list-outline', 'list') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: tabIcon('trending-up-outline', 'trending-up') }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: tabIcon('time-outline', 'time') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: tabIcon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
```

Each nested section (`routines`, `progress`, `history`, `settings`) keeps or gets a `_layout.tsx` with a headerless `Stack` (`screenOptions={{ headerShown: false }}`) and `export const unstable_settings = { initialRouteName: 'index' };` (history already has both). Pressing the active tab resetting it to its root is the expo-router Tabs default; confirm and note.

- [ ] **Step 4: Update every link**

| From | To |
|---|---|
| `/(app)/history/${id}` | `/(app)/(tabs)/history/${id}` (keep `withAnchor: true` on Home's call) |
| `/(app)/progress/${id}` and `/(app)/progress` | `/(app)/(tabs)/progress/${id}`, `/(app)/(tabs)/progress` |
| `/(app)/routines/${id}`, `/(app)/routines/new` | `/(app)/(tabs)/routines/${id}`, `/(app)/(tabs)/routines/new` |
| `/(app)/credits` | `/(app)/(tabs)/settings/credits` |
| `/(app)/session/${id}` | unchanged |
| `router.replace('/(app)')` after finishing a session, root layout redirects, notification tap `router.navigate('/(app)')` | `/(app)/(tabs)` |

Run `grep -rn "router\.\(push\|replace\|navigate\)" app src` and confirm every target exists as a file route.

- [ ] **Step 5: Sign-out in Ajustes, drawer removed**

At the bottom of `app/(app)/(tabs)/settings/index.tsx` add `<Button title="Cerrar sesión" variant="danger" onPress={async () => { await cancelAllReminders(); await supabase.auth.signOut(); }} />` (imports from `src/lib/reminders/scheduler` and `src/lib/supabase`). Delete `src/components/AppDrawerContent.tsx`; `grep -rn "expo-router/drawer\|AppDrawerContent" app src` must be empty.

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck`; `npm run test:unit`

```bash
git add -A app src
git commit -m "feat: replace the side drawer with a bottom tab bar; session opens full screen"
```

---

### Task 4: Themed screens — Inicio, auth, Ajustes, credits

**Files:** `app/(app)/(tabs)/index.tsx`, `app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx`, `app/(app)/(tabs)/settings/index.tsx`, `app/(app)/(tabs)/settings/credits.tsx`, `src/components/HomeProgressCard.tsx`, `src/components/WeekCalendarStrip.tsx`

**Interfaces:**
- Consumes (Task 2): `useTheme`, `Screen`, `Card`, `Button`, `AppText`, `Chip`, `Banner`.

Migration recipe (applies to Tasks 4–7, per file):
1. Move the `StyleSheet.create({...})` into `function makeStyles(c: ColorTokens) { return StyleSheet.create({...}); }` at the bottom of the file, and inside the component: `const { colors } = useTheme(); const styles = useMemo(() => makeStyles(colors), [colors]);`.
2. Replace each literal with a token: `'#111'` text → `c.text`; `'#111'` as a button/selected background → `c.accent` (its text `'#fff'` → `c.onAccent`); `'#fff'` card/sheet backgrounds → `c.surface`; `'#666'`/`'#999'` → `c.textMuted`; `'#ccc'`/`'#ddd'`/`'#eee'` borders → `c.border`; `'#eee'`/`'#f0f0f0'`/`'#f5f5f5'` fills → `c.surfaceMuted`; `'#16a34a'`/`'#166534'` → `c.success`, `'#f0fdf4'` → `c.successMuted`; `'#dc2626'`/`'#991b1b'` → `c.danger`, `'#fef2f2'` → `c.dangerMuted`; `'#f59e0b'`/`'#92400e'` → `c.warning`, `'#fffbeb'` → `c.warningMuted`; `'#2563eb'` → `c.accent`; `rgba(0,0,0,…)` backdrops → `c.overlay`; screen `flex: 1` containers get `backgroundColor: c.background`.
3. Where a block is exactly a card/button/banner/chip, replace it with the shared component instead of restyling it.
4. Text inputs: `backgroundColor: c.surface`, `color: c.text`, `borderColor: c.border`, `placeholderTextColor={colors.textMuted}`.
5. No module-scope style may reference a color.

- [ ] **Step 1:** Apply the recipe to the files of this task. Home's streak card uses `Banner tone="warning"`; the deload/switch banners use `Banner tone="warning"` with `Button`s; the start button is `Button` primary; cards are `Card`.
- [ ] **Step 2:** `npm run typecheck`; `npm run test:unit`.
- [ ] **Step 3: Commit**

```bash
git add -A app src/components
git commit -m "feat: themed Inicio, auth, Ajustes and credits screens"
```

---

### Task 5: Themed Rutinas screens and editors

**Files:** `app/(app)/(tabs)/routines/index.tsx`, `new.tsx`, `[routineId].tsx`, `src/components/RoutineBuilder.tsx`, `DayCard.tsx`, `DayExercisesSection.tsx`, `ExerciseForm.tsx`, `ExercisePicker.tsx`, `WeekdayPicker.tsx`, `StepperInput.tsx`, `WeightStepper.tsx`, `ExerciseThumbnail.tsx`

**Interfaces:** same as Task 4 (apply the Task 4 recipe). Filter and segmented controls become `Chip`s; "Activar"/"Eliminar"/"+ Nueva rutina" become `Button`s (`primary`/`danger`/`primary`); the drag-and-drop row keeps its gesture handlers untouched.

- [ ] **Step 1:** Apply the recipe to every file listed.
- [ ] **Step 2:** `npm run typecheck`; `npm run test:unit`.
- [ ] **Step 3: Commit**

```bash
git add -A app src/components
git commit -m "feat: themed Rutinas screens, pickers and steppers"
```

---

### Task 6: Themed session and history

**Files:** `app/(app)/session/[sessionId].tsx`, `src/components/SessionExerciseCard.tsx`, `src/components/PrBanner.tsx`, `src/components/SetEditor.tsx`, `app/(app)/(tabs)/history/index.tsx`, `app/(app)/(tabs)/history/[sessionId].tsx`

**Interfaces:** Task 4 recipe. Logged-set rows use `successMuted`/`success`; the PR banner keeps its dark-on-light look as `surface` inverted: background `c.text`, text `c.background` (readable in both modes); the set editor sheet uses `surface` and `overlay`; RIR options are `Chip`s.

- [ ] **Step 1:** Apply the recipe.
- [ ] **Step 2:** `npm run typecheck`; `npm run test:unit`.
- [ ] **Step 3: Commit**

```bash
git add -A app src/components
git commit -m "feat: themed session, set editor, PR banner and history"
```

---

### Task 7: Themed progress and charts

**Files:** `app/(app)/(tabs)/progress/index.tsx`, `app/(app)/(tabs)/progress/[exerciseId].tsx`, `src/components/ProgressChart.tsx`, `src/components/Sparkline.tsx`

**Interfaces:** Task 4 recipe, plus: `ProgressChart` uses `color={colors.accent}`, `dataPointsColor={colors.accent}`, axis text `colors.textMuted`, `rulesColor={colors.border}`, `xAxisColor`/`yAxisColor` `colors.border`, and the focus strip `stripColor={colors.textMuted}` (confirm prop names in the installed gifted-charts types; note deviations). Trend colors use `success` / `textMuted` / `danger`. The 1RM/Peso toggle is two `Chip`s.

- [ ] **Step 1:** Apply the recipe and chart colors.
- [ ] **Step 2:** `npm run typecheck`; `npm run test:unit`.
- [ ] **Step 3: Commit**

```bash
git add -A app src/components
git commit -m "feat: themed progress screens and charts"
```

---

### Task 8: App icon, splash and notification icon

**Files:**
- Create: `assets/source/icon.svg`, `assets/source/adaptive-foreground.svg`, `assets/source/notification.svg`, `scripts/build-icons.ts`, generated `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png`, `assets/favicon.png`, `assets/notification-icon.png`
- Modify: `app.json`, `package.json`

- [ ] **Step 1: Draw the SVGs**

A stylized dumbbell: two rounded plates on each side of a short bar, white, centered.
- `icon.svg`: 1024×1024, rounded-square background `#2563EB` (rx 224), white dumbbell spanning ~60% width.
- `adaptive-foreground.svg`: 1024×1024 transparent, white dumbbell within the central 66% safe zone.
- `notification.svg`: 96×96 transparent, white dumbbell silhouette only (Android tints it).

- [ ] **Step 2: Render script**

`npm i -D @resvg/resvg-js`. `scripts/build-icons.ts` renders: `icon.svg` → `assets/icon.png` (1024) and `assets/favicon.png` (48); `adaptive-foreground.svg` → `assets/adaptive-icon.png` (1024); `icon.svg` → `assets/splash.png` (1024, used as the splash image); `notification.svg` → `assets/notification-icon.png` (96). Add `"build-icons": "tsx scripts/build-icons.ts"`; run it; commit the PNGs.

- [ ] **Step 3: app.json**

- `"icon": "./assets/icon.png"`.
- `android.adaptiveIcon`: `{ "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#2563EB" }`.
- Splash via the `expo-splash-screen` config plugin: `["expo-splash-screen", { "image": "./assets/splash.png", "imageWidth": 200, "resizeMode": "contain", "backgroundColor": "#F7F8FA", "dark": { "backgroundColor": "#0B0F14" } }]` (confirm the plugin's option names in its installed README/types; remove the top-level `splash` key if the plugin replaces it, and note what you did).
- Replace the plain `"expo-notifications"` plugin entry with `["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#2563EB" }]`.
- `web.favicon`: `./assets/favicon.png`.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck`; `npm run test:unit`; `npx expo config --type public` (prints the resolved config without errors).

```bash
git add assets scripts/build-icons.ts app.json package.json package-lock.json
git commit -m "feat: app icon, adaptive icon, splash and notification icon"
```

---

### Task 9: No color literals left

**Files:**
- Create: `tests/theme/no-color-literals.test.ts`
- Modify: any file it flags

- [ ] **Step 1: Write the scan test**

`tests/theme/no-color-literals.test.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const SCAN = ['app', 'src'];
const ALLOW = [path.join('src', 'theme')];
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(d.name) ? [full] : [];
  });
}

describe('no color literals outside src/theme', () => {
  it('finds none', () => {
    const offenders: string[] = [];
    for (const dir of SCAN) {
      for (const file of files(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file);
        if (ALLOW.some((a) => rel.startsWith(a))) continue;
        fs.readFileSync(file, 'utf-8')
          .split('\n')
          .forEach((line, i) => {
            if (LITERAL.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2:** Run it; migrate every offender with the Task 4 recipe until it passes. (A `#` in a non-color string, e.g. a URL fragment, can be rewritten to avoid the pattern; never weaken the regex.)
- [ ] **Step 3:** `npm run typecheck`; `npm run test:unit`.
- [ ] **Step 4: Commit**

```bash
git add -A app src tests/theme/no-color-literals.test.ts
git commit -m "test: forbid color literals outside the theme"
```

---

### Task 10: Final verification and device checklist

- [ ] **Step 1:** `npm run typecheck`, `npm run test:unit` (all pass).
- [ ] **Step 2: Device checklist for the user (verbatim)**
  1. Con el celular en modo oscuro y "Sistema", la app se ve oscura; elegir "Claro" en Ajustes la cambia al instante y se mantiene al reabrir.
  2. Todas las pantallas (Inicio, Rutinas, Sesión, Progreso, Historial, Ajustes, login) se leen bien en los dos modos: sin cajas blancas en oscuro ni textos invisibles.
  3. Gráficos y sparklines se leen en los dos modos.
  4. El ícono y la pantalla de carga muestran la pesa azul; el ícono de notificación es una silueta blanca prolija.
  5. La barra de abajo muestra las cinco pestañas con ícono y texto; la activa en azul.
  6. Entrar a un ejercicio en Progreso, ir a Historial y volver mantiene el ejercicio abierto; tocar Progreso otra vez vuelve a la lista.
  7. Empezar un entrenamiento abre la sesión a pantalla completa, sin la barra; al terminar volvés al Inicio con la barra.
  8. Una fila de "Actividad reciente" abre el detalle en Historial, y ← vuelve a la lista de Historial.
  9. "Cerrar sesión" en Ajustes cierra la sesión.
