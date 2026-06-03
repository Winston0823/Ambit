import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useProfileRole } from '../hooks/useProfileRole';
import { Brand } from '../constants/theme';

/// Entry point. Routes to the founder group for owners/both and to the
/// candidate group for seekers. Spinning while the DB role check resolves
/// (typically one frame from cache, or <200ms on a fresh sign-in).
export default function Index() {
  const { role, loading } = useProfileRole();

  if (loading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  // 'both' users are primarily recruiting — land them in the founder group
  // so they see the seeker deck and their projects immediately. They can
  // always discover projects via the same feed (it shows seekers when in
  // the founder group, projects when in the candidate group).
  const isOwner = role === 'owner' || role === 'both';
  return <Redirect href={isOwner ? '/(founder)/projects' : '/(candidate)/feed'} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, alignItems: 'center', justifyContent: 'center' },
});
