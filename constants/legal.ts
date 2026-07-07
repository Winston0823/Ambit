// Ambit legal content — Terms of Use (EULA) + Privacy Policy.
//
// Rendered in-app by LegalModal and linked from the sign-up agree-gate and the
// profile screen. The SAME text should be hosted at a public URL for the App
// Store Connect "Privacy Policy URL" field (see LEGAL_URLS below).
//
// ⚠️ These are working drafts written to satisfy Apple's review requirements
// (Guideline 1.2 for UGC + 5.1.1 privacy). They are NOT a substitute for legal
// review — have counsel check them before public launch. Update the bracketed
// placeholders (contact email, company name, governing law, hosted URLs).

export const LEGAL_EFFECTIVE_DATE = 'July 7, 2026';
export const LEGAL_CONTACT_EMAIL = 'support@ambit.app'; // TODO: real support/privacy inbox
export const LEGAL_ENTITY = 'Ambit'; // TODO: legal company name if incorporated

// Hosted copies for App Store Connect metadata (required for the Privacy Policy
// URL field, recommended for Terms). TODO: publish and paste the real URLs.
export const LEGAL_URLS = {
  terms: 'https://ambit.app/terms',
  privacy: 'https://ambit.app/privacy',
};

export interface LegalSection {
  heading: string;
  body: string; // blank line = paragraph break; "• " lines render as bullets
}

export interface LegalDoc {
  title: string;
  updated: string;
  sections: LegalSection[];
}

export const TERMS_OF_USE: LegalDoc = {
  title: 'Terms of Use',
  updated: LEGAL_EFFECTIVE_DATE,
  sections: [
    {
      heading: '1. Acceptance',
      body: `By creating an account or using Ambit (the "App"), you agree to these Terms of Use and to our Privacy Policy. If you do not agree, do not use the App.`,
    },
    {
      heading: '2. Eligibility',
      body: `Ambit is for current university students and members of university communities. You must be at least 18 years old, or the age of majority where you live, and be able to form a binding contract. You must sign up with a valid university (.edu or equivalent) email where required.`,
    },
    {
      heading: '3. Your account',
      body: `You are responsible for your account and for keeping your login secure. Provide accurate information and keep it current. You may not impersonate anyone or misrepresent your affiliation, skills, or identity.`,
    },
    {
      heading: '4. Community rules — zero tolerance for objectionable content',
      body: `Ambit has ZERO TOLERANCE for objectionable content or abusive behavior. You agree not to post, send, or share content that is unlawful, harassing, hateful, threatening, sexually explicit, defamatory, discriminatory, spammy, fraudulent, or that infringes others' rights, and not to stalk, bully, or abuse any other user.

We reserve the right to remove content and to suspend or terminate accounts that violate these rules, at our discretion and without notice.`,
    },
    {
      heading: '5. Your content',
      body: `You retain ownership of the content you create (your profile, messages, portfolio, and projects). You grant Ambit a non-exclusive, worldwide license to host, store, display, and transmit that content solely to operate and improve the App. You are solely responsible for the content you share and must have the rights to share it.`,
    },
    {
      heading: '6. Reporting, blocking, and enforcement',
      body: `You can report objectionable content and block abusive users from within the App. We review reports and act on violations — including removing content and ejecting the offending user — typically within 24 hours. By using Ambit you agree to this moderation process. Filing false or malicious reports is itself a violation.`,
    },
    {
      heading: '7. Prohibited use',
      body: `You may not: reverse engineer or disrupt the App; scrape or harvest data; use bots or automated access; attempt to access other users' accounts; or use the App for any illegal purpose or in violation of any applicable law.`,
    },
    {
      heading: '8. Disclaimers',
      body: `Ambit is provided "as is" without warranties of any kind. Ambit is a platform for connecting people; we do not verify every user, do not employ or endorse any user, and are not a party to any arrangement, hire, or agreement you make with another user. You interact with other users at your own risk.`,
    },
    {
      heading: '9. Limitation of liability',
      body: `To the fullest extent permitted by law, Ambit and ${LEGAL_ENTITY} will not be liable for any indirect, incidental, or consequential damages, or for any conduct or content of any user. Our total liability for any claim is limited to the amount you paid us (if any) in the 12 months before the claim.`,
    },
    {
      heading: '10. Termination',
      body: `You may stop using Ambit and delete your account at any time from the profile screen. We may suspend or terminate your access if you violate these Terms.`,
    },
    {
      heading: '11. Changes',
      body: `We may update these Terms. Material changes will be surfaced in the App. Continued use after an update means you accept the revised Terms.`,
    },
    {
      heading: '12. Contact',
      body: `Questions about these Terms? Contact us at ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  updated: LEGAL_EFFECTIVE_DATE,
  sections: [
    {
      heading: 'Overview',
      body: `This policy explains what information Ambit collects, how we use it, and your choices. By using the App you agree to this policy.`,
    },
    {
      heading: 'Information you provide',
      body: `• Account: your university (.edu) email, and name.
• Profile: photo, bio/blurb, skills, campus, role (seeker/owner), and student/professor status.
• Links you add: GitHub, LinkedIn, personal site, and any résumé you upload (which we process to help fill your profile).
• Content you create: portfolio items and images, projects and cover images, and messages (including photos) you send to other users.`,
    },
    {
      heading: 'Information collected automatically',
      body: `• Usage and reliability signals (e.g. response rate, last activity) used for matching and to show reply-tier badges.
• A device push-notification token, so we can notify you of messages and reach-outs.
• With your permission, calendar availability (read on your device) to help schedule meetings, and camera/photo access to add images.
• Advertising identifier (IDFA) and related data, only if you allow tracking, used to show rewarded ads (see "Advertising").`,
    },
    {
      heading: 'How we use your information',
      body: `To operate the App: create and secure your account, power matching and discovery, deliver messages, send notifications, schedule meetings, show rewarded ads, and keep the community safe (moderation of reports and blocks). We generate a vector representation of your profile text to improve matching relevance.`,
    },
    {
      heading: 'How we share your information',
      body: `• With other users: your profile and the content you choose to share are visible to other users as part of the App's core function.
• With service providers that operate the App on our behalf: cloud hosting and database (Supabase), push notifications (Expo), advertising (Google AdMob), and AI-assisted résumé parsing and matching. These providers process data only to provide their services.
• For legal reasons: to comply with law or protect rights, safety, and the integrity of the App.

We do not sell your personal information.`,
    },
    {
      heading: 'Advertising and tracking',
      body: `Ambit shows rewarded ads through Google AdMob when you choose to watch one. On iOS we ask for your permission before any tracking via Apple's App Tracking Transparency prompt; if you decline, we request non-personalized ads. You can change this anytime in your device Settings.`,
    },
    {
      heading: 'Data retention and deletion',
      body: `We keep your information while your account is active. You can permanently delete your account and associated data at any time from the profile screen ("Delete account"), which removes your profile, projects, portfolio, messages, matches, and uploaded files.`,
    },
    {
      heading: 'Your choices and rights',
      body: `You can edit or remove your profile content, block and report other users, control notification and tracking permissions in device Settings, and delete your account. Depending on where you live, you may have rights to access, correct, or delete your personal data — contact us to exercise them.`,
    },
    {
      heading: 'Security',
      body: `We use industry-standard measures (including encrypted storage of your session on your device and access controls on our backend) to protect your information. No system is perfectly secure, but we work to safeguard your data.`,
    },
    {
      heading: 'Children',
      body: `Ambit is not directed to children. You must be at least 18, and our university-email requirement is intended to limit the service to adult members of university communities. We do not knowingly collect data from anyone under 13.`,
    },
    {
      heading: 'Changes',
      body: `We may update this policy. Material changes will be surfaced in the App with a new effective date.`,
    },
    {
      heading: 'Contact',
      body: `Questions or requests about your privacy? Contact us at ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};
