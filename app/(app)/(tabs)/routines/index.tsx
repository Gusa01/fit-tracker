import { useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthSession } from '../../../../src/hooks/useAuthSession';
import { usePullToRefresh } from '../../../../src/hooks/usePullToRefresh';
import { useRoutines } from '../../../../src/hooks/useRoutines';
import { supabase } from '../../../../src/lib/supabase';
import { activateRoutine, softDeleteRoutine } from '../../../../src/lib/routines/mutations';
import { AppText, Button, Card, Screen } from '../../../../src/components/ui';
import { useTheme } from '../../../../src/theme/ThemeProvider';

export default function RoutinesList() {
  const { colors } = useTheme();
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const { routines, isLoading, error, refetch } = useRoutines(userId);
  const refreshControl = usePullToRefresh(refetch);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleActivate(routineId: string) {
    if (!userId) return;
    setBusyId(routineId);
    try {
      await activateRoutine(supabase, userId, routineId);
      await refetch();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo activar la rutina.');
    } finally {
      setBusyId(null);
    }
  }

  function handleDelete(routineId: string, name: string) {
    Alert.alert('Eliminar rutina', `¿Eliminar "${name}"? Esto no borra tu historial de entrenamientos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBusyId(routineId);
          try {
            await softDeleteRoutine(supabase, routineId);
            await refetch();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar la rutina.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  if (error) {
    return (
      <Screen>
        <AppText color="danger">{error}</AppText>
      </Screen>
    );
  }

  if (isLoading && routines.length === 0) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        refreshControl={refreshControl}
        data={routines}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AppText variant="muted" style={styles.empty}>
            Todavía no tenés rutinas.
          </AppText>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/(tabs)/routines/${item.id}`)}>
            <Card style={styles.row}>
              <AppText variant="heading">
                {item.name}
                {item.is_active ? ' ⭐' : ''}
              </AppText>
              <View style={styles.rowActions}>
                {!item.is_active && (
                  <Button title="Activar" disabled={busyId === item.id} onPress={() => handleActivate(item.id)} />
                )}
                <Button
                  title="Eliminar"
                  variant="danger"
                  disabled={busyId === item.id}
                  onPress={() => handleDelete(item.id, item.name)}
                />
              </View>
            </Card>
          </Pressable>
        )}
      />
      <View style={styles.newButton}>
        <Button title="+ Nueva rutina" onPress={() => router.push('/(app)/(tabs)/routines/new')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', marginTop: 32 },
  row: { marginBottom: 8 },
  rowActions: { flexDirection: 'row', gap: 8 },
  newButton: { marginTop: 12 },
});
