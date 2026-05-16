import { Redirect } from 'expo-router';

/// Entry point. v1 candidate-only — owner side wires later.
export default function Index() {
  return <Redirect href="/(candidate)/feed" />;
}
