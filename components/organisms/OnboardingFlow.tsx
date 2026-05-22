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
import {
  OnboardingProvider,
  OnboardingProfile,
  useOnboarding,
} from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import { OnboardingProgress } from '../atoms';
import {
  ANCHORED_CTA_BOTTOM,
  ANCHORED_CTA_HEIGHT,
} from '../molecules/OnboardingContinue';
import { SplashScreen } from './onboarding/SplashScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { SignInScreen } from './onboarding/SignInScreen';
import { EduEmailScreen } from './onboarding/EduEmailScreen';
import { DemographicScreen } from './onboarding/DemographicScreen';
import { VibeBlurbScreen } from './onboarding/VibeBlurbScreen';
import { PhotoScreen } from './onboarding/PhotoScreen';
import { CampusScreen } from './onboarding/CampusScreen';
import { SkillTagsScreen } from './onboarding/SkillTagsScreen';
import { ProofLinksScreen } from './onboarding/ProofLinksScreen';
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

/// Canonical step order. The user's branch (student vs. professor + the
/// student's role pick) determines which of these actually render — see
/// shouldShow + activeSteps below. Order here is the narrative spine; the
/// branching is purely subtractive.
const STEPS = [
  'splash',
  'welcome',
  'eduEmail',
  'demographic',
  'vibe',
  'photo',
  'campus',
  'role',
  'skills',
  'proof',
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
  'vibe',
  'photo',
  'campus',
  'role',
  'skills',
  'proof',
];

/// Whether a step should render for a given profile.
///   - Professors skip `role` (implicitly Owners — they recruit) and
///     `skills` (their value prop is the research, not a personal chip list).
///   - Student Owners (not Seeker, not Both) skip `skills` for the same
///     reason — they pitch the project, not themselves.
function shouldShow(step: LinearStep, profile: OnboardingProfile): boolean {
  if (profile.demographic === 'professor') {
    return step !== 'role' && step !== 'skills';
  }
  if (step === 'skills' && profile.role === 'owner') return false;
  return true;
}

function activeSteps(profile: OnboardingProfile): readonly LinearStep[] {
  return STEPS.filter((s) => shouldShow(s, profile));
}

function activeProgressSteps(profile: OnboardingProfile): LinearStep[] {
  return PROGRESS_STEPS_ALL.filter((s) => shouldShow(s, profile));
}

/// Per-step "is this field filled?" predicate. Mirrors the validation
/// inside each screen — keep these in sync if a screen's required-field
/// logic changes. Used to pick the first incomplete step when a resuming
/// user re-enters the flow.
function isComplete(step: LinearStep, profile: OnboardingProfile): boolean {
  switch (step) {
    case 'eduEmail':    return profile.eduEmail.toLowerCase().endsWith('.edu') && profile.eduEmail.includes('@');
    case 'demographic': return profile.demographic !== null;
    case 'vibe':        return profile.vibeBlurb.length >= 50;
    case 'photo':       return !!profile.photoUri;
    case 'campus':      return profile.campusId !== null;
    case 'role':        return profile.role !== null;
    case 'skills':      return profile.skills.length >= 2;
    case 'proof':       return Object.values(profile.proofLinks).some((v) => v.trim().length > 0);
    // splash/welcome/complete have no "field" — they're transitions.
    case 'splash':
    case 'welcome':
    case 'complete':    return true;
  }
}

function firstIncompleteStep(profile: OnboardingProfile): LinearStep {
  for (const step of activeSteps(profile)) {
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
  const { user, refreshProfile } = useAuth();

  /// First mount with a signed-in user: pull their partial profile (if any)
  /// from Supabase and jump straight to the first step they haven't filled.
  /// Brand-new users (no session yet) start at splash as normal.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const merged = await hydrate(user.id);
      if (cancelled) return;
      setStep(firstIncompleteStep(merged));
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
    const steps = activeSteps(profile);
    const i = steps.indexOf(step as LinearStep);
    if (i >= 0 && i < steps.length - 1) setStep(steps[i + 1]);
  };

  const back = () => {
    if (step === 'signIn') {
      setStep('welcome');
      return;
    }
    const steps = activeSteps(profile);
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
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }

    prevStepRef.current = step;
  }, [step, translateX, opacity]);

  const handleDone = async () => {
    if (user) {
      try {
        await submit(user.id, user.email);
        // Flip hasProfile in AuthContext so the root layout re-routes from
        // OnboardingInline to the main app. Non-blocking on failure.
        await refreshProfile();
      } catch { /* non-blocking */ }
    }
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
            onSocialSignedIn={dismiss}
          />
        );
      case 'signIn':
        return <SignInScreen onBack={back} onSignedIn={dismiss} />;
      case 'eduEmail':
        return <EduEmailScreen onBack={back} onContinue={advance} />;
      case 'demographic':
        return <DemographicScreen onBack={back} onContinue={advance} />;
      case 'vibe':
        return <VibeBlurbScreen onBack={back} onContinue={advance} />;
      case 'photo':
        return <PhotoScreen onBack={back} onContinue={advance} />;
      case 'campus':
        return <CampusScreen onBack={back} onContinue={advance} />;
      case 'skills':
        return <SkillTagsScreen onBack={back} onContinue={advance} />;
      case 'proof':
        return <ProofLinksScreen onBack={back} onContinue={advance} />;
      case 'role':
        return <RoleDeclarationScreen onBack={back} onContinue={advance} />;
      case 'complete':
        return <CompleteScreen onDone={handleDone} />;
    }
  };

  const progressSteps = activeProgressSteps(profile);
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
          style={[
            styles.progressOverlay,
            {
              bottom:
                insets.bottom + ANCHORED_CTA_BOTTOM + ANCHORED_CTA_HEIGHT + 16,
            },
          ]}
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
    left: 0,
    right: 0,
    zIndex: 20,
  },
});
