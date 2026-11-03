import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInputInstance, View } from 'react-native';

import { isUsernameAvailable } from '@/api/profiles';
import { AuthScaffold } from '@/components/AuthScaffold';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { supabase } from '@/lib/supabase';
import {
  friendlyError,
  normaliseEmail,
  normaliseUsername,
  passwordStrength,
  STUDENT_EMAIL_DOMAIN,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/lib/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export default function SignUp() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  const nameRef = useRef<TextInputInstance>(null);
  const usernameRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  // Live username availability check (debounced).
  useEffect(() => {
    const value = normaliseUsername(username);
    if (!value || validateUsername(value)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(value);
        if (!cancelled) setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        if (!cancelled) setUsernameStatus('error');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  const strength = passwordStrength(password);
  const strengthColors = [colors.border, colors.danger, colors.warning, colors.success];
  const strengthLabels = ['', 'Weak', 'Good', 'Strong'];

  const submit = async () => {
    const next = {
      email: validateEmail(email),
      displayName: validateDisplayName(displayName),
      username: validateUsername(username) ?? (usernameStatus === 'taken' ? 'That username is already taken.' : null),
      password: validatePassword(password),
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    try {
      const cleanEmail = normaliseEmail(email);
      const cleanUsername = normaliseUsername(username);
      if (!(await isUsernameAvailable(cleanUsername))) {
        setErrors((e) => ({ ...e, username: 'That username is already taken.' }));
        setUsernameStatus('taken');
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { username: cleanUsername, display_name: displayName.trim() } },
      });
      if (error) throw error;
      // Supabase returns a user with no identities when the email is already registered.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setFormError('An account with this email already exists. Try signing in instead.');
        return;
      }
      if (!data.session) {
        router.push({ pathname: '/verify', params: { email: cleanEmail } });
      }
      // If email confirmation is disabled the session arrives immediately and
      // the root navigator moves on to onboarding automatically.
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const usernameRight =
    usernameStatus === 'checking' ? (
      <ActivityIndicator size="small" color={colors.textMuted} />
    ) : usernameStatus === 'available' ? (
      <Icon name="checkmark-circle" size={20} color={colors.success} />
    ) : usernameStatus === 'taken' ? (
      <Icon name="close-circle" size={20} color={colors.danger} />
    ) : null;

  return (
    <AuthScaffold
      title="Join OurBeckett"
      subtitle={`All you need is your @${STUDENT_EMAIL_DOMAIN} email.`}
      footer={
        <AppText variant="caption" tone="muted" align="center">
          Already have an account?{' '}
          <AppText variant="caption" tone="link" weight="700" onPress={() => router.replace('/sign-in')}>
            Sign in
          </AppText>
        </AppText>
      }
    >
      <TextField
        label="Student email"
        placeholder={`c1234567@${STUDENT_EMAIL_DOMAIN}`}
        leftIcon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => nameRef.current?.focus()}
        onBlur={() => email && setErrors((e) => ({ ...e, email: validateEmail(email) }))}
        error={errors.email}
      />
      <TextField
        ref={nameRef}
        label="Display name"
        placeholder="e.g. Amara Okafor"
        leftIcon="person-outline"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={50}
        textContentType="name"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
        error={errors.displayName}
      />
      <TextField
        ref={usernameRef}
        label="Username"
        placeholder="amara.o"
        leftIcon="at"
        value={username}
        onChangeText={(v) => setUsername(normaliseUsername(v))}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        right={usernameRight}
        error={errors.username ?? (usernameStatus === 'taken' ? 'That username is already taken.' : null)}
        hint={usernameStatus === 'available' ? 'Nice, that one’s yours.' : 'Letters, numbers, _ and . only.'}
      />
      <View>
        <TextField
          ref={passwordRef}
          label="Password"
          placeholder="At least 8 characters"
          leftIcon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secureToggle
          autoCapitalize="none"
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={errors.password}
        />
        {password ? (
          <View style={styles.strengthRow}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.strengthBar, { backgroundColor: strength >= i ? strengthColors[strength] : colors.border }]} />
            ))}
            <AppText variant="caption" tone="muted" style={styles.strengthLabel}>
              {strengthLabels[strength]}
            </AppText>
          </View>
        ) : null}
      </View>

      {formError ? (
        <View style={[styles.formError, { backgroundColor: colors.dangerSoft }]}>
          <Icon name="alert-circle" size={18} color={colors.danger} />
          <AppText variant="callout" tone="danger" style={styles.flex}>
            {formError}
          </AppText>
        </View>
      ) : null}

      <Button title="Create account" variant="gradient" size="lg" onPress={submit} loading={submitting} fullWidth />
      <AppText variant="caption" tone="muted" align="center">
        We’ll email you a code to confirm it’s really you. Your email is never shown on your profile.
      </AppText>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { width: 48, textAlign: 'right' },
  formError: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
});
