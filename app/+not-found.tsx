import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { AppText, Screen } from '../src/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Screen>
        <AppText variant="title">This screen doesn't exist.</AppText>
        <Link href="/" style={styles.link}>
          <AppText color="accent">Go to home screen!</AppText>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
