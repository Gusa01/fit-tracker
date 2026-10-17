import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PrBannerData } from '../lib/progress/types';
import { buildPrBannerText } from '../lib/progress/format';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

const VISIBLE_MS = 3000;

export function PrBanner({ banner, onDismiss }: { banner: PrBannerData | null; onDismiss: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [banner, onDismiss]);

  if (!banner) return null;
  const { title, detail } = buildPrBannerText(banner.exerciseName, banner.broken);

  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

// Inverted surface: text-colored background with background-colored text, readable in both modes.
function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    banner: {
      position: 'absolute',
      top: 8,
      left: 16,
      right: 16,
      backgroundColor: c.text,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      elevation: 6,
      shadowColor: c.text,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    title: { color: c.background, fontWeight: '700', fontSize: 15 },
    detail: { color: c.background, marginTop: 2 },
  });
}
