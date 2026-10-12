/**
 * auth-service.js — Registration, login and logout (PROJECT_SPEC.md §2, BR-01 – BR-06).
 * Passwords are hashed with bcrypt and are never stored, logged or returned in plain text.
 */

const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { config } = require('../config/env');
const { ROLES, USER_STATUS } = require('../config/constants');
const {
  AppError, badRequest, forbidden, validationFailed, assertValid,
} = require('../utils/app-error');
const { text, normalizeEmail } = require('../utils/text');
const { toUser } = require('../utils/serializers');
const { signToken } = require('../middleware/auth');
const { isPublicRole, validateRegistration, readCredentials } = require('../validators/auth-validator');

const DUPLICATE_KEY = 11000;
const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists. Please log in instead.';
/** One message for an unknown email AND a wrong password, so login never reveals which emails exist. */
const INVALID_CREDENTIALS = () => new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
/** Compared against when the email is unknown, so both cases take about the same time. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);

function buildStudentProfile(values) {
  return {
    college: text(values.college),
    degree: values.degree,
    branch: text(values.branch),
    graduationYear: Number(text(values.graduationYear)),
    cgpa: Math.round(Number(text(values.cgpa)) * 100) / 100,
  };
}

function buildRecruiterProfile(values) {
  return {
    companyName: text(values.companyName),
    designation: text(values.designation),
    companyWebsite: text(values.companyWebsite),
    companyLocation: text(values.companyLocation),
  };
}

/**
 * Create a student (`active`) or recruiter (`pending` until an admin approves, BR-07) account.
 * The role must be one of the public roles: an admin can never be registered (BR-06), and the
 * status is always decided here, never taken from the request. Does not log the user in.
 * @returns {Promise<{ user: object, isPendingApproval: boolean }>}
 */
async function register(values = {}) {
  if (!isPublicRole(values.role)) {
    throw badRequest('ROLE_NOT_ALLOWED', 'Please choose to register as a Student or a Recruiter.');
  }
  assertValid(validateRegistration(values));

  const email = normalizeEmail(values.email);
  if (await User.exists({ email })) throw validationFailed({ email: EMAIL_TAKEN_MESSAGE });

  const isStudent = values.role === ROLES.STUDENT;
  try {
    const user = await User.create({
      role: values.role,
      name: text(values.name),
      email,
      passwordHash: await hashPassword(values.password),
      phone: text(values.phone),
      status: isStudent ? USER_STATUS.ACTIVE : USER_STATUS.PENDING,
      studentProfile: isStudent ? buildStudentProfile(values) : undefined,
      recruiterProfile: isStudent ? undefined : buildRecruiterProfile(values),
    });
    return { user: toUser(user), isPendingApproval: !isStudent };
  } catch (error) {
    // Two registrations with the same email at the same moment: the unique index decides.
    if (error.code === DUPLICATE_KEY) throw validationFailed({ email: EMAIL_TAKEN_MESSAGE });
    throw error;
  }
}

/**
 * Check an email and password and issue a login token.
 * Blocked accounts are refused (BR-03); pending recruiters may log in with limited access.
 * @returns {Promise<{ token: string, user: object, isPendingApproval: boolean }>}
 */
async function login(body) {
  const credentials = readCredentials(body);
  if (!credentials) throw badRequest('MISSING_FIELDS', 'Please enter your email and password.');

  const user = await User.findOne({ email: credentials.email }).select('+passwordHash');
  const isMatch = await bcrypt.compare(credentials.password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !isMatch) throw INVALID_CREDENTIALS();

  if (user.status === USER_STATUS.BLOCKED) {
    throw forbidden('This account has been blocked. Please contact the FreshHire admin.', 'ACCOUNT_BLOCKED');
  }
  const isPendingApproval = user.role === ROLES.RECRUITER && user.status === USER_STATUS.PENDING;
  if (user.status !== USER_STATUS.ACTIVE && !isPendingApproval) {
    throw forbidden('This account is not active.', 'ACCOUNT_INACTIVE');
  }
  return { token: signToken(user), user: toUser(user), isPendingApproval };
}

/** End the user's sessions: every token issued so far stops working. */
async function logout(userId) {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

module.exports = { register, login, logout, hashPassword };
