import React from 'react';
import { Tabs } from 'expo-router';
import { LiquidNavBar, NavTabKey } from '../../components/organisms';

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
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => {
        const currentRoute = state.routes[state.index].name;
        const activeKey = ROUTE_TO_TAB[currentRoute] ?? 'discovery';
        return (
          <LiquidNavBar
            activeKey={activeKey}
            onChange={(key) => navigation.navigate(TAB_TO_ROUTE[key] as never)}
          />
        );
      }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="projects" />
      <Tabs.Screen name="profile" />
      {/* Saved exists as a route but never appears in the nav bar — it's
          pushed via router.push('/saved') from the feed's bookmark icon. */}
      <Tabs.Screen name="saved" options={{ href: null }} />
      {/* Project create / edit screens — reached from the projects tab.
          Hidden from the nav bar via href:null. */}
      <Tabs.Screen name="project-new" options={{ href: null }} />
      <Tabs.Screen name="project-edit" options={{ href: null }} />
    </Tabs>
  );
}
