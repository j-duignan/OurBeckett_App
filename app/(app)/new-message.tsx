import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/keys';
import { fetchFollows, searchUsers } from '@/api/profiles';
import { UserRow } from '@/components/UserRow';
import { AppText } from '@/components/ui/AppText';
import { Header } from '@/components/ui/Header';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { useDebounced } from '@/hooks/useDebounced';
import { useStartConversation } from '@/hooks/useModeration';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function NewMessage() {
  const { colors } = useTheme();
  const { userId } = useCurrentUser();
  const startConversation = useStartConversation();
  const [text, setText] = useState('');
  const term = useDebounced(text.trim(), 300);
  const searching = term.replace(/^@/, '').length >= 2;

  const following = useQuery({
    queryKey: queryKeys.follows(userId, 'following'),
    queryFn: () => fetchFollows(userId, 'following'),
    enabled: !searching,
  });
  const results = useQuery({ queryKey: queryKeys.searchUsers(term), queryFn: () => searchUsers(term), enabled: searching });

  const active = searching ? results : following;
  const data = (active.data ?? []).filter((u) => u.id !== userId);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="New message" close />
      <TextField
        placeholder="Search by name or @username"
        leftIcon="search"
        value={text}
        onChangeText={setText}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={styles.search}
      />
      {!searching ? (
        <AppText variant="label" tone="muted" style={styles.section}>
          PEOPLE YOU FOLLOW
        </AppText>
      ) : null}
      {active.isPending ? (
        <LoadingState />
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => active.refetch()} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <UserRow
              user={item}
              subtitle={item.course ?? undefined}
              onPress={() => startConversation(item.id)}
              right={
                <View style={[styles.chatIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="chatbubble-outline" size={18} color={colors.link} />
                </View>
              }
            />
          )}
          ListEmptyComponent={
            searching ? (
              <EmptyState icon="person-outline" title="No students found" message={`Nobody matches “${term}”.`} />
            ) : (
              <EmptyState icon="people-outline" title="Search for anyone" message="Type a name or username to find any Leeds Beckett student." />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  chatIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
