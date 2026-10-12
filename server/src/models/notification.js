/**
 * notification.js — In-app notifications (PROJECT_SPEC.md §4.5, §5.5). One document per recipient.
 */

const { Schema, model } = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // the recipient
  type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, default: '' },
  link: { type: String, default: '' }, // frontend page path, relative to the site root
  read: { type: Boolean, default: false },
  legacyId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ type: 1, createdAt: -1 }); // admin "sent announcements"

module.exports = model('Notification', notificationSchema);
