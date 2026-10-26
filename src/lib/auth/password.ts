const MIN_PASSWORD_LENGTH = 8;

/** Set by `npm run create-user`: the account still has the temporary password the owner sent. */
export function mustChangePassword(user: { user_metadata?: Record<string, unknown> } | undefined): boolean {
  return user?.user_metadata?.must_change_password === true;
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}
