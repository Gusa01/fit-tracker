// Public on purpose: the README lists the same credentials, and the account is recreated twice a week.
// Keep in sync with DEMO_USER_EMAIL / DEMO_USER_PASSWORD (.env.local and the GitHub secrets).
export const DEMO_ACCOUNT = {
  email: 'demo.fittracker@example.com',
  password: 'fittracker123',
} as const;
