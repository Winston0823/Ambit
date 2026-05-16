import React, { useRef, useMemo, useState, useCallback } from 'react';
import { View, Alert, Image, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';
import { FeedTemplate } from '../../components/templates';
import { StartupCard } from '../../components/organisms';
import { Avatar, Badge, Divider } from '../../components/atoms';
import { SkillTagGroup, NeighborhoodDistance, ResponseRateBadge } from '../../components/molecules';
import { startups } from '../../data/startups';
import { Startup } from '../../data/types';
import { Colors, Spacing, Typography } from '../../constants/theme';

export default function CandidateFeed() {
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);

  const handlePress = useCallback((startup: Startup) => {
    setSelectedStartup(startup);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <FeedTemplate
        title="Startups near you"
        data={startups}
        keyExtractor={(item) => item.id}
        renderCard={(item: Startup, index: number) => (
          <StartupCard
            startup={item}
            index={index}
            onInterest={(roleId) => router.push(`/(candidate)/interest/${item.id}?roleId=${roleId}`)}
            onPress={() => handlePress(item)}
          />
        )}
      />
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: Colors.warmWhite, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: Colors.textTertiary, width: 40 }}
      >
        {selectedStartup && (
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHeader}>
              <Image source={{ uri: selectedStartup.logo }} style={styles.sheetLogo} />
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetName}>{selectedStartup.name}</Text>
                <Badge label={selectedStartup.stage} variant="stage" />
              </View>
            </View>
            <Text style={styles.sheetOneLiner}>{selectedStartup.oneLiner}</Text>
            <NeighborhoodDistance neighborhood={selectedStartup.neighborhood} distance={selectedStartup.distance} />
            <ResponseRateBadge rate={selectedStartup.responseRate} />
            <Text style={styles.sheetMeta}>Responds in {selectedStartup.responseTime}</Text>
            <Text style={styles.sheetMeta}>Team of {selectedStartup.teamSize} &middot; {selectedStartup.officeVibe}</Text>
            <Divider />
            <Text style={styles.sectionTitle}>Founder</Text>
            <View style={styles.founderRow}>
              <Avatar uri={selectedStartup.founder.photo} name={selectedStartup.founder.name} size="lg" />
              <View style={styles.founderInfo}>
                <Text style={styles.founderName}>{selectedStartup.founder.name}</Text>
                <Text style={styles.founderBio}>{selectedStartup.founder.bio}</Text>
              </View>
            </View>
            <Divider />
            <Text style={styles.sectionTitle}>Open Roles</Text>
            {selectedStartup.roles.map((role) => (
              <View key={role.id} style={styles.roleCard}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleComp}>{role.compRange}</Text>
                <Badge label={role.workType} variant="status" />
                <SkillTagGroup skills={role.skills} />
              </View>
            ))}
          </ScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    padding: Spacing.screen,
    gap: Spacing.sm + 4,
    paddingBottom: 80,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
  },
  sheetLogo: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: Colors.warmGray,
  },
  sheetHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
  sheetName: {
    ...Typography.heading,
    fontSize: 22,
  },
  sheetOneLiner: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  sheetMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  sectionTitle: {
    ...Typography.label,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  founderRow: {
    flexDirection: 'row',
    gap: Spacing.sm + 4,
    alignItems: 'center',
  },
  founderInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  founderName: {
    ...Typography.name,
    fontSize: 16,
  },
  founderBio: {
    ...Typography.caption,
  },
  roleCard: {
    backgroundColor: Colors.warmGray,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  roleTitle: {
    ...Typography.name,
    fontSize: 16,
  },
  roleComp: {
    ...Typography.caption,
    color: Colors.brandGreen,
    fontWeight: '600',
  },
});
