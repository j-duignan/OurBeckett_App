import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Button } from './ui/Button';
import { Header } from './ui/Header';
import { Screen } from './ui/Screen';
import { LoadingState } from './ui/States';

type Props = {
  title: string;
  submitLabel: string;
  onSubmit: () => void;
  submitting: boolean;
  loading?: boolean;
  children: ReactNode;
};

/** Modal form layout shared by the create/edit screens. */
export function FormScaffold({ title, submitLabel, onSubmit, submitting, loading, children }: Props) {
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={title} close right={<Button title={submitLabel} size="sm" variant="gradient" onPress={onSubmit} loading={submitting} disabled={loading} />} />
      {loading ? (
        <LoadingState />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
});
