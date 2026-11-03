import { router } from 'expo-router';
import { useState } from 'react';

import { FormScaffold } from '@/components/FormScaffold';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { supabase } from '@/lib/supabase';
import { friendlyError, validatePassword } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useOverlay } from '@/providers/OverlayProvider';

export default function ChangePassword() {
  const { session } = useAuth();
  const { showToast } = useOverlay();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const e = {
      current: current ? null : 'Enter your current password.',
      next: validatePassword(next),
      confirm: next !== confirm ? 'Passwords don’t match.' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean) || !session?.user.email) return;

    setSaving(true);
    try {
      // Re-check the current password before allowing a change.
      const { error: authError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: current });
      if (authError) {
        setErrors({ current: 'Your current password is incorrect.' });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      showToast('Password changed');
      router.back();
    } catch (err) {
      setErrors({ confirm: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScaffold title="Change password" submitLabel="Save" onSubmit={submit} submitting={saving}>
      <TextField label="Current password" value={current} onChangeText={setCurrent} secureToggle autoCapitalize="none" textContentType="password" error={errors.current} />
      <TextField label="New password" value={next} onChangeText={setNext} secureToggle autoCapitalize="none" textContentType="newPassword" error={errors.next} hint="At least 8 characters with a letter and a number." />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureToggle autoCapitalize="none" textContentType="newPassword" error={errors.confirm} />
      <AppText variant="caption" tone="muted">
        Forgotten your current password? Sign out and use “Forgot password?” on the sign-in screen.
      </AppText>
    </FormScaffold>
  );
}
