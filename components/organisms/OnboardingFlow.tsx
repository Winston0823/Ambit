import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Brand } from '../../constants/theme';
import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';
import { SplashScreen } from './onboarding/SplashScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { EduEmailScreen } from './onboarding/EduEmailScreen';
import { AgeGateScreen } from './onboarding/AgeGateScreen';
import { VibeBlurbScreen } from './onboarding/VibeBlurbScreen';
import { SkillTagsScreen } from './onboarding/SkillTagsScreen';
import { RoleDeclarationScreen } from './onboarding/RoleDeclarationScreen';
import { CampusScreen } from './onboarding/CampusScreen';
import { PhotoScreen } from './onboarding/PhotoScreen';
import { ProofLinksScreen } from './onboarding/ProofLinksScreen';
import { CompleteScreen } from './onboarding/CompleteScreen';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const STEPS = [
  'splash',
  'welcome',
  'eduEmail',
  'age',
  'vibe',
  'skills',
  'role',
  'campus',
  'photo',
  'proof',
  'complete',
] as const;
type Step = typeof STEPS[number];

/// Full-screen modal walking the 11-step onboarding sequence.
/// (System sheets S-002a Apple Sign In and S-003b Google Picker are skipped —
/// they're platform UI, not our screens. SheerID fallback S-006 deferred.)
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

  const advance = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
    else dismiss();
  };
  const dismiss = () => {
    onDismiss();
    setTimeout(() => {
      setStep('splash');
      reset();
    }, 300);
  };

  switch (step) {
    case 'splash':   return <SplashScreen onContinue={advance} />;
    case 'welcome':  return <WelcomeScreen onContinue={advance} />;
    case 'eduEmail': return <EduEmailScreen onBack={back} onContinue={advance} />;
    case 'age':      return <AgeGateScreen onBack={back} onContinue={advance} />;
    case 'vibe':     return <VibeBlurbScreen onBack={back} onContinue={advance} />;
    case 'skills':   return <SkillTagsScreen onBack={back} onContinue={advance} />;
    case 'role':     return <RoleDeclarationScreen onBack={back} onContinue={advance} />;
    case 'campus':   return <CampusScreen onBack={back} onContinue={advance} />;
    case 'photo':    return <PhotoScreen onBack={back} onContinue={advance} />;
    case 'proof':    return <ProofLinksScreen onBack={back} onContinue={advance} />;
    case 'complete': return <CompleteScreen onDone={dismiss} />;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
});
