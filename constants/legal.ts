// Ambit legal content — Terms of Use + Privacy Policy.
//
// Voice + structure modeled on Apple's Privacy Policy: warm, plain-language,
// second-person, with question/noun-phrase section headings (not "Section 1")
// and the bold lead-in "**Term.** Such as …" pattern for data bullets.
//
// Rendered in-app by LegalModal and linked from the sign-up agree-gate and the
// profile screen; the same source is exported to .docx (docs/legal/) for
// hosting. Inline **bold** is supported by both renderers.
//
// ⚠️ Working drafts written to satisfy Apple's review requirements (Guideline
// 1.2 for UGC + 5.1.1 privacy). NOT a substitute for legal review — have
// counsel check them before public launch. Update the bracketed placeholders
// (contact email, entity name, governing law, hosted URLs).

export const LEGAL_EFFECTIVE_DATE = 'July 8, 2026';
export const LEGAL_CONTACT_EMAIL = 'support@ambit.app'; // TODO: real support/privacy inbox
export const LEGAL_ENTITY = 'Ambit'; // TODO: legal company name if incorporated

// Hosted copies for App Store Connect metadata (Privacy Policy URL required).
export const LEGAL_URLS = {
  terms: 'https://ambit.app/terms',
  privacy: 'https://ambit.app/privacy',
};

export interface LegalSection {
  heading: string;
  body: string; // "\n\n" = paragraph break, "• " = bullet, **text** = bold
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string; // lead paragraph under the title, before the first section
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Ambit Privacy Policy',
  updated: LEGAL_EFFECTIVE_DATE,
  intro:
    `Ambit's Privacy Policy describes how Ambit collects, uses, and shares your personal data. We built Ambit to help student builders find each other — and we've built it to respect your privacy along the way. This policy is written in plain language, and we mean every word of it.`,
  sections: [
    {
      heading: 'What Is Personal Data at Ambit?',
      body: `At Ambit, we believe strongly in your fundamental right to privacy. "Personal data" is data that identifies you or that can reasonably be linked to you — like your name, profile, messages, and email address. Data that we cannot connect back to you isn't personal data.`,
    },
    {
      heading: 'Your Privacy Rights at Ambit',
      body: `You control your presence on Ambit. You can view and edit your profile at any time, block or report other users, and permanently delete your account and all associated data from the profile screen. Depending on where you live, you may also have the right to access, correct, or export your personal data — just reach out and we'll help.

You never have to pay a fee or trade a benefit to exercise these rights.`,
    },
    {
      heading: 'Personal Data Ambit Collects from You',
      body: `You share some information with us directly when you set up your profile and use the app:

• **Account information.** Such as your university (.edu) email address and your name.
• **Profile details.** Such as your photo, bio, skills, campus, role (seeker or owner), and whether you're a student or professor.
• **Links you add.** Such as your GitHub, LinkedIn, personal site, and any résumé you upload, which we process to help fill in your profile.
• **Content you create.** Such as portfolio items and images, projects and cover images, and the messages and photos you send to other users.`,
    },
    {
      heading: 'Personal Data Ambit Collects Automatically',
      body: `Some information is collected as you use the app:

• **Activity and reliability signals.** Such as your response rate and last active time, used to power matching and show reply-tier badges.
• **A push-notification token.** So we can let you know when someone reaches out or replies.
• **Permission-based data.** Such as your calendar availability (read on your device to help schedule meetings) and camera or photo access (to add images) — only with your permission.
• **Advertising identifier.** Such as your device's advertising ID, used to show rewarded ads only if you allow tracking (see "Advertising and Tracking").`,
    },
    {
      heading: 'How Ambit Uses Your Personal Data',
      body: `We use your data to run the app and make it better: to create and secure your account, power matching and discovery, deliver your messages, send notifications you've asked for, help you schedule meetings, show rewarded ads you choose to watch, and keep the community safe by acting on reports and blocks. We also create a numerical representation of your profile text to improve how well matches fit.

We do not use your data to build advertising profiles about you, and we never sell your personal data.`,
    },
    {
      heading: 'How Ambit Shares Personal Data',
      body: `• **With other users.** Your profile and the content you choose to share are visible to other users — that's the core of how Ambit works.
• **With service providers.** Such as our cloud host and database (Supabase), push notifications (Expo), advertising (Google AdMob), and AI-assisted résumé parsing and matching. They may only process your data to provide their services to us.
• **For legal and safety reasons.** To comply with the law, enforce our Terms, or protect the rights, safety, and integrity of Ambit and its users.`,
    },
    {
      heading: 'Advertising and Tracking',
      body: `Ambit shows rewarded ads through Google AdMob when you choose to watch one to unlock an extra reach-out. On iOS, we ask for your permission through Apple's App Tracking Transparency prompt before any tracking. If you decline, we simply request non-personalized ads. You can change your choice anytime in your device Settings.`,
    },
    {
      heading: 'Protection of Personal Data at Ambit',
      body: `We use technical and organizational measures to protect your data, including encrypted storage of your login session on your device and access controls on our backend. No system is perfectly secure, but safeguarding your information is something we work at continuously.`,
    },
    {
      heading: 'Children and Personal Data',
      body: `Ambit is not directed to children. You must be at least 18 to use Ambit, and our university-email requirement is designed to keep the service limited to adult members of university communities. We do not knowingly collect personal data from anyone under 13.`,
    },
    {
      heading: 'Retaining and Deleting Your Data',
      body: `We keep your information for as long as your account is active. Whenever you're ready, you can permanently delete your account from the profile screen — this removes your profile, projects, portfolio, messages, matches, and uploaded files.`,
    },
    {
      heading: 'Our Commitment to Your Privacy',
      body: `Protecting your privacy isn't a feature we bolted on — it's part of how Ambit is built. We collect what we need to make the app work, we're clear about it, and we put you in control of your data.`,
    },
    {
      heading: 'Privacy Questions',
      body: `If you have any questions about this policy or how we handle your data, we're happy to help. Contact us at ${LEGAL_CONTACT_EMAIL} and we'll get back to you.`,
    },
  ],
};

export const TERMS_OF_USE: LegalDoc = {
  title: 'Ambit Terms of Use',
  updated: LEGAL_EFFECTIVE_DATE,
  intro:
    `These Terms of Use are the agreement between you and ${LEGAL_ENTITY} for using Ambit (the "app"). We've kept them as plain as we can. By creating an account or using Ambit, you agree to these Terms and to our Privacy Policy. If you don't agree, please don't use the app.`,
  sections: [
    {
      heading: 'Who Can Use Ambit',
      body: `Ambit is for current university students and members of university communities. You must be at least 18 years old (or the age of majority where you live), able to enter a binding agreement, and — where required — sign up with a valid university (.edu or equivalent) email.`,
    },
    {
      heading: 'Your Account',
      body: `You're responsible for your account and for keeping your login secure. Please give us accurate information and keep it current. Don't impersonate anyone or misrepresent your affiliation, your skills, or who you are.`,
    },
    {
      heading: 'Being a Good Community Member',
      body: `Ambit only works if it stays a place people trust. We have **zero tolerance for objectionable content and abusive behavior.** You agree not to post, send, or share content that is unlawful, harassing, hateful, threatening, sexually explicit, defamatory, discriminatory, spammy, fraudulent, or that infringes anyone's rights — and not to stalk, bully, or abuse another user.

We may remove content and suspend or terminate accounts that break these rules, at our discretion and without notice.`,
    },
    {
      heading: 'Your Content',
      body: `You own the content you create — your profile, messages, portfolio, and projects. You give Ambit a non-exclusive, worldwide license to host, store, display, and transmit that content solely to operate and improve the app. You're responsible for what you share, and you confirm you have the right to share it.`,
    },
    {
      heading: 'Reporting, Blocking, and How We Respond',
      body: `You can report objectionable content and block abusive users right from the app. We review reports and act on violations — including removing content and removing the offending user — typically within 24 hours. By using Ambit, you agree to this moderation process. Filing false or malicious reports is itself a violation.`,
    },
    {
      heading: 'Things You Agree Not to Do',
      body: `Please don't reverse engineer or disrupt the app, scrape or harvest data, use bots or automated access, try to reach other users' accounts, or use Ambit for anything illegal or against applicable law.`,
    },
    {
      heading: 'The Things We Have to Say',
      body: `Ambit is provided "as is," without warranties of any kind. Ambit is a place to connect with people — we don't verify every user, we don't employ or endorse anyone, and we're not a party to any arrangement, hire, or agreement you make with another user. You interact with other users at your own risk.`,
    },
    {
      heading: 'Limitation of Liability',
      body: `To the fullest extent permitted by law, Ambit and ${LEGAL_ENTITY} won't be liable for indirect, incidental, or consequential damages, or for the conduct or content of any user. Our total liability for any claim is limited to the amount you paid us, if any, in the 12 months before the claim.`,
    },
    {
      heading: 'Ending Your Membership',
      body: `You can stop using Ambit and delete your account anytime from the profile screen. We may suspend or end your access if you break these Terms.`,
    },
    {
      heading: 'Changes to These Terms',
      body: `We may update these Terms from time to time. If we make a material change, we'll surface it in the app. Continuing to use Ambit after an update means you accept the revised Terms.`,
    },
    {
      heading: 'Questions',
      body: `If anything here is unclear, we'd rather you ask. Contact us at ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};
