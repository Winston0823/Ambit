import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../atoms';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onContinue: () => void; }

/// S-003 Welcome / Sign Up. Two OAuth buttons + .edu fallback.
/// Content vertically centered per user request.
export function WelcomeScreen({ onContinue }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoSquare}>
          <Text style={styles.logoText}>ambit</Text>
        </View>

        <Text style={styles.headline}>How do you want to continue?</Text>
        <Text style={styles.helper}>Google and Apple are equivalent.</Text>

        <View style={styles.cta}>
          <Button
            title="Continue with Apple"
            onPress={onContinue}
            variant="primary"
            style={styles.appleBtn}
          />
          <Button
            title="Continue with Google"
            onPress={onContinue}
            variant="secondary"
          />
        </View>

        <Text style={styles.fallback}>Use .edu email instead  →</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
    paddingHorizontal: Space.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  logoSquare: {
    width: 140,
    height: 140,
    borderRadius: 32,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 60,
  },
  logoText: {
    fontFamily: AmbitFont.display,
    fontSize: 36,
    color: Brand.seekerInk,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 32,
    color: Brand.inkPrimary,
    textAlign: 'center',
  },
  helper: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  cta: {
    gap: 12,
    marginTop: 48,
  },
  appleBtn: { backgroundColor: Brand.inkPrimary },
  fallback: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.accent,
    textAlign: 'center',
    marginTop: 24,
  },
});
