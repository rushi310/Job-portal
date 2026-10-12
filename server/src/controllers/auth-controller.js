/**
 * auth-controller.js — HTTP handlers for registration, login, logout and "who am I".
 */

const authService = require('../services/auth-service');
const notificationService = require('../services/notification-service');
const { toUser } = require('../utils/serializers');
const { asyncHandler, sendData } = require('../utils/async-handler');

const register = asyncHandler(async (req, res) => {
  sendData(res, await authService.register(req.body), 201);
});

const login = asyncHandler(async (req, res) => {
  sendData(res, await authService.login(req.body));
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  sendData(res, { loggedOut: true });
});

/** The logged-in user's own account and unread notification count (used on every page load). */
const getMe = asyncHandler(async (req, res) => {
  sendData(res, {
    user: toUser(req.user),
    unreadCount: await notificationService.countUnread(req.user._id),
  });
});

module.exports = { register, login, logout, getMe };
