import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AmbitFont, Brand, Radii, Space } from '../constants/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/// App-wide error boundary. A render error anywhere below this catches here
/// and shows a recoverable fallback instead of white-screening the whole app
/// (which is both a bad experience and an App Store rejection reason). Error
/// boundaries MUST be class components — there is no hooks equivalent.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface for local debugging; swap for a crash reporter (Sentry) later.
    console.error('Uncaught render error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. You can try again — your data is safe.
          </Text>
          <Pressable onPress={this.reset} style={styles.btn} accessibilityRole="button">
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
    gap: 12,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 24,
    color: Brand.inkPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: Radii.md,
    backgroundColor: Brand.primary,
  },
  btnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkOnBrand,
  },
});
