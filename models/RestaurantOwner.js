// models/RestaurantOwner.js
const mongoose = require('mongoose');

const restaurantOwnerSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  company_name: {
    type: String,
    required: true,
    trim: true
  },
  tax_number: {
    type: String,
    required: true,
    unique: true
  },
  legal_address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    postal_code: { type: String, required: true },
    country: { type: String, default: 'Франция' }
  },
  contact_person: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    position: { type: String, required: true }
  },
  documents: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['business_license', 'tax_certificate', 'id_document', 'other']
    },
    verified: { type: Boolean, default: false }
  }],
  restaurants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant'
  }],
  is_verified: {
    type: Boolean,
    default: false
  },
  verification_status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verification_notes: {
    type: String
  },
  subscription_plan: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    default: 'basic'
  },
  commission_rate: {
    type: Number,
    default: 15, // процент комиссии
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Индекс для поиска по пользователю
restaurantOwnerSchema.index({ user_id: 1 });

// Индекс для поиска по налоговому номеру
restaurantOwnerSchema.index({ tax_number: 1 });

module.exports = mongoose.model('RestaurantOwner', restaurantOwnerSchema);