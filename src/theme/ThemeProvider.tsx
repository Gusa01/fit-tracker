import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { ColorTokens, darkColors, lightColors } from './colors';
import { loadThemePreference, resolveScheme, saveThemePreference, ThemePreference } from './preference';

interface ThemeValue {
  colors: ColorTokens;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    loadThemePreference().then(setPreferenceState);
  }, []);

  // Makes native Alerts and the keyboard follow the in-app choice; 'unspecified' restores the system scheme
  // (Android rejects null).
  useEffect(() => {
    try {
      Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
    } catch (err) {
      console.warn('Could not set the native color scheme', err);
    }
  }, [preference]);

  const scheme = resolveScheme(preference, system === 'light' || system === 'dark' ? system : null);
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeValue>(
    () => ({
      colors,
      scheme,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        saveThemePreference(next).catch((err) => console.warn('Could not save theme preference', err));
      },
    }),
    [colors, scheme, preference]
  );

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [scheme, colors]);

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
