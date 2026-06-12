/// Reply rate against the 72h reach-out SLA.
///
/// MOCK until reach-out timestamps land. No responded-within-72h data exists
/// yet — the `projects` table has no response fields and `InboxItem` only
/// carries each conversation's latest message, not its history. So this is a
/// deterministic placeholder: a stable hash of the entity id mapped into a
/// believable band (70–98%). The same id always yields the same number, which
/// is what keeps a founder's rate consistent between their management card and
/// their discovery card. Swap the body for a real computation once timestamps
/// exist; callers shouldn't need to change.
///
/// Key by the entity whose responsiveness is being measured: project id for a
/// project (the founder answering reach-outs), seeker id for a seeker.
export function responseRate(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return 70 + (h % 29); // 70..98
}

export type ResponseTier = {
  /// Drives which icon the badge renders.
  kind: 'fast' | 'responsive';
  label: string;
};

/// Public-facing, warmth-preserving label for discovery cards. We deliberately
/// do NOT surface the raw percentage here (that lives on the owner's private
/// management card) — a low number on a person's discovery card reads as
/// punishing. Below the threshold we show nothing, so absence is neutral.
export function responseTier(id: string): ResponseTier | null {
  const rate = responseRate(id);
  if (rate >= 90) return { kind: 'fast', label: 'Replies fast' };
  if (rate >= 80) return { kind: 'responsive', label: 'Responsive' };
  return null;
}
