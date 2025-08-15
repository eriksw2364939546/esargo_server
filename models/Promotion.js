// models/Promotion.js
const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  restaurant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  discount_type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_delivery'],
    required: true
  },
  discount_value: {
    type: Number,
    required: true,
    min: 0
  },
  min_order_amount: {
    type: Number,
    default: 0,
    min: 0
  },
  max_discount_amount: {
    type: Number // Максимальная сумма скидки для процентных скидок
  },
  promo_code: {
    type: String,
    uppercase: true,
    trim: true
  },
  usage_limit: {
    type: Number // Общий лимит использований
  },
  usage_count: {
    type: Number,
    default: 0
  },
  user_usage_limit: {
    type: Number, // Лимит использований на пользователя
    default: 1
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  applicable_days: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Индекс для поиска акций ресторана
promotionSchema.index({ restaurant_id: 1, is_active: 1 });

// Индекс для поиска по промокоду
promotionSchema.index({ promo_code: 1 });

// Метод для проверки действительности акции
promotionSchema.methods.isValid = function() {
  const now = new Date();
  return this.is_active && 
         this.start_date <= now && 
         this.end_date >= now &&
         (!this.usage_limit || this.usage_count < this.usage_limit);
};

module.exports = mongoose.model('Promotion', promotionSchema);