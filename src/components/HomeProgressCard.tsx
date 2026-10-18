import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useProgressSummary } from '../hooks/useExerciseProgress';
import { bestSetPerSession } from '../lib/progress/metrics';
import { groupByExercise } from '../lib/progress/records';
import { pickSpotlightExercise } from '../lib/progress/spotlight';
import { loadSpotlightExerciseId, saveSpotlightExerciseId } from '../lib/progress/spotlightPreference';
import { formatMetricValue } from '../lib/progress/format';
import { Trend } from '../lib/progress/types';
import { ProgressChart } from './ProgressChart';
import { AppText, Card } from './ui';
import { ColorTokens } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

const TREND_ARROW: Record<Trend, string> = { up: '↑', flat: '→', down: '↓' };
const TREND_COLOR: Record<Trend, keyof ColorTokens> = { up: 'success', flat: 'textMuted', down: 'danger' };

/** Home's "Progreso" section: one exercise's chart with a picker, linking to the full list. */
export function HomeProgressCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuthSession();
  const { rows, summaries, isLoading, error } = useProgressSummary(session?.user.id);
  const { width: screenWidth } = useWindowDimensions();
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    loadSpotlightExerciseId()
      .then(setPreferredId)
      .catch(() => {});
  }, []);

  const exerciseId = pickSpotlightExercise(summaries, preferredId);
  const summary = summaries.find((s) => s.exerciseId === exerciseId) ?? null;
  const points = useMemo(
    () => (summary ? bestSetPerSession(groupByExercise(rows).get(summary.exerciseId) ?? [], summary.metric) : []),
    [rows, summary]
  );

  function choose(id: string) {
    setPreferredId(id);
    setPickerOpen(false);
    saveSpotlightExerciseId(id).catch(() => {});
  }

  if (isLoading && summaries.length === 0) {
    return (
      <Card>
        <AppText variant="heading" style={styles.title}>
          Progreso
        </AppText>
        <ActivityIndicator color={colors.accent} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <AppText variant="heading" style={styles.title}>
          Progreso
        </AppText>
        <AppText variant="muted">{error}</AppText>
      </Card>
    );
  }

  if (!summary) return null;

  // Home padding 16x2, card padding 16x2 + border 1x2
  const chartWidth = screenWidth - 32 - 34;

  return (
    <Card>
      <AppText variant="heading" style={styles.title}>
        Progreso
      </AppText>

      <Pressable style={styles.selector} onPress={() => setPickerOpen(true)}>
        <Text style={styles.selectorText} numberOfLines={1}>
          {summary.exerciseName} ▾
        </Text>
        {summary.latestValue !== null && (
          <Text style={styles.value}>{formatMetricValue(summary.latestValue, summary.metric)}</Text>
        )}
        {summary.trend && (
          <Text style={[styles.arrow, { color: colors[TREND_COLOR[summary.trend]] }]}>{TREND_ARROW[summary.trend]}</Text>
        )}
      </Pressable>

      <ProgressChart key={summary.exerciseId} points={points} metric={summary.metric} width={chartWidth} height={160} />

      <Pressable onPress={() => router.push('/(app)/(tabs)/progress' as any)}>
        <Text style={styles.link}>Ver todo →</Text>
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Elegí un ejercicio</Text>
          <FlatList
            data={summaries}
            keyExtractor={(item) => item.exerciseId}
            renderItem={({ item }) => (
              <Pressable style={styles.option} onPress={() => choose(item.exerciseId)}>
                <Text style={[styles.optionText, item.exerciseId === summary.exerciseId && styles.optionActive]}>
                  {item.exerciseName}
                </Text>
                {item.trend && (
                  <Text style={[styles.arrow, { color: colors[TREND_COLOR[item.trend]] }]}>{TREND_ARROW[item.trend]}</Text>
                )}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </Card>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    title: { fontSize: 15 },
    selector: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
    selectorText: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text },
    value: { fontSize: 16, fontWeight: '600', color: c.text },
    arrow: { fontSize: 18, width: 18, textAlign: 'center' },
    link: { color: c.accent, fontWeight: '600', textAlign: 'right' },
    backdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      maxHeight: '60%',
      backgroundColor: c.surface,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      paddingVertical: 12,
    },
    sheetTitle: { fontWeight: '700', fontSize: 16, paddingHorizontal: 16, paddingBottom: 8, color: c.text },
    option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
    optionText: { flex: 1, fontSize: 15, color: c.text },
    optionActive: { fontWeight: '700' },
  });
}
