import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, SpringConfig } from '../../constants/theme';
import { useRole, Role } from '../../context/RoleContext';
import { Icon } from '../atoms';

export function DeveloperToggle() {
  const { role, setRole } = useRole();
  const router = useRouter();

  const handleSwitch = (newRole: Role) => {
    if (newRole === role) return;
    setRole(newRole);
    router.replace(newRole === 'founder' ? '/(founder)/feed' : '/(candidate)/feed');
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(role === 'founder' ? 0 : 130, SpringConfig.toggle) }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Icon name="repeat" size={16} color={Colors.textTertiary} />
        <Text style={styles.label}>Switch view</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleSwitch('founder')}
          activeOpacity={0.8}
        >
          <Text style={[styles.optionText, role === 'founder' && styles.optionTextActive]}>
            Founder
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleSwitch('candidate')}
          activeOpacity={0.8}
        >
          <Text style={[styles.optionText, role === 'candidate' && styles.optionTextActive]}>
            Candidate
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Demo toggle — switch between founder and candidate</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm + 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  label: {
    ...Typography.label,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: Colors.warmGray,
    borderRadius: 12,
    padding: 3,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 130,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  option: {
    width: 130,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  optionTextActive: {
    color: Colors.brandGreen,
  },
  hint: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
