# Training Reminders & Streak Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local notifications that remind the user to train on scheduled days at one chosen time, plus a Saturday "streak at risk" alert, controlled from a new Ajustes screen.

**Architecture:** A pure `planReminders` function turns settings + the cached routine + completed-session dates into dated notifications for the next 14 days. A serialized `syncReminders` cancels and reschedules them through `expo-notifications`; it runs on Home load, session completion and settings changes, and everything is cancelled on sign-out. Settings and completed dates live in AsyncStorage.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router, `expo-notifications` (local DATE triggers), AsyncStorage, expo-sqlite cache, Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-10-12-fit-tracker-reminders-design.md`

## Global Constraints

- Work in `B:\Gusa\Dev\fit-tracker` on branch `reminders`. Do not switch branches or push.
- All user-facing copy is Spanish (rioplatense), exactly as written in this plan.
- Local notifications only: no push, no backend or migration changes.
- Window: today through the next 13 days (14 calendar days); only times strictly after now.
- Defaults: both alerts off, time 18:30. Minutes chosen in 5-minute steps.
- Android channel id `reminders`, name `Recordatorios`, default importance.
- `syncReminders` never throws to callers and never blocks Home, session completion or the settings screen.
- `src/lib/reminders/plan.ts` must not import React, React Native, Expo, expo-sqlite or Supabase.
- Unit tests live in `tests/lib/reminders/*.test.ts`. Nothing in this plan is an integration test.
- Every commit message ends with a `Co-Authored-By:` trailer naming the model that wrote it (per that agent's harness).
- Verification: `npm run typecheck`, `npm run test:unit`, `npx jest <path>`.

## Review Focus

1. Two `syncReminders` calls overlapping (Home focus while the settings screen saves) → no duplicate notifications: runs are serialized; pinned by a test in Task 3.
2. Corrupted or partial JSON in AsyncStorage → defaults / empty list, never a crash: pinned in Task 1.
3. Sunday with no training this week and a live streak → no streak alert (this week's Saturday passed, next week's isn't planned): pinned in Task 2.
4. Reminder time already passed today → today's reminder skipped, later days kept: pinned in Task 2.
5. Active routine with no `started_at` → nothing scheduled: pinned in Task 3 (scheduler passes `routine: null`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/reminders/types.ts` (create) | `ReminderSettings`, `PlanInput`, `PlannedReminder` |
| `src/lib/reminders/storage.ts` (create) | settings + completed-dates AsyncStorage |
| `src/lib/reminders/plan.ts` (create) | pure `planReminders` |
| `src/lib/reminders/scheduler.ts` (create) | expo-notifications setup, permissions, serialized `syncReminders`, cancel, test send |
| `app/_layout.tsx` (modify) | setup at start, tap → Home |
| `src/hooks/useHomeData.ts`, `src/hooks/useSessionSets.ts`, `src/components/AppDrawerContent.tsx` (modify) | callers |
| `app/(app)/settings.tsx` (create), `app/(app)/_layout.tsx` (modify) | Ajustes screen + drawer item |
| `package.json`, `package-lock.json`, `app.json` (modify) | dependency + config plugin |

---

### Task 1: Types and storage

**Files:**
- Create: `src/lib/reminders/types.ts`, `src/lib/reminders/storage.ts`
- Test: `tests/lib/reminders/storage.test.ts`

**Interfaces:**
- Produces: types below; `DEFAULT_REMINDER_SETTINGS: ReminderSettings`; `loadReminderSettings(): Promise<ReminderSettings>`; `saveReminderSettings(settings: ReminderSettings): Promise<void>`; `loadCompletedDates(): Promise<string[]>`; `saveCompletedDates(dates: string[]): Promise<void>`; `addCompletedDate(date: string): Promise<void>`.

- [ ] **Step 1: Create the types**

`src/lib/reminders/types.ts`:

```typescript
export interface ReminderSettings {
  trainingEnabled: boolean;
  streakEnabled: boolean;
  hour: number;
  minute: number;
}

export interface PlanInput {
  now: Date;
  settings: ReminderSettings;
  routine: { startedAt: string; weekdaySchedule: Record<string, unknown> } | null;
  days: Array<{ id: string; name: string; isRestDay: boolean }>;
  /** YYYY-MM-DD local dates of completed sessions. */
  completedDates: string[];
}

export interface PlannedReminder {
  kind: 'training' | 'streak';
  date: Date;
  title: string;
  body: string;
}
```

- [ ] **Step 2: Write the failing tests**

`tests/lib/reminders/storage.test.ts`:

```typescript
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  saveReminderSettings,
  loadCompletedDates,
  saveCompletedDates,
  addCompletedDate,
} from '../../../src/lib/reminders/storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('reminder settings', () => {
  it('defaults to both alerts off at 18:30', async () => {
    expect(DEFAULT_REMINDER_SETTINGS).toEqual({ trainingEnabled: false, streakEnabled: false, hour: 18, minute: 30 });
    expect(await loadReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    const settings = { trainingEnabled: true, streakEnabled: false, hour: 7, minute: 15 };
    await saveReminderSettings(settings);
    expect(await loadReminderSettings()).toEqual(settings);
  });

  it('falls back to defaults for corrupted JSON', async () => {
    await AsyncStorage.setItem('fit-tracker:reminder-settings', '{not json');
    expect(await loadReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('falls back per field for missing or invalid values', async () => {
    await AsyncStorage.setItem('fit-tracker:reminder-settings', JSON.stringify({ trainingEnabled: true, hour: 25, minute: 'x' }));
    expect(await loadReminderSettings()).toEqual({ trainingEnabled: true, streakEnabled: false, hour: 18, minute: 30 });
  });
});

describe('completed session dates', () => {
  it('is empty by default and for corrupted JSON', async () => {
    expect(await loadCompletedDates()).toEqual([]);
    await AsyncStorage.setItem('fit-tracker:completed-session-dates', 'oops');
    expect(await loadCompletedDates()).toEqual([]);
  });

  it('keeps only YYYY-MM-DD strings', async () => {
    await AsyncStorage.setItem('fit-tracker:completed-session-dates', JSON.stringify(['2026-10-12', 5, 'nope', null]));
    expect(await loadCompletedDates()).toEqual(['2026-10-12']);
  });

  it('replaces the list on save and dedupes on add', async () => {
    await saveCompletedDates(['2026-10-05', '2026-10-07']);
    await addCompletedDate('2026-10-07');
    await addCompletedDate('2026-10-12');
    expect(await loadCompletedDates()).toEqual(['2026-10-05', '2026-10-07', '2026-10-12']);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest tests/lib/reminders/storage.test.ts`
Expected: FAIL, cannot find module `storage`.

- [ ] **Step 4: Implement**

`src/lib/reminders/storage.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReminderSettings } from './types';

const SETTINGS_KEY = 'fit-tracker:reminder-settings';
const DATES_KEY = 'fit-tracker:completed-session-dates';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  trainingEnabled: false,
  streakEnabled: false,
  hour: 18,
  minute: 30,
};

function readJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const parsed = readJson(await AsyncStorage.getItem(SETTINGS_KEY));
  const value = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  return {
    trainingEnabled:
      typeof value.trainingEnabled === 'boolean' ? value.trainingEnabled : DEFAULT_REMINDER_SETTINGS.trainingEnabled,
    streakEnabled:
      typeof value.streakEnabled === 'boolean' ? value.streakEnabled : DEFAULT_REMINDER_SETTINGS.streakEnabled,
    hour: inRange(value.hour, 0, 23) ? value.hour : DEFAULT_REMINDER_SETTINGS.hour,
    minute: inRange(value.minute, 0, 59) ? value.minute : DEFAULT_REMINDER_SETTINGS.minute,
  };
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadCompletedDates(): Promise<string[]> {
  const parsed = readJson(await AsyncStorage.getItem(DATES_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((d): d is string => typeof d === 'string' && DATE_PATTERN.test(d));
}

export async function saveCompletedDates(dates: string[]): Promise<void> {
  await AsyncStorage.setItem(DATES_KEY, JSON.stringify(dates));
}

export async function addCompletedDate(date: string): Promise<void> {
  const dates = await loadCompletedDates();
  if (!dates.includes(date)) await saveCompletedDates([...dates, date]);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/lib/reminders/storage.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add src/lib/reminders/types.ts src/lib/reminders/storage.ts tests/lib/reminders/storage.test.ts
git commit -m "feat: store reminder settings and completed session dates on the device"
```

---

### Task 2: Pure reminder planning

**Files:**
- Create: `src/lib/reminders/plan.ts`
- Test: `tests/lib/reminders/plan.test.ts`

**Interfaces:**
- Consumes: `PlanInput`, `PlannedReminder` (Task 1). Existing: `resolveTodayDayId(weekdaySchedule, weekday, weekNumber)`, `weekdayFromDate(date)`, `computeWeekNumber(startedAt, date)`, `formatDateOnly(date)` from `src/lib/sessions/weekResolution.ts`; `computeConsecutiveActiveWeeks(sessionDates, now)` from `src/lib/home/streak.ts`.
- Produces: `REMINDER_WINDOW_DAYS = 14`; `planReminders(input: PlanInput): PlannedReminder[]` (sorted by date).

Calendar used by the tests (local time): 2026-10-12 is a Monday. The routine starts 2026-10-05, so Oct 5–11 is week 1, Oct 12–18 week 2 (even), Oct 19–25 week 3 (odd), Oct 26–Nov 1 week 4.

- [ ] **Step 1: Write the failing tests**

`tests/lib/reminders/plan.test.ts`:

```typescript
import { planReminders, REMINDER_WINDOW_DAYS } from '../../../src/lib/reminders/plan';
import { PlanInput, ReminderSettings } from '../../../src/lib/reminders/types';
import { formatDateOnly } from '../../../src/lib/sessions/weekResolution';

const ON: ReminderSettings = { trainingEnabled: true, streakEnabled: true, hour: 18, minute: 30 };

function input(overrides: Partial<PlanInput>): PlanInput {
  return {
    now: new Date(2026, 9, 14, 10, 0), // Wed 14 Oct 2026, 10:00
    settings: ON,
    routine: {
      startedAt: '2026-10-05T09:00:00',
      weekdaySchedule: { mon: 'a', wed: 'b', fri: { even_week: 'c', odd_week: 'b' }, sat: 'rest' },
    },
    days: [
      { id: 'a', name: 'Upper', isRestDay: false },
      { id: 'b', name: 'Lower', isRestDay: false },
      { id: 'c', name: 'Push', isRestDay: false },
      { id: 'rest', name: 'Descanso', isRestDay: true },
    ],
    completedDates: [],
    ...overrides,
  };
}

function summary(reminders: ReturnType<typeof planReminders>) {
  return reminders.map((r) => `${r.kind} ${formatDateOnly(r.date)} ${r.date.getHours()}:${r.date.getMinutes()}`);
}

const trainingOnly = { ...ON, streakEnabled: false };
const streakOnly = { ...ON, trainingEnabled: false };

describe('planReminders — training', () => {
  it('plans one reminder per training day in the 14-day window, at the configured time', () => {
    expect(REMINDER_WINDOW_DAYS).toBe(14);
    expect(summary(planReminders(input({ settings: trainingOnly })))).toEqual([
      'training 2026-10-14 18:30',
      'training 2026-10-16 18:30', // Fri, week 2 (even) -> Push
      'training 2026-10-19 18:30',
      'training 2026-10-21 18:30',
      'training 2026-10-23 18:30', // Fri, week 3 (odd) -> Lower
      'training 2026-10-26 18:30',
    ]);
  });

  it('names the routine day, resolving alternating weekdays by week number', () => {
    const reminders = planReminders(input({ settings: trainingOnly }));
    expect(reminders.find((r) => formatDateOnly(r.date) === '2026-10-16')).toMatchObject({
      title: '💪 Hoy toca Push',
      body: '¡A entrenar!',
    });
    expect(reminders.find((r) => formatDateOnly(r.date) === '2026-10-23')!.title).toBe('💪 Hoy toca Lower');
  });

  it('skips rest days, unscheduled weekdays and unknown day ids', () => {
    const reminders = planReminders(
      input({ settings: trainingOnly, routine: { startedAt: '2026-10-05T09:00:00', weekdaySchedule: { sat: 'rest', sun: 'gone' } } })
    );
    expect(reminders).toEqual([]);
  });

  it('skips a day whose session is already completed', () => {
    const dates = summary(planReminders(input({ settings: trainingOnly, completedDates: ['2026-10-14'] })));
    expect(dates[0]).toBe('training 2026-10-16 18:30');
  });

  it("skips today when the reminder time has already passed", () => {
    const dates = summary(planReminders(input({ settings: trainingOnly, now: new Date(2026, 9, 14, 19, 0) })));
    expect(dates[0]).toBe('training 2026-10-16 18:30');
  });

  it('plans nothing when training reminders are off or there is no routine', () => {
    expect(planReminders(input({ settings: { ...ON, trainingEnabled: false, streakEnabled: false } }))).toEqual([]);
    expect(planReminders(input({ routine: null }))).toEqual([]);
  });
});

describe('planReminders — streak at risk', () => {
  it("alerts this Saturday when the week has no session and the streak is alive", () => {
    const reminders = planReminders(input({ settings: streakOnly, completedDates: ['2026-10-07'] }));
    expect(summary(reminders)).toEqual(['streak 2026-10-17 18:30']);
    expect(reminders[0]).toMatchObject({
      title: '🔥 Tu racha está en riesgo',
      body: 'Llevás 1 semana seguida. Entrená antes del domingo para no perderla.',
    });
  });

  it("alerts next Saturday when this week already has a session", () => {
    const reminders = planReminders(
      input({ settings: streakOnly, completedDates: ['2026-09-30', '2026-10-07', '2026-10-13'] })
    );
    expect(summary(reminders)).toEqual(['streak 2026-10-24 18:30']);
    expect(reminders[0].body).toBe('Llevás 3 semanas seguidas. Entrená antes del domingo para no perderla.');
  });

  it('plans no streak alert when the streak is 0', () => {
    expect(planReminders(input({ settings: streakOnly, completedDates: [] }))).toEqual([]);
    expect(planReminders(input({ settings: streakOnly, completedDates: ['2026-09-20'] }))).toEqual([]);
  });

  it("plans none on Sunday when this week's Saturday has passed and the week has no session", () => {
    const sunday = new Date(2026, 9, 18, 10, 0);
    expect(planReminders(input({ settings: streakOnly, now: sunday, completedDates: ['2026-10-07'] }))).toEqual([]);
  });

  it('plans none when streak alerts are off', () => {
    expect(planReminders(input({ settings: trainingOnly, completedDates: ['2026-10-07'] })).every((r) => r.kind === 'training')).toBe(true);
  });
});

describe('planReminders — both kinds', () => {
  it('returns training and streak reminders sorted by date', () => {
    const kinds = summary(planReminders(input({ completedDates: ['2026-10-07'] })));
    expect(kinds.slice(0, 3)).toEqual(['training 2026-10-14 18:30', 'training 2026-10-16 18:30', 'streak 2026-10-17 18:30']);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest tests/lib/reminders/plan.test.ts`
Expected: FAIL, cannot find module `plan`.

- [ ] **Step 3: Implement**

`src/lib/reminders/plan.ts`:

```typescript
import { PlanInput, PlannedReminder } from './types';
import { computeWeekNumber, formatDateOnly, resolveTodayDayId, weekdayFromDate } from '../sessions/weekResolution';
import { computeConsecutiveActiveWeeks } from '../home/streak';

export const REMINDER_WINDOW_DAYS = 14;
const SATURDAY_FROM_MONDAY = 5;

/** Local date `offsetDays` after `base`, at hour:minute (the Date constructor keeps DST right). */
function atTime(base: Date, offsetDays: number, hour: number, minute: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays, hour, minute, 0, 0);
}

function streakBody(weeks: number): string {
  const count = weeks === 1 ? '1 semana seguida' : `${weeks} semanas seguidas`;
  return `Llevás ${count}. Entrená antes del domingo para no perderla.`;
}

export function planReminders(input: PlanInput): PlannedReminder[] {
  const { now, settings, routine, days, completedDates } = input;
  if (!routine) return [];
  const completed = new Set(completedDates);
  const planned: PlannedReminder[] = [];

  if (settings.trainingEnabled) {
    for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset++) {
      const date = atTime(now, offset, settings.hour, settings.minute);
      if (date <= now || completed.has(formatDateOnly(date))) continue;
      const dayId = resolveTodayDayId(
        routine.weekdaySchedule,
        weekdayFromDate(date),
        computeWeekNumber(routine.startedAt, date)
      );
      const day = days.find((d) => d.id === dayId);
      if (!day || day.isRestDay) continue;
      planned.push({ kind: 'training', date, title: `💪 Hoy toca ${day.name}`, body: '¡A entrenar!' });
    }
  }

  if (settings.streakEnabled) {
    const streak = computeConsecutiveActiveWeeks(completedDates, now);
    if (streak > 0) {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const thisWeek = Array.from({ length: 7 }, (_, i) => formatDateOnly(atTime(now, i - daysSinceMonday, 0, 0)));
      const trainedThisWeek = thisWeek.some((d) => completed.has(d));
      // Assumes no future training: training means opening the app, which reschedules.
      const offset = SATURDAY_FROM_MONDAY - daysSinceMonday + (trainedThisWeek ? 7 : 0);
      const date = atTime(now, offset, settings.hour, settings.minute);
      if (date > now) {
        planned.push({ kind: 'streak', date, title: '🔥 Tu racha está en riesgo', body: streakBody(streak) });
      }
    }
  }

  return planned.sort((a, b) => a.date.getTime() - b.date.getTime());
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/lib/reminders/plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add src/lib/reminders/plan.ts tests/lib/reminders/plan.test.ts
git commit -m "feat: plan training reminders and streak alerts for the next 14 days"
```

---

### Task 3: Notifications scheduler and app setup

**Files:**
- Modify: `package.json`, `package-lock.json`, `app.json` (via install + plugin)
- Create: `src/lib/reminders/scheduler.ts`
- Modify: `app/_layout.tsx`
- Test: `tests/lib/reminders/scheduler.test.ts`

**Interfaces:**
- Consumes: `planReminders` (Task 2), `loadReminderSettings`, `loadCompletedDates` (Task 1). Existing `getDatabase()` (`src/lib/sqlite/db.ts`), `getCachedActiveRoutine(db)` → `CachedRoutine | null` with `started_at: string | null` and `weekday_schedule`, `getCachedRoutineDays(db, routineId)` → `{ id, name, is_rest_day }[]` (`src/lib/sqlite/cache.ts`).
- Produces: `REMINDER_CHANNEL_ID = 'reminders'`; `setupNotifications(): Promise<void>`; `hasNotificationPermission(): Promise<boolean>`; `requestNotificationPermission(): Promise<boolean>`; `syncReminders(): Promise<void>` (serialized, never rejects); `cancelAllReminders(): Promise<void>` (never rejects); `sendTestReminder(): Promise<void>`.

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-notifications`
Expected: `expo-notifications` added to `dependencies` at the SDK-57-compatible version. Then add `"expo-notifications"` to the `plugins` array in `app.json` (after `"expo-sqlite"`) if the install didn't.

Before writing code, confirm in `node_modules/expo-notifications/build/*.d.ts`: `setNotificationHandler` and the handler's fields (`shouldShowBanner`, `shouldShowList`, `shouldPlaySound`, `shouldSetBadge`); `SchedulableTriggerInputTypes.DATE` with `date` and `channelId`; `AndroidImportance.DEFAULT`; `getPermissionsAsync`/`requestPermissionsAsync` returning `{ granted }`; `cancelAllScheduledNotificationsAsync`; `addNotificationResponseReceivedListener`; and how an immediate notification takes a channel (a channel-only trigger such as `{ channelId }`, or `trigger: null`). If a name differs in the installed version, use the installed equivalent and note it in the report.

- [ ] **Step 2: Write the failing scheduler test**

`tests/lib/reminders/scheduler.test.ts`:

```typescript
const calls: string[] = [];

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    calls.push('cancel');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }),
  scheduleNotificationAsync: jest.fn(async (request: { content: { title: string } }) => {
    calls.push(`schedule ${request.content.title}`);
    return 'id';
  }),
}));
jest.mock('../../../src/lib/sqlite/db', () => ({ getDatabase: () => ({}) }));
const mockRoutine = { id: 'r', started_at: '2026-10-05T09:00:00', weekday_schedule: { mon: 'a' } };
jest.mock('../../../src/lib/sqlite/cache', () => ({
  getCachedActiveRoutine: jest.fn(() => mockRoutine),
  getCachedRoutineDays: jest.fn(() => [{ id: 'a', name: 'Upper', is_rest_day: false }]),
}));

import * as Notifications from 'expo-notifications';
import { getCachedActiveRoutine } from '../../../src/lib/sqlite/cache';
import { saveReminderSettings } from '../../../src/lib/reminders/storage';
import { syncReminders } from '../../../src/lib/reminders/scheduler';

beforeEach(async () => {
  calls.length = 0;
  jest.clearAllMocks();
  await saveReminderSettings({ trainingEnabled: true, streakEnabled: false, hour: 18, minute: 30 });
});

describe('syncReminders', () => {
  it('cancels then schedules the planned reminders', async () => {
    await syncReminders();
    expect(calls[0]).toBe('cancel');
    expect(calls.slice(1).every((c) => c === 'schedule 💪 Hoy toca Upper')).toBe(true);
    expect(calls.length).toBeGreaterThan(1);
  });

  it('never interleaves two overlapping runs (no duplicate notifications)', async () => {
    await Promise.all([syncReminders(), syncReminders()]);
    const firstCancel = calls.indexOf('cancel');
    const secondCancel = calls.indexOf('cancel', firstCancel + 1);
    const perRun = secondCancel - firstCancel - 1;
    expect(perRun).toBeGreaterThan(0);
    // run 1 = cancel + its schedules, run 2 = cancel + the same number of schedules, never mixed
    expect(calls.slice(secondCancel + 1)).toHaveLength(perRun);
    expect(calls.slice(firstCancel + 1, secondCancel).every((c) => c.startsWith('schedule'))).toBe(true);
  });

  it('only cancels when both alerts are off', async () => {
    await saveReminderSettings({ trainingEnabled: false, streakEnabled: false, hour: 18, minute: 30 });
    await syncReminders();
    expect(calls).toEqual(['cancel']);
  });

  it('only cancels without notification permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await syncReminders();
    expect(calls).toEqual(['cancel']);
  });

  it('schedules nothing when the active routine has no start date', async () => {
    (getCachedActiveRoutine as jest.Mock).mockReturnValueOnce({ ...mockRoutine, started_at: null });
    await syncReminders();
    expect(calls).toEqual(['cancel']);
  });

  it('never rejects when scheduling fails', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(syncReminders()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest tests/lib/reminders/scheduler.test.ts`
Expected: FAIL, cannot find module `scheduler`.

- [ ] **Step 4: Implement the scheduler**

`src/lib/reminders/scheduler.ts`:

```typescript
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDatabase } from '../sqlite/db';
import { getCachedActiveRoutine, getCachedRoutineDays } from '../sqlite/cache';
import { loadCompletedDates, loadReminderSettings } from './storage';
import { planReminders } from './plan';

export const REMINDER_CHANNEL_ID = 'reminders';

export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (await hasNotificationPermission()) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function syncOnce(): Promise<void> {
  const settings = await loadReminderSettings();
  if ((!settings.trainingEnabled && !settings.streakEnabled) || !(await hasNotificationPermission())) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  const db = getDatabase();
  const cached = getCachedActiveRoutine(db);
  const routine =
    cached && cached.started_at ? { startedAt: cached.started_at, weekdaySchedule: cached.weekday_schedule } : null;
  const days = cached
    ? getCachedRoutineDays(db, cached.id).map((d) => ({ id: d.id, name: d.name, isRestDay: d.is_rest_day }))
    : [];
  const planned = planReminders({
    now: new Date(),
    settings,
    routine,
    days,
    completedDates: await loadCompletedDates(),
  });

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const reminder of planned) {
    await Notifications.scheduleNotificationAsync({
      content: { title: reminder.title, body: reminder.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.date,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  }
}

// Runs one at a time: two overlapping cancel-then-schedule runs would duplicate notifications.
let syncChain: Promise<void> = Promise.resolve();

/** Replaces every scheduled reminder with a fresh 14-day plan. Never rejects. */
export function syncReminders(): Promise<void> {
  syncChain = syncChain.then(() =>
    syncOnce().catch((err) => {
      console.warn('Could not sync reminders', err);
    })
  );
  return syncChain;
}

/** Used on sign-out. Never rejects. */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch((err) => {
    console.warn('Could not cancel reminders', err);
  });
}

export async function sendTestReminder(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: '🔔 Aviso de prueba', body: 'Así te van a llegar los recordatorios.' },
    trigger: Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : null,
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/lib/reminders/scheduler.test.ts`
Expected: PASS (6 tests). If the immediate-trigger shape `{ channelId }` doesn't type-check in the installed version, use the installed equivalent (Step 1) and note it.

- [ ] **Step 6: Set up at app start and open Home on tap**

In `app/_layout.tsx`:

1. Add imports:

```typescript
import * as Notifications from 'expo-notifications';
import { setupNotifications } from '../src/lib/reminders/scheduler';
```

2. Inside `RootLayout`, after the existing `useEffect`s and before `if (isLoading) return null;`, add:

```typescript
  useEffect(() => {
    setupNotifications().catch((err) => console.warn('Could not set up notifications', err));
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(app)' as any);
    });
    return () => subscription.remove();
  }, []);
```

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add package.json package-lock.json app.json src/lib/reminders/scheduler.ts tests/lib/reminders/scheduler.test.ts app/_layout.tsx
git commit -m "feat: schedule reminders with expo-notifications, serialized, opening Home on tap"
```

---

### Task 4: Keep reminders in sync (Home, session completion, sign-out)

**Files:**
- Modify: `src/hooks/useHomeData.ts`, `src/hooks/useSessionSets.ts`, `src/components/AppDrawerContent.tsx`

**Interfaces:**
- Consumes: `saveCompletedDates`, `addCompletedDate` (Task 1); `syncReminders`, `cancelAllReminders` (Task 3). Existing `formatDateOnly` from `src/lib/sessions/weekResolution.ts`.

No new tests: the decisions are in the planner and scheduler (Tasks 2–3); this is wiring.

- [ ] **Step 1: Home writes completed dates and resyncs**

In `src/hooks/useHomeData.ts`:

1. Add imports:

```typescript
import { saveCompletedDates } from '../lib/reminders/storage';
import { syncReminders } from '../lib/reminders/scheduler';
```

2. Inside `load`, in the existing `if (recentSessions !== null) {` block, after the `setConsistencyStreak(...)` line, add:

```typescript
        await saveCompletedDates(recentSessions.map((s) => s.sessionDate)).catch(() => {});
```

3. In `load`'s `finally` block, after `setLoading(false);`, add:

```typescript
      // Fire-and-forget: reminders never block Home (and run even when there's no routine,
      // so turning a routine off clears its alerts).
      syncReminders();
```

- [ ] **Step 2: Session completion records today and resyncs**

In `src/hooks/useSessionSets.ts`:

1. Add imports:

```typescript
import { addCompletedDate } from '../lib/reminders/storage';
import { syncReminders } from '../lib/reminders/scheduler';
import { formatDateOnly } from '../lib/sessions/weekResolution';
```

(Skip the `formatDateOnly` import if the file already imports it.)

2. At the very end of `completeSession` (after its existing last statement), add:

```typescript
    // Today's reminder and this week's streak alert no longer apply.
    await addCompletedDate(formatDateOnly(new Date())).catch(() => {});
    syncReminders();
```

- [ ] **Step 3: Sign-out cancels every reminder**

In `src/components/AppDrawerContent.tsx`:

1. Add `import { cancelAllReminders } from '../lib/reminders/scheduler';`
2. Replace the sign-out `onPress={() => supabase.auth.signOut()}` with:

```tsx
onPress={async () => {
  await cancelAllReminders();
  await supabase.auth.signOut();
}}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add src/hooks/useHomeData.ts src/hooks/useSessionSets.ts src/components/AppDrawerContent.tsx
git commit -m "feat: resync reminders on Home load and session completion, cancel on sign-out"
```

---

### Task 5: Ajustes screen and drawer entry

**Files:**
- Create: `app/(app)/settings.tsx`
- Modify: `app/(app)/_layout.tsx`

**Interfaces:**
- Consumes: `loadReminderSettings`, `saveReminderSettings`, `DEFAULT_REMINDER_SETTINGS` (Task 1); `ReminderSettings` (Task 1); `syncReminders`, `hasNotificationPermission`, `requestNotificationPermission`, `sendTestReminder` (Task 3). Existing `getDatabase()`, `getCachedActiveRoutine(db)`.

- [ ] **Step 1: Create the screen**

`app/(app)/settings.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { View, Text, Switch, Pressable, Modal, FlatList, StyleSheet, Linking, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DEFAULT_REMINDER_SETTINGS, loadReminderSettings, saveReminderSettings } from '../../src/lib/reminders/storage';
import { ReminderSettings } from '../../src/lib/reminders/types';
import {
  hasNotificationPermission,
  requestNotificationPermission,
  sendTestReminder,
  syncReminders,
} from '../../src/lib/reminders/scheduler';
import { getDatabase } from '../../src/lib/sqlite/db';
import { getCachedActiveRoutine } from '../../src/lib/sqlite/cache';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

export default function SettingsScreen() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [hasRoutine, setHasRoutine] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const loaded = await loadReminderSettings();
        setSettings(loaded);
        const anyOn = loaded.trainingEnabled || loaded.streakEnabled;
        setPermissionDenied(anyOn && !(await hasNotificationPermission()));
        setHasRoutine(getCachedActiveRoutine(getDatabase()) !== null);
      })().catch((err) => console.warn('Could not load reminder settings', err));
    }, [])
  );

  async function apply(next: ReminderSettings) {
    setSettings(next);
    await saveReminderSettings(next).catch((err) => console.warn('Could not save reminder settings', err));
    syncReminders();
  }

  async function toggle(key: 'trainingEnabled' | 'streakEnabled', value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission().catch(() => false);
      setPermissionDenied(!granted);
      if (!granted) return;
    }
    await apply({ ...settings, [key]: value });
  }

  async function handleTest() {
    const granted = await requestNotificationPermission().catch(() => false);
    setPermissionDenied(!granted);
    if (!granted) return;
    await sendTestReminder().catch(() => Alert.alert('Error', 'No se pudo enviar el aviso de prueba.'));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {permissionDenied && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Para recibir avisos, activá las notificaciones de Fit Tracker en los ajustes del celular.
          </Text>
          <Pressable style={styles.warningButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.warningButtonText}>Abrir ajustes</Text>
          </Pressable>
        </View>
      )}

      {!hasRoutine && <Text style={styles.muted}>Activá una rutina para recibir recordatorios.</Text>}

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>Recordatorio de entrenamiento</Text>
          <Switch value={settings.trainingEnabled} onValueChange={(v) => toggle('trainingEnabled', v)} />
        </View>
        <Text style={styles.muted}>Te avisa los días que toca entrenar, si todavía no lo hiciste.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>Racha en riesgo</Text>
          <Switch value={settings.streakEnabled} onValueChange={(v) => toggle('streakEnabled', v)} />
        </View>
        <Text style={styles.muted}>Te avisa el sábado si todavía no entrenaste en la semana.</Text>
      </View>

      <Pressable style={[styles.card, styles.row]} onPress={() => setPickerOpen(true)}>
        <Text style={styles.title}>Hora</Text>
        <Text style={styles.time}>
          {pad(settings.hour)}:{pad(settings.minute)} ▾
        </Text>
      </Pressable>

      <Pressable style={styles.testButton} onPress={handleTest}>
        <Text style={styles.testButtonText}>Enviar aviso de prueba</Text>
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Elegí la hora</Text>
          <View style={styles.columns}>
            <FlatList
              style={styles.column}
              data={HOURS}
              keyExtractor={(h) => `h${h}`}
              renderItem={({ item }) => (
                <Pressable style={styles.option} onPress={() => apply({ ...settings, hour: item })}>
                  <Text style={[styles.optionText, item === settings.hour && styles.optionActive]}>{pad(item)}</Text>
                </Pressable>
              )}
            />
            <FlatList
              style={styles.column}
              data={MINUTES}
              keyExtractor={(m) => `m${m}`}
              renderItem={({ item }) => (
                <Pressable style={styles.option} onPress={() => apply({ ...settings, minute: item })}>
                  <Text style={[styles.optionText, item === settings.minute && styles.optionActive]}>{pad(item)}</Text>
                </Pressable>
              )}
            />
          </View>
          <Pressable style={styles.doneButton} onPress={() => setPickerOpen(false)}>
            <Text style={styles.doneText}>Listo</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  muted: { color: '#666' },
  time: { fontSize: 16, fontWeight: '700' },
  warning: { borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fffbeb', borderRadius: 8, padding: 12, gap: 8 },
  warningText: { color: '#92400e' },
  warningButton: { alignSelf: 'flex-start', backgroundColor: '#111', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  warningButtonText: { color: '#fff', fontWeight: '600' },
  testButton: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  testButtonText: { color: '#111', fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '60%', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16, gap: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  columns: { flexDirection: 'row', gap: 16, flexShrink: 1 },
  column: { flex: 1 },
  option: { paddingVertical: 10, alignItems: 'center' },
  optionText: { fontSize: 16, color: '#666' },
  optionActive: { color: '#111', fontWeight: '700' },
  doneButton: { backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  doneText: { color: '#fff', fontWeight: '700' },
});
```

- [ ] **Step 2: Add the drawer entry**

In `app/(app)/_layout.tsx`, directly after the `history` `Drawer.Screen`, add:

```tsx
      <Drawer.Screen name="settings" options={{ title: 'Ajustes' }} />
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` (exit 0); `npm run test:unit` (all pass)

```bash
git add "app/(app)/settings.tsx" "app/(app)/_layout.tsx"
git commit -m "feat: add the Ajustes screen for training reminders and streak alerts"
```

---

### Task 6: Final verification and device checklist

**Files:** none new; fix-ups only.

- [ ] **Step 1:** `npm run typecheck` (exit 0) and `npm run test:unit` (all pass, including the three `tests/lib/reminders/*.test.ts` files).
- [ ] **Step 2: Hand the device checklist to the user (verbatim)**
  1. Prendés un interruptor en Ajustes: te pide el permiso de notificaciones.
  2. "Enviar aviso de prueba" muestra una notificación al instante.
  3. Con la hora unos minutos adelante, un día de entrenamiento, llega "💪 Hoy toca <día>".
  4. Tocar el aviso abre el Inicio.
  5. Si terminás la sesión antes de la hora, ese día no llega.
  6. Si negás el permiso, aparece el mensaje con "Abrir ajustes".
  7. Después de cerrar sesión no llegan más avisos.
- [ ] **Step 3:** Commit any fix-ups with a failing test first when the problem is in `src/lib/reminders/plan.ts` or `storage.ts`.
