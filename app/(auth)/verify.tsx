import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthScaffold } from '@/components/AuthScaffold';
import { CodeInput } from '@/components/CodeInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { OTP_LENGTH } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/validation';
import { useOverlay } from '@/providers/OverlayProvider';
import { spacing } from '@/theme/tokens';

const RESEND_SECONDS = 60;

// The Supabase email templates must include {{ .Token }}; see README.
const CODE_LENGTH = OTP_LENGTH;

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { showToast } = useOverlay();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (token = code) => {
    if (!email) return;
    if (token.length < CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      if (err) throw err;
      // Session is now active; the root navigator routes to onboarding.
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!email || cooldown > 0) return;
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email });
      if (err) throw err;
      setCooldown(RESEND_SECONDS);
      showToast('New code sent. Check your inbox (and junk folder).');
    } catch (err) {
      showToast(friendlyError(err), 'error');
    }
  };

  return (
    <AuthScaffold
      title="Check your inbox"
      subtitle={
        <AppText tone="secondary" style={styles.subtitle}>
          We sent a code to <AppText weight="700">{email}</AppText>. Enter it below to confirm your account.
        </AppText>
      }
    >
      <CodeInput
        value={code}
        length={CODE_LENGTH}
        error={error}
        onChange={(value) => {
          setCode(value);
          setError(null);
          if (value.length === CODE_LENGTH) verify(value);
        }}
      />
      <Button title="Verify email" variant="gradient" size="lg" fullWidth onPress={() => verify()} loading={verifying} />
      <Button
        title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        variant="ghost"
        onPress={resend}
        disabled={cooldown > 0}
      />
      <Button title="Use a different email" variant="ghost" onPress={() => router.replace('/sign-up')} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: spacing.sm },
});
