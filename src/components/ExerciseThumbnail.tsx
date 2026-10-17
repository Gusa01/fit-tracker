import { useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { exerciseImageUrl } from '../lib/exercises/images';
import { MUSCLE_LABEL, isMuscle } from '../lib/exercises/taxonomy';

/** Exercise illustration, or the muscle's initials when there's no image (or it fails to load). */
export function ExerciseThumbnail({ imagePath, muscle, size = 40 }: { imagePath: string | null; muscle: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const uri = exerciseImageUrl(imagePath);
  const label = isMuscle(muscle) ? MUSCLE_LABEL[muscle] : '?';
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 8, backgroundColor: '#f0f0f0' }}
        resizeMode="contain"
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

const styles = StyleSheet.create({
  fallback: { borderRadius: 8, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#666', fontWeight: '700', fontSize: 12 },
});
