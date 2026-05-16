import React from 'react';
import { Alert } from 'react-native';
import { InboxTemplate } from '../../components/templates';
import { InterestExpression } from '../../components/organisms';
import { interests } from '../../data/interests';
import { candidates } from '../../data/candidates';
import { startups } from '../../data/startups';
import { Interest } from '../../data/types';

export default function FounderInbox() {
  return (
    <InboxTemplate
      title="Interest expressions"
      count={interests.length}
      data={interests}
      keyExtractor={(item: Interest) => item.id}
      renderItem={(item: Interest) => {
        const candidate = candidates.find((c) => c.id === item.candidateId);
        const startup = startups.find((s) => s.id === item.startupId);
        const role = startup?.roles.find((r) => r.id === item.roleId);

        if (!candidate || !startup) return null;

        return (
          <InterestExpression
            interest={item}
            candidate={candidate}
            startup={startup}
            role={role}
            onOpenChat={() => Alert.alert('Chat', `Opening chat with ${candidate.name}`)}
            onPass={() => Alert.alert('Passed', `Passed on ${candidate.name}`)}
            onSave={() => Alert.alert('Saved', `Saved ${candidate.name} for later`)}
          />
        );
      }}
    />
  );
}
