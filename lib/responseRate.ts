/// Reply-tier helper for the 72h reach-out SLA.
///
/// The underlying number is real: `profiles.response_rate` (0–1), computed
/// server-side by `recompute_response_metrics` (see 005_closure_loop.sql +
/// 024_response_metrics_reply_only.sql) — the fraction of reach-outs a user
/// REPLIED to within 72h. Pass that value (or null when the user has no
/// eligible reach-outs aged past the window) straight in.

/// Three-tier "reward" pill for the discovery card. Warmth principle: an
/// unknown/very-low rate returns null so the signal is simply absent, never
/// punishing; above the thresholds we surface a graded, colored, iconed pill
/// that celebrates a reliable replier (the top tier pulses). The UI layer maps
/// `tier` → color/icon so the palette stays in `theme.ts`.
///
/// IMPORTANT: `rate` is `profiles.response_rate` (0–1) — the FRACTION of
/// reach-outs a user replied to within 72h. It measures how OFTEN someone
/// replies, NOT how fast. Labels are therefore frequency-worded ("Almost
/// always replies"), never speed-worded ("Replies in minutes") — the raw
/// average reply *time* lives in `avg_response_minutes` and is a separate
/// signal (see formatResponseTime in lib/closureLoop).
export type ResponseReward = {
  tier: 'fast' | 'medium' | 'steady';
  label: string;
  icon: 'lightning' | 'chat' | 'clock';
  /// Top tier → the pill pulses. Lower tiers stay calm.
  reward: boolean;
};

export function responseReward(rate: number | null | undefined): ResponseReward | null {
  if (rate == null) return null;
  const pct = rate * 100;
  if (pct >= 85) return { tier: 'fast', label: 'Almost always replies', icon: 'lightning', reward: true };
  if (pct >= 60) return { tier: 'medium', label: 'Usually replies', icon: 'chat', reward: false };
  if (pct >= 30) return { tier: 'steady', label: 'Often replies', icon: 'clock', reward: false };
  return null; // very low or unknown → hidden, never punishing
}
