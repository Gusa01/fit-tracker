jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_ACCOUNT } from '../../../src/lib/auth/demoAccount';
import { WELCOME_SLIDES, loadWelcomeSeen, saveWelcomeSeen, welcomeFinish } from '../../../src/lib/onboarding/welcome';

describe('welcome guide', () => {
  beforeEach(() => AsyncStorage.clear());

  it('has four slides, ending on progress', () => {
    expect(WELCOME_SLIDES.map((s) => s.title)).toEqual([
      'Bienvenido a Fit Tracker',
      'Primero, armá tu rutina',
      'Entrená desde Inicio',
      'Mirá cómo avanzás',
    ]);
  });

  it('sends invited users to the routine form and the demo to the app', () => {
    expect(welcomeFinish('friend@example.com')).toEqual({ label: 'Crear mi rutina', destination: 'new-routine' });
    expect(welcomeFinish(DEMO_ACCOUNT.email)).toEqual({ label: 'Ver la demo', destination: 'home' });
  });

  it('is unseen until saved, then stays seen', async () => {
    expect(await loadWelcomeSeen()).toBe(false);
    await saveWelcomeSeen();
    expect(await loadWelcomeSeen()).toBe(true);
  });

  it('treats an unexpected stored value as unseen', async () => {
    await AsyncStorage.setItem('fit-tracker:welcome-seen', 'garbage');
    expect(await loadWelcomeSeen()).toBe(false);
  });
});
