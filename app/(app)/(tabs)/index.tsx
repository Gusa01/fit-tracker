import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useHomeData } from '../../../src/hooks/useHomeData';
import { WeekCalendarStrip } from '../../../src/components/WeekCalendarStrip';
import { HomeProgressCard } from '../../../src/components/HomeProgressCard';
import { OtherDaySheet } from '../../../src/components/OtherDaySheet';
import { formatDateOnly } from '../../../src/lib/sessions/weekResolution';
import { AppText, Banner, Button, Card, Screen } from '../../../src/components/ui';
import { formatShortDate } from '../../../src/lib/progress/format';
import { loadWelcomeSeen } from '../../../src/lib/onboarding/welcome';
import { ColorTokens } from '../../../src/theme/colors';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function Home() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    loading,
    error,
    routineName,
    weekNumber,
    weekProgress,
    weekCalendar,
    todayDayName,
    todayIsRestDay,
    sessionStatus,
    startOrResumeSession,
    deloadExerciseName,
    routineSwitchAvailable,
    nextRoutineName,
    dismissDeload,
    dismissSwitch,
    acceptDeload,
    acceptSwitch,
    recentActivity,
    consistencyStreak,
    otherDays,
    pendingDay,
  } = useHomeData();
  const [pickingDay, setPickingDay] = useState(false);
  const now = new Date();
  const yesterday = formatDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  // First visit on this device: show the welcome guide over Home.
  useEffect(() => {
    loadWelcomeSeen().then((seen) => {
      if (!seen) router.push('/(app)/welcome');
    });
  }, []);

  async function handleStart(dayId?: string) {
    const sessionId = await startOrResumeSession(dayId);
    if (sessionId) {
      router.push(`/(app)/session/${sessionId}`);
    }
  }

  async function handleAcceptDeload() {
    try {
      await acceptDeload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar el deload.');
    }
  }

  async function handleAcceptSwitch() {
    try {
      await acceptSwitch();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cambiar de rutina.');
    }
  }

  return (
    <Screen scroll padded={false}>
      <View style={styles.container}>
        {loading && <ActivityIndicator color={colors.accent} />}
        {error && <AppText color="danger">{error}</AppText>}

        {!loading && !error && (
          <>
            {routineName ? (
              <>
                <Card style={styles.fullWidth}>
                  <AppText style={styles.routineName}>{routineName}</AppText>
                  {weekProgress !== null ? (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${weekProgress * 100}%` }]} />
                    </View>
                  ) : (
                    <AppText variant="muted" style={styles.weekLabel}>
                      Semana {weekNumber}
                    </AppText>
                  )}

                  <WeekCalendarStrip days={weekCalendar} />

                  {todayDayName ? (
                    todayIsRestDay ? (
                      <AppText>Hoy: {todayDayName} (descanso)</AppText>
                    ) : (
                      <>
                        <AppText>Hoy: {todayDayName}</AppText>
                        {sessionStatus === 'completed' ? (
                          <AppText color="success" style={styles.doneLabel}>
                            ✓ Entrenamiento completado hoy
                          </AppText>
                        ) : (
                          <Button
                            title={
                              sessionStatus === 'in_progress' ? 'Continuar entrenamiento' : 'Empezar entrenamiento'
                            }
                            onPress={() => handleStart()}
                          />
                        )}
                      </>
                    )
                  ) : (
                    <AppText>No hay entrenamiento programado para hoy.</AppText>
                  )}

                  {pendingDay && (
                    <Banner tone="warning">
                      <AppText color="warning">
                        {pendingDay.pendingDate === yesterday ? 'Ayer' : `El ${pendingDay.pendingWeekday}`} te tocaba{' '}
                        {pendingDay.dayName} y no lo hiciste.
                      </AppText>
                      <View style={styles.pendingButton}>
                        <Button
                          title={`Hacer ${pendingDay.dayName} hoy`}
                          onPress={() => handleStart(pendingDay.dayId)}
                        />
                      </View>
                    </Banner>
                  )}

                  {otherDays.length > 0 && (
                    <Button title="Entrenar otro día ›" variant="ghost" onPress={() => setPickingDay(true)} />
                  )}
                </Card>

                <OtherDaySheet
                  visible={pickingDay}
                  options={otherDays}
                  onClose={() => setPickingDay(false)}
                  onPick={(dayId) => {
                    setPickingDay(false);
                    handleStart(dayId);
                  }}
                />

                {consistencyStreak > 0 && (
                  <Banner tone="warning">
                    {`🔥 ${consistencyStreak} ${
                      consistencyStreak === 1 ? 'semana consecutiva' : 'semanas consecutivas'
                    } entrenando`}
                  </Banner>
                )}

                {recentActivity.length > 0 && (
                  <Card style={styles.fullWidth}>
                    <AppText variant="heading" style={styles.sectionTitle}>
                      Actividad reciente
                    </AppText>
                    {recentActivity.map((entry) => (
                      <Pressable
                        key={entry.sessionId}
                        style={styles.activityPressable}
                        onPress={() => router.push(`/(app)/(tabs)/history/${entry.sessionId}`, { withAnchor: true })}
                      >
                        <AppText>
                          {entry.dayName} — {formatShortDate(entry.sessionDate)}
                        </AppText>
                        <AppText variant="muted" style={styles.activityChevron}>
                          ›
                        </AppText>
                      </Pressable>
                    ))}
                  </Card>
                )}

                <HomeProgressCard />
              </>
            ) : (
              <Card style={styles.fullWidth}>
                <AppText>No tenés una rutina activa. Activá una desde la pestaña Rutinas.</AppText>
              </Card>
            )}
          </>
        )}

        {deloadExerciseName && (
          <Banner tone="warning">
            <AppText>¿Bajarle la intensidad a "{deloadExerciseName}"? Viene costando en las últimas sesiones.</AppText>
            <View style={styles.bannerActions}>
              <View style={styles.bannerAction}>
                <Button title="Aceptar" onPress={handleAcceptDeload} />
              </View>
              <View style={styles.bannerAction}>
                <Button title="Ignorar" variant="secondary" onPress={dismissDeload} />
              </View>
            </View>
          </Banner>
        )}

        {routineSwitchAvailable && (
          <Banner tone="warning">
            <AppText>
              Ya pasaron las semanas sugeridas de esta rutina
              {nextRoutineName ? ` — ¿cambiar a "${nextRoutineName}"?` : '.'}
            </AppText>
            <View style={styles.bannerActions}>
              <View style={styles.bannerAction}>
                <Button title="Aceptar" onPress={handleAcceptSwitch} />
              </View>
              <View style={styles.bannerAction}>
                <Button title="Ignorar" variant="secondary" onPress={dismissSwitch} />
              </View>
            </View>
          </Banner>
        )}
      </View>
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: { gap: 16, padding: 16 },
    fullWidth: { width: '100%' },
    routineName: { fontSize: 20, fontWeight: '700' },
    weekLabel: { fontSize: 15 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: c.accent },
    doneLabel: { fontWeight: '600' },
    sectionTitle: { fontSize: 15 },
    activityPressable: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    activityChevron: { fontSize: 18 },
    bannerActions: { flexDirection: 'row', gap: 8 },
    bannerAction: { flex: 1 },
    pendingButton: { marginTop: 8 },
  });
}
