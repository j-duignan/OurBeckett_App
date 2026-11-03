import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInputInstance, View } from 'react-native';

import { AuthScaffold } from '@/components/AuthScaffold';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { supabase } from '@/lib/supabase';
import { friendlyError, normaliseEmail, STUDENT_EMAIL_DOMAIN, validateEmail } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function SignIn() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    const eErr = validateEmail(email);
    setEmailError(eErr);
    setFormError(null);
    if (eErr) return;
    if (!password) {
      setFormError('Enter your password.');
      return;
    }
    setSubmitting(true);
    const cleanEmail = normaliseEmail(email);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          await supabase.auth.resend({ type: 'signup', email: cleanEmail });
          router.push({ pathname: '/verify', params: { email: cleanEmail } });
          return;
        }
        throw error;
      }
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in to see what’s happening on campus."
      footer={
        <AppText variant="caption" tone="muted" align="center">
          New to OurBeckett?{' '}
          <AppText variant="caption" tone="link" weight="700" onPress={() => router.replace('/sign-up')}>
            Create an account
          </AppText>
        </AppText>
      }
    >
      <TextField
        label="Student email"
        placeholder={`you@${STUDENT_EMAIL_DOMAIN}`}
        leftIcon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={emailError}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        placeholder="Your password"
        leftIcon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureToggle
        autoCapitalize="none"
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Pressable onPress={() => router.push({ pathname: '/forgot-password', params: { email: normaliseEmail(email) } })} style={styles.forgot} accessibilityRole="link">
        <AppText variant="label" tone="link">
          Forgot password?
        </AppText>
      </Pressable>

      {formError ? (
        <View style={[styles.formError, { backgroundColor: colors.dangerSoft }]}>
          <Icon name="alert-circle" size={18} color={colors.danger} />
          <AppText variant="callout" tone="danger" style={styles.flex}>
            {formError}
          </AppText>
        </View>
      ) : null}

      <Button title="Sign in" variant="gradient" size="lg" fullWidth onPress={submit} loading={submitting} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.sm },
  formError: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
});
