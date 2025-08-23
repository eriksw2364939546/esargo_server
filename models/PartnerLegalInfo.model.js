// models/PartnerLegalInfo.model.js - ТОЧНО ПО СКРИНУ 2 🎯
import mongoose from 'mongoose';

const partnerLegalInfoSchema = new mongoose.Schema({
  // Связи
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  partner_request_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InitialPartnerRequest',
    required: true,
    index: true
  },
  
  // 🏢 ЮРИДИЧЕСКИЕ ДАННЫЕ (точно как на скрине 2)
  legal_data: {
    // "Название юридического лица (если отличается от названия магазина)"
    legal_name: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Burger King"
      required: true
    },
    
    // "SIRET номер"
    siret_number: {
      type: String, // 🔐 ЗАШИФРОВАНО - "123 456 789 00014"
      required: true,
      index: true
    },
    
    // "Форма юридического лица" (dropdown)
    legal_form: {
      type: String, // ✅ ОТКРЫТО - выпадающий список
      required: true,
      enum: [
        'Auto-entrepreneur',
        'SASU', 
        'SARL',
        'SAS',
        'EURL',
        'SA',
        'SNC',
        'SCI',
        'SELARL',
        'Micro-entreprise',
        'EI',
        'EIRL',
        'Autre'
      ]
    },
    
    // "Номер TVA (если есть)"
    tva_number: {
      type: String, // 🔐 ЗАШИФРОВАНО - "FR12 345678912"
      required: false
    },
    
    // "Юридический адрес (siège social)"
    legal_address: {
      type: String, // 🔐 ЗАШИФРОВАНО - "10 Rue de la Paix, 75002 Paris"
      required: true
    },
    
    // "Имя и фамилия юридического представителя (директора)"
    legal_representative: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Jean Dupont"
      required: true
    }
  },
  
  // 🏦 БАНКОВСКИЕ ДАННЫЕ (точно как на скрине 2)
  bank_details: {
    // "IBAN"
    iban: {
      type: String, // 🔐 ЗАШИФРОВАНО - "FR76 3000 6000 0112 3456 7890 189"
      required: true
    },
    
    // "BIC"
    bic: {
      type: String, // 🔐 ЗАШИФРОВАНО - "AGRIFRPPXXX"
      required: true
    }
  },
  
  // 📞 КОНТАКТНЫЕ ДАННЫЕ ЮРИДИЧЕСКОГО ЛИЦА (точно как на скрине 2)
  legal_contact: {
    // "Email юр. лица"
    email: {
      type: String, // 🔐 ЗАШИФРОВАНО
      required: true
    },
    
    // "Телефон юр. лица"
    phone: {
      type: String, // 🔐 ЗАШИФРОВАНО
      required: true
    }
  },
  
  // 📄 СТАТУС ВЕРИФИКАЦИИ
  verification_status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'needs_correction'],
    default: 'pending',
    index: true
  },
  
  // ℹ️ ИНФОРМАЦИЯ О ПРОВЕРКЕ
  verification_info: {
    verified_at: Date,
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    rejected_at: Date,
    rejected_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    rejection_reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    admin_notes: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    approval_notes: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // 📄 ДОКУМЕНТЫ (опционально)
  documents: {
    kbis_document: {
      type: String, // 🔐 ЗАШИФРОВАНО - ссылка на K-bis
      required: false
    },
    id_document: {
      type: String, // 🔐 ЗАШИФРОВАНО - документ личности
      required: false
    },
    additional_documents: [{
      name: String,
      url: String, // 🔐 ЗАШИФРОВАНО
      uploaded_at: Date
    }]
  },
  
  // 🛡️ ВАЛИДАЦИЯ
  validation_info: {
    siret_validated: {
      type: Boolean,
      default: false
    },
    iban_validated: {
      type: Boolean,
      default: false
    },
    tva_status: {
      type: String,
      enum: ['applicable', 'not_applicable', 'pending'],
      default: 'pending'
    }
  },
  
  // 📅 ВРЕМЕННЫЕ МЕТКИ
  submitted_at: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  collection: 'partnerlegalinfos'
});

// ================ ИНДЕКСЫ ================
partnerLegalInfoSchema.index({
  verification_status: 1,
  submitted_at: -1
});

partnerLegalInfoSchema.index({
  'legal_data.siret_number': 1
});

partnerLegalInfoSchema.index({
  'legal_data.legal_form': 1
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * Валидация французского SIRET номера
 */
partnerLegalInfoSchema.methods.validateSiret = function() {
  const siret = this.legal_data.siret_number;
  if (!siret) return false;
  
  const cleaned = siret.replace(/\s/g, '');
  const siretRegex = /^\d{14}$/;
  return siretRegex.test(cleaned);
};

/**
 * Валидация французского IBAN
 */
partnerLegalInfoSchema.methods.validateIban = function() {
  const iban = this.bank_details.iban;
  if (!iban) return false;
  
  const cleaned = iban.replace(/\s/g, '');
  const frenchIbanRegex = /^FR\d{2}[A-Z0-9]{23}$/;
  return frenchIbanRegex.test(cleaned);
};

/**
 * Валидация TVA номера
 */
partnerLegalInfoSchema.methods.validateTva = function() {
  const tva = this.legal_data.tva_number;
  if (!tva) return true; // TVA опционально
  
  const cleaned = tva.replace(/\s/g, '');
  const frenchTvaRegex = /^FR\d{11}$/;
  return frenchTvaRegex.test(cleaned);
};

/**
 * Проверка полноты данных для верификации
 */
partnerLegalInfoSchema.methods.isReadyForVerification = function() {
  const required = [
    this.legal_data.legal_name,
    this.legal_data.siret_number,
    this.legal_data.legal_form,
    this.legal_data.legal_address,
    this.legal_data.legal_representative,
    this.bank_details.iban,
    this.bank_details.bic,
    this.legal_contact.email,
    this.legal_contact.phone
  ];
  
  return required.every(field => !!field);
};

/**
 * Получение статуса проверки
 */
partnerLegalInfoSchema.methods.getVerificationStatus = function() {
  return {
    status: this.verification_status,
    siret_valid: this.validateSiret(),
    iban_valid: this.validateIban(),
    tva_valid: this.validateTva(),
    ready_for_verification: this.isReadyForVerification()
  };
};

// ================ НАСТРОЙКИ JSON ================
partnerLegalInfoSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Не возвращаем зашифрованные данные в JSON
    if (ret.legal_data) {
      delete ret.legal_data.legal_name;
      delete ret.legal_data.siret_number;
      delete ret.legal_data.tva_number;
      delete ret.legal_data.legal_address;
      delete ret.legal_data.legal_representative;
    }
    if (ret.bank_details) {
      delete ret.bank_details.iban;
      delete ret.bank_details.bic;
    }
    if (ret.legal_contact) {
      delete ret.legal_contact.email;
      delete ret.legal_contact.phone;
    }
    if (ret.documents) {
      Object.keys(ret.documents).forEach(key => {
        if (typeof ret.documents[key] === 'string') {
          delete ret.documents[key];
        }
      });
    }
    return ret;
  }
});

export default mongoose.model('PartnerLegalInfo', partnerLegalInfoSchema);