import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ProfileTemplate } from '../../components/templates';
import { TextInput, Button, Badge, Divider, Avatar } from '../../components/atoms';
import { SkillTagGroup } from '../../components/molecules';
import { CandidateCard, DeveloperToggle } from '../../components/organisms';
import { candidates } from '../../data/candidates';
import { Colors, Spacing, Typography, Shadows, Radii } from '../../constants/theme';

export default function CandidateProfile() {
  const me = candidates[0]; // Using first candidate as "me" for prototype
  const [name, setName] = useState(me.name);
  const [vibeBlurb, setVibeBlurb] = useState(me.vibeBlurb);
  const [lookingFor, setLookingFor] = useState(me.lookingFor);
  const [linkedIn, setLinkedIn] = useState(me.linkedIn);
  const [showPreview, setShowPreview] = useState(false);

  if (showPreview) {
    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.backButton}>
            <Text style={styles.backText}>← Back to edit</Text>
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Card Preview</Text>
        </View>
        <View style={styles.previewCard}>
          <CandidateCard
            candidate={{ ...me, name, vibeBlurb, lookingFor, linkedIn }}
            index={0}
            onChat={() => {}}
            onPass={() => {}}
            onSave={() => {}}
            onPress={() => {}}
          />
        </View>
      </View>
    );
  }

  return (
    <ProfileTemplate title="My Profile">
      <View style={styles.photoSection}>
        <Image source={{ uri: me.photo }} style={styles.photo} />
        <TouchableOpacity style={styles.editPhoto}>
          <Text style={styles.editPhotoText}>Change photo</Text>
        </TouchableOpacity>
      </View>

      <TextInput label="Name" value={name} onChangeText={setName} />

      <View>
        <TextInput
          label="Vibe blurb"
          value={vibeBlurb}
          onChangeText={(text) => { if (text.length <= 200) setVibeBlurb(text); }}
          multiline
          numberOfLines={3}
        />
        <Text style={styles.charCount}>{vibeBlurb.length}/200</Text>
      </View>

      <View>
        <Text style={styles.sectionLabel}>Skills</Text>
        <SkillTagGroup skills={me.skills} />
        <TouchableOpacity style={styles.editLink}>
          <Text style={styles.editLinkText}>Edit skills</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <Text style={styles.sectionLabel}>Neighborhood</Text>
        <Badge label={me.neighborhood} variant="neighborhood" />
      </View>

      <Divider />

      <Text style={styles.sectionTitle}>What I'm looking for</Text>
      <TextInput
        label="Role type & preferences"
        value={lookingFor}
        onChangeText={setLookingFor}
        multiline
        numberOfLines={2}
      />

      <TextInput label="LinkedIn URL" value={linkedIn} onChangeText={setLinkedIn} />

      <Button
        title="Preview my card"
        variant="secondary"
        onPress={() => setShowPreview(true)}
        style={styles.previewButton}
      />

      <Divider spacing={Spacing.lg} />

      <DeveloperToggle />
    </ProfileTemplate>
  );
}

const styles = StyleSheet.create({
  photoSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  charCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  editLink: {
    marginTop: Spacing.sm,
  },
  editLinkText: {
    ...Typography.label,
    color: Colors.brandGreen,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...Typography.subheading,
  },
  previewButton: {
    marginTop: Spacing.md,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: Colors.warmWhite,
  },
  previewHeader: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  backButton: {
    paddingVertical: Spacing.xs,
  },
  backText: {
    ...Typography.label,
    color: Colors.brandGreen,
    fontWeight: '600',
  },
  previewTitle: {
    ...Typography.heading,
  },
  previewCard: {
    padding: Spacing.screen,
  },
});
