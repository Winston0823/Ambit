import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Brand, AmbitFont } from '../../../constants/theme';

/// Chat thread (S-051). Placeholder until Stream Chat is wired.
export default function FounderChatThread() {
  const { id } = useLocalSearchParams();
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Chat</Text>
      <Text style={styles.body}>Thread {String(id)}. Stream Chat wires here.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: Brand.canvas },
  title: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary, marginTop: 16 },
  body: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 12 },
});
