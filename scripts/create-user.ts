import * as path from 'path';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Sign-ups are closed on the hosted project, so accounts for friends are created here with the service-role key.

// No look-alike characters (0/O, 1/l/I), so a password read off a chat message is typed right the first time.
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

async function main() {
  const [email, givenPassword] = process.argv.slice(2);
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email) {
    console.error('Usage: npm run create-user -- <email> [password]');
    process.exit(1);
  }
  if (!url || !serviceKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    process.exit(1);
  }

  const password = givenPassword ?? generatePassword(randomBytes(12));
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;

  console.log(`Created ${email}. Password: ${password}`);
  console.log('Send it privately; it is not stored anywhere else.');
}

const isMainModule = process.argv[1]?.endsWith('create-user.ts') ?? false;
if (isMainModule) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
