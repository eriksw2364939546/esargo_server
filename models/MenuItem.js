// models/MenuItem.js
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  restaurant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      "Еда",
      "Алкоголь",
      "Косметика",
      "Цветы",
      "Домашние животные"
    ]
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discount_price: {
    type: Number,
    min: 0
  },
  images: [{
    type: String // URLs изображений
  }],
  ingredients: [{
    type: String
  }],
  allergens: [{
    type: String,
    enum: [
      'глютен', 'молочные продукты', 'яйца', 'орехи',
      'арахис', 'соя', 'рыба', 'морепродукты', 'сельдерей'
    ]
  }],
  is_vegetarian: {
    type: Boolean,
    default: false
  },
  is_vegan: {
    type: Boolean,
    default: false
  },
  is_spicy: {
    type: Boolean,
    default: false
  },
  cooking_time: {
    type: Number, // в минутах
    default: 30
  },
  is_available: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Индекс для поиска по ресторану и категории
menuItemSchema.index({ restaurant_id: 1, category: 1 });

// Индекс для текстового поиска
menuItemSchema.index({
  name: 'text',
  description: 'text',
  ingredients: 'text'
});

module.exports = mongoose.model('MenuItem', menuItemSchema);