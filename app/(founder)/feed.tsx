import React, { useCallback, useRef, useMemo } from 'react';
import { Alert, View } from 'react-native';
import { FeedTemplate } from '../../components/templates';
import { CandidateCard } from '../../components/organisms';
import { ProfileSidebar } from '../../components/organisms';
import { candidates } from '../../data/candidates';
import { Candidate } from '../../data/types';
import BottomSheet from '@gorhom/bottom-sheet';
import { Colors, Spacing } from '../../constants/theme';
import { useState } from 'react';

export default function FounderFeed() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);

  const handlePress = useCallback((candidate: Candidate) => {
    setSelectedCandidate(candidate);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <FeedTemplate
        title="Candidates near you"
        data={candidates}
        keyExtractor={(item) => item.id}
        renderCard={(item: Candidate, index: number) => (
          <CandidateCard
            candidate={item}
            index={index}
            onChat={() => Alert.alert('Chat', `Start chat with ${item.name}`)}
            onPass={() => Alert.alert('Passed', `Passed on ${item.name}`)}
            onSave={() => Alert.alert('Saved', `Saved ${item.name}`)}
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
        {selectedCandidate && <ProfileSidebar candidate={selectedCandidate} />}
      </BottomSheet>
    </View>
  );
}
