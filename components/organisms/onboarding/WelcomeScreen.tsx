import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../atoms';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props {
  onCreateAccount: () => void;
  onSignIn: () => void;
}

/// S-003 Welcome. Dual-path entry: create a new account (onboarding) OR
/// sign in (returning user). Returning users skip onboarding entirely.
export function WelcomeScreen({ onCreateAccount, onSignIn }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoSquare}>
          <Text style={styles.logoText}>ambit</Text>
        </View>

        <Text style={styles.headline}>Welcome to ambit</Text>
        <Text style={styles.helper}>
          The place where student builders find each other.
        </Text>

        <View style={styles.cta}>
          <Button
            title="Create account"
            onPress={onCreateAccount}
            variant="primary"
            trailingArrow
          />
          <Button
            title="Sign in"
            onPress={onSignIn}
            variant="secondary"
          />
        </View>

        <Pressable onPress={onCreateAccount}>
          <Text style={styles.fineprint}>
            New here? Set up takes about two minutes.
          </Text>
        </Pressable>
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
    paddingHorizontal: Space.lg,
    lineHeight: 20,
  },
  cta: {
    gap: 12,
    marginTop: 48,
  },
  fineprint: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
