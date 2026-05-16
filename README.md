# Ambit — React Native Prototype

A chat-first, proximity-based hiring app connecting Bay Area startup founders with local talent. Built with Expo + React Native.

## Quick Start

```bash
cd Ambit
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `i` for iOS simulator / `a` for Android emulator.

## Features

- **Founder view**: Browse AI-matched candidates, review interest expressions, chat with talent
- **Candidate view**: Discover nearby startups, express interest with personalized notes, chat with founders
- **Developer toggle**: Switch between founder/candidate views from the top of the app
- **Hinge-quality UI**: Warm, premium design with spring animations and haptic feedback

## Architecture

**Atomic Design** structure:

```
components/
  atoms/       → Badge, Avatar, Tag, Button, TextInput, Icon, Divider, StatusDot
  molecules/   → SkillTagGroup, NeighborhoodDistance, ChatBubble, ActionBar, TimerBadge
  organisms/   → CandidateCard, StartupCard, InterestExpression, ChatThread, ChatInput
  templates/   → FeedTemplate, ChatTemplate, ProfileTemplate, InboxTemplate
```

**Navigation** (Expo Router):

```
app/
  (founder)/   → Discover, Inbox, Chats, Profile tabs
  (candidate)/ → Discover, Chats, Profile tabs
```

## Tech Stack

- Expo SDK 54 + Expo Router v6
- React Native Reanimated (spring animations)
- React Native Gesture Handler
- @gorhom/bottom-sheet
- expo-haptics
- All data is mock — no backend required

## Mock Data

- 14 candidates with diverse backgrounds
- 12 startups across various industries and stages
- 8 interest expressions
- 5 conversations with realistic message history
