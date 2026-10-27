import { buildOtherDayOptions, weekDates } from '../../../src/lib/home/otherDays';
import { formatDateOnly } from '../../../src/lib/sessions/weekResolution';

describe('weekDates', () => {
  it('runs Monday to Sunday around a mid-week day', () => {
    const dates = weekDates(new Date(2026, 9, 28)).map(formatDateOnly); // Wednesday
    expect(dates[0]).toBe('2026-10-26');
    expect(dates[6]).toBe('2026-11-01');
  });

  it('puts a Sunday at the end of its week, not the start of the next', () => {
    expect(formatDateOnly(weekDates(new Date(2026, 10, 1))[0])).toBe('2026-10-26');
  });
});

describe('buildOtherDayOptions', () => {
  const days = [
    { id: 'push', name: 'Push', is_rest_day: false },
    { id: 'pull', name: 'Pull', is_rest_day: false },
    { id: 'rest', name: 'Descanso', is_rest_day: true },
  ];
  const schedule = { mon: 'push', wed: 'pull', fri: 'push' };
  const startedLongAgo = new Date(2026, 8, 1).toISOString();
  const tuesday = new Date(2026, 9, 27, 10);

  it('owes a training day that was scheduled earlier this week and not trained', () => {
    const options = buildOtherDayOptions(schedule, days, startedLongAgo, [], tuesday);
    const push = options.find((o) => o.dayId === 'push');
    expect(push?.pendingDate).toBe('2026-10-26');
    expect(push?.pendingWeekday).toBe('lunes');
  });

  it('owes nothing for days still ahead this week', () => {
    const options = buildOtherDayOptions(schedule, days, startedLongAgo, [], tuesday);
    expect(options.find((o) => o.dayId === 'pull')?.pendingDate).toBeNull();
  });

  it('stops owing a day once it was trained on any day of the week', () => {
    const sessions = [{ routineDayId: 'push', sessionDate: '2026-10-27' }];
    const options = buildOtherDayOptions(schedule, days, startedLongAgo, sessions, tuesday);
    expect(options.find((o) => o.dayId === 'push')?.pendingDate).toBeNull();
  });

  it('owes a day scheduled twice once per missed date, naming the latest one', () => {
    const saturday = new Date(2026, 9, 31, 10);
    const oneDone = [{ routineDayId: 'push', sessionDate: '2026-10-26' }];
    expect(buildOtherDayOptions(schedule, days, startedLongAgo, oneDone, saturday)[0].pendingWeekday).toBe('viernes');
    const bothDone = [...oneDone, { routineDayId: 'push', sessionDate: '2026-10-31' }];
    expect(buildOtherDayOptions(schedule, days, startedLongAgo, bothDone, saturday)[0].pendingDate).toBeNull();
  });

  it('ignores dates before the routine was started', () => {
    const startedToday = new Date(2026, 9, 27, 8).toISOString();
    const options = buildOtherDayOptions(schedule, days, startedToday, [], tuesday);
    expect(options.every((o) => o.pendingDate === null)).toBe(true);
  });

  it('starts over on Monday: last week is never owed', () => {
    const monday = new Date(2026, 10, 2, 10);
    const options = buildOtherDayOptions(schedule, days, startedLongAgo, [], monday);
    expect(options.every((o) => o.pendingDate === null)).toBe(true);
  });

  it('lists training days in routine order with the weekdays they fall on, leaving rest days out', () => {
    const options = buildOtherDayOptions(schedule, days, startedLongAgo, [], tuesday);
    expect(options.map((o) => [o.dayName, o.scheduledOn])).toEqual([
      ['Push', ['lunes', 'viernes']],
      ['Pull', ['miércoles']],
    ]);
  });

  it('resolves alternating weeks per date', () => {
    const alternating = { mon: { even_week: 'pull', odd_week: 'push' } };
    // Started Monday 2026-10-19, so 2026-10-26 is week 2 (even): Pull was due.
    const started = new Date(2026, 9, 19, 8).toISOString();
    const options = buildOtherDayOptions(alternating, days, started, [], tuesday);
    expect(options.find((o) => o.dayId === 'pull')?.pendingWeekday).toBe('lunes');
    expect(options.find((o) => o.dayId === 'push')?.pendingDate).toBeNull();
  });
});
