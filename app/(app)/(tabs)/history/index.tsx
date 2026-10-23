import { useMemo } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthSession } from '../../../../src/hooks/useAuthSession';
import { usePullToRefresh } from '../../../../src/hooks/usePullToRefresh';
import { useSessionHistory } from '../../../../src/hooks/useSessionHistory';
import { formatSessionTitle } from '../../../../src/lib/history/format';
import { AppText, Banner, Button, Card, Screen } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { ColorTokens } from '../../../../src/theme/colors';

export default function HistoryList() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuthSession();
  const { sessions, isLoading, error, isLoadingMore, loadMoreError, loadMore, refetch } = useSessionHistory(
    session?.user.id
  );
  const refreshControl = usePullToRefresh(refetch);

  if (isLoading && sessions.length === 0) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (error && sessions.length === 0) {
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

  return (
    <Screen padded={false}>
      <FlatList
        refreshControl={refreshControl}
        style={styles.list}
        contentContainerStyle={styles.content}
        data={sessions}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          error ? (
            <Pressable style={styles.banner} onPress={refetch}>
              <Banner tone="danger">No se pudo actualizar. Tocá para reintentar.</Banner>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <AppText variant="muted" style={styles.message}>
            Todavía no hay sesiones. Completá tu primera sesión para verla acá.
          </AppText>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator style={styles.footer} color={colors.accent} />
          ) : loadMoreError ? (
            <Pressable style={styles.footerRetry} onPress={loadMore}>
              <AppText variant="label">No se pudieron cargar más sesiones. Reintentar</AppText>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.rowWrap} onPress={() => router.push(`/(app)/(tabs)/history/${item.id}`)}>
            <Card style={styles.row}>
              <View style={styles.rowMain}>
                <AppText variant="heading">{formatSessionTitle(item.sessionDate, item.dayName)}</AppText>
                <AppText variant="muted">
                  {item.exerciseCount} {item.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · {item.setCount}{' '}
                  {item.setCount === 1 ? 'serie' : 'series'}
                </AppText>
              </View>
              <AppText color="textMuted" style={styles.chevron}>
                ›
              </AppText>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function makeStyles(_c: ColorTokens) {
  return StyleSheet.create({
    list: { flex: 1 },
    content: { padding: 16 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    message: { textAlign: 'center', marginTop: 32 },
    retry: { marginTop: 16 },
    banner: { marginBottom: 8 },
    rowWrap: { marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 0 },
    rowMain: { flex: 1, gap: 2 },
    chevron: { fontSize: 22, marginLeft: 8 },
    footer: { marginVertical: 16 },
    footerRetry: { padding: 16, alignItems: 'center' },
  });
}
