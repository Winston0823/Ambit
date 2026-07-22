import React, { useEffect, useState } from 'react';
import { withLayoutContext, useSegments } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { LiquidNavBar, NavTabKey } from '../../../components/organisms';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getInbox } from '../../../lib/messaging';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

const ROUTE_TO_TAB: Record<string, NavTabKey> = {
  feed: 'discovery',
  chat: 'chat',
  projects: 'projects',
  profile: 'profile',
};
const TAB_TO_ROUTE: Record<NavTabKey, string> = {
  discovery: 'feed',
  chat: 'chat',
  projects: 'projects',
  profile: 'profile',
};

/// Swipeable tab carousel (Clash-Royale feel) via material-top-tabs + native
/// react-native-pager-view: all four tabs stay mounted (`lazy: false` → no lag
/// on swipe). Discovery is `swipeEnabled: false` so its horizontal swipes drive
/// the card deck, not screen transitions — you leave Discovery by tapping a tab.
export default function TabsLayout() {
  const { user } = useAuth();
  const segments = useSegments();
  const inThread = segments[segments.length - 1] === '[id]';

  // Unread badge on the Chat tab (kept in sync via realtime).
  const [hasUnread, setHasUnread] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const items = await getInbox();
        if (!cancelled) setHasUnread(items.some((i) => i.unread_count > 0));
      } catch {}
    };
    refresh();

    // Adopt an existing live channel if already registered (fast-refresh /
    // remount) — .on() after subscribe() throws, so only wire + subscribe +
    // tear down a channel we create.
    const topic = 'layout-badge-watch';
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (existing) return () => { cancelled = true; };

    const ch = supabase
      .channel(topic)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${user.id}` },
        refresh,
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const badgeTabs = new Set<NavTabKey>(hasUnread ? ['chat'] : []);

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      initialRouteName="feed"
      // Tab-swipe off on Discovery (the deck owns horizontal gestures) and
      // inside a chat thread; on everywhere else. Derived per-route as a
      // FUNCTION of route.name — material-top-tabs reads swipeEnabled from the
      // focused route's options, so this is synchronously correct on the very
      // first render (a segments-derived value lagged one render, mounting the
      // native pager scrollEnabled=true; on Fabric/Android the later prop
      // update never reached the pager — see patches/react-native-tab-view).
      screenOptions={({ route }) => ({
        lazy: false,
        swipeEnabled: route.name !== 'feed' && !inThread,
      })}
      tabBar={({ state, navigation }: any) => {
        const currentRoute = state.routes[state.index].name;
        const activeKey = ROUTE_TO_TAB[currentRoute] ?? 'discovery';
        return (
          <LiquidNavBar
            activeKey={activeKey}
            hidden={inThread}
            badgeTabs={badgeTabs}
            onChange={(key) => navigation.navigate(TAB_TO_ROUTE[key])}
          />
        );
      }}
    >
      {/* swipeEnabled is controlled at the navigator level above (off on
          Discovery + inside a thread), not per-screen — per-screen options are
          applied unreliably on the initial route. */}
      <MaterialTopTabs.Screen name="feed" />
      <MaterialTopTabs.Screen name="chat" />
      <MaterialTopTabs.Screen name="projects" />
      <MaterialTopTabs.Screen name="profile" />
    </MaterialTopTabs>
  );
}
