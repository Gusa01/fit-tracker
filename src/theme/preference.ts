import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'fit-tracker:theme-preference';

export async function loadThemePreference(): Promise<ThemePreference> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEY, preference);
}

export function resolveScheme(
  preference: ThemePreference,
  system: 'light' | 'dark' | null | undefined
): 'light' | 'dark' {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}
