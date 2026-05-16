import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ProfileTemplate } from '../../components/templates';
import { TextInput, Button, Badge, Divider, Avatar } from '../../components/atoms';
import { SkillTagGroup } from '../../components/molecules';
import { DeveloperToggle } from '../../components/organisms';
import { startups } from '../../data/startups';
import { Colors, Spacing, Typography, Shadows, Radii } from '../../constants/theme';

export default function FounderProfile() {
  const startup = startups[0]; // Using first startup as "my startup" for prototype
  const [companyName, setCompanyName] = useState(startup.name);
  const [oneLiner, setOneLiner] = useState(startup.oneLiner);
  const [officeVibe, setOfficeVibe] = useState(startup.officeVibe);

  return (
    <ProfileTemplate title="Company Profile">
      <View style={styles.logoSection}>
        <Image source={{ uri: startup.logo }} style={styles.logo} />
        <TouchableOpacity style={styles.editPhoto}>
          <Text style={styles.editPhotoText}>Change logo</Text>
        </TouchableOpacity>
      </View>

      <TextInput label="Company Name" value={companyName} onChangeText={setCompanyName} />
      <TextInput label="One-liner" value={oneLiner} onChangeText={setOneLiner} />

      <View style={styles.row}>
        <Text style={styles.label}>Stage</Text>
        <Badge label={startup.stage} variant="stage" />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Team size</Text>
        <Text style={styles.value}>{startup.teamSize} people</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Neighborhood</Text>
        <Badge label={startup.neighborhood} variant="neighborhood" />
      </View>

      <TextInput label="Office vibe" value={officeVibe} onChangeText={setOfficeVibe} />

      <Divider />

      <Text style={styles.sectionTitle}>Founder</Text>
      <View style={styles.founderCard}>
        <Avatar uri={startup.founder.photo} name={startup.founder.name} size="lg" />
        <View style={styles.founderInfo}>
          <Text style={styles.founderName}>{startup.founder.name}</Text>
          <Text style={styles.founderBio}>{startup.founder.bio}</Text>
        </View>
      </View>

      <Divider />

      <Text style={styles.sectionTitle}>Open Roles</Text>
      {startup.roles.map((role) => (
        <View key={role.id} style={styles.roleCard}>
          <Text style={styles.roleTitle}>{role.title}</Text>
          <Text style={styles.roleComp}>{role.compRange}</Text>
          <View style={styles.roleRow}>
            <Badge label={role.workType} variant="status" />
          </View>
          <SkillTagGroup skills={role.skills} />
        </View>
      ))}

      <Button
        title="+ Add role"
        variant="secondary"
        onPress={() => {}}
        style={styles.addButton}
      />

      <Divider spacing={Spacing.lg} />

      <DeveloperToggle />
    </ProfileTemplate>
  );
}

const styles = StyleSheet.create({
  logoSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.warmGray,
  },
  editPhoto: {
    paddingVertical: Spacing.xs,
  },
  editPhotoText: {
    ...Typography.label,
    color: Colors.brandGreen,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  label: {
    ...Typography.label,
  },
  value: {
    ...Typography.body,
    fontSize: 15,
  },
  sectionTitle: {
    ...Typography.subheading,
    marginTop: Spacing.xs,
  },
  founderCard: {
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
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows,
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
  roleRow: {
    flexDirection: 'row',
  },
  addButton: {
    marginTop: Spacing.sm,
  },
});
