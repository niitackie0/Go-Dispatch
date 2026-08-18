/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Staff accounts, from your own terminal.
 *
 *     npm run admin list
 *     npm run admin create
 *     npm run admin password <email>
 *
 * The console can already do all of this. This exists for the two cases where
 * the console cannot help:
 *
 *  - **Nobody can get in.** Changing the only owner's email from the Staff
 *    Accounts screen is one wrong click away from locking everybody out of a
 *    system that has no password reset. This puts a way back in that does not
 *    depend on being signed in.
 *  - **A password must not be spoken aloud.** Anything typed into a chat, a
 *    ticket or a support call is in a transcript forever. Passwords typed here
 *    are read straight from your keyboard, masked, hashed with Argon2id, and
 *    never printed or logged.
 *
 * Setting a password also signs that account out everywhere, which is the point
 * of setting it: a session opened with the old password should not outlive it.
 */

import 'dotenv/config';
import { hash, verify } from '@node-rs/argon2';
import readline from 'node:readline';
import { prisma } from '../src/server/prisma.js';
import { MIN_PASSWORD_LENGTH } from '../src/server/auth.js';
import { ADMIN_ROLES, type AdminRole } from '../src/types.js';

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

/** Reads a password without echoing it, so it is not left on screen. */
function askSecret(question: string): Promise<string> {
  const rl: any = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    // Everything after the prompt is swallowed rather than echoed.
    rl._writeToOutput = (chunk: string) => {
      if (chunk.startsWith(question)) rl.output.write(chunk);
    };
  });
}

async function readNewPassword(existingHash?: string): Promise<string> {
  for (;;) {
    const first = await askSecret('New password (not shown): ');

    if (first.length < MIN_PASSWORD_LENGTH) {
      console.log(`  Too short. At least ${MIN_PASSWORD_LENGTH} characters.\n`);
      continue;
    }

    // Refuses the password already in use, which for this project means
    // refusing the one that has been sitting in a chat transcript.
    if (existingHash && (await verify(existingHash, first).catch(() => false))) {
      console.log('  That is the password it already has. Choose a different one.\n');
      continue;
    }

    const second = await askSecret('Type it again: ');
    if (first !== second) {
      console.log('  They did not match.\n');
      continue;
    }

    return first;
  }
}

async function list(): Promise<void> {
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { sessions: true } } },
  });

  if (admins.length === 0) {
    console.log('\nNo staff accounts exist. Run `npm run admin create`.\n');
    return;
  }

  console.log('');
  for (const a of admins) {
    console.log(`  ${a.email}`);
    console.log(`    ${a.name} — ${a.role}, ${a._count.sessions} active session(s), added ${a.createdAt.toISOString().slice(0, 10)}`);
  }

  const owners = admins.filter((a) => a.role === 'owner').length;
  console.log(`\n  ${admins.length} account(s), ${owners} owner(s).`);
  if (owners === 1) {
    console.log('  Only one owner. Add a second before changing that one\'s email or role.');
  }
  console.log('');
}

async function create(): Promise<void> {
  const name = await ask('Full name: ');
  if (!name) return console.log('A name is required.');

  const email = (await ask('Email: ')).toLowerCase();
  if (!email.includes('@')) return console.log('That does not look like an email address.');

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return console.log(`\n${email} already has an account. Use \`npm run admin password ${email}\` instead.\n`);

  const roleInput = (await ask(`Role [${ADMIN_ROLES.join(' / ')}] (owner): `)).toLowerCase() || 'owner';
  if (!ADMIN_ROLES.includes(roleInput as AdminRole)) return console.log(`Unknown role "${roleInput}".`);

  const password = await readNewPassword();

  const created = await prisma.adminUser.create({
    data: { name, email, role: roleInput as AdminRole, passwordHash: await hash(password) },
  });

  console.log(`\nCreated ${created.email} as ${created.role}.`);
  console.log('Sign in with it now, before removing any account you are replacing.\n');
}

async function setPassword(email: string): Promise<void> {
  const target = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (!target) return console.log(`\nNo account for ${email}. Run \`npm run admin list\`.\n`);

  console.log(`\nSetting a new password for ${target.email} (${target.role}).`);
  const password = await readNewPassword(target.passwordHash);

  const [, sessions] = await prisma.$transaction([
    prisma.adminUser.update({ where: { id: target.id }, data: { passwordHash: await hash(password) } }),
    prisma.session.deleteMany({ where: { adminUserId: target.id } }),
  ]);

  console.log(`\nPassword changed. ${sessions.count} session(s) signed out — sign in again with the new one.\n`);
}

const [command, argument] = process.argv.slice(2);

switch (command) {
  case 'list':
    await list();
    break;
  case 'create':
    await create();
    break;
  case 'password':
    if (!argument) {
      console.log('\nUsage: npm run admin password <email>\n');
      break;
    }
    await setPassword(argument);
    break;
  default:
    console.log(`
Staff accounts

  npm run admin list                 who has an account, and their role
  npm run admin create               add one, typing the password yourself
  npm run admin password <email>     set a new password and sign that account out
`);
}

process.exit(0);
