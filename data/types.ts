export interface Candidate {
  id: string;
  name: string;
  photo: string;
  neighborhood: string;
  distance: string;
  vibeBlurb: string;
  skills: string[];
  lookingFor: string;
  linkedIn: string;
  lastActive: string;
  responseRate: number;
  portfolio?: string;
  github?: string;
}

export interface Role {
  id: string;
  title: string;
  skills: string[];
  compRange: string;
  workType: string;
}

export interface Founder {
  name: string;
  photo: string;
  bio: string;
}

export interface Startup {
  id: string;
  name: string;
  logo: string;
  oneLiner: string;
  stage: 'Pre-seed' | 'Seed' | 'Series A';
  teamSize: string;
  neighborhood: string;
  distance: string;
  officeVibe: string;
  founder: Founder;
  roles: Role[];
  responseRate: number;
  responseTime: string;
}

export interface Interest {
  id: string;
  candidateId: string;
  startupId: string;
  roleId: string;
  note: string;
  createdAt: string;
  hoursRemaining: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type: 'text' | 'coffee';
}

export interface Conversation {
  id: string;
  founderId: string;
  candidateId: string;
  startupId: string;
  messages: Message[];
  lastMessageAt: string;
  unreadCount: number;
}
