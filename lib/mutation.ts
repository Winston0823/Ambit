/// Mutation helpers — the antidote to the audit's #1 cross-cutting theme:
/// "errors look like success OR emptiness."
///
/// Two patterns, one consistent failure surface (the shared toast):
///   • runMutation   — fire a write; on failure show a toast (+ optional Retry).
///   • optimistic    — apply a local change immediately, write through, and
///                     ROLL BACK + toast if the write fails. No more lying UI.
///
/// Both swallow the throw by default (returning a boolean) so callers stay
/// declarative; pass `rethrow` if the caller needs to branch on failure.

import { toast } from './toast';

function messageFrom(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim().length > 0) return m;
  }
  return fallback;
}

export interface RunMutationOpts {
  /// Shown in the error toast. Keep it human ("Couldn't save your profile").
  errorMessage: string;
  /// Optional success toast. Omit for silent-on-success (the common case —
  /// the UI change is its own confirmation).
  successMessage?: string;
  /// Adds a "Retry" affordance to the error toast that re-runs the mutation.
  retry?: boolean;
  /// Re-throw after toasting (default false → returns false instead).
  rethrow?: boolean;
}

/// Run an async write with a guaranteed, visible failure path.
/// Returns true on success, false on handled failure.
export async function runMutation(
  fn: () => Promise<void>,
  opts: RunMutationOpts,
): Promise<boolean> {
  try {
    await fn();
    if (opts.successMessage) toast.success(opts.successMessage);
    return true;
  } catch (e) {
    toast.error(messageFrom(e, opts.errorMessage), {
      actionLabel: opts.retry ? 'Retry' : undefined,
      onAction: opts.retry ? () => void runMutation(fn, opts) : undefined,
    });
    if (opts.rethrow) throw e;
    return false;
  }
}

export interface OptimisticOpts<T> {
  /// Apply the change to local state and RETURN the previous value so we can
  /// revert. Runs synchronously, before the network write.
  apply: () => T;
  /// Persist. Throws on failure (the standard supabase `{ error }` → throw).
  commit: () => Promise<void>;
  /// Restore previous state. Receives whatever `apply` returned.
  revert: (previous: T) => void;
  /// Shown if commit fails (after revert).
  errorMessage: string;
}

/// Optimistic update with automatic rollback. The UI moves instantly; if the
/// server rejects it, we snap back and tell the user — instead of the current
/// behavior where a failed write is `console.warn`'d and the UI keeps lying
/// until the next refetch.
export async function optimistic<T>(opts: OptimisticOpts<T>): Promise<boolean> {
  const previous = opts.apply();
  try {
    await opts.commit();
    return true;
  } catch (e) {
    opts.revert(previous);
    toast.error(messageFrom(e, opts.errorMessage));
    return false;
  }
}
