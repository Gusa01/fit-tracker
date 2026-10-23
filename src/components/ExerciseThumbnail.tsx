import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { exerciseImageUrl } from '../lib/exercises/images';
import { MUSCLE_LABEL, isMuscle } from '../lib/exercises/taxonomy';
import { useTheme } from '../theme/ThemeProvider';
import { ColorTokens } from '../theme/colors';

/** Exercise illustration, or the muscle's initials when there's no image (or it fails to load). */
export function ExerciseThumbnail({
  imagePath,
  muscle,
  size = 40,
}: {
  imagePath: string | null;
  muscle: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [failed, setFailed] = useState(false);
  const uri = exerciseImageUrl(imagePath);
  const label = isMuscle(muscle) ? MUSCLE_LABEL[muscle] : '?';
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 8, backgroundColor: colors.imageBackdrop }}
        contentFit="contain"
        // Disk cache: the bucket images are fetched once, not on every list render.
        cachePolicy="memory-disk"
        recyclingKey={uri}
        transition={150}
        onError={() => setFailed(true)}
        accessibilityLabel={`Ilustración de ${label}`}
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size }]} accessibilityLabel={label}>
      <Text style={styles.fallbackText}>{label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    fallback: { borderRadius: 8, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    fallbackText: { color: c.textMuted, fontWeight: '700', fontSize: 12 },
  });
}
