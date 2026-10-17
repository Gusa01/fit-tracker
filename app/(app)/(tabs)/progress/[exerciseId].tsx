import { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthSession } from '../../../../src/hooks/useAuthSession';
import { useExerciseProgress } from '../../../../src/hooks/useExerciseProgress';
import { ProgressChart } from '../../../../src/components/ProgressChart';
import { AppText, Button, Card, Chip, Screen } from '../../../../src/components/ui';
import { bestSetPerSession, metricKind, primaryMetric } from '../../../../src/lib/progress/metrics';
import { computeRecords } from '../../../../src/lib/progress/records';
import {
  RECORD_LABEL,
  TOGGLE_LABEL,
  formatMetricValue,
  formatShortDate,
  formatSourceSet,
} from '../../../../src/lib/progress/format';
import { Metric, RecordEntry } from '../../../../src/lib/progress/types';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { ColorTokens } from '../../../../src/theme/colors';

export default function ExerciseProgressDetail() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { session } = useAuthSession();
  const { rows, isLoading, error, refetch } = useExerciseProgress(session?.user.id, exerciseId);
  const { width: screenWidth } = useWindowDimensions();
  const [toggle, setToggle] = useState<'e1rm' | 'weight'>('e1rm');

  const kind = rows.length > 0 ? metricKind(rows) : null;
  const metric: Metric | null = kind === 'weighted' ? toggle : kind ? primaryMetric(kind) : null;
  const points = useMemo(() => (metric ? bestSetPerSession(rows, metric) : []), [rows, metric]);
  const records = useMemo(() => (rows.length > 0 ? computeRecords(rows) : null), [rows]);
  const exerciseName = rows.length > 0 ? rows[rows.length - 1].exercise_name : '';

  if (isLoading && rows.length === 0) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.centered}>
          <AppText variant="muted" style={styles.message}>
            {error}
          </AppText>
          <View style={styles.retry}>
            <Button title="Reintentar" onPress={refetch} />
          </View>
        </View>
      </Screen>
    );
  }

  // screen padding 16x2, card padding 12x2 + border 1x2
  const chartWidth = screenWidth - 32 - 26;

  const recordRows: Array<{ metric: Metric; entry: RecordEntry | null }> = records
    ? kind === 'weighted'
      ? [
          { metric: 'e1rm', entry: records.bestE1rm },
          { metric: 'weight', entry: records.bestWeight },
        ]
      : kind === 'seconds'
        ? [{ metric: 'seconds', entry: records.bestSeconds }]
        : [{ metric: 'reps', entry: records.bestReps }]
    : [];

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
        <AppText style={styles.back}>←</AppText>
        <AppText variant="title" style={styles.title}>
          {exerciseName}
        </AppText>
      </Pressable>

      {kind === 'weighted' && (
        <View style={styles.toggle}>
          {(['e1rm', 'weight'] as const).map((option) => (
            <Chip
              key={option}
              label={TOGGLE_LABEL[option]}
              selected={toggle === option}
              onPress={() => setToggle(option)}
            />
          ))}
        </View>
      )}

      {metric && points.length > 0 && (
        <Card style={styles.chartCard}>
          <ProgressChart key={metric} points={points} metric={metric} width={chartWidth} />
        </Card>
      )}

      {recordRows.length > 0 && (
        <Card style={styles.recordsCard}>
          <AppText variant="heading" style={styles.cardTitle}>
            🏆 Récords
          </AppText>
          {recordRows.map(({ metric: recordMetric, entry }) =>
            entry ? (
              <View key={recordMetric} style={styles.recordRow}>
                <View style={styles.recordHeader}>
                  <AppText variant="label">{RECORD_LABEL[recordMetric]}</AppText>
                  <AppText variant="heading">{formatMetricValue(entry.value, recordMetric)}</AppText>
                </View>
                <AppText variant="muted" style={styles.recordDetail}>
                  {recordMetric === 'seconds' || recordMetric === 'reps'
                    ? formatShortDate(entry.date)
                    : `${formatSourceSet(entry, recordMetric)} · ${formatShortDate(entry.date)}`}
                </AppText>
              </View>
            ) : null
          )}
        </Card>
      )}
    </Screen>
  );
}

function makeStyles(_c: ColorTokens) {
  return StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    message: { textAlign: 'center' },
    retry: { marginTop: 16, alignSelf: 'stretch' },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    back: { fontSize: 22 },
    title: { fontSize: 22, flexShrink: 1 },
    toggle: { flexDirection: 'row', gap: 8, alignSelf: 'flex-start' },
    chartCard: { padding: 12, overflow: 'hidden' },
    recordsCard: { padding: 12, gap: 0 },
    cardTitle: { marginBottom: 8 },
    recordRow: { paddingVertical: 6 },
    recordHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    recordDetail: { marginTop: 2 },
  });
}
