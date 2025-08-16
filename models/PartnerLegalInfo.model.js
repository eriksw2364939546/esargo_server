// ============================================
// НОВАЯ МОДЕЛЬ: PartnerLegalInfo.model.js
// Юридические данные (заполняются ПОСЛЕ одобрения)
// ============================================

const mongoose = require('mongoose');

const partnerLegalInfoSchema = new mongoose.Schema({
  partner_request_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InitialPartnerRequest',
    required: true,
    unique: true
  },
  
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Статус юридической верификации
  verification_status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'needs_correction'],
    default: 'pending'
  },
  
  // Французские юридические данные
  legal_data: {
    legal_name: {
      type: String,
      required: true,
      trim: true
    },
    siret_number: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      validate: {
        validator: function(v) {
          return /^\d{14}$/.test(v);
        },
        message: 'SIRET должен содержать 14 цифр'
      }
    },
    legal_form: {
      type: String,
      required: true,
      enum: ['SASU', 'SARL', 'SAS', 'EURL', 'Auto-entrepreneur']
    },
    tva_number: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^FR\d{11}$/.test(v);
        },
        message: 'TVA должен быть в формате FR + 11 цифр'
      }
    },
    legal_address: {
      type: String,
      required: true,
      trim: true
    },
    director_name: {
      type: String,
      required: true,
      trim: true
    },
    iban: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          const cleaned = v.replace(/\s/g, '');
          return /^FR\d{12}[A-Z0-9]{11}\d{2}$/.test(cleaned);
        },
        message: 'Некорректный французский IBAN'
      }
    },
    bic: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[A-Z]{4}FR[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v);
        },
        message: 'Некорректный BIC код'
      }
    },
    legal_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    legal_phone: {
      type: String,
      required: true,
      trim: true
    }
  },
  
  // Временные метки
  submitted_at: {
    type: Date,
    default: Date.now
  },
  
  verified_at: Date,
  verified_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  
  // Примечания для исправлений
  correction_notes: String
}, {
  timestamps: true
});

// Индексы
partnerLegalInfoSchema.index({ partner_request_id: 1 });
partnerLegalInfoSchema.index({ user_id: 1 });
partnerLegalInfoSchema.index({ 'legal_data.siret_number': 1 });

module.exports = mongoose.model('PartnerLegalInfo', partnerLegalInfoSchema);
