import { useMemo, useState } from 'react';
import { TextInput, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { AppText, Button, Screen } from '../../src/components/ui';
import { ColorTokens } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeProvider';
import { DEMO_ACCOUNT } from '../../src/lib/auth/demoAccount';

export default function SignIn() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(credentials: { email: string; password: string }) {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword(credentials);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace('/');
  }

  return (
    <Screen padded={false} safeBottom>
      <View style={styles.container}>
        <AppText variant="title" style={styles.title}>
          Iniciar sesión
        </AppText>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <AppText color="danger">{error}</AppText>}
        <Button
          title={loading ? 'Ingresando...' : 'Ingresar'}
          onPress={() => signIn({ email, password })}
          disabled={loading}
        />
        <Button
          title="Probar con la cuenta demo"
          variant="secondary"
          onPress={() => signIn(DEMO_ACCOUNT)}
          disabled={loading}
        />
        <AppText variant="muted" style={styles.note}>
          Las cuentas son por invitación. Si querés una propia, pedísela a Agustín.
        </AppText>
      </View>
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
    title: { fontSize: 24, marginBottom: 12 },
    note: { textAlign: 'center' },
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
