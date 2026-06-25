/// Shared input validation + helper copy.
///
/// The audit (2026-06-20, theme 3) flagged validation as "presence-only,
/// never semantic, with no 'why disabled'." This module centralizes the
/// real shape checks and the human-readable reason a field is rejected, so
/// every screen can show inline helper copy instead of silently disabling
/// the CTA.

// ---------- Education email ----------

/// A plausibly-real academic email. `.edu` covers US institutions; we also
/// accept the common international academic TLDs so a Toronto/Oxford/Sydney
/// student isn't hard-walled. Role (student vs faculty) is NOT derivable from
/// the domain — see Obsidian Vault/Ambit/Decisions for the .edu gate note.
const ACADEMIC_TLDS = [
  '.edu',          // US (and a few international, e.g. .edu.au handled below)
  '.ac.uk',        // United Kingdom
  '.edu.au',       // Australia
  '.ac.nz',        // New Zealand
  '.edu.cn',       // China
  '.ac.jp',        // Japan
  '.ac.kr',        // South Korea
  '.edu.sg',       // Singapore
  '.edu.hk',       // Hong Kong
  '.ac.in',        // India
  '.edu.ca',       // some Canadian colleges (most use .ca — see note)
  '.ca',           // Canadian universities commonly use bare .ca (utoronto.ca)
];

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FieldCheck {
  valid: boolean;
  /// Inline helper copy. Empty string while the field is untouched/empty so
  /// we don't scold the user before they've typed.
  reason: string;
}

/// Validate an academic email. We keep `.edu` as the primary, strongest gate
/// (Educause restricts .edu to accredited US degree-granting institutions, so
/// it's expensive to fake at scale) and allow well-known international
/// academic TLDs as a secondary path.
export function checkEduEmail(raw: string): FieldCheck {
  const email = raw.trim().toLowerCase();
  if (email.length === 0) return { valid: false, reason: '' };
  if (!EMAIL_SHAPE.test(email)) {
    return { valid: false, reason: 'Enter a complete email, e.g. you@school.edu' };
  }
  const domain = email.slice(email.indexOf('@') + 1);
  const isAcademic = ACADEMIC_TLDS.some((tld) => domain.endsWith(tld));
  if (!isAcademic) {
    return {
      valid: false,
      reason: 'Use your school-issued email (.edu or your university domain).',
    };
  }
  return { valid: true, reason: '' };
}

// ---------- URLs ----------

/// Normalize user-typed URLs: trim, prefix a bare host with https://. Returns
/// '' for input that isn't a URL at all (no dot, or just a handle) so callers
/// can decide whether to keep or drop it. Mirrors lib/resume.ts:normalizeResumeUrl
/// so résumé-imported and hand-typed links converge on the same shape.
export function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (v.length === 0) return '';
  // Already has a scheme.
  if (/^https?:\/\//i.test(v)) return v;
  // Bare host like "github.com/foo" — must contain a dot to be a host.
  if (v.includes('.') && !v.includes(' ')) return `https://${v}`;
  return '';
}

const HOST_SHAPE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i;

/// Validate a link field. `kind` tailors the helper copy. Empty is allowed
/// (callers gate "at least one" separately); a non-empty value must look like
/// a real URL, not "asdf".
export function checkUrl(raw: string, label = 'link'): FieldCheck {
  const v = raw.trim();
  if (v.length === 0) return { valid: false, reason: '' };
  const stripped = v.replace(/^https?:\/\//i, '');
  if (!HOST_SHAPE.test(stripped)) {
    return { valid: false, reason: `That doesn't look like a ${label} URL yet.` };
  }
  return { valid: true, reason: '' };
}

// ---------- Length-gated text ----------

/// Min-length text (vibe blurb, project blurb). Returns a live "N more to go"
/// reason so the minimum is never a silent wall.
export function checkMinLength(raw: string, min: number, noun = 'characters'): FieldCheck {
  const len = raw.trim().length;
  if (len === 0) return { valid: false, reason: '' };
  if (len < min) {
    return { valid: false, reason: `${min - len} more ${noun} to go (${len}/${min}).` };
  }
  return { valid: true, reason: '' };
}

/// Min-count selection (skills: pick at least N). Surfaces the count so the
/// disabled CTA has a visible "why".
export function checkMinCount(count: number, min: number, noun = 'skills'): FieldCheck {
  if (count === 0) return { valid: false, reason: '' };
  if (count < min) {
    return { valid: false, reason: `Pick ${min - count} more ${noun} (${count}/${min}).` };
  }
  return { valid: true, reason: '' };
}
