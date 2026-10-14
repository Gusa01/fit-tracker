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
  mergeCompletedDates,
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

  it('merges server dates with stored ones, sorted and without duplicates', async () => {
    await saveCompletedDates(['2026-10-12', '2026-10-05']);
    await mergeCompletedDates(['2026-10-07', '2026-10-05']);
    expect(await loadCompletedDates()).toEqual(['2026-10-05', '2026-10-07', '2026-10-12']);
  });

  it('keeps both writes when add and merge run concurrently', async () => {
    await Promise.all([addCompletedDate('2026-10-12'), mergeCompletedDates(['2026-10-05'])]);
    expect(await loadCompletedDates()).toEqual(['2026-10-05', '2026-10-12']);
  });
});
