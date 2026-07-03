import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Radii } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  /// Tap handler when the row is closed. (When open, a tap closes it.)
  onPress?: () => void;
  /// Renders the action(s) revealed behind the row's right edge. Receives a
  /// `close` fn so the action can snap the row shut after it fires.
  renderReveal: (close: () => void) => React.ReactNode;
  /// Width of the revealed action zone.
  revealWidth?: number;
  /// Outer radius so the clipped row keeps the card's rounded corners.
  radius?: number;
}

/// Swipe-left to reveal a trailing action (e.g. Edit). PanResponder-based to
/// match the codebase idiom (SwipeDeck), no gesture-handler dependency. The
/// content layer translates left over a fixed reveal zone; release snaps to
/// open or closed. A closed tap passes through to onPress; an open tap closes.
export function SwipeRevealRow({
  children,
  onPress,
  renderReveal,
  revealWidth = 84,
  radius = Radii.lg,
}: Props) {
  const tx = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  const snap = (open: boolean) => {
    openRef.current = open;
    Animated.spring(tx, {
      toValue: open ? -revealWidth : 0,
      friction: 9,
      tension: 90,
      useNativeDriver: true,
    }).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderMove: (_e, g) => {
          const base = openRef.current ? -revealWidth : 0;
          const next = Math.max(-revealWidth, Math.min(0, base + g.dx));
          tx.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const base = openRef.current ? -revealWidth : 0;
          const next = base + g.dx;
          snap(next < -revealWidth / 2);
        },
        onPanResponderTerminate: () => snap(openRef.current),
      }),
    // revealWidth is stable; tx/openRef are refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revealWidth],
  );

  const handlePress = () => {
    if (openRef.current) snap(false);
    else onPress?.();
  };

  return (
    <View style={[styles.wrap, { borderRadius: radius }]}>
      <View style={[styles.reveal, { width: revealWidth }]}>
        {renderReveal(() => snap(false))}
      </View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        <Animated.View
          // A Pressable here would fight the PanResponder on some platforms;
          // a tap handler via onStartShouldSetResponder keeps both happy.
          onStartShouldSetResponder={() => true}
          onResponderRelease={handlePress}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  reveal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
