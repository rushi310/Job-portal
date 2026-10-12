/**
 * public-controller.js — Routes that need no login: health check and landing-page data.
 */

const jobService = require('../services/job-service');
const { isDatabaseConnected } = require('../config/database');
const { asyncHandler, sendData } = require('../utils/async-handler');

/** Used by the hosting platform: 200 while the API can reach the database, 503 otherwise. */
function getHealth(req, res) {
  const isConnected = isDatabaseConnected();
  res.status(isConnected ? 200 : 503).json({
    ok: isConnected,
    data: { status: isConnected ? 'ok' : 'unavailable', database: isConnected ? 'connected' : 'disconnected' },
  });
}

const getLanding = asyncHandler(async (req, res) => {
  sendData(res, await jobService.getLandingData());
});

module.exports = { getHealth, getLanding };
