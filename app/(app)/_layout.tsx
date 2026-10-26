import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Full screen, no tab bar, so a set isn't logged on a stray tab tap between sets. */}
      <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
    </Stack>
  );
}
