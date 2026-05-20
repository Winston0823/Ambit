/// Mock data fixtures. Used until Supabase is wired.

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
