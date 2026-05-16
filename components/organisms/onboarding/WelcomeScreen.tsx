import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../atoms';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onContinue: () => void; }

/// S-003 Welcome / Sign Up entry. Two OAuth buttons.
/// Apple/Google flows are system sheets — we skip those in the mock and just advance.
export function WelcomeScreen({ onContinue }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.logoArea}>
        <View style={styles.logoSquare}>
          <Text style={styles.logoText}>ambit</Text>
        </View>
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

      <Text style={styles.fallback}>Use .edu email instead →</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
    paddingHorizontal: Space.lg,
  },
  logoArea: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 60,
  },
  logoSquare: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: AmbitFont.display,
    fontSize: 24,
    color: Brand.seekerInk,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    textAlign: 'center',
  },
  helper: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  cta: {
    gap: 12,
    marginTop: 40,
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
