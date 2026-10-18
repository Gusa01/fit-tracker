import { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outline: IconName, filled: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="routines" options={{ title: 'Rutinas', headerShown: false, tabBarIcon: tabIcon('list-outline', 'list') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: tabIcon('trending-up-outline', 'trending-up') }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: tabIcon('time-outline', 'time') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', headerShown: false, tabBarIcon: tabIcon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
