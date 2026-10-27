import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { OtherDayOption } from '../lib/home/otherDays';
import { AppText } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

interface OtherDaySheetProps {
  visible: boolean;
  options: OtherDayOption[];
  onPick: (dayId: string) => void;
  onClose: () => void;
}

function scheduleLabel(option: OtherDayOption): string {
  if (option.pendingWeekday) return `pendiente (${option.pendingWeekday})`;
  if (option.scheduledOn.length === 0) return 'sin día asignado';
  return option.scheduledOn.join(' y ');
}

// "Entrenar otro día": every training day of the routine, so any of them can be done today.
export function OtherDaySheet({ visible, options, onPick, onClose }: OtherDaySheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={styles.sheet}>
          <AppText variant="heading">¿Qué día querés entrenar hoy?</AppText>
          {options.map((option) => (
            <Pressable
              key={option.dayId}
              style={styles.row}
              onPress={() => onPick(option.dayId)}
              accessibilityRole="button"
            >
              <AppText variant="label">{option.dayName}</AppText>
              <AppText variant="muted" color={option.pendingWeekday ? 'warning' : undefined}>
                {scheduleLabel(option)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      paddingBottom: 32,
      gap: 8,
      maxHeight: '85%',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      minHeight: 48,
    },
  });
}
