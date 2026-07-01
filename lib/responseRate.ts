/// Reply-tier helper for the 72h reach-out SLA.
///
/// The underlying number is real: `profiles.response_rate` (0–1), computed
/// server-side by `recompute_response_metrics` (see 005_closure_loop.sql +
/// 024_response_metrics_reply_only.sql) — the fraction of reach-outs a user
/// REPLIED to within 72h. Pass that value (or null when the user has no
/// eligible reach-outs aged past the window) straight in.

export type ResponseTier = {
  /// Drives which icon the badge renders.
  kind: 'fast' | 'responsive';
  label: string;
};

/// Public-facing, warmth-preserving label for discovery cards. We deliberately
/// do NOT surface the raw percentage here (that lives on the owner's private
/// management card) — a low number on a person's discovery card reads as
/// punishing. Below the threshold (or when the rate is unknown) we show
/// nothing, so absence is neutral.
///
/// `rate` is the 0–1 value from `profiles.response_rate`, or null/undefined
/// when no rate has been computed yet.
export function responseTier(rate: number | null | undefined): ResponseTier | null {
  if (rate == null) return null;
  const pct = rate * 100;
  if (pct >= 90) return { kind: 'fast', label: 'Replies fast' };
  if (pct >= 80) return { kind: 'responsive', label: 'Responsive' };
  return null;
}
