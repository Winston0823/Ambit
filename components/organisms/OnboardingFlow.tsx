import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '../../constants/theme';
import { Motion } from '../../constants/motion';
import {
  OnboardingProvider,
  OnboardingProfile,
  useOnboarding,
} from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import { OnboardingProgress } from '../atoms';
import { SplashScreen } from './onboarding/SplashScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { PathPreviewScreen } from './onboarding/PathPreviewScreen';
import { SignInScreen } from './onboarding/SignInScreen';
import { EduEmailScreen } from './onboarding/EduEmailScreen';
import { DemographicScreen } from './onboarding/DemographicScreen';
import { PhotoScreen } from './onboarding/PhotoScreen';
import { CampusScreen } from './onboarding/CampusScreen';
import { SkillTagsScreen } from './onboarding/SkillTagsScreen';
import { RoleDeclarationScreen } from './onboarding/RoleDeclarationScreen';
import { CompleteScreen } from './onboarding/CompleteScreen';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

interface InlineProps {
  /// Called when onboarding completes — handleDone has already submitted
  /// the profile to Supabase by this point, so the parent should re-route
  /// to the main app (typically by re-checking hasProfile in AuthContext).
  onComplete: () => void;
}

/// Canonical step order — the ENTRY GATE only. This is the minimum a user
/// completes to get into the app and receive a real deck: identity (.edu +
/// student/professor), the role branch, campus, and (for seekers) skills.
///
/// `vibe` and `proof` are intentionally NOT in this spine — they only
/// matter once other people see the user's card, so they're deferred to
/// in-app progressive completion (the Profile tab is already a fully
/// editable surface for them) rather than gating first launch.
///
/// `photo` IS in the spine because it's where the user's NAME is captured —
/// without a name the user renders as "?" and is filtered out of everyone's
/// deck (feed's `name`-presence filter), making them invisible. The photo
/// itself stays optional on that screen.
///
/// The user's branch (student vs. professor + the student's role pick)
/// determines which of these actually render — see shouldShow + activeSteps
/// below. Order here is the narrative spine; the branching is purely
/// subtractive.
const STEPS = [
  'splash',
  'welcome',
  'preview',
  'eduEmail',
  'demographic',
  'photo',
  'role',
  'campus',
  'skills',
  'complete',
] as const;
type LinearStep = typeof STEPS[number];
type Step = LinearStep | 'signIn';

/// Steps that appear in the progress bar. Splash + welcome + signIn are
/// entry moments; complete is the celebration — none of them benefit from
/// orientation. The actual progress denominator is filtered through
/// shouldShow() so professors don't see "5 / 8" when only 6 screens exist
/// in their branch.
const PROGRESS_STEPS_ALL: LinearStep[] = [
  'eduEmail',
  'demographic',
  'photo',
  'role',
  'campus',
  'skills',
];

/// Whether a step should render for a given profile.
///   - Professors skip `role` (implicitly Owners — they recruit) and
///     `skills` (their value prop is the research, not a personal chip list).
///   - Student Owners (not Seeker, not Both) skip `skills` for the same
///     reason — they pitch the project, not themselves.
function shouldShow(
  step: LinearStep,
  profile: OnboardingProfile,
  hasSession: boolean,
): boolean {
  // `eduEmail` exists only to create the auth account (email + password). A
  // user who already has a session — social sign-in, or a resumed session —
  // has an account, so demanding credentials again would just try to sign
  // them up a second time. Skip it. (Audit P0: social sign-in loop.)
  if (step === 'eduEmail' && hasSession) return false;
  if (profile.demographic === 'professor') {
    return step !== 'role' && step !== 'skills';
  }
  if (step === 'skills' && profile.role === 'owner') return false;
  return true;
}

function activeSteps(
  profile: OnboardingProfile,
  hasSession: boolean,
): readonly LinearStep[] {
  return STEPS.filter((s) => shouldShow(s, profile, hasSession));
}

function activeProgressSteps(
  profile: OnboardingProfile,
  hasSession: boolean,
): LinearStep[] {
  return PROGRESS_STEPS_ALL.filter((s) => shouldShow(s, profile, hasSession));
}

/// Per-step "is this field filled?" predicate. Mirrors the validation
/// inside each screen — keep these in sync if a screen's required-field
/// logic changes. Used to pick the first incomplete step when a resuming
/// user re-enters the flow.
function isComplete(step: LinearStep, profile: OnboardingProfile): boolean {
  switch (step) {
    case 'eduEmail':    return profile.eduEmail.toLowerCase().endsWith('.edu') && profile.eduEmail.includes('@');
    case 'demographic': return profile.demographic !== null;
    case 'photo':       return profile.name.trim().length > 1;
    case 'campus':      return profile.campusId !== null;
    case 'role':        return profile.role !== null;
    case 'skills':      return profile.skills.length >= 2;
    // splash/welcome/preview/complete have no "field" — they're transitions.
    case 'splash':
    case 'welcome':
    case 'preview':
    case 'complete':    return true;
  }
}

function firstIncompleteStep(
  profile: OnboardingProfile,
  hasSession: boolean,
): LinearStep {
  for (const step of activeSteps(profile, hasSession)) {
    if (!isComplete(step, profile)) return step;
  }
  return 'complete';
}

const SCREEN_W = Dimensions.get('window').width;

export function OnboardingFlow({ visible, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onDismiss}
    >
      <OnboardingProvider>
        <View style={styles.root}>
          <Steps onDismiss={onDismiss} />
        </View>
      </OnboardingProvider>
    </Modal>
  );
}

/// Inline variant — same flow, no Modal wrapper. Used by app/_layout when
/// onboarding is the user's actual entry point (first launch / incomplete
/// profile). No slide-from-bottom animation; the splash IS the entry.
export function OnboardingInline({ onComplete }: InlineProps) {
  return (
    <OnboardingProvider>
      <View style={styles.root}>
        <Steps onDismiss={onComplete} />
      </View>
    </OnboardingProvider>
  );
}

function Steps({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState<Step>('splash');
  const prevStepRef = useRef<Step>(step);
  const translateX = useRef(new Animated.Value(0)).current;
  const { profile, reset, submit, hydrate } = useOnboarding();
  const { user, hasProfile, refreshProfile } = useAuth();
  const hasSession = !!user;

  /// The resume-jump must fire at most once, and only while the user is still
  /// on an entry screen (hasn't started filling the profile spine). Without
  /// this guard the effect re-runs on every `user?.id` change — including the
  /// one triggered mid-flow by email sign-up — and a slow hydrate could yank a
  /// user who has already advanced backward to an earlier step. (Audit P1.)
  const resumeJumpedRef = useRef(false);
  const ENTRY_STEPS: readonly Step[] = ['splash', 'welcome', 'preview', 'signIn'];

  /// First mount with a signed-in user: pull their partial profile (if any)
  /// from Supabase and jump straight to the first step they haven't filled.
  /// Brand-new users (no session yet) start at splash as normal. This is also
  /// the routing path for social sign-in from the entry screens: a new social
  /// user lands on the first incomplete spine step (demographic — eduEmail is
  /// skipped because they already have a session).
  useEffect(() => {
    if (!user) return;
    if (resumeJumpedRef.current) return;
    // Only jump from an entry screen — never yank a user who's already in the
    // spine. (Reads the current step; not a dep, so it sees the latest value
    // when the user?.id change fires the effect.)
    if (!ENTRY_STEPS.includes(step)) return;
    resumeJumpedRef.current = true;
    let cancelled = false;
    (async () => {
      const merged = await hydrate(user.id);
      if (cancelled) return;
      // hasSession is guaranteed true here (user is truthy).
      setStep(firstIncompleteStep(merged, true));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const dismiss = () => {
    onDismiss();
    setTimeout(() => {
      setStep('splash');
      reset();
    }, 300);
  };

  /// advance / back walk the *active* sub-flow (after applying shouldShow),
  /// so e.g. a professor advancing from `campus` lands on `proof`, skipping
  /// the role + skills screens that don't apply to them.
  const advance = () => {
    if (step === 'signIn') return;
    const steps = activeSteps(profile, hasSession);
    const i = steps.indexOf(step as LinearStep);
    if (i >= 0 && i < steps.length - 1) setStep(steps[i + 1]);
  };

  const back = () => {
    if (step === 'signIn') {
      setStep('welcome');
      return;
    }
    const steps = activeSteps(profile, hasSession);
    const i = steps.indexOf(step as LinearStep);
    if (i > 0) setStep(steps[i - 1]);
    else dismiss();
  };

  // Per-step transition. Default: ~280ms easeOutCubic horizontal slide
  // (iOS-native feel). Special case: any transition OUT of splash uses a
  // luxurious opacity crossfade (~1100ms easeInOutCubic) so the very first
  // hand-off into the app reads as deliberate rather than mechanical —
  // applies both to brand-new users (splash → welcome) and resuming users
  // (splash → wherever they left off).
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const prev = prevStepRef.current;
    if (prev === step) return;

    const isLeavingSplash = prev === 'splash';

    if (isLeavingSplash) {
      translateX.setValue(0);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      const prevIdx = prev === 'signIn' ? 1.5 : STEPS.indexOf(prev as LinearStep);
      const newIdx = step === 'signIn' ? 1.5 : STEPS.indexOf(step as LinearStep);
      const forward = newIdx >= prevIdx;
      opacity.setValue(1);
      translateX.setValue(forward ? SCREEN_W : -SCREEN_W);
      Animated.timing(translateX, {
        toValue: 0,
        ...Motion.slide,
        useNativeDriver: true,
      }).start();
    }

    prevStepRef.current = step;
  }, [step, translateX, opacity]);

  /// Called after Apple/Google sign-in succeeds (from Welcome or SignIn).
  /// A user who already has a completed profile leaves the flow; a brand-new
  /// social user (no profile row) must NOT dismiss — dismissing resets to
  /// splash and the resume-hydrate would later strand them on eduEmail →
  /// duplicate account. The hydrate effect routes them into the spine at the
  /// first incomplete step (demographic). (Audit P0: social sign-in loop.)
  const handleSocialSignedIn = () => {
    if (hasProfile === true) dismiss();
  };

  /// Final submit. Throws on failure so CompleteScreen can keep the user on
  /// the celebration screen, surface the reason, and offer Retry. We only
  /// dismiss/reset after a confirmed successful upsert. (Audit P0: final
  /// submit failure was swallowed, then reset() wiped everything.)
  const handleDone = async () => {
    if (!user) {
      // With the eduEmail confirmation guard in place we should always have a
      // session by CompleteScreen; treat its absence as a retryable error
      // rather than silently discarding the profile.
      throw new Error('Your session expired — sign in again to finish.');
    }
    await submit(user.id, user.email);
    // Flip hasProfile in AuthContext so the root layout re-routes from
    // OnboardingInline to the main app.
    await refreshProfile();
    dismiss();
  };

  const renderStep = () => {
    switch (step) {
      case 'splash':
        return <SplashScreen onContinue={advance} />;
      case 'welcome':
        return (
          <WelcomeScreen
            onCreateAccount={advance}
            onSignIn={() => setStep('signIn')}
            onSocialSignedIn={handleSocialSignedIn}
          />
        );
      case 'signIn':
        return <SignInScreen onBack={back} onSignedIn={handleSocialSignedIn} />;
      case 'preview':
        return <PathPreviewScreen onBack={back} onContinue={advance} />;
      case 'eduEmail':
        return <EduEmailScreen onBack={back} onContinue={advance} />;
      case 'demographic':
        return <DemographicScreen onBack={back} onContinue={advance} />;
      case 'photo':
        return <PhotoScreen onBack={back} onContinue={advance} />;
      case 'campus':
        return <CampusScreen onBack={back} onContinue={advance} />;
      case 'skills':
        return <SkillTagsScreen onBack={back} onContinue={advance} />;
      case 'role':
        return <RoleDeclarationScreen onBack={back} onContinue={advance} />;
      case 'complete':
        return <CompleteScreen onDone={handleDone} />;
    }
  };

  const progressSteps = activeProgressSteps(profile, hasSession);
  const progressIndex = progressSteps.indexOf(step as LinearStep);
  const showProgress = progressIndex >= 0;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.slider, { transform: [{ translateX }], opacity }]}
      >
        {renderStep()}
      </Animated.View>

      {showProgress && (
        <View
          style={[styles.progressOverlay, { top: insets.top + 8 }]}
          pointerEvents="none"
        >
          <OnboardingProgress
            current={progressIndex + 1}
            total={progressSteps.length}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  slider: { flex: 1 },
  progressOverlay: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
  },
});
