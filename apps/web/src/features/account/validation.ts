export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  confirmedAdult: boolean;
  acceptedPolicies: boolean;
}
export type RegisterErrors = Partial<Record<keyof RegisterInput, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email address.';
  if (email.length > 254 || !EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  return undefined;
}

// Client-side checks are for convenience only. The server re-validates everything (Phase 4).
export function validateRegister(input: RegisterInput): RegisterErrors {
  const errors: RegisterErrors = {};
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const password = validatePassword(input.password);
  if (password) errors.password = password;
  if (input.confirmPassword !== input.password) errors.confirmPassword = 'Passwords do not match.';
  if (!input.confirmedAdult) errors.confirmedAdult = 'You must be 18 or older to use GlowLogic.';
  if (!input.acceptedPolicies) errors.acceptedPolicies = 'Please accept the privacy notice and terms to continue.';
  return errors;
}

export function validateLogin(email: string, password: string): Partial<Record<'email' | 'password', string>> {
  const errors: Partial<Record<'email' | 'password', string>> = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = 'Enter your password.';
  return errors;
}
