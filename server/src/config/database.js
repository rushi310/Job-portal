/**
 * database.js — MongoDB connection management (Mongoose).
 * The connection string is never logged: errors report only the kind of failure.
 */

const mongoose = require('mongoose');

// Fail fast instead of queueing queries while the database is unreachable.
mongoose.set('bufferCommands', false);
// Unknown query fields are dropped rather than sent to MongoDB.
mongoose.set('strictQuery', true);
// Indexes are built once, explicitly, right after connecting (see ensureIndexes) — not in the
// background at an unknown moment — so the unique constraints are in force before any request.
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const CONNECT_OPTIONS = { serverSelectionTimeoutMS: 10000 };
const RETRY_DELAY_MS = 3000;

/** Likely cause of a failed connection, from the error's kind and code — never from the address. */
function describeFailure(error) {
  const code = error.code || error.name;
  if (/querySrv|ENOTFOUND|ETIMEOUT|ECONNREFUSED|EAI_AGAIN/.test(`${error.code} ${error.message}`)) {
    return `${code}: the database address could not be looked up (DNS). Check the internet connection, `
      + 'turn off any VPN, or try another network / DNS server, then start again';
  }
  if (/auth/i.test(error.message)) return `${code}: the username or password in MONGODB_URI was refused`;
  if (error.name === 'MongooseServerSelectionError') {
    return `${code}: the database did not answer. In Atlas, check Network Access (is this computer's IP allowed?) `
      + 'and that the cluster is not paused';
  }
  return `${code}: check MONGODB_URI and network access`;
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const MODEL_FILES = ['user', 'job', 'application', 'saved-job', 'notification', 'resume'];

/** Create any missing indexes (unique email, one application per student and job, …). */
async function ensureIndexes() {
  const models = MODEL_FILES.map((name) => require(`../models/${name}`));
  await Promise.all(models.map((model) => model.createIndexes()));
}

/**
 * Connect and make sure the indexes exist.
 * @param {string} uri
 * @param {{ attempts?: number }} [options] attempts > 1 retries after a short pause — home networks
 *   sometimes fail the first DNS lookup of an Atlas address
 * @returns {Promise<void>} rejects with a message that is safe to log
 */
async function connectDatabase(uri, { attempts = 1 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, CONNECT_OPTIONS);
      break;
    } catch (error) {
      // Only the kind of error is reported, so the connection string can never reach the logs.
      const reason = describeFailure(error);
      if (attempt >= attempts) throw new Error(`Could not connect to MongoDB (${reason}).`);
      console.warn(`MongoDB connection attempt ${attempt} of ${attempts} failed (${error.code || error.name}); trying again…`);
      await wait(RETRY_DELAY_MS);
    }
  }
  await ensureIndexes();
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

/** @returns {boolean} true when queries can run */
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseConnected };
