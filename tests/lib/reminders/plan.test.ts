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
