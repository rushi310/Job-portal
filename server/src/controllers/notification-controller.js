/**
 * notification-controller.js — HTTP handlers for the logged-in user's own notifications.
 */

const notificationService = require('../services/notification-service');
const { parsePaging } = require('../utils/pagination');
const { asyncHandler, sendData } = require('../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  sendData(res, await notificationService.listForUser(req.user._id, parsePaging(req.query)));
});

const getUnreadCount = asyncHandler(async (req, res) => {
  sendData(res, { unread: await notificationService.countUnread(req.user._id) });
});

const markAsRead = asyncHandler(async (req, res) => {
  sendData(res, await notificationService.markAsRead(req.user._id, req.params.notificationId));
});

const markAllAsRead = asyncHandler(async (req, res) => {
  sendData(res, await notificationService.markAllAsRead(req.user._id));
});

module.exports = { list, getUnreadCount, markAsRead, markAllAsRead };
