import { useCallback, useRef, useState } from 'react';
import { View, Text, Switch, Pressable, Modal, FlatList, StyleSheet, Linking, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DEFAULT_REMINDER_SETTINGS, loadReminderSettings, saveReminderSettings } from '../../src/lib/reminders/storage';
import { ReminderSettings } from '../../src/lib/reminders/types';
import {
  hasNotificationPermission,
  requestNotificationPermission,
  sendTestReminder,
  syncReminders,
} from '../../src/lib/reminders/scheduler';
import { getDatabase } from '../../src/lib/sqlite/db';
import { getCachedActiveRoutine } from '../../src/lib/sqlite/cache';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

export default function SettingsScreen() {
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
        setPermissionDenied(anyOn && !(await hasNotificationPermission()));
        setHasRoutine(getCachedActiveRoutine(getDatabase()) !== null);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {permissionDenied && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Para recibir avisos, activá las notificaciones de Fit Tracker en los ajustes del celular.
          </Text>
          <Pressable style={styles.warningButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.warningButtonText}>Abrir ajustes</Text>
          </Pressable>
        </View>
      )}

      {!hasRoutine && <Text style={styles.muted}>Activá una rutina para recibir recordatorios.</Text>}

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>Recordatorio de entrenamiento</Text>
          <Switch disabled={!loaded} value={settings.trainingEnabled} onValueChange={(v) => toggle('trainingEnabled', v)} />
        </View>
        <Text style={styles.muted}>Te avisa los días que toca entrenar, si todavía no lo hiciste.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>Racha en riesgo</Text>
          <Switch disabled={!loaded} value={settings.streakEnabled} onValueChange={(v) => toggle('streakEnabled', v)} />
        </View>
        <Text style={styles.muted}>Te avisa el sábado si todavía no entrenaste en la semana.</Text>
      </View>

      <Pressable style={[styles.card, styles.row]} disabled={!loaded} onPress={() => setPickerOpen(true)}>
        <Text style={styles.title}>Hora</Text>
        <Text style={styles.time}>
          {pad(settings.hour)}:{pad(settings.minute)} ▾
        </Text>
      </Pressable>

      <Pressable style={styles.testButton} disabled={!loaded} onPress={handleTest}>
        <Text style={styles.testButtonText}>Enviar aviso de prueba</Text>
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Elegí la hora</Text>
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
          <Pressable style={styles.doneButton} onPress={() => setPickerOpen(false)}>
            <Text style={styles.doneText}>Listo</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  muted: { color: '#666' },
  time: { fontSize: 16, fontWeight: '700' },
  warning: { borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fffbeb', borderRadius: 8, padding: 12, gap: 8 },
  warningText: { color: '#92400e' },
  warningButton: { alignSelf: 'flex-start', backgroundColor: '#111', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  warningButtonText: { color: '#fff', fontWeight: '600' },
  testButton: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  testButtonText: { color: '#111', fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '60%', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16, gap: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  columns: { flexDirection: 'row', gap: 16, flexShrink: 1 },
  column: { flex: 1 },
  option: { paddingVertical: 10, alignItems: 'center' },
  optionText: { fontSize: 16, color: '#666' },
  optionActive: { color: '#111', fontWeight: '700' },
  doneButton: { backgroundColor: '#111', borderRadius: 8, padding: 12, alignItems: 'center' },
  doneText: { color: '#fff', fontWeight: '700' },
});
