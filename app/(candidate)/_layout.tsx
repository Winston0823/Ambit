import React from 'react';
import { Stack } from 'expo-router';

/// Candidate route group — a Stack that hosts the swipeable `(tabs)` carousel
/// plus the pushed detail screens (saved, project-*). Those must be Stack
/// pushes, not swipeable pager tabs — so they live here, outside `(tabs)`.
export default function CandidateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="saved" />
      <Stack.Screen name="project-new" />
      <Stack.Screen name="project-edit" />
      <Stack.Screen name="project-manage" />
      <Stack.Screen name="resume-import" />
      {/* Chat thread reached from outside the Chat tab (pipeline / projects /
          saved) — pushed here on the outer stack so back returns to the entry
          point instead of hijacking the Chat tab. */}
      <Stack.Screen name="thread/[id]" />
    </Stack>
  );
}
