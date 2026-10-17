import { Link, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText, Screen } from "../src/components/ui";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <Screen>
        <View style={styles.center}>
          <AppText variant="title">This screen doesn't exist.</AppText>
          <Link href="/" style={styles.link}>
            <AppText color="accent">Go to home screen!</AppText>
          </Link>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
