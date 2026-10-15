import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../supabase';
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

/** 'undetermined' = the system prompt can still be shown; 'denied' = only the phone settings can change it. */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) return 'granted';
  return permissions.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (await hasNotificationPermission()) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function syncOnce(): Promise<void> {
  // Reads the locally stored session (no network): never schedule on a signed-out device.
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

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

/** Used on sign-out. Runs in the sync chain so it can't interleave with a sync. Never rejects. */
export function cancelAllReminders(): Promise<void> {
  syncChain = syncChain.then(() =>
    Notifications.cancelAllScheduledNotificationsAsync().catch((err) => {
      console.warn('Could not cancel reminders', err);
    })
  );
  return syncChain;
}

export async function sendTestReminder(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: '🔔 Aviso de prueba', body: 'Así te van a llegar los recordatorios.' },
    trigger: Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : null,
  });
}
