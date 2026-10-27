import { Weekday } from '../routines/types';
import { computeWeekNumber, formatDateOnly, resolveTodayDayId, weekdayFromDate } from '../sessions/weekResolution';

const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: 'lunes',
  tue: 'martes',
  wed: 'miércoles',
  thu: 'jueves',
  fri: 'viernes',
  sat: 'sábado',
  sun: 'domingo',
};

interface OtherDaysRoutineDay {
  id: string;
  name: string;
  is_rest_day: boolean;
}

export interface OtherDayOption {
  dayId: string;
  dayName: string;
  /** Weekdays this day is scheduled on this week, e.g. ["lunes", "jueves"]. */
  scheduledOn: string[];
  /** The most recent date this week it was due and not trained, or null when nothing is owed. */
  pendingDate: string | null;
  pendingWeekday: string | null;
}

/** Monday to Sunday of the local week that contains `today`. */
export function weekDates(today: Date): Date[] {
  const fromMonday = (today.getDay() + 6) % 7;
  return Array.from(
    { length: 7 },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - fromMonday + i)
  );
}

/**
 * Every training day of the routine, in routine order, with whether this week still owes it. A day is owed
 * once for each scheduled date before today that no session of that day this week makes up for, so a missed
 * Monday "Push" stops being owed as soon as Push is trained on any day of the same week. Dates before the
 * routine was started never count, and the count starts over every Monday.
 */
export function buildOtherDayOptions(
  weekdaySchedule: Record<string, unknown>,
  days: OtherDaysRoutineDay[],
  startedAt: string,
  sessionsThisWeek: { routineDayId: string; sessionDate: string }[],
  today: Date
): OtherDayOption[] {
  const todayStr = formatDateOnly(today);
  const startedStr = formatDateOnly(new Date(startedAt));
  const schedule = weekDates(today).map((date) => ({
    date: formatDateOnly(date),
    weekday: weekdayFromDate(date),
    dayId: resolveTodayDayId(weekdaySchedule, weekdayFromDate(date), computeWeekNumber(startedAt, date)),
  }));

  return days
    .filter((day) => !day.is_rest_day)
    .map((day) => {
      const own = schedule.filter((entry) => entry.dayId === day.id);
      const due = own.filter((entry) => entry.date < todayStr && entry.date >= startedStr);
      const trained = sessionsThisWeek.filter((s) => s.routineDayId === day.id).length;
      const owed = due.slice(trained);
      const latest = owed.length > 0 ? owed[owed.length - 1] : null;
      return {
        dayId: day.id,
        dayName: day.name,
        scheduledOn: own.map((entry) => WEEKDAY_NAMES[entry.weekday]),
        pendingDate: latest?.date ?? null,
        pendingWeekday: latest ? WEEKDAY_NAMES[latest.weekday] : null,
      };
    });
}
