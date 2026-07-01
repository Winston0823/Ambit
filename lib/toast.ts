/// Lightweight global toast bus.
///
/// The audit (2026-06-20, theme 1) flagged that mutations route errors to
/// `console.warn` while the UI optimistically shows success, and reads route
/// `catch → set([])` so outages look like empty data. The fix is a single
/// shared, app-wide notification surface that ANY layer can reach — including
/// non-React helpers in lib/ (e.g. lib/mutation.ts) that don't have hook access.
///
/// This is a tiny pub/sub singleton: `toast.error(...)` from anywhere,
/// <ToastHost/> subscribes once at the root and renders the stack. Deliberately
/// dependency-free (no react-native-toast-message) to keep the bundle lean and
/// match the existing "RN Animated, no reanimated" house style.

export type ToastTone = 'error' | 'success' | 'info';

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /// Optional action affordance (e.g. "Retry", "Undo"). The host renders a
  /// trailing button that calls this and dismisses.
  actionLabel?: string;
  onAction?: () => void;
  /// Auto-dismiss after ms. Defaults: error 5000 (longer, it matters),
  /// success/info 2800. Pass 0 to require manual / action dismissal.
  durationMs?: number;
}

export interface ToastItem extends Required<Omit<ToastInput, 'onAction'>> {
  id: number;
  onAction?: () => void;
}

type Listener = (toast: ToastItem) => void;

let nextId = 1;
const listeners = new Set<Listener>();

function emit(input: ToastInput) {
  const tone = input.tone ?? 'info';
  const item: ToastItem = {
    id: nextId++,
    message: input.message,
    tone,
    actionLabel: input.actionLabel ?? '',
    durationMs:
      input.durationMs ?? (tone === 'error' ? 5000 : 2800),
    onAction: input.onAction,
  };
  // If nothing is mounted yet (cold start before ToastHost mounts), fall back
  // to console so the signal isn't silently dropped.
  if (listeners.size === 0) {
    // eslint-disable-next-line no-console
    console.warn(`[toast:${tone}] ${input.message}`);
    return;
  }
  listeners.forEach((l) => l(item));
}

export const toast = {
  show: (input: ToastInput) => emit(input),
  error: (message: string, opts?: Omit<ToastInput, 'message' | 'tone'>) =>
    emit({ ...opts, message, tone: 'error' }),
  success: (message: string, opts?: Omit<ToastInput, 'message' | 'tone'>) =>
    emit({ ...opts, message, tone: 'success' }),
  info: (message: string, opts?: Omit<ToastInput, 'message' | 'tone'>) =>
    emit({ ...opts, message, tone: 'info' }),
  /// Subscribe a host renderer. Returns an unsubscribe fn.
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
