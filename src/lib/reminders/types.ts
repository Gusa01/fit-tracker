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
