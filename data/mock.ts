/// Mock data fixtures. Used until Supabase is wired.

import { Brand } from '../constants/theme';

export interface Campus {
  id: string;
  name: string;
  city: string;
}

/// LA-area campuses. USC + UCLA are the v1 anchor campuses; the rest are
/// nearby schools where students might commute or collaborate.
export const CAMPUSES: Campus[] = [
  { id: 'usc',        name: 'University of Southern California', city: 'Los Angeles' },
  { id: 'ucla',       name: 'UCLA',                              city: 'Los Angeles' },
  { id: 'caltech',    name: 'Caltech',                           city: 'Pasadena' },
  { id: 'lmu',        name: 'Loyola Marymount University',       city: 'Los Angeles' },
  { id: 'pepperdine', name: 'Pepperdine University',             city: 'Malibu' },
  { id: 'csula',      name: 'Cal State LA',                      city: 'Los Angeles' },
  { id: 'oxy',        name: 'Occidental College',                city: 'Los Angeles' },
];

/// Skill tag categories. Spec § 8.1 has the full taxonomy; this is a v0 subset.
export interface SkillCategory {
  label: string;
  tags: string[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    label: 'ENGINEERING',
    tags: ['React Native', 'Swift', 'Kotlin', 'TypeScript', 'Python', 'Rust', 'Go', 'DevOps', 'iOS', 'Android', 'Web'],
  },
  {
    label: 'DESIGN',
    tags: ['Figma', 'UI/UX', 'Prototyping', 'Brand', 'Motion'],
  },
  {
    label: 'PRODUCT & BUSINESS',
    tags: ['Product Strategy', 'User Research', 'Growth', 'Marketing', 'Sales', 'Operations'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Discovery deck — owner view sees Seeker cards, seeker view sees Project cards.
// Shape designed so the real matching API can swap in via one prop change:
//   - SeekerCardData ← profiles table row (role='seeker')
//   - ProjectCardData ← projects table row + owner profile join + match score
// ─────────────────────────────────────────────────────────────────────────────

export interface SeekerCardData {
  kind: 'seeker';
  id: string;
  name: string;
  photoUri: string | null;
  campusId: string;
  skills: string[];
  vibeBlurb: string;
  /// Post-onboarding portfolio highlight. v1 = plain string; later swaps to
  /// a structured object (title + link + media). The card layout doesn't
  /// change — only DiscoveryCard.tsx reads this field.
  portfolioHighlight: string;
}

export interface ProjectCardData {
  kind: 'project';
  id: string;
  title: string;
  pitch: string;
  ownerName: string;
  ownerPhotoUri: string | null;
  ownerCampusId: string;
  /// Single-string mock until the matching algorithm lands. Real shape:
  /// `{ reasons: string[]; score: number }` — only DiscoveryCard.tsx reads it.
  whyMatched: string;
  skillsSought: string[];
  /// Two-stop gradient drawn from the warm-tan palette family. Each project
  /// gets a unique fingerprint until real banner uploads land.
  gradient: [string, string];
}

export type DiscoveryCardData = SeekerCardData | ProjectCardData;

export const MOCK_SEEKERS: SeekerCardData[] = [
  {
    kind: 'seeker',
    id: 'seeker-1',
    name: 'Alex Chen',
    photoUri: null,
    campusId: 'usc',
    skills: ['React Native', 'TypeScript', 'iOS'],
    vibeBlurb: 'I like shipping things that feel calm and fast.',
    portfolioHighlight: 'Built a habit tracker featured on r/sideproject (4k stars).',
  },
  {
    kind: 'seeker',
    id: 'seeker-2',
    name: 'Daria Park',
    photoUri: null,
    campusId: 'ucla',
    skills: ['Figma', 'UI/UX', 'Brand'],
    vibeBlurb: 'Designer who codes enough to be dangerous.',
    portfolioHighlight: 'Rebranded a 50k-student org; case study on Read.cv.',
  },
  {
    kind: 'seeker',
    id: 'seeker-3',
    name: 'Maya Patel',
    photoUri: null,
    campusId: 'caltech',
    skills: ['Python', 'User Research', 'Product Strategy'],
    vibeBlurb: 'Researcher first, builder second. Loves a good interview.',
    portfolioHighlight: 'Published mental-health UX study cited by Stanford d.school.',
  },
  {
    kind: 'seeker',
    id: 'seeker-4',
    name: 'Sam Liu',
    photoUri: null,
    campusId: 'usc',
    skills: ['Growth', 'Marketing', 'Operations'],
    vibeBlurb: 'I make the engine that pulls people in. Big spreadsheet energy.',
    portfolioHighlight: 'Took a campus newsletter from 200 → 12k subscribers in a year.',
  },
  {
    kind: 'seeker',
    id: 'seeker-5',
    name: 'Iris Tan',
    photoUri: null,
    campusId: 'ucla',
    skills: ['Brand', 'Motion', 'Prototyping'],
    vibeBlurb: 'Brand systems and the tiny animations that make them sing.',
    portfolioHighlight: 'Design system used by 3 SC startups; open-sourced on GitHub.',
  },
  {
    kind: 'seeker',
    id: 'seeker-6',
    name: 'Jordan Reyes',
    photoUri: null,
    campusId: 'lmu',
    skills: ['Swift', 'iOS', 'Prototyping'],
    vibeBlurb: 'iOS native. Care a lot about polish, less about frameworks.',
    portfolioHighlight: 'Two indie apps in the App Store; one was Apple-featured.',
  },
  {
    kind: 'seeker',
    id: 'seeker-7',
    name: 'Priya Shah',
    photoUri: null,
    campusId: 'usc',
    skills: ['Python', 'DevOps', 'Web'],
    vibeBlurb: 'Backend-y, infra-curious. I make things not break.',
    portfolioHighlight: 'Built the data pipeline behind a YC-backed climate tool.',
  },
];

export const MOCK_PROJECTS: ProjectCardData[] = [
  {
    kind: 'project',
    id: 'project-1',
    title: 'AI Study Tool',
    pitch: 'A study companion that learns the way you actually study — not the way textbooks assume you do.',
    ownerName: 'Noah Park',
    ownerPhotoUri: null,
    ownerCampusId: 'usc',
    whyMatched: '3 shared skills · same campus',
    skillsSought: ['Designer', 'iOS', 'User Research'],
    gradient: [Brand.primary, Brand.accent],
  },
  {
    kind: 'project',
    id: 'project-2',
    title: 'Hardware for student labs',
    pitch: 'Cheaper, open-source bench equipment so undergrad labs stop running on duct tape.',
    ownerName: 'Daria Kim',
    ownerPhotoUri: null,
    ownerCampusId: 'caltech',
    whyMatched: 'Both into prototyping · 12 mi away',
    skillsSought: ['Mechanical', 'Firmware', 'Industrial Design'],
    gradient: ['#C9A57A', Brand.seekerInk],
  },
  {
    kind: 'project',
    id: 'project-3',
    title: 'Campus mental-health app',
    pitch: 'Anonymous, peer-led support that meets students where they actually are: their phones, at 2 a.m.',
    ownerName: 'Maya Patel',
    ownerPhotoUri: null,
    ownerCampusId: 'ucla',
    whyMatched: 'Skills you listed match 4 of their needs',
    skillsSought: ['Design', 'iOS', 'Research', 'Brand'],
    gradient: [Brand.seekerSurface, Brand.accent],
  },
  {
    kind: 'project',
    id: 'project-4',
    title: 'Late-night food map',
    pitch: 'A map of every place still serving food past midnight near campus — built by students, for students.',
    ownerName: 'Sam Liu',
    ownerPhotoUri: null,
    ownerCampusId: 'usc',
    whyMatched: 'Both at USC · same vibe (calm + fast)',
    skillsSought: ['Web', 'Growth', 'Brand'],
    gradient: ['#E8C9A0', Brand.primary],
  },
  {
    kind: 'project',
    id: 'project-5',
    title: 'Sustainable thrift marketplace',
    pitch: 'Peer-to-peer clothing exchange that doesn\'t feel like a flea market and isn\'t run by middlemen.',
    ownerName: 'Iris Tan',
    ownerPhotoUri: null,
    ownerCampusId: 'ucla',
    whyMatched: '2 shared skills · same campus radius',
    skillsSought: ['React Native', 'Marketing', 'Operations'],
    gradient: [Brand.accent, '#7A5A38'],
  },
  {
    kind: 'project',
    id: 'project-6',
    title: 'Indie-game studio v0',
    pitch: 'Looking for a small, weird team to make one strange, small game and ship it before graduation.',
    ownerName: 'Jordan Reyes',
    ownerPhotoUri: null,
    ownerCampusId: 'lmu',
    whyMatched: 'Both like motion · adjacent campus',
    skillsSought: ['Motion', 'Sound', 'Game Dev'],
    gradient: ['#D4B490', '#4D361D'],
  },
  {
    kind: 'project',
    id: 'project-7',
    title: 'Lecture-recap bot',
    pitch: 'A bot that watches your lecture recording and gives you a 3-bullet summary before you finish your coffee.',
    ownerName: 'Priya Shah',
    ownerPhotoUri: null,
    ownerCampusId: 'usc',
    whyMatched: '4 shared skills · same campus',
    skillsSought: ['Python', 'iOS', 'Growth'],
    gradient: [Brand.seekerSurface, '#B48045'],
  },
];
