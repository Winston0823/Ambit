import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AppleLogo, GoogleLogo } from 'phosphor-react-native';
import { AmbitFont, Brand, Radii } from '../../constants/theme';

interface Props {
  onAppleSignIn:  () => Promise<void> | void;
  onGoogleSignIn: () => Promise<void> | void;
  /// When set, both buttons are disabled and a spinner sits in the one
  /// whose key matches. Keeps the screen from issuing parallel auth calls
  /// if the user double-taps or taps both.
  busy?:          'apple' | 'google' | null;
}

/// Continue with Apple / Continue with Google. On iOS we use Apple's
/// native AppleAuthenticationButton (Apple HIG requires it when offering
/// "Sign in with Apple"); everywhere else we render a styled fallback
/// that drives the same handler — which on non-iOS goes through Supabase
/// OAuth via the web browser.
export function SocialAuthButtons({ onAppleSignIn, onGoogleSignIn, busy }: Props) {
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const disabled = !!busy;

  return (
    <View style={styles.column}>
      {Platform.OS === 'ios' && appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={Radii.md}
          style={styles.appleNative}
          onPress={() => { if (!disabled) onAppleSignIn(); }}
        />
      ) : (
        <Pressable
          onPress={() => { if (!disabled) onAppleSignIn(); }}
          disabled={disabled}
          style={({ pressed }) => [
            styles.btn,
            styles.appleBtn,
            disabled && styles.btnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
        >
          {busy === 'apple' ? (
            <ActivityIndicator color={Brand.canvas} />
          ) : (
            <>
              <AppleLogo size={20} color={Brand.canvas} weight="fill" />
              <Text style={styles.appleLabel}>Continue with Apple</Text>
            </>
          )}
        </Pressable>
      )}

      <Pressable
        onPress={() => { if (!disabled) onGoogleSignIn(); }}
        disabled={disabled}
        style={({ pressed }) => [
          styles.btn,
          styles.googleBtn,
          disabled && styles.btnDisabled,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        {busy === 'google' ? (
          <ActivityIndicator color={Brand.inkPrimary} />
        ) : (
          <>
            <GoogleLogo size={20} color="#4285F4" weight="bold" />
            <Text style={styles.googleLabel}>Continue with Google</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 10 },
  appleNative: {
    height: 52,
    width: '100%',
  },
  btn: {
    height: 52,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  btnDisabled: { opacity: 0.5 },

  appleBtn: { backgroundColor: '#000' },
  appleLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.canvas,
  },

  googleBtn: {
    backgroundColor: Brand.canvas,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  googleLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
});
