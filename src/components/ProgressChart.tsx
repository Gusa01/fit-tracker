import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ChartPoint, Metric } from '../lib/progress/types';
import { formatMetricValue, formatShortDate, formatSourceSet } from '../lib/progress/format';
import { AppText } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

const MAX_X_LABELS = 6;
const Y_AXIS_LABEL_WIDTH = 36;

/**
 * Line chart of one point per session, with the tapped (or latest) point's set shown below.
 * `width` is the horizontal space available to the whole chart, y-axis labels included.
 * Give it a `key` that changes with the series so the selection resets.
 */
export function ProgressChart({
  points,
  metric,
  width,
  height = 200,
}: {
  points: ChartPoint[];
  metric: Metric;
  width: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  if (points.length === 0) return null;

  // gifted-charts draws the y-axis labels outside `width`
  const plotWidth = width - Y_AXIS_LABEL_WIDTH;
  const labelStep = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
  const data = points.map((p, i) => ({ value: p.value, label: i % labelStep === 0 ? formatShortDate(p.date) : '' }));
  const minValue = Math.min(...points.map((p) => p.value));
  const selected = points[selectedIndex ?? points.length - 1];

  return (
    <View>
      <LineChart
        data={data}
        width={plotWidth}
        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
        height={height}
        color={colors.accent}
        thickness={2}
        dataPointsColor={colors.accent}
        rulesColor={colors.border}
        xAxisColor={colors.border}
        yAxisColor={colors.border}
        stripColor={colors.textMuted}
        noOfSections={4}
        yAxisOffset={Math.max(0, Math.floor(minValue * 0.9))}
        initialSpacing={12}
        spacing={points.length > 1 ? Math.max(24, (plotWidth - 24) / (points.length - 1)) : 24}
        focusEnabled
        showStripOnFocus
        onFocus={(_item: unknown, index: number) => setSelectedIndex(index)}
        xAxisLabelTextStyle={styles.axisText}
        yAxisTextStyle={styles.axisText}
      />
      {selected && (
        <AppText variant="label" style={styles.selected}>
          {formatShortDate(selected.date)} · {formatSourceSet(selected, metric)}
          {metric === 'e1rm' ? ` · ${formatMetricValue(selected.value, metric)}` : ''}
        </AppText>
      )}
      {points.length === 1 && (
        <AppText variant="muted" style={styles.hint}>
          Seguí entrenando para ver la evolución
        </AppText>
      )}
    </View>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    axisText: { color: c.textMuted, fontSize: 10 },
    selected: { marginTop: 8 },
    hint: { marginTop: 4 },
  });
}
