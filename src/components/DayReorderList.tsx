import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { NestableDraggableFlatList, RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { RoutineDay, Weekday } from '../lib/routines/types';
import { hapticDrop, hapticLift, hapticTick } from '../lib/haptics';
import { AppText } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

const WEEKDAY_SHORT: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mié' },
  { key: 'thu', label: 'Jue' },
  { key: 'fri', label: 'Vie' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

interface DayReorderListProps {
  days: RoutineDay[];
  weekdaySchedule: Record<string, unknown>;
  onReorder: (orderedIds: string[]) => void;
}

function subtitle(day: RoutineDay, weekdaySchedule: Record<string, unknown>): string {
  if (day.is_rest_day) return 'Descanso';
  const weekdays = WEEKDAY_SHORT.filter((w) => weekdaySchedule[w.key] === day.id).map((w) => w.label);
  return weekdays.length > 0 ? weekdays.join(' · ') : 'Sin días asignados';
}

/**
 * Compact, draggable rows for reordering days. Full day cards hold their own draggable exercise list, and a
 * draggable list inside a draggable item isn't supported, so reordering happens in this separate mode.
 */
export function DayReorderList({ days, weekdaySchedule, onReorder }: DayReorderListProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Local order so a drop shows the new order at once.
  const [ordered, setOrdered] = useState(days);
  useEffect(() => setOrdered(days), [days]);

  function commit(next: RoutineDay[]) {
    setOrdered(next);
    onReorder(next.map((d) => d.id));
  }

  // Screen-reader alternative to dragging.
  function moveBy(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  return (
    <NestableDraggableFlatList
      data={ordered}
      keyExtractor={(day: RoutineDay) => day.id}
      activationDistance={12}
      onDragBegin={hapticLift}
      onPlaceholderIndexChange={hapticTick}
      onDragEnd={({ data, from, to }) => {
        hapticDrop();
        if (from !== to) commit(data);
      }}
      renderItem={({ item: day, drag, isActive, getIndex }: RenderItemParams<RoutineDay>) => (
        <ScaleDecorator activeScale={1.03}>
          <Pressable
            style={[styles.row, isActive && styles.rowActive]}
            onLongPress={drag}
            delayLongPress={250}
            disabled={isActive}
            accessibilityRole="button"
            accessibilityLabel={day.name || 'Día sin nombre'}
            accessibilityHint="Mantené presionado y arrastrá para reordenar."
            accessibilityActions={[
              { name: 'moveUp', label: 'Subir' },
              { name: 'moveDown', label: 'Bajar' },
            ]}
            onAccessibilityAction={(event) => {
              const index = getIndex();
              if (index === undefined) return;
              moveBy(index, event.nativeEvent.actionName === 'moveUp' ? -1 : 1);
            }}
          >
            <View style={styles.rowMain}>
              <AppText variant="heading">{day.name || 'Día sin nombre'}</AppText>
              <AppText variant="muted">{subtitle(day, weekdaySchedule)}</AppText>
            </View>
            {/* The handle drags on touch, without the long-press wait. */}
            <Pressable onPressIn={drag} disabled={isActive} hitSlop={8} importantForAccessibility="no">
              <Ionicons name="reorder-three" size={24} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        </ScaleDecorator>
      )}
    />
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 8,
    },
    rowActive: {
      borderColor: c.accent,
      backgroundColor: c.surfaceMuted,
      elevation: 6,
      shadowColor: c.text,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    rowMain: { flex: 1 },
  });
}
