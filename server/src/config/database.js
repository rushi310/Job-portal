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
const MODEL_FILES = ['user', 'job', 'application', 'saved-job', 'notification', 'resume'];

/** Create any missing indexes (unique email, one application per student and job, …). */
async function ensureIndexes() {
  const models = MODEL_FILES.map((name) => require(`../models/${name}`));
  await Promise.all(models.map((model) => model.createIndexes()));
}

/** @returns {Promise<void>} rejects with a message that is safe to log */
async function connectDatabase(uri) {
  try {
    await mongoose.connect(uri, CONNECT_OPTIONS);
  } catch (error) {
    // Only the kind of error is reported, so the connection string can never reach the logs.
    throw new Error(`Could not connect to MongoDB (${error.name}). Check MONGODB_URI and network access.`);
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
