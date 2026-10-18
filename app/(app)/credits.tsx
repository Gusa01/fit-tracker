import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { CreditedExercise, listCreditedExercises } from '../../src/lib/exercises/queries';

export default function CreditsScreen() {
  const [items, setItems] = useState<CreditedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setItems(await listCreditedExercises(supabase));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No se pudieron cargar los créditos.</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Créditos de imágenes</Text>
          <Text style={styles.muted}>
            Las ilustraciones de ejercicios provienen de wger.de y se usan bajo licencias Creative Commons. Los datos del
            catálogo provienen de free-exercise-db (dominio público).
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.muted}>
            {item.image_credit.author} · {item.image_credit.license}
          </Text>
          <Pressable onPress={() => Linking.openURL(item.image_credit.source_url)} hitSlop={8}>
            <Text style={styles.link}>Ver fuente</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  header: { gap: 8, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  muted: { color: '#666' },
  row: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 4 },
  name: { fontWeight: '700' },
  link: { color: '#2563eb', fontWeight: '600' },
  retryButton: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '600' },
});
