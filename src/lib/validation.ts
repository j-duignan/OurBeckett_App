export const STUDENT_EMAIL_DOMAIN = 'student.leedsbeckett.ac.uk';

const STUDENT_EMAIL_REGEX = /^[a-z0-9._%+-]+@student\.leedsbeckett\.ac\.uk$/;
const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mirrors public.is_student_email() in the database (case-insensitive). */
export function isStudentEmail(email: string): boolean {
  return STUDENT_EMAIL_REGEX.test(normaliseEmail(email));
}

export function validateEmail(email: string): string | null {
  const value = normaliseEmail(email);
  if (!value) return 'Enter your student email address.';
  if (!value.includes('@')) return 'That doesn’t look like an email address.';
  if (!isStudentEmail(value)) {
    return `Use your Leeds Beckett student email ending in @${STUDENT_EMAIL_DOMAIN}.`;
  }
  return null;
}

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase().replace(/^@/, '');
}

export function validateUsername(username: string): string | null {
  const value = normaliseUsername(username);
  if (value.length < 3) return 'Usernames need at least 3 characters.';
  if (value.length > 20) return 'Usernames can be at most 20 characters.';
  if (!USERNAME_REGEX.test(value)) return 'Use only letters, numbers, underscores and full stops.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  const value = name.trim();
  if (!value) return 'Enter the name you want people to see.';
  if (value.length > 50) return 'Display names can be at most 50 characters.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Include at least one letter and one number.';
  }
  return null;
}

export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length >= 12 && score < 3) score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/** Turns Supabase/Postgres errors into messages students can act on. */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as { message: unknown }).message)
    : typeof error === 'string' ? error : '';
  const lower = message.toLowerCase();

  if (!message) return fallback;
  if (lower.includes('leedsbeckett')) return `Only @${STUDENT_EMAIL_DOMAIN} email addresses can join OurBeckett.`;
  if (lower.includes('database error saving new user')) {
    return 'We couldn’t create your account. Check you’re using your student email and that your username isn’t taken.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (lower.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (lower.includes('email not confirmed')) return 'Please verify your email first. We can send you a new code.';
  if (lower.includes('token has expired') || lower.includes('otp') && lower.includes('invalid')) {
    return 'That code is invalid or has expired. Request a new one.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (lower.includes('new password should be different')) return 'Choose a password you haven’t used before.';
  if (lower.includes('duplicate key') && lower.includes('username')) return 'That username is already taken.';
  if (lower.includes('duplicate key') && lower.includes('communities')) return 'A community with that name already exists.';
  if (lower.includes('duplicate key') && lower.includes('reports')) return 'You’ve already reported this. Our team will review it.';
  if (lower.includes('row-level security')) return 'You don’t have permission to do that.';
  if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  if (lower.includes('cannot message')) return 'You can’t message this student.';
  return message.length < 140 ? message : fallback;
}
