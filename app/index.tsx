import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useProfileRole } from '../hooks/useProfileRole';
import { Brand } from '../constants/theme';

/// Entry point. Owners land on their projects dashboard; seekers land on the
/// discovery feed.
export default function Index() {
  const { role, loading } = useProfileRole();

  if (loading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  const isOwner = role === 'owner';
  return <Redirect href={isOwner ? '/(founder)/(tabs)/projects' : '/(candidate)/(tabs)/feed'} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, alignItems: 'center', justifyContent: 'center' },
});
