import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Brand } from '../../constants/theme';
import { EduEmailScreen } from './onboarding/EduEmailScreen';
import { AgeGateScreen } from './onboarding/AgeGateScreen';
import { VibeBlurbScreen } from './onboarding/VibeBlurbScreen';
import { RoleDeclarationScreen } from './onboarding/RoleDeclarationScreen';
import { CompleteScreen } from './onboarding/CompleteScreen';

export type Role = 'owner' | 'seeker' | 'both';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const STEPS = ['eduEmail', 'ageGate', 'vibe', 'role', 'complete'] as const;
type Step = typeof STEPS[number];

/// Full-screen modal walking the user through the v1.0 onboarding sequence.
/// Per spec Journey 1, key 5 screens. UI only — no backend wired.
export function OnboardingFlow({ visible, onDismiss }: Props) {
  const [step, setStep] = useState<Step>('eduEmail');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState(18);
  const [blurb, setBlurb] = useState('');
  const [role, setRole] = useState<Role | null>('seeker');

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
    setTimeout(() => setStep('eduEmail'), 300);
  };

  const renderStep = () => {
    switch (step) {
      case 'eduEmail':
        return <EduEmailScreen email={email} setEmail={setEmail} onBack={dismiss} onContinue={advance} />;
      case 'ageGate':
        return <AgeGateScreen age={age} setAge={setAge} onBack={back} onContinue={advance} />;
      case 'vibe':
        return <VibeBlurbScreen blurb={blurb} setBlurb={setBlurb} onBack={back} onContinue={advance} />;
      case 'role':
        return <RoleDeclarationScreen role={role} setRole={setRole} onBack={back} onContinue={advance} />;
      case 'complete':
        return <CompleteScreen onDone={dismiss} />;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        {renderStep()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
});
