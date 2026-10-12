/**
 * server.js — Starts the API: connect to MongoDB, then listen on the platform's port.
 * Demo data is never imported here; run `npm run seed` on purpose instead.
 */

const { config } = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function start() {
  await connectDatabase(config.mongodbUri, { attempts: 3 });
  const server = createApp().listen(config.port, () => {
    console.info(`FreshHire API listening on port ${config.port} (${config.nodeEnv})`);
    if (config.serveFrontend) console.info(`Frontend served at http://localhost:${config.port}/`);
  });

  server.on('error', (error) => {
    const reason = error.code === 'EADDRINUSE'
      ? `port ${config.port} is already in use — another copy of the server is probably still running. `
        + 'Stop it (Ctrl+C in its terminal) or set another PORT'
      : error.message;
    console.error(`FreshHire API could not start: ${reason}.`);
    process.exit(1);
  });

  // Finish open requests and close the database connection when the platform stops the service.
  const shutdown = () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error(`FreshHire API could not start: ${error.message}`);
  process.exit(1);
});
