import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Brand, AmbitFont } from '../../../constants/theme';

interface Props { onContinue: () => void; }

/// S-001 Splash. Auto-advances after 1.2s.
export function SplashScreen({ onContinue }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const t = setTimeout(onContinue, 1400);
    return () => clearTimeout(t);
  }, [opacity, onContinue]);

  return (
    <View style={styles.root}>
      <Animated.Text style={[styles.wordmark, { opacity }]}>ambit</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.canvas,
  },
  wordmark: {
    fontFamily: AmbitFont.display,
    fontSize: 64,
    color: Brand.inkPrimary,
    letterSpacing: -1,
  },
});
