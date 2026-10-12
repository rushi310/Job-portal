/**
 * seed.js — Imports the demo data into the database named by MONGODB_URI.  Usage: npm run seed
 *
 * Run it on purpose; the server never runs it by itself. It only adds records that are missing
 * and never changes or deletes existing ones, so it can be repeated safely.
 *
 * The demo passwords in /data are public. They are fine on your own computer, but an admin with a
 * public password on a shared database would hand the whole site to anyone. So for any database
 * that is not on this computer, SEED_ADMIN_PASSWORD is required: set it in the shell for this one
 * command (it is hashed before storing and never printed or saved).
 */

const { config } = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const { seedDatabase } = require('../services/seed-service');

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/;
const LOCAL_DATABASE_PATTERN = /^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/;

function readAdminPassword() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || '';
  if (adminPassword && !STRONG_PASSWORD_PATTERN.test(adminPassword)) {
    throw new Error('SEED_ADMIN_PASSWORD must be 12+ characters with an uppercase letter, a lowercase letter and a number.');
  }
  const isLocalDatabase = LOCAL_DATABASE_PATTERN.test(config.mongodbUri);
  if (!adminPassword && (config.isProduction || !isLocalDatabase)) {
    throw new Error('SEED_ADMIN_PASSWORD is required for a database that is not on this computer '
      + '(the admin must not get the public demo password). See DEPLOYMENT.md, step 2.');
  }
  return adminPassword;
}

async function run() {
  const adminPassword = readAdminPassword();
  await connectDatabase(config.mongodbUri);
  const summary = await seedDatabase({ adminPassword });

  console.info('Seed finished (created / already there / skipped):');
  Object.entries(summary).forEach(([name, { created, existing, skipped }]) => {
    console.info(`  ${name.padEnd(14)} ${created} / ${existing} / ${skipped}`);
  });
  if (adminPassword) {
    console.info('The admin account uses your SEED_ADMIN_PASSWORD (if it was created now; an existing admin is unchanged).');
    console.info('The other demo accounts use the public demo passwords listed in README.md.');
  }
}

run()
  .catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
