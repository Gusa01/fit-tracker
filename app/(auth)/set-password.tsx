import { useMemo, useState } from 'react';
import { TextInput, StyleSheet, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { validateNewPassword } from '../../src/lib/auth/password';
import { AppText, Button, Screen } from '../../src/components/ui';
import { ColorTokens } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeProvider';

// The root layout sends a user here while their account still has the temporary password from create-user,
// and moves them on to the app once the metadata flag is cleared.
export default function SetPassword() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const problem = validateNewPassword(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setSaving(false);
    if (error) setError(error.message);
  }

  return (
    <Screen padded={false} safeBottom>
      <View style={styles.container}>
        <AppText variant="title" style={styles.title}>
          Elegí tu contraseña
        </AppText>
        <AppText variant="muted">Entraste con una contraseña temporal. Poné una que te guste para seguir.</AppText>
        <TextInput
          style={styles.input}
          placeholder="Nueva contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Repetí la contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={confirmation}
          onChangeText={setConfirmation}
        />
        {error && <AppText color="danger">{error}</AppText>}
        <Button title={saving ? 'Guardando...' : 'Guardar contraseña'} onPress={handleSave} disabled={saving} />
        <Button title="Cerrar sesión" variant="ghost" onPress={() => supabase.auth.signOut()} disabled={saving} />
      </View>
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
    title: { fontSize: 24, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      borderRadius: 8,
      padding: 12,
    },
  });
}
