/**
 * auth.js — Authentication and role checks for protected routes.
 * The frontend's page guards only decide what to show; these checks are the security boundary.
 * The user is always loaded from the database for each request, so blocking, deleting or
 * approving an account takes effect immediately, and a role written in a token is never trusted
 * on its own.
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { config } = require('../config/env');
const { ROLES, USER_STATUS } = require('../config/constants');
const User = require('../models/user');
const { unauthenticated, forbidden, notFound } = require('../utils/app-error');

const BEARER_PREFIX = 'Bearer ';

/** Create a signed login token for a user. */
function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, tv: user.tokenVersion },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' },
  );
}

function readToken(req) {
  const header = req.get('authorization') ?? '';
  return header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : '';
}

/**
 * Require a valid token for an account that may still log in. Sets `req.user`.
 * Every failure gives the same 401, so the response never says why a token was refused.
 */
async function authenticate(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) throw unauthenticated();

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw unauthenticated('Your session has expired. Please log in again.');
    }
    if (!mongoose.isValidObjectId(payload.sub)) throw unauthenticated();

    const user = await User.findById(payload.sub);
    const isStillValid = user
      && user.role === payload.role
      && user.tokenVersion === payload.tv
      && user.status !== USER_STATUS.BLOCKED;
    if (!isStillValid) throw unauthenticated('Your session has ended. Please log in again.');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Allow only the given roles (use after `authenticate`). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(forbidden('You do not have access to this.'));
    return next();
  };
}

/** BR-07: only approved (`active`) recruiters may post or manage jobs and see applicants. */
function requireActiveRecruiter(req, res, next) {
  if (req.user?.role !== ROLES.RECRUITER) return next(forbidden('Please log in as a recruiter.'));
  if (req.user.status !== USER_STATUS.ACTIVE) {
    return next(forbidden(
      'Your account is awaiting admin approval. You can post and manage jobs once it is approved.',
      'NOT_APPROVED',
    ));
  }
  return next();
}

/** Reject ids that are not ObjectIds before they reach a query (treated as "not found"). */
function validateIdParam(...names) {
  return (req, res, next) => {
    const isValid = names.every((name) => mongoose.isValidObjectId(req.params[name]));
    return next(isValid ? undefined : notFound());
  };
}

module.exports = { signToken, authenticate, requireRole, requireActiveRecruiter, validateIdParam };
