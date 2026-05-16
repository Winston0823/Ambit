import React, { ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
}

/// Wrap any screen in this to dismiss the keyboard when the user taps
/// outside an input. `accessible={false}` keeps screen-reader behavior
/// pointed at the children, not the wrapper.
export function KeyboardDismiss({ children, style }: Props) {
  return (
    <Pressable
      onPress={Keyboard.dismiss}
      style={[styles.flex, style]}
      accessible={false}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
