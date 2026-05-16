/// Mock data fixtures. Used until Supabase is wired.

export interface Campus {
  id: string;
  name: string;
  city: string;
}

export const CAMPUSES: Campus[] = [
  { id: 'stanford',   name: 'Stanford University',          city: 'Stanford' },
  { id: 'berkeley',   name: 'UC Berkeley',                  city: 'Berkeley' },
  { id: 'sjsu',       name: 'San Jose State University',    city: 'San Jose' },
  { id: 'scu',        name: 'Santa Clara University',       city: 'Santa Clara' },
  { id: 'sfsu',       name: 'San Francisco State University', city: 'San Francisco' },
  { id: 'usf',        name: 'University of San Francisco',  city: 'San Francisco' },
  { id: 'ucsc',       name: 'UC Santa Cruz',                city: 'Santa Cruz' },
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
