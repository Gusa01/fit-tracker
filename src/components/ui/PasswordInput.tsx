import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}

// A password field with an eye button, so a temporary password with look-alike characters can be checked before sending.
export function PasswordInput({ placeholder, value, onChangeText }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        field: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: 8,
        },
        input: { flex: 1, color: colors.text, padding: 12 },
        toggle: { paddingHorizontal: 12, alignSelf: 'stretch', justifyContent: 'center' },
      }),
    [colors]
  );
  return (
    <View style={styles.field}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={styles.toggle}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
