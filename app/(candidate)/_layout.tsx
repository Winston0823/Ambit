import React from 'react';
import { Tabs } from 'expo-router';
import { LiquidNavBar, NavTab, NavTabKey } from '../../components/organisms/LiquidNavBar';

const CANDIDATE_TABS: NavTab[] = [
  { key: 'discovery', label: 'Discovery', icon: 'compass' },
  { key: 'chat', label: 'Chat', icon: 'message-circle' },
  { key: 'projects', label: 'Projects', icon: 'folder' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

const TAB_TO_ROUTE: Record<NavTabKey, string> = {
  discovery: 'feed',
  chat: 'chats',
  projects: 'projects',
  profile: 'profile',
};

const ROUTE_TO_TAB: Record<string, NavTabKey> = {
  feed: 'discovery',
  chats: 'chat',
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
            tabs={CANDIDATE_TABS}
            activeKey={activeKey}
            onChange={(key) => navigation.navigate(TAB_TO_ROUTE[key] as never)}
          />
        );
      }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="projects" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="interest" options={{ href: null }} />
    </Tabs>
  );
}
