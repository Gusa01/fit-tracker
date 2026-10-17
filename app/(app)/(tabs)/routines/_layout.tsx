import { Stack } from 'expo-router';
import { useTheme } from '../../../../src/theme/ThemeProvider';

export const unstable_settings = { initialRouteName: 'index' };

// This stack owns the header (the tab's own header is hidden) so nested screens get a back arrow.
export default function RoutinesLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Rutinas' }} />
      <Stack.Screen name="new" options={{ title: 'Nueva rutina' }} />
      <Stack.Screen name="[routineId]" options={{ title: 'Editar rutina' }} />
    </Stack>
  );
}
