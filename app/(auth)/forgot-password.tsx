import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AuthScaffold } from '@/components/AuthScaffold';
import { CodeInput } from '@/components/CodeInput';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { OTP_LENGTH } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { friendlyError, normaliseEmail, STUDENT_EMAIL_DOMAIN, validateEmail, validatePassword } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';

const CODE_LENGTH = OTP_LENGTH;

/**
 * Two-step password reset:
 *  1. Request a recovery code by email.
 *  2. Enter code + new password. Verifying the code signs the student in
 *     (flagged as "recovering" so they stay on this screen), then the new
 *     password is saved.
 */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { setRecovering, session, signOut } = useAuth();
  const { showToast } = useOverlay();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const requestCode = async () => {
    const err = validateEmail(email);
    setErrors({ email: err });
    if (err) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normaliseEmail(email));
      if (error) throw error;
      setStep('reset');
      showToast('If that email has an account, a reset code is on its way.', 'info');
    } catch (e) {
      setErrors({ email: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    const next = {
      code: code.length < CODE_LENGTH ? `Enter the ${CODE_LENGTH}-digit code from your email.` : null,
      password: validatePassword(password),
      confirm: password !== confirm ? 'Passwords don’t match.' : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    try {
      if (!session) {
        setRecovering(true);
        const { error } = await supabase.auth.verifyOtp({ email: normaliseEmail(email), token: code, type: 'recovery' });
        if (error) {
          setRecovering(false);
          throw error;
        }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setRecovering(false);
      showToast('Password updated. Welcome back!');
    } catch (e) {
      setErrors({ form: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (session) await signOut();
    setRecovering(false);
    router.replace('/sign-in');
  };

  if (step === 'request') {
    return (
      <AuthScaffold title="Reset your password" subtitle="Enter your student email and we’ll send you a reset code.">
        <TextField
          label="Student email"
          placeholder={`you@${STUDENT_EMAIL_DOMAIN}`}
          leftIcon="mail-outline"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={requestCode}
          error={errors.email}
        />
        <Button title="Send reset code" variant="gradient" size="lg" fullWidth onPress={requestCode} loading={busy} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold title="Choose a new password" subtitle={`Enter the code we sent to ${normaliseEmail(email)}.`} back={false}>
      <CodeInput value={code} onChange={setCode} length={CODE_LENGTH} error={errors.code} />
      <TextField
        label="New password"
        placeholder="At least 8 characters"
        leftIcon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureToggle
        autoCapitalize="none"
        textContentType="newPassword"
        autoComplete="new-password"
        error={errors.password}
      />
      <TextField
        label="Confirm new password"
        placeholder="Type it again"
        leftIcon="lock-closed-outline"
        value={confirm}
        onChangeText={setConfirm}
        secureToggle
        autoCapitalize="none"
        textContentType="newPassword"
        error={errors.confirm ?? errors.form}
      />
      <Button title="Update password" variant="gradient" size="lg" fullWidth onPress={resetPassword} loading={busy} />
      <Button title="Resend code" variant="ghost" onPress={requestCode} disabled={busy} />
      <Button title="Cancel" variant="ghost" onPress={cancel} disabled={busy} />
    </AuthScaffold>
  );
}
