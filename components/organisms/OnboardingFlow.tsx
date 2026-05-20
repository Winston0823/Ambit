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
import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';
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

const STEPS = [
  'splash',
  'welcome',
  'eduEmail',
  'demographic',
  'vibe',
  'photo',
  'campus',
  'skills',
  'proof',
  'role',
  'complete',
] as const;
type LinearStep = typeof STEPS[number];
type Step = LinearStep | 'signIn';

/// Steps for which the progress bar is visible. Splash + welcome + signIn
/// are entry moments; complete is the celebration — none of them benefit
/// from orientation.
const PROGRESS_STEPS: LinearStep[] = [
  'eduEmail',
  'demographic',
  'vibe',
  'photo',
  'campus',
  'skills',
  'proof',
  'role',
];

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

function Steps({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState<Step>('splash');
  const prevStepRef = useRef<Step>(step);
  const translateX = useRef(new Animated.Value(0)).current;
  const { reset, submit } = useOnboarding();
  const { user } = useAuth();

  const dismiss = () => {
    onDismiss();
    setTimeout(() => {
      setStep('splash');
      reset();
    }, 300);
  };

  const advance = () => {
    if (step === 'signIn') return;
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const back = () => {
    if (step === 'signIn') {
      setStep('welcome');
      return;
    }
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
    else dismiss();
  };

  // Slide the next screen in from the appropriate side every time `step`
  // changes. Direction is derived from index order; the signIn branch is
  // treated as forward off welcome and back into it. ~280ms easeOutCubic
  // matches iOS-native feel without dragging.
  useEffect(() => {
    const prev = prevStepRef.current;
    if (prev === step) return;

    const prevIdx = prev === 'signIn' ? 1.5 : STEPS.indexOf(prev as LinearStep);
    const newIdx = step === 'signIn' ? 1.5 : STEPS.indexOf(step as LinearStep);
    const forward = newIdx >= prevIdx;

    translateX.setValue(forward ? SCREEN_W : -SCREEN_W);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    prevStepRef.current = step;
  }, [step, translateX]);

  const handleDone = async () => {
    if (user) {
      try { await submit(user.id, user.email); } catch { /* non-blocking */ }
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

  const progressIndex = PROGRESS_STEPS.indexOf(step as LinearStep);
  const showProgress = progressIndex >= 0;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.slider, { transform: [{ translateX }] }]}
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
            total={PROGRESS_STEPS.length}
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
