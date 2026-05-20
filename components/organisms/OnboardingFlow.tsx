import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Brand } from '../../constants/theme';
import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';
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

/// Linear sign-up sequence. Sign-in is a branch off 'welcome' that lives
/// outside this array — it bypasses everything and goes straight to home.
///
/// Order rationale:
///   1. splash / welcome      — brand + dual-path entry (create OR sign in)
///   2. eduEmail              — eligibility (returning users don't see this)
///   3. demographic           — student vs professor; gates downstream copy
///   4. vibe                  — personality before identity (sets tone)
///   5. photo                 — name + avatar
///   6. campus                — proximity anchor
///   7. skills                — capability
///   8. proof                 — validation links
///   9. role                  — owner / seeker / both (toggleable later)
///   10. complete             — celebration + dismiss
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
  const { reset } = useOnboarding();

  const dismiss = () => {
    onDismiss();
    setTimeout(() => {
      setStep('splash');
      reset();
    }, 300);
  };

  /// Linear advance — only valid when on a LinearStep. The 'signIn' branch
  /// dismisses on success rather than advancing.
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
      return <CompleteScreen onDone={dismiss} />;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
});
