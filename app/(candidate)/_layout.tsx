import React, { useEffect, useState } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { LiquidNavBar, NavTabKey } from '../../components/organisms';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { getInbox } from '../../lib/messaging';

const TAB_TO_ROUTE: Record<NavTabKey, string> = {
  discovery: 'feed',
  chat: 'chat',
  projects: 'projects',
  profile: 'profile',
};

/// The chat tab is a nested Stack (chat/_layout.tsx) so thread + search
/// live inside it as proper push targets. The Tabs navigator's active
/// route is still 'chat' for any screen within that stack — no extra
/// mapping needed.
const ROUTE_TO_TAB: Record<string, NavTabKey> = {
  feed: 'discovery',
  chat: 'chat',
  projects: 'projects',
  profile: 'profile',
};

export default function CandidateLayout() {
  const { user } = useAuth();
  const segments = useSegments();
  const inThread = segments[segments.length - 1] === '[id]';

  // Tracks whether there are any unread conversations for the badge dot.
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

    // Keep the badge in sync with incoming messages and read receipts.
    const ch = supabase
      .channel('layout-badge-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${user.id}` },
        refresh,
      )
      .subscribe();

    return () => {
      cancelled = true;
      ch.unsubscribe();
    };
  }, [user?.id]);

  const badgeTabs = new Set<NavTabKey>(hasUnread ? ['chat'] : []);

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => {
        const currentRoute = state.routes[state.index].name;
        const activeKey = ROUTE_TO_TAB[currentRoute] ?? 'discovery';
        return (
          <LiquidNavBar
            activeKey={activeKey}
            hidden={inThread}
            badgeTabs={badgeTabs}
            onChange={(key) => navigation.navigate(TAB_TO_ROUTE[key] as never)}
          />
        );
      }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="projects" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="saved" options={{ href: null }} />
      <Tabs.Screen name="project-new" options={{ href: null }} />
      <Tabs.Screen name="project-edit" options={{ href: null }} />
      <Tabs.Screen name="project-manage" options={{ href: null }} />
    </Tabs>
  );
}
