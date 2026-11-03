import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Logo } from './Logo';
import { AppText } from './ui/AppText';
import { Header } from './ui/Header';
import { Screen } from './ui/Screen';

type Props = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  back?: boolean;
};

export function AuthScaffold({ title, subtitle, children, footer, back = true }: Props) {
  return (
    <Screen edges={['top', 'bottom']}>
      <Header border={false} back={back} left={back ? undefined : <View />} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Logo size={32} wordmark={false} />
          <AppText variant="h1" style={styles.title}>
            {title}
          </AppText>
          {subtitle ? (
            typeof subtitle === 'string' ? (
              <AppText tone="secondary" style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : (
              subtitle
            )
          ) : null}
          <View style={styles.form}>{children}</View>
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl },
  title: { marginTop: spacing.xl },
  subtitle: { marginTop: spacing.sm },
  form: { marginTop: spacing.xxl, gap: spacing.lg },
  footer: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, alignItems: 'center' },
});
