#!/usr/bin/env node
/**
 * create-admin.mjs: bootstrap the first admin user for CALENDAR.
 * Creates a Supabase Auth user with email + password (email_confirm: true)
 * and upserts the matching public.profiles row (role = 'admin',
 * must_change_password = true, so the app forces a password change on
 * first sign-in).
 *
 * USAGE:
 *   node scripts/create-admin.mjs --email admin@eiden-group.com --name "Marouane Akrich" [--password <password>]
 *
 * ENVIRONMENT (read from process.env; if missing, a manual fallback parser
 * reads .env.local then .env from the current working directory):
 *   SUPABASE_URL              : e.g. https://<project-ref>.supabase.co
 *                                (falls back to NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY : service role key, NOT the anon key
 *
 * EXAMPLES:
 *   # auto-generate a strong 16-char password (printed once below):
 *   SUPABASE_URL=https://abc.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *     node scripts/create-admin.mjs --email admin@eiden-group.com --name "Admin"
 *
 *   # or supply your own:
 *   node scripts/create-admin.mjs --email admin@eiden-group.com --name "Admin" --password 'Sup3rSecret!'
 *
 * BEHAVIOR / SAFETY:
 *   * Idempotent-ish: if a profile with the same email already exists, the
 *     script prints an error and exits 1. If the auth user exists but has no
 *     profile, the script exits 1 and reports the orphaned auth user id.
 *   * The generated/supplied password is printed exactly once. It is never
 *     stored anywhere by this script (profiles.must_change_password = true
 *     forces the user to change it at first login; the app must enforce that).
 *   * Requires @supabase/supabase-js (already a dependency of this app).
 *   * Run with system Node (>= 18). Safe on both staging and production.
 */

import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// env loading: process.env first, then manual parse of .env.local / .env
function parseEnvFile(filePath) {
  const out = {};
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const withoutExport = trimmed.replace(/^export\s+/, '');
    const eq = withoutExport.indexOf('=');
    if (eq === -1) continue;
    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    // strip matching surrounding quotes, if any
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadEnv() {
  const merged = { ...process.env };
  if (!merged.SUPABASE_URL || !merged.SUPABASE_SERVICE_ROLE_KEY) {
    for (const name of ['.env.local', '.env']) {
      const p = resolve(process.cwd(), name);
      if (!existsSync(p)) continue;
      const parsed = parseEnvFile(p);
      for (const [k, v] of Object.entries(parsed)) {
        if (merged[k] === undefined) merged[k] = v;
      }
    }
  }
  return merged;
}

// args
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--email' || a === '--name' || a === '--password') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${a}`);
      }
      args[a.slice(2)] = value;
      i += 1;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${a} (expected --email, --name, [--password])`);
    }
  }
  return args;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_';

function generatePassword(length = 16) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

// main
async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    fail(err.message);
  }

  if (args.help) {
    console.log('Usage: node scripts/create-admin.mjs --email <email> --name <full name> [--password <password>]');
    process.exit(0);
  }

  const email = args.email?.trim().toLowerCase();
  const fullName = args.name?.trim();
  const password = args.password ?? generatePassword(16);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail('A valid --email is required (e.g. admin@eiden-group.com).');
  }
  if (!fullName) {
    fail('--name is required (e.g. --name "Marouane Akrich").');
  }
  if (password.length < 8) {
    fail('Password must be at least 8 characters long.');
  }

  const env = loadEnv();
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    fail('SUPABASE_URL is not set (and NEXT_PUBLIC_SUPABASE_URL is not set either). Check your environment or .env.local.');
  }
  if (!serviceRoleKey) {
    fail('SUPABASE_SERVICE_ROLE_KEY is not set. This key is server-only: find it in Supabase Dashboard → Project Settings → API → service_role.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // idempotency check: an existing profile with this email means the
  // admin was already bootstrapped (or the account exists): do nothing.
  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    fail(`Could not query public.profiles (${lookupError.message}). Are migrations 0001–0005 applied?`);
  }
  if (existing) {
    console.error(`\nUser already exists: ${existing.email} (id ${existing.id}, role ${existing.role}).`);
    console.error('Refusing to create a duplicate. Delete the user in Supabase Auth first if you really want to recreate it.\n');
    process.exit(1);
  }

  // create the auth user
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'admin' },
  });

  if (createError) {
    // user likely exists in auth.users but has no profile row (orphaned)
    if (/already|exists|registered/i.test(createError.message)) {
      fail(`Auth user already exists for ${email} but no matching profile row was found (${createError.message}).\nResolve manually: delete the auth user in Supabase Dashboard → Authentication → Users, then re-run this script.`);
    }
    fail(`auth.admin.createUser failed: ${createError.message}`);
  }

  const userId = created?.user?.id;
  if (!userId) {
    fail('auth.admin.createUser returned no user id: aborting.');
  }

  // upsert the profile row (id = auth user id, role admin, temp password flow)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: 'admin',
        is_active: true,
        must_change_password: true,
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    fail(
      `Auth user was created (id ${userId}) but the profiles upsert failed: ${profileError.message}\n` +
      `Fix manually: insert into public.profiles (id, email, full_name, role, must_change_password)\n` +
      `values ('${userId}', '${email}', '${fullName.replace(/'/g, "''")}', 'admin', true);\n` +
      `Or delete the orphaned auth user in the Supabase dashboard and re-run this script.`
    );
  }

  // done: print credentials ONCE
  console.log('');
  console.log('============================================================');
  console.log('  CALENDAR. · admin account created');
  console.log('============================================================');
  console.log(`  Email:                ${email}`);
  console.log(`  Temporary password:   ${password}`);
  console.log(`  Full name:            ${fullName}`);
  console.log(`  Auth user id:         ${userId}`);
  console.log(`  must_change_password: true (forced at first sign-in)`);
  console.log('');
  console.log('  IMPORTANT:');
  console.log('  * This password is shown ONCE and is not stored anywhere.');
  console.log('  * Store it in a password manager now, or share it securely.');
  console.log('  * The user will be required to set a new password on first login.');
  console.log('============================================================');
  console.log('');
}

main().catch((err) => {
  console.error('Unexpected error:', err?.message || err);
  process.exit(1);
});
