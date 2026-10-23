import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { supabase } from '../../../../src/lib/supabase';
import { CreditedExercise, listCreditedExercises } from '../../../../src/lib/exercises/queries';
import { AppText, Button, Card } from '../../../../src/components/ui';
import { ColorTokens } from '../../../../src/theme/colors';
import { useTheme } from '../../../../src/theme/ThemeProvider';

export default function CreditsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <AppText variant="muted">No se pudieron cargar los créditos.</AppText>
        <Button title="Reintentar" onPress={load} />
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
          <AppText variant="muted">
            Las ilustraciones de ejercicios provienen de wger.de y se usan bajo licencias Creative Commons. Los datos
            del catálogo provienen de free-exercise-db (dominio público).
          </AppText>
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.row}>
          <AppText style={styles.name}>{item.name}</AppText>
          <AppText variant="muted">
            {item.image_credit.author} · {item.image_credit.license}
          </AppText>
          <Pressable onPress={() => Linking.openURL(item.image_credit.source_url)} hitSlop={8}>
            <AppText color="accent" style={styles.link}>
              Ver fuente
            </AppText>
          </Pressable>
        </Card>
      )}
    />
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 8 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: c.background,
    },
    header: { gap: 8, marginBottom: 8 },
    row: { gap: 4 },
    name: { fontWeight: '700' },
    link: { fontWeight: '600' },
  });
}
