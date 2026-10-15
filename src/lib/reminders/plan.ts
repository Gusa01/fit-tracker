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
