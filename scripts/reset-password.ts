import * as path from 'path';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { generatePassword } from './create-user';
import { DEMO_ACCOUNT } from '../src/lib/auth/demoAccount';

// "Forgot my password" for invite-only accounts: the owner sets a temporary password and the app asks for a new one
// on the next sign-in, exactly as after create-user.

async function main() {
  const [email] = process.argv.slice(2);
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email) {
    console.error('Usage: npm run reset-password -- <email>');
    process.exit(1);
  }
  if (email === DEMO_ACCOUNT.email) {
    console.error('The demo account keeps its published password; run npm run seed-demo to reset it instead.');
    process.exit(1);
  }
  if (!url || !serviceKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    console.error(`No account for ${email}.`);
    process.exit(1);
  }

  const password = generatePassword(randomBytes(12));
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: { ...user.user_metadata, must_change_password: true },
  });
  if (error) throw error;

  console.log(`Reset ${email}. Temporary password: ${password}`);
  console.log('Send it privately. The app asks for a new password on the next sign-in.');
}

const isMainModule = process.argv[1]?.endsWith('reset-password.ts') ?? false;
if (isMainModule) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
