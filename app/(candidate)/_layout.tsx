import React from 'react';
import { Tabs } from 'expo-router';
import { LiquidNavBar, DEFAULT_TABS, NavTabKey } from '../../components/organisms';

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
            tabs={DEFAULT_TABS}
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
    </Tabs>
  );
}
