import React from 'react';
import { Stack } from 'expo-router';

/// Inbox (index) is the anchor of this stack: even when a sub-screen
/// (thread / new / search) is entered directly — a deep link, or the "+"
/// resolving across route groups — expo-router keeps index underneath, so
/// `router.back()` always returns to the messages list instead of
/// dead-ending and locking the user out of the inbox.
export const unstable_settings = {
  initialRouteName: 'index',
};

/// Stack navigator nested inside the Chat tab. Lets us push the thread
/// screen ([id].tsx) and search.tsx with proper per-tab history so:
///   - the bottom Tabs nav keeps Chat highlighted across these screens
///   - router.back() pops within this stack instead of switching tabs
///   - iOS swipe-back gesture works out of the box
///
/// Native headers are hidden — each screen renders its own top bar in
/// the Ambit brand language.
export default function ChatStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
