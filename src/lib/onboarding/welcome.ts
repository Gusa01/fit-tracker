import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_ACCOUNT } from '../auth/demoAccount';

export interface WelcomeSlide {
  icon: 'barbell-outline' | 'list-outline' | 'home-outline' | 'trending-up-outline';
  title: string;
  body: string;
}

export const WELCOME_SLIDES: readonly WelcomeSlide[] = [
  {
    icon: 'barbell-outline',
    title: 'Bienvenido a Fit Tracker',
    body: 'Tu rutina, tus series y tu progreso en un solo lugar. Funciona aunque no tengas señal en el gimnasio.',
  },
  {
    icon: 'list-outline',
    title: 'Primero, armá tu rutina',
    body: 'En Rutinas: creá los días, elegí los ejercicios del catálogo y poné series y repeticiones. Después activala.',
  },
  {
    icon: 'home-outline',
    title: 'Entrená desde Inicio',
    body: 'Inicio te dice qué te toca hoy y cuánto levantar. Registrás cada serie al terminarla; la app ajusta el peso para la próxima.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Mirá cómo avanzás',
    body: 'En Progreso ves tus gráficos y récords, y en Historial cada sesión, que podés corregir.',
  },
];

export type WelcomeFinish = { label: string; destination: 'new-routine' | 'home' };

/** The demo account already has a routine, so it ends on the app instead of the routine form. */
export function welcomeFinish(email: string | undefined): WelcomeFinish {
  return email === DEMO_ACCOUNT.email
    ? { label: 'Ver la demo', destination: 'home' }
    : { label: 'Crear mi rutina', destination: 'new-routine' };
}

const KEY = 'fit-tracker:welcome-seen';

/** Per device. An unreadable value counts as not seen: showing the guide again is the harmless failure. */
export async function loadWelcomeSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  return raw === 'true';
}

export async function saveWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}
