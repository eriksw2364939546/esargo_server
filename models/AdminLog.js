// models/AdminLog.js
const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'restaurant_approved',
      'restaurant_rejected',
      'restaurant_deactivated',
      'restaurant_activated',
      'user_banned',
      'user_unbanned',
      'order_cancelled',
      'review_deleted',
      'promotion_approved',
      'application_reviewed',
      'owner_verified',
      'owner_rejected'
    ]
  },
  target_type: {
    type: String,
    required: true,
    enum: ['Restaurant', 'User', 'Order', 'Review', 'Promotion', 'RestaurantApplication', 'RestaurantOwner']
  },
  target_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed // Дополнительные данные о действии
  },
  ip_address: {
    type: String
  },
  user_agent: {
    type: String
  }
}, {
  timestamps: true
});

// Индекс для поиска логов админа
adminLogSchema.index({ admin_id: 1, createdAt: -1 });

// Индекс для поиска по типу действия
adminLogSchema.index({ action: 1, createdAt: -1 });

// Индекс для поиска по целевому объекту
adminLogSchema.index({ target_type: 1, target_id: 1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);