import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AmbitFont, Brand } from '../constants/theme';

/// Catch-all for unmatched routes / stale deep links. Without this, Expo
/// Router falls back to its default dev-styled screen — which reads as broken
/// in a shipped build. Gives the user an honest message and a way home.
export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <Text style={styles.title}>This page doesn't exist.</Text>
        <Text style={styles.body}>
          The link may be old or broken. Let's get you back to Ambit.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  title: { fontFamily: AmbitFont.display, fontSize: 24, color: Brand.inkPrimary, textAlign: 'center' },
  body: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkMuted, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  link: { marginTop: 24, backgroundColor: Brand.action, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 999 },
  linkText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '700', color: Brand.inkOnBrand },
});
