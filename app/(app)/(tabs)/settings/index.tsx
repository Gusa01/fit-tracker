import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Switch, Pressable, Modal, FlatList, StyleSheet, Linking, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  saveReminderSettings,
} from '../../../../src/lib/reminders/storage';
import { ReminderSettings } from '../../../../src/lib/reminders/types';
import {
  getNotificationPermissionStatus,
  notificationsAvailable,
  requestNotificationPermission,
  sendTestReminder,
  syncReminders,
  cancelAllReminders,
} from '../../../../src/lib/reminders/scheduler';
import { supabase } from '../../../../src/lib/supabase';
import { getDatabase } from '../../../../src/lib/sqlite/db';
import { getCachedActiveRoutine } from '../../../../src/lib/sqlite/cache';
import { AppText, Banner, Button, Card, Chip, Screen } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { ThemePreference } from '../../../../src/theme/preference';
import { ColorTokens } from '../../../../src/theme/colors';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [hasRoutine, setHasRoutine] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Handlers read the latest settings from here, not from the render-time snapshot.
  const settingsRef = useRef<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const stored = await loadReminderSettings();
        settingsRef.current = stored;
        setSettings(stored);
        setLoaded(true);
        const anyOn = stored.trainingEnabled || stored.streakEnabled;
        setPermissionDenied(anyOn && (await getNotificationPermissionStatus()) === 'denied');
        const routine = getCachedActiveRoutine(getDatabase());
        setHasRoutine(routine !== null && routine.started_at !== null);
      })().catch((err) => console.warn('Could not load reminder settings', err));
    }, [])
  );

  async function apply(change: Partial<ReminderSettings>) {
    const next = { ...settingsRef.current, ...change };
    settingsRef.current = next;
    setSettings(next);
    await saveReminderSettings(next).catch((err) => console.warn('Could not save reminder settings', err));
    syncReminders();
  }

  async function toggle(key: 'trainingEnabled' | 'streakEnabled', value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission().catch(() => false);
      setPermissionDenied(!granted);
      if (!granted) return;
    }
    await apply({ [key]: value });
    if (!settingsRef.current.trainingEnabled && !settingsRef.current.streakEnabled) setPermissionDenied(false);
  }

  async function handleTest() {
    const granted = await requestNotificationPermission().catch(() => false);
    setPermissionDenied(!granted);
    if (!granted) return;
    await sendTestReminder().catch(() => Alert.alert('Error', 'No se pudo enviar el aviso de prueba.'));
  }

  return (
    <Screen scroll>
      <Card>
        <AppText variant="heading">Apariencia</AppText>
        <View style={styles.chips}>
          {THEME_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={preference === option.value}
              onPress={() => setPreference(option.value)}
            />
          ))}
        </View>
      </Card>

      {!notificationsAvailable() && (
        <Banner tone="warning">
          <AppText color="warning">
            Esta versión de la app no puede mostrar notificaciones. Los recordatorios funcionan en la app instalada.
          </AppText>
        </Banner>
      )}

      {notificationsAvailable() && permissionDenied && (
        <Banner tone="warning">
          <AppText color="warning">
            Para recibir avisos, activá las notificaciones de Fit Tracker en los ajustes del celular.
          </AppText>
          <View style={styles.warningButton}>
            <Button title="Abrir ajustes" onPress={() => Linking.openSettings()} />
          </View>
        </Banner>
      )}

      {!hasRoutine && <AppText variant="muted">Activá una rutina para recibir recordatorios.</AppText>}

      <Card>
        <View style={styles.row}>
          <AppText variant="heading" style={styles.title}>
            Recordatorio de entrenamiento
          </AppText>
          <Switch
            disabled={!loaded}
            trackColor={{ false: colors.surfaceMuted, true: colors.accent }}
            thumbColor={colors.onDark}
            value={settings.trainingEnabled}
            onValueChange={(v) => toggle('trainingEnabled', v)}
          />
        </View>
        <AppText variant="muted">Te avisa los días que toca entrenar, si todavía no lo hiciste.</AppText>
      </Card>

      <Card>
        <View style={styles.row}>
          <AppText variant="heading" style={styles.title}>
            Racha en riesgo
          </AppText>
          <Switch
            disabled={!loaded}
            trackColor={{ false: colors.surfaceMuted, true: colors.accent }}
            thumbColor={colors.onDark}
            value={settings.streakEnabled}
            onValueChange={(v) => toggle('streakEnabled', v)}
          />
        </View>
        <AppText variant="muted">Te avisa el sábado si todavía no entrenaste en la semana.</AppText>
      </Card>

      <Pressable disabled={!loaded} onPress={() => setPickerOpen(true)}>
        <Card style={styles.row}>
          <AppText variant="heading" style={styles.title}>
            Hora
          </AppText>
          <AppText variant="heading">
            {pad(settings.hour)}:{pad(settings.minute)} ▾
          </AppText>
        </Card>
      </Pressable>

      <Button title="Enviar aviso de prueba" variant="secondary" disabled={!loaded} onPress={handleTest} />

      <Pressable onPress={() => router.push('/(app)/(tabs)/settings/credits')}>
        <Card style={styles.row}>
          <AppText variant="heading" style={styles.title}>
            Créditos de imágenes ›
          </AppText>
        </Card>
      </Pressable>

      <Button
        title="Cerrar sesión"
        variant="danger"
        onPress={async () => {
          await cancelAllReminders();
          await supabase.auth.signOut();
        }}
      />

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <AppText variant="heading">Elegí la hora</AppText>
          <View style={styles.columns}>
            <FlatList
              style={styles.column}
              data={HOURS}
              extraData={settings}
              keyExtractor={(h) => `h${h}`}
              renderItem={({ item }) => (
                <Pressable style={styles.option} onPress={() => apply({ hour: item })}>
                  <Text style={[styles.optionText, item === settings.hour && styles.optionActive]}>{pad(item)}</Text>
                </Pressable>
              )}
            />
            <FlatList
              style={styles.column}
              data={MINUTES}
              extraData={settings}
              keyExtractor={(m) => `m${m}`}
              renderItem={({ item }) => (
                <Pressable style={styles.option} onPress={() => apply({ minute: item })}>
                  <Text style={[styles.optionText, item === settings.minute && styles.optionActive]}>{pad(item)}</Text>
                </Pressable>
              )}
            />
          </View>
          <Button title="Listo" onPress={() => setPickerOpen(false)} />
        </View>
      </Modal>
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    chips: { flexDirection: 'row', gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { flexShrink: 1 },
    warningButton: { alignSelf: 'flex-start' },
    backdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      maxHeight: '60%',
      backgroundColor: c.surface,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      padding: 16,
      gap: 8,
    },
    columns: { flexDirection: 'row', gap: 16, flexShrink: 1 },
    column: { flex: 1 },
    option: { paddingVertical: 10, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
    optionText: { fontSize: 16, color: c.textMuted },
    optionActive: { color: c.text, fontWeight: '700' },
  });
}
