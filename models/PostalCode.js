// models/PostalCode.js
const mongoose = require('mongoose');

const postalCodeSchema = new mongoose.Schema({
  postal_code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    trim: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number] // [longitude, latitude]
    }
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Индекс для геопоиска
postalCodeSchema.index({ coordinates: '2dsphere' });

// Индекс для поиска по городу
postalCodeSchema.index({ city: 1 });

module.exports = mongoose.model('PostalCode', postalCodeSchema);