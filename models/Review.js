// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000
  },
  is_verified: {
    type: Boolean,
    default: false // Отзыв проверен (от реального заказчика)
  }
}, {
  timestamps: true
});

// Индекс для поиска отзывов ресторана
reviewSchema.index({ restaurant_id: 1, createdAt: -1 });

// Индекс для уникальности отзыва (один отзыв на заказ)
reviewSchema.index({ order_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);