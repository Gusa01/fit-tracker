import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthSession } from '../../src/hooks/useAuthSession';
import { WELCOME_SLIDES, WelcomeSlide, saveWelcomeSeen, welcomeFinish } from '../../src/lib/onboarding/welcome';
import { AppText, Button, Screen } from '../../src/components/ui';
import { ColorTokens } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Welcome() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { session } = useAuthSession();
  const listRef = useRef<FlatList<WelcomeSlide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === WELCOME_SLIDES.length - 1;
  const finish = welcomeFinish(session?.user.email);

  // Marked on open rather than on finish, so leaving with the back button doesn't bring it back every launch.
  useEffect(() => {
    saveWelcomeSeen().catch((err) => console.warn('Could not save the welcome state', err));
  }, []);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  function handleNext() {
    if (!isLast) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      return;
    }
    leave(finish.destination);
  }

  function leave(destination: 'new-routine' | 'home') {
    router.back();
    if (destination === 'new-routine') router.navigate('/(app)/(tabs)/routines/new');
  }

  return (
    <Screen padded={false} safeBottom>
      <FlatList
        ref={listRef}
        data={WELCOME_SLIDES}
        keyExtractor={(slide) => slide.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.circle}>
              <Ionicons name={item.icon} size={56} color={colors.onAccent} />
            </View>
            <AppText variant="title" style={styles.centered}>
              {item.title}
            </AppText>
            <AppText variant="muted" style={[styles.centered, styles.body]}>
              {item.body}
            </AppText>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.dots}>
          {WELCOME_SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={isLast ? finish.label : 'Siguiente'} onPress={handleNext} />
        <Button title={isLast ? 'Ahora no' : 'Saltear'} variant="ghost" onPress={() => leave('home')} />
      </View>
    </Screen>
  );
}

function makeStyles(c: ColorTokens) {
  return StyleSheet.create({
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
    circle: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    centered: { textAlign: 'center' },
    body: { fontSize: 15, lineHeight: 22 },
    footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
    dotActive: { backgroundColor: c.accent },
  });
}
