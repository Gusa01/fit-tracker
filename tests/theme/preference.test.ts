jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadThemePreference, saveThemePreference, resolveScheme } from '../../src/theme/preference';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('theme preference', () => {
  it('defaults to system, round-trips, and falls back on garbage', async () => {
    expect(await loadThemePreference()).toBe('system');
    await saveThemePreference('dark');
    expect(await loadThemePreference()).toBe('dark');
    await AsyncStorage.setItem('fit-tracker:theme-preference', 'purple');
    expect(await loadThemePreference()).toBe('system');
  });
});

describe('resolveScheme', () => {
  it('follows the device for system and overrides otherwise', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});
