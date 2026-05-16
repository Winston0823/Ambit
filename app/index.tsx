import { Redirect } from 'expo-router';
import { useRole } from '../context/RoleContext';

export default function Index() {
  const { role } = useRole();

  if (role === 'founder') {
    return <Redirect href="/(founder)/feed" />;
  }
  return <Redirect href="/(candidate)/feed" />;
}
