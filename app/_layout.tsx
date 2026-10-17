import { ReactNode, useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthSession } from '../src/hooks/useAuthSession';
import { initDatabase, getDatabase } from '../src/lib/sqlite/db';
import { supabase } from '../src/lib/supabase';
import { startSyncListener } from '../src/lib/sync/syncService';
import * as Notifications from 'expo-notifications';
import { cancelAllReminders, setupNotifications } from '../src/lib/reminders/scheduler';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

initDatabase();

function ThemedRoot({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      {children}
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const { session, isLoading } = useAuthSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, isLoading, segments]);

  // Covers token expiry and remote sign-out, not just the drawer button.
  useEffect(() => {
    if (!isLoading && !session) cancelAllReminders();
  }, [isLoading, session]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const stop = startSyncListener(getDatabase(), supabase, userId);
    return stop;
  }, [session?.user.id]);

  useEffect(() => {
    setupNotifications().catch((err) => console.warn('Could not set up notifications', err));
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate('/(app)' as any);
    });
    return () => subscription.remove();
  }, []);

  if (isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedRoot>
            <Slot />
          </ThemedRoot>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
