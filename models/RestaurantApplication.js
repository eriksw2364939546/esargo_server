// models/RestaurantApplication.js
const mongoose = require('mongoose');

const restaurantApplicationSchema = new mongoose.Schema({
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant_data: {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    longDescription: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    website: String,
    images: [String],
    cuisine_types: [{
      type: String,
      enum: ['армянская', 'средиземноморская', 'европейская', 'восточная']
    }],
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }
    },
    working_hours: {
      monday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
      friday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, is_closed: { type: Boolean, default: false } }
    },
    delivery_postal_codes: [{ type: String, required: true }],
    delivery_fee: { type: Number, required: true, min: 0 },
    min_order_amount: { type: Number, required: true, min: 0 }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submitted_at: {
    type: Date,
    default: Date.now
  },
  reviewed_at: {
    type: Date
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejection_reason: {
    type: String
  },
  documents: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['license', 'tax_certificate', 'health_permit', 'other']
    }
  }],
  admin_notes: {
    type: String
  }
}, {
  timestamps: true
});

// Индекс для поиска заявок владельца
restaurantApplicationSchema.index({ owner_id: 1, status: 1 });

// Индекс для админа
restaurantApplicationSchema.index({ status: 1, submitted_at: 1 });

module.exports = mongoose.model('RestaurantApplication', restaurantApplicationSchema);