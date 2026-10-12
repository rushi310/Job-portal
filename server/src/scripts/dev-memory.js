/**
 * dev-memory.js — Local demo with nothing to install or configure.  Usage: npm run dev:memory
 *
 * Starts a temporary in-memory MongoDB, imports the demo data and runs the API, which also
 * serves the frontend at http://localhost:5000/. Everything is lost when the process stops, so
 * this is for trying the project out — use `npm run dev` with a real MONGODB_URI to keep data.
 * (The first run downloads a MongoDB binary of about 500 MB for mongodb-memory-server.)
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

async function run() {
  const mongo = await MongoMemoryServer.create();
  // Set before the configuration is loaded (it is read once, when first required).
  process.env.NODE_ENV = 'development';
  process.env.MONGODB_URI = `${mongo.getUri()}freshhire`;
  process.env.SERVE_FRONTEND = 'true';
  process.env.ALLOW_DEMO_RESET = 'true';

  const { config } = require('../config/env');
  const { connectDatabase } = require('../config/database');
  const { seedDatabase } = require('../services/seed-service');
  const { createApp } = require('../app');

  await connectDatabase(config.mongodbUri);
  await seedDatabase();
  createApp().listen(config.port, () => {
    console.info(`FreshHire demo running at http://localhost:${config.port}/ (temporary data; Ctrl+C to stop)`);
  });
  process.on('SIGINT', async () => {
    await mongo.stop();
    process.exit(0);
  });
}

run().catch((error) => {
  console.error(`Could not start the demo: ${error.message}`);
  process.exit(1);
});
