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
  { id: 'usc',        name: 'USC',        city: 'Los Angeles' },
  { id: 'ucla',       name: 'UCLA',       city: 'Los Angeles' },
  { id: 'caltech',    name: 'Caltech',    city: 'Pasadena' },
  { id: 'lmu',        name: 'LMU',        city: 'Los Angeles' },
  { id: 'pepperdine', name: 'Pepperdine', city: 'Malibu' },
  { id: 'csula',      name: 'Cal State LA', city: 'Los Angeles' },
  { id: 'oxy',        name: 'Occidental College', city: 'Los Angeles' },
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
    tags: ['Product Strategy', 'User Research', 'Growth Strategy', 'Marketing', 'Sales', 'Operations'],
  },
];

/// Role categories for project hiring. Founders pick which positions they're
/// actively recruiting for — displayed on discovery cards so seekers know
/// exactly what kind of team member is wanted before they reach out.
export interface RoleCategory {
  label: string;
  roles: string[];
}

export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    label: 'ENGINEERING',
    roles: ['Software Engineer', 'Frontend', 'Backend', 'Full Stack', 'Mobile', 'ML / AI', 'Data Science', 'DevOps / Infra'],
  },
  {
    label: 'DESIGN',
    roles: ['Product Design', 'UX Research', 'Brand / Visual'],
  },
  {
    label: 'PRODUCT & OPS',
    roles: ['Product Manager', 'Operations', 'Finance'],
  },
  {
    label: 'GROWTH',
    roles: ['Marketing', 'Sales / BD', 'Content / Social'],
  },
];

/// Typical skills each role implies — drives the "roles → skills" auto-fill in
/// project create (a role implies the skills it needs). Owners can edit the
/// result; skills are what discovery actually matches on. Keys are ROLE_
/// CATEGORIES roles; values are SKILL_CATEGORIES tags.
export const ROLE_SKILLS: Record<string, string[]> = {
  'Software Engineer': ['TypeScript', 'Python', 'Web'],
  'Frontend':          ['TypeScript', 'Web', 'UI/UX'],
  'Backend':           ['Python', 'Go', 'DevOps'],
  'Full Stack':        ['TypeScript', 'Web', 'Python'],
  'Mobile':            ['React Native', 'Swift', 'Kotlin', 'iOS', 'Android'],
  'ML / AI':           ['Python'],
  'Data Science':      ['Python'],
  'DevOps / Infra':    ['DevOps', 'Go'],
  'Product Design':    ['Figma', 'UI/UX', 'Prototyping'],
  'UX Research':       ['User Research', 'UI/UX'],
  'Brand / Visual':    ['Brand', 'Figma', 'Motion'],
  'Product Manager':   ['Product Strategy', 'User Research'],
  'Operations':        ['Operations'],
  'Finance':           ['Operations'],
  'Marketing':         ['Marketing', 'Growth Strategy'],
  'Sales / BD':        ['Sales', 'Growth Strategy'],
  'Content / Social':  ['Marketing', 'Brand'],
};

/// Derive the skills a project matches on from the roles it's hiring for.
/// Owners pick roles; discovery still ranks on skill overlap, so we map roles
/// → skills silently (no skills UI). De-duped, order-stable.
export function skillsForRoles(roles: string[]): string[] {
  const out: string[] = [];
  for (const r of roles) for (const s of ROLE_SKILLS[r] ?? []) if (!out.includes(s)) out.push(s);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery deck — owner view sees Seeker cards, seeker view sees Project cards.
// Shape designed so the real matching API can swap in via one prop change:
//   - SeekerCardData ← profiles table row (role='seeker')
//   - ProjectCardData ← projects table row + owner profile join + match score
// ─────────────────────────────────────────────────────────────────────────────

/// A single portfolio entry. Rendered as a circular bubble with the
/// image (or gradient placeholder when imageUri is null) and the title
/// beneath. Tapping a bubble opens PortfolioModal which surfaces the
/// full description.
export interface PortfolioItem {
  id: string;
  /// File:// URI from the picker, or remote Supabase Storage URL after
  /// upload. null = render the gradient placeholder.
  imageUri: string | null;
  /// Short label that lives under the bubble.
  title: string;
  /// 2–4 sentences shown in the expanded modal.
  description: string;
  /// Two-stop gradient used as the placeholder when no image is set.
  /// Keyed off id when seeding mock data so each bubble feels distinct.
  gradient: [string, string];
  /// When the work happened — "2025" / "Spring 2025". Required in the editor;
  /// optional on the type so legacy rows + mock seeds stay valid. '' = unset.
  timeframe?: string;
  /// Role / contribution bullets (one per line in the editor).
  contributions?: string[];
  /// One external link — live demo / repo / case study.
  linkUrl?: string | null;
  /// Tool / tech tags shown as chips.
  tools?: string[];
}

/// External links surfaced as icon buttons on the card's Portfolio
/// Highlights screen (screen 2). All optional — only the present ones render.
export interface SeekerLinks {
  github?: string;
  site?: string;
  appStore?: string;
}

export interface SeekerCardData {
  kind: 'seeker';
  id: string;
  name: string;
  photoUri: string | null;
  campusId: string;
  skills: string[];
  vibeBlurb: string;
  /// Field of study, e.g. "Computer Science". Optional — the discovery card
  /// eyebrow shows it when present and falls back to campus-only otherwise,
  /// so we never fabricate a major the user didn't give us.
  major?: string;
  /// Graduation year, e.g. "26" or "2026". Optional, same rationale.
  gradYear?: string;
  /// Ordered list of featured work. Empty array = hide the portfolio
  /// section in discovery; in profile, the "+ Add" affordance still shows.
  portfolio: PortfolioItem[];
  /// Optional external links — GitHub / personal site / App Store. Rendered
  /// as icon buttons on the Portfolio Highlights screen.
  links?: SeekerLinks;
}

export interface ProjectCardData {
  kind: 'project';
  id: string;
  /// UUID of the owner profile. Empty string for placeholder mock cards
  /// (isRealUuid filters those out of messaging flows). Populated from
  /// `compat_projects_for_seeker.owner_id` on the live deck.
  ownerId: string;
  title: string;
  pitch: string;
  ownerName: string;
  ownerPhotoUri: string | null;
  ownerCampusId: string;
  /// Single-string mock until the matching algorithm lands. Real shape:
  /// `{ reasons: string[]; score: number }` — only DiscoveryCard.tsx reads it.
  whyMatched: string;
  skillsSought: string[];
  /// Open positions the founder is recruiting for. Empty = not set / any role.
  rolesSought: string[];
  /// Two-stop gradient drawn from the warm-tan palette family. Used as the
  /// hero fallback when the project has no cover image.
  gradient: [string, string];
  /// Optional founder-uploaded cover image. When set it becomes the card's
  /// hero (over the owner avatar / gradient). Public URL from the
  /// `project-images` bucket; undefined/null = fall back.
  imageUri?: string | null;
  /// Optional deadline ("needs someone by ___"). ISO date string `YYYY-MM-DD`
  /// from `projects.needed_by`. Drives the top-right urgency badge.
  neededBy?: string | null;
}

export type DiscoveryCardData = SeekerCardData | ProjectCardData;

/// Gradient swatch pool used to fingerprint portfolio bubbles when no
/// image has been uploaded. Drawn from the warm palette so placeholders
/// still feel on-brand.
const PORTFOLIO_GRADIENTS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', Brand.seekerInk],
  [Brand.seekerSurface, Brand.accent],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
];

export const MOCK_SEEKERS: SeekerCardData[] = [
  {
    kind: 'seeker',
    id: 'seeker-1',
    name: 'Alex Chen',
    photoUri: 'https://i.pravatar.cc/800?img=12',
    campusId: 'usc',
    skills: ['React Native', 'TypeScript', 'iOS', 'Swift'],
    vibeBlurb: 'I like shipping things that feel calm and fast.',
    portfolio: [
      {
        id: 'p1-1',
        imageUri: 'https://picsum.photos/seed/habittracker/600/600',
        title: 'Habit Tracker',
        description: 'A minimal habit-tracking app for iOS that focuses on streak-based motivation. Built in 3 weeks while studying for finals. Featured on r/sideproject with 4k stars.',
        gradient: PORTFOLIO_GRADIENTS[0],
      },
      {
        id: 'p1-2',
        imageUri: 'https://picsum.photos/seed/todolite/600/600',
        title: 'ToDo Lite',
        description: 'A todo app that gets out of your way. No nesting, no projects, no tags — just a list and a way to clear it. 600 paying users in the first month.',
        gradient: PORTFOLIO_GRADIENTS[1],
      },
      {
        id: 'p1-3',
        imageUri: 'https://picsum.photos/seed/recipebook/600/600',
        title: 'Recipe Book',
        description: 'iPad-first recipe organizer with handwriting-style fonts and a "what can I make right now" filter. Built for my parents; ended up shipping it.',
        gradient: PORTFOLIO_GRADIENTS[2],
      },
    ],
    links: {
      github: 'https://github.com/alexchen',
      site: 'https://alexchen.dev',
      appStore: 'https://apps.apple.com/app/habit-tracker',
    },
  },
  {
    kind: 'seeker',
    id: 'seeker-2',
    name: 'Daria Park',
    photoUri: null,
    campusId: 'ucla',
    skills: ['Figma', 'UI/UX', 'Brand', 'Motion'],
    vibeBlurb: 'Designer who codes enough to be dangerous.',
    portfolio: [
      {
        id: 'p2-1',
        imageUri: null,
        title: 'Org Rebrand',
        description: 'Rebranded a 50k-student org from scratch — wordmark, color system, motion principles, full guidelines doc. Case study published on Read.cv.',
        gradient: PORTFOLIO_GRADIENTS[3],
      },
      {
        id: 'p2-2',
        imageUri: null,
        title: 'Onboarding Study',
        description: 'A 6-week research project on first-run onboarding patterns across 30 indie iOS apps. Wrote up the findings as a blog post that got picked up on Hacker News.',
        gradient: PORTFOLIO_GRADIENTS[4],
      },
    ],
    links: {
      github: 'https://github.com/dariapark',
      site: 'https://read.cv/dariapark',
    },
  },
  {
    kind: 'seeker',
    id: 'seeker-3',
    name: 'Maya Patel',
    photoUri: null,
    campusId: 'caltech',
    skills: ['Python', 'User Research', 'Product Strategy'],
    vibeBlurb: 'Researcher first, builder second. Loves a good interview.',
    portfolio: [
      {
        id: 'p3-1',
        imageUri: null,
        title: 'Mental Health UX',
        description: 'Published study on mental-health app UX patterns. Cited by the Stanford d.school in their healthcare design curriculum.',
        gradient: PORTFOLIO_GRADIENTS[0],
      },
    ],
    links: {
      site: 'https://mayapatel.research.io',
    },
  },
  {
    kind: 'seeker',
    id: 'seeker-4',
    name: 'Sam Liu',
    photoUri: null,
    campusId: 'usc',
    skills: ['Growth Strategy', 'Marketing', 'Operations'],
    vibeBlurb: 'I make the engine that pulls people in. Big spreadsheet energy.',
    portfolio: [
      {
        id: 'p4-1',
        imageUri: null,
        title: 'Campus Newsletter',
        description: 'Grew a campus newsletter from 200 → 12k subscribers in 12 months. Three-line subject lines, A/B-tested CTAs, weekly post-mortems.',
        gradient: PORTFOLIO_GRADIENTS[1],
      },
    ],
  },
  {
    kind: 'seeker',
    id: 'seeker-5',
    name: 'Iris Tan',
    photoUri: null,
    campusId: 'ucla',
    skills: ['Brand', 'Motion', 'Prototyping'],
    vibeBlurb: 'Brand systems and the tiny animations that make them sing.',
    portfolio: [
      {
        id: 'p5-1',
        imageUri: null,
        title: 'Design System',
        description: 'Open-source design system used by 3 SC-area startups. 80+ components, motion primitives, dark/light tokens. Maintained solo for 2 years.',
        gradient: PORTFOLIO_GRADIENTS[2],
      },
      {
        id: 'p5-2',
        imageUri: null,
        title: 'Brand Reel',
        description: 'Motion-graphics reel for an indie game studio. 30 seconds, hand-keyed, no After Effects expressions. Picked up by Motionographer.',
        gradient: PORTFOLIO_GRADIENTS[3],
      },
    ],
  },
  {
    kind: 'seeker',
    id: 'seeker-6',
    name: 'Jordan Reyes',
    photoUri: null,
    campusId: 'lmu',
    skills: ['Swift', 'iOS', 'Prototyping'],
    vibeBlurb: 'iOS native. Care a lot about polish, less about frameworks.',
    portfolio: [
      {
        id: 'p6-1',
        imageUri: null,
        title: 'Indie App #1',
        description: 'Solo-developed iOS app, Apple-featured in the "New & Noteworthy" rotation. 60k organic downloads in week one.',
        gradient: PORTFOLIO_GRADIENTS[4],
      },
    ],
  },
  {
    kind: 'seeker',
    id: 'seeker-7',
    name: 'Priya Shah',
    photoUri: null,
    campusId: 'usc',
    skills: ['Python', 'DevOps', 'Web'],
    vibeBlurb: 'Backend-y, infra-curious. I make things not break.',
    portfolio: [
      {
        id: 'p7-1',
        imageUri: null,
        title: 'Climate Pipeline',
        description: 'Built the data pipeline behind a YC-backed climate-data tool. 30TB/day, 99.95% uptime, fully serverless on AWS.',
        gradient: PORTFOLIO_GRADIENTS[0],
      },
    ],
  },
];

export const MOCK_PROJECTS: ProjectCardData[] = [
  {
    kind: 'project',
    ownerId: '',
    id: 'project-1',
    title: 'AI Study Tool',
    pitch: 'A study companion that learns the way you actually study — not the way textbooks assume you do.',
    ownerName: 'Noah Park',
    ownerPhotoUri: null,
    ownerCampusId: 'usc',
    whyMatched: '3 shared skills · same campus',
    skillsSought: ['Designer', 'iOS', 'User Research'],
    rolesSought: ['Mobile', 'Product Design', 'UX Research'],
    gradient: [Brand.primary, Brand.accent],
  },
  {
    kind: 'project',
    ownerId: '',
    id: 'project-2',
    title: 'Hardware for student labs',
    pitch: 'Cheaper, open-source bench equipment so undergrad labs stop running on duct tape.',
    ownerName: 'Daria Kim',
    ownerPhotoUri: null,
    ownerCampusId: 'caltech',
    whyMatched: 'Both into prototyping · 12 mi away',
    skillsSought: ['Mechanical', 'Firmware', 'Industrial Design'],
    rolesSought: ['Software Engineer', 'DevOps / Infra'],
    gradient: ['#C9A57A', Brand.seekerInk],
  },
  {
    kind: 'project',
    ownerId: '',
    id: 'project-3',
    title: 'Campus mental-health app',
    pitch: 'Anonymous, peer-led support that meets students where they actually are: their phones, at 2 a.m.',
    ownerName: 'Maya Patel',
    ownerPhotoUri: null,
    ownerCampusId: 'ucla',
    whyMatched: 'Skills you listed match 4 of their needs',
    skillsSought: ['Design', 'iOS', 'Research', 'Brand'],
    rolesSought: ['Mobile', 'Product Design', 'Marketing'],
    gradient: [Brand.seekerSurface, Brand.accent],
  },
  {
    kind: 'project',
    ownerId: '',
    id: 'project-4',
    title: 'Late-night food map',
    pitch: 'A map of every place still serving food past midnight near campus — built by students, for students.',
    ownerName: 'Sam Liu',
    ownerPhotoUri: null,
    ownerCampusId: 'usc',
    whyMatched: 'Both at USC · same vibe (calm + fast)',
    skillsSought: ['Web', 'Growth Strategy', 'Brand'],
    rolesSought: ['Full Stack', 'Marketing'],
    gradient: ['#E8C9A0', Brand.primary],
  },
  {
    kind: 'project',
    ownerId: '',
    id: 'project-5',
    title: 'Sustainable thrift marketplace',
    pitch: 'Peer-to-peer clothing exchange that doesn\'t feel like a flea market and isn\'t run by middlemen.',
    ownerName: 'Iris Tan',
    ownerPhotoUri: null,
    ownerCampusId: 'ucla',
    whyMatched: '2 shared skills · same campus radius',
    skillsSought: ['React Native', 'Marketing', 'Operations'],
    rolesSought: ['Mobile', 'Marketing', 'Operations'],
    gradient: [Brand.accent, '#7A5A38'],
  },
  {
    kind: 'project',
    ownerId: '',
    id: 'project-6',
    title: 'Indie-game studio v0',
    pitch: 'Looking for a small, weird team to make one strange, small game and ship it before graduation.',
    ownerName: 'Jordan Reyes',
    ownerPhotoUri: null,
    ownerCampusId: 'lmu',
    whyMatched: 'Both like motion · adjacent campus',
    skillsSought: ['Motion', 'Sound', 'Game Dev'],
    rolesSought: ['Software Engineer', 'Brand / Visual'],
    gradient: ['#D4B490', '#4D361D'],
  },
  {
    kind: 'project',
    ownerId: '',
    id: 'project-7',
    title: 'Lecture-recap bot',
    pitch: 'A bot that watches your lecture recording and gives you a 3-bullet summary before you finish your coffee.',
    ownerName: 'Priya Shah',
    ownerPhotoUri: null,
    ownerCampusId: 'usc',
    whyMatched: '4 shared skills · same campus',
    skillsSought: ['Python', 'iOS', 'Growth Strategy'],
    rolesSought: ['ML / AI', 'Mobile', 'Marketing'],
    gradient: [Brand.seekerSurface, '#B48045'],
  },
];
