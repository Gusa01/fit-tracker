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

// Every write to the dates key runs one at a time so concurrent read-modify-writes can't drop a date.
let datesChain: Promise<unknown> = Promise.resolve();

function serializeDatesWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = datesChain.then(task);
  datesChain = result.catch(() => {});
  return result;
}

async function writeDates(dates: string[]): Promise<void> {
  await AsyncStorage.setItem(DATES_KEY, JSON.stringify(dates));
}

export function saveCompletedDates(dates: string[]): Promise<void> {
  return serializeDatesWrite(() => writeDates(dates));
}

export function addCompletedDate(date: string): Promise<void> {
  return serializeDatesWrite(async () => {
    const dates = await loadCompletedDates();
    if (!dates.includes(date)) await writeDates([...dates, date]);
  });
}

/** Completed sessions are never un-completed, so the union of stored and server dates is correct. */
export function mergeCompletedDates(serverDates: string[]): Promise<void> {
  return serializeDatesWrite(async () => {
    const stored = await loadCompletedDates();
    await writeDates([...new Set([...stored, ...serverDates])].sort());
  });
}
