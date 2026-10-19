import { useMemo } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthSession } from '../../../../src/hooks/useAuthSession';
import { usePullToRefresh } from '../../../../src/hooks/usePullToRefresh';
import { useProgressSummary } from '../../../../src/hooks/useExerciseProgress';
import { Sparkline } from '../../../../src/components/Sparkline';
import { AppText, Button, Card, Screen } from '../../../../src/components/ui';
import { formatDaysAgo, formatMetricValue } from '../../../../src/lib/progress/format';
import { sparklinesByExercise } from '../../../../src/lib/progress/spotlight';
import { Trend } from '../../../../src/lib/progress/types';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { ColorTokens } from '../../../../src/theme/colors';

const TREND_ARROW: Record<Trend, string> = { up: '↑', flat: '→', down: '↓' };
const TREND_COLOR: Record<Trend, keyof ColorTokens> = { up: 'success', flat: 'textMuted', down: 'danger' };

export default function ProgressList() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuthSession();
  const { rows, summaries, isLoading, error, refetch } = useProgressSummary(session?.user.id);
  const refreshControl = usePullToRefresh(refetch);
  const sparklines = useMemo(() => sparklinesByExercise(rows, summaries), [rows, summaries]);

  if (isLoading && summaries.length === 0) {
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

  const today = new Date();

  return (
    <Screen padded={false}>
      <FlatList
        refreshControl={refreshControl}
        style={styles.container}
        contentContainerStyle={styles.content}
        data={summaries}
        keyExtractor={(item) => item.exerciseId}
        ListEmptyComponent={
          <AppText variant="muted" style={styles.message}>
            Todavía no hay datos. Completá tu primera sesión para empezar a ver tu progreso.
          </AppText>
        }
        renderItem={({ item }) => {
          const trendColor = item.trend ? colors[TREND_COLOR[item.trend]] : colors.textMuted;
          return (
            <Pressable
              style={styles.rowWrap}
              onPress={() => router.push(`/(app)/(tabs)/progress/${item.exerciseId}` as any)}
            >
              <Card style={styles.row}>
                <View style={styles.rowMain}>
                  <AppText variant="heading">{item.exerciseName}</AppText>
                  <AppText variant="muted" style={styles.subtitle}>
                    {formatDaysAgo(item.lastTrainedDate, today)}
                  </AppText>
                </View>
                <Sparkline values={sparklines.get(item.exerciseId) ?? []} color={trendColor} />
                {item.latestValue !== null && (
                  <AppText variant="heading" style={styles.value}>
                    {formatMetricValue(item.latestValue, item.metric)}
                  </AppText>
                )}
                <AppText style={[styles.arrow, { color: trendColor }]}>
                  {item.trend ? TREND_ARROW[item.trend] : ' '}
                </AppText>
                <AppText color="textMuted" style={styles.chevron}>
                  ›
                </AppText>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    message: { textAlign: 'center', marginTop: 32 },
    retry: { marginTop: 16, alignSelf: 'stretch' },
    rowWrap: { marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 0 },
    rowMain: { flex: 1 },
    subtitle: { marginTop: 2, fontSize: 12 },
    value: { marginHorizontal: 12 },
    arrow: { fontSize: 20, width: 20, textAlign: 'center' },
    chevron: { fontSize: 22, marginLeft: 8 },
  });
}
