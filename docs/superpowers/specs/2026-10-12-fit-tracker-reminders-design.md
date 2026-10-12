# Fit Tracker — Training Reminders & Streak Alerts — Design Spec

Date: 2026-10-12

## 1. Purpose

The user asked for phone alerts that remind them to train at a time they choose, so they don't skip sessions, mixed with motivation. This spec adds two local notifications:

- **Training reminder**: on each day the active routine schedules training, at one user-chosen time, unless that day's session is already completed.
- **Streak at risk**: on Saturday at the same time, if the user hasn't trained yet that week and their weekly streak is alive.

Both are off by default and controlled from a new **Ajustes** screen. Everything runs on the device: no server, no push notifications.

It builds on the implemented specs (`2026-09-13-fit-tracker-design.md`, `2026-09-16-fit-tracker-home-and-navigation-design.md` for the streak, `2026-10-07-fit-tracker-session-history-design.md`).

## 2. Non-goals

- No push notifications and no backend changes (no migration).
- No "new PR" notification: a PR happens with the app open and the session screen already shows a banner.
- No weekly summary notification (a possible later addition).
- No per-weekday times; one time for both alerts.
- No exact-alarm permission on Android (see §8).
- No syncing settings across devices: settings and scheduled alerts are per device.
- No automated UI/E2E tests (main spec §11).

## 3. Settings

Stored in AsyncStorage under `fit-tracker:reminder-settings`:

```typescript
interface ReminderSettings {
  trainingEnabled: boolean; // default false
  streakEnabled: boolean;   // default false
  hour: number;             // 0–23, default 18
  minute: number;           // 0–59, default 30
}
```

A missing or unreadable value loads the defaults.

## 4. Scheduling rules — `planReminders` (pure)

`src/lib/reminders/plan.ts`. No React, Expo or SQLite imports; unit-tested.

```typescript
interface PlanInput {
  now: Date;
  settings: ReminderSettings;
  routine: { startedAt: string; weekdaySchedule: Record<string, unknown> } | null;
  days: Array<{ id: string; name: string; isRestDay: boolean }>;
  completedDates: string[]; // YYYY-MM-DD, local dates of completed sessions
}

interface PlannedReminder {
  kind: 'training' | 'streak';
  date: Date;   // local date at settings.hour:settings.minute
  title: string;
  body: string;
}

function planReminders(input: PlanInput): PlannedReminder[]; // sorted by date
```

**Window:** today through the next 13 days (14 calendar days). Only times strictly after `now` are returned.

**No routine** (`routine === null`) → empty list.

**Training reminders** (when `trainingEnabled`), for each date D in the window:
- Resolve the routine day with the existing `resolveTodayDayId(weekdaySchedule, weekdayFromDate(D), computeWeekNumber(startedAt, D))` (this handles alternating weekdays).
- Skip when it resolves to nothing, to an unknown day id, or to a day with `isRestDay`.
- Skip when D is in `completedDates`.
- Otherwise: title `💪 Hoy toca <day name>`, body `¡A entrenar!`.

**Streak at risk** (when `streakEnabled`):
- `streak = computeConsecutiveActiveWeeks(completedDates, now)` (existing Home function: counts the current week if it has a session, otherwise counts back from last week).
- `streak === 0` → no streak alert.
- If the current week (Monday–Sunday containing `now`) has **no** completed session: one alert on this week's Saturday.
- If the current week **has** a completed session: one alert on next week's Saturday. The plan assumes no future training; training makes the user open the app, which reschedules.
- At most one streak alert is ever planned. If its time is not after `now` (e.g. it's already Sunday), none.
- Title `🔥 Tu racha está en riesgo`, body `Llevás <streak> semana(s) seguidas. Entrená antes del domingo para no perderla.` (`semana` when 1, `semanas` otherwise).

## 5. Scheduler — `syncReminders` (side effects)

`src/lib/reminders/scheduler.ts`:

1. Load settings. Both disabled → cancel all of the app's scheduled notifications and stop.
2. Check the permission (`getPermissionsAsync`). Not granted → cancel all and stop (no prompt here).
3. Build `PlanInput`: `now`; settings; routine and days from the existing local SQLite cache (`resolveToday` / `getCachedActiveRoutine` / `getCachedRoutineDays`), so it works offline; `completedDates` from the local completed-dates store (§6).
4. `cancelAllScheduledNotificationsAsync()`, then schedule each planned reminder with a `DATE` trigger on the Android channel `reminders`.
5. Any error is caught and logged with `console.warn`; `syncReminders` never throws to its callers.

Also exports `cancelAllReminders()` (used on sign-out) and `sendTestReminder()` (immediate notification for the settings test button).

### When it runs

- Home load (after the existing sync), on every Home focus.
- Session completion (`useSessionSets.completeSession`), after today's date is added to the completed-dates store.
- Any change on the Ajustes screen.
- Sign-out: `cancelAllReminders()` (so a signed-out device never shows a routine's alerts).

## 6. Completed-dates store

AsyncStorage `fit-tracker:completed-session-dates`: a JSON array of `YYYY-MM-DD`.

- Home writes the dates from `listRecentCompletedSessions` whenever that request succeeds (replacing the stored list).
- `completeSession` appends today's local date (deduplicated).
- Read by `syncReminders`. Missing or unreadable → empty list.

## 7. App integration

- **Dependency**: `expo-notifications` via `npx expo install`. Local notifications work in Expo Go on Android and iOS (verified in the Expo docs 2026-10-12; only push was removed from Expo Go on Android in SDK 53).
- **Android channel** `reminders`, name "Recordatorios", default importance, created at app start.
- **Foreground**: a notification handler shows the banner and plays sound even when the app is open.
- **Tap**: a notification response listener in the root layout navigates to Home (`/(app)`).
- **Drawer**: new item **Ajustes** after "Historial".

## 8. Ajustes screen — `app/(app)/settings.tsx`

- Section "Recordatorio de entrenamiento": switch + "Te avisa los días que toca entrenar, si todavía no lo hiciste."
- Section "Racha en riesgo": switch + "Te avisa el sábado si todavía no entrenaste en la semana."
- "Hora": shows `HH:MM`; tapping opens a picker of hours (00–23) and minutes in 5-minute steps (00, 05, …, 55). One time for both alerts.
- Turning a switch on: if permission isn't granted, request it (`requestPermissionsAsync`). Denied → the switch stays off and the screen shows "Para recibir avisos, activá las notificaciones de Fit Tracker en los ajustes del celular." with a button "Abrir ajustes" (`Linking.openSettings()`).
- If permission is revoked later while a switch is on, the screen shows the same message (checked on focus) and `syncReminders` schedules nothing.
- With no active routine: "Activá una rutina para recibir recordatorios." (switches stay usable).
- Button "Enviar aviso de prueba": sends an immediate notification (`🔔 Aviso de prueba` / `Así te van a llegar los recordatorios.`); requests permission first if needed.
- Every change saves settings and runs `syncReminders`.

**Android delivery timing:** `DATE` triggers may arrive a few minutes late on Android (inexact alarms to save battery). Accepted; checked on device.

## 9. Error handling

- Permission denied/revoked: nothing scheduled, the message in Ajustes explains how to enable it.
- Scheduling failures: logged, never block Home, session completion, or the settings screen.
- Offline: the plan uses the local routine cache and the local completed-dates store.

## 10. Testing

### Unit
- `planReminders`:
  - one training reminder per training day in the 14-day window, at the configured time;
  - none on rest days or unscheduled weekdays;
  - alternating weekday resolved by week number;
  - none today if today is in `completedDates`; none today if the time already passed;
  - streak: this Saturday when the week has no session and streak > 0; next Saturday when this week has a session; none when streak is 0; none when its time has passed;
  - each kind off when its switch is off; empty with no routine;
  - titles/bodies, including the day name and `semana`/`semanas`.
- Settings storage and completed-dates store: defaults when empty, round trip, completed-dates append deduplicates (AsyncStorage jest mock, as in `currentSessionStorage.test.ts`).

### Manual (device)
1. Turning a switch on asks for permission.
2. With the time a few minutes ahead on a training day, the reminder arrives with the day name.
3. Tapping it opens Home.
4. Completing the session before the time cancels that day's reminder.
5. Denying permission shows the message and the "Abrir ajustes" button.
6. "Enviar aviso de prueba" shows a notification immediately.
7. After signing out, no reminders arrive.
