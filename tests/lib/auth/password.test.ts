import { mustChangePassword, validateNewPassword } from '../../../src/lib/auth/password';

describe('mustChangePassword', () => {
  it('is true only when the account was created with a temporary password', () => {
    expect(mustChangePassword({ user_metadata: { must_change_password: true } })).toBe(true);
    expect(mustChangePassword({ user_metadata: { must_change_password: false } })).toBe(false);
    expect(mustChangePassword({ user_metadata: {} })).toBe(false);
    expect(mustChangePassword(undefined)).toBe(false);
  });
});

describe('validateNewPassword', () => {
  it('requires at least 8 characters', () => {
    expect(validateNewPassword('abc123', 'abc123')).toBe('La contraseña tiene que tener al menos 8 caracteres.');
  });

  it('requires both fields to match', () => {
    expect(validateNewPassword('fuerte1234', 'fuerte12345')).toBe('Las contraseñas no coinciden.');
  });

  it('accepts a valid password', () => {
    expect(validateNewPassword('fuerte1234', 'fuerte1234')).toBeNull();
  });
});
