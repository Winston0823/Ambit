import React from 'react';
import { Tabs } from 'expo-router';
import { LiquidNavBar, NavTabKey } from '../../components/organisms';

const TAB_TO_ROUTE: Record<NavTabKey, string> = {
  discovery: 'feed',
  chat: 'chat',
  projects: 'projects',
  profile: 'profile',
};

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
      {/* Messaging — thread + search reached from the chat tab. */}
      <Tabs.Screen name="thread" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}
