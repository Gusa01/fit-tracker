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
jest.mock('../../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'u' } } } })) } },
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
import { supabase } from '../../../src/lib/supabase';
import { cancelAllReminders, syncReminders } from '../../../src/lib/reminders/scheduler';

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

  it('only cancels when there is no signed-in session', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: null } });
    await syncReminders();
    expect(calls).toEqual(['cancel']);
  });

  it('runs cancelAllReminders after a sync that is already running', async () => {
    const sync = syncReminders();
    const cancel = cancelAllReminders();
    await Promise.all([sync, cancel]);
    expect(calls.length).toBeGreaterThan(2);
    expect(calls[calls.length - 1]).toBe('cancel');
  });

  it('never rejects when scheduling fails', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(syncReminders()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
