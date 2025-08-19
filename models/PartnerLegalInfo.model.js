// models/PartnerLegalInfo.model.js - ИСПРАВЛЕНА ENUM ОШИБКА 🔐
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
  
  // 🔐 ЮРИДИЧЕСКИЕ ДАННЫЕ (смешанное шифрование)
  legal_data: {
    // 🔐 ОСНОВНЫЕ ДАННЫЕ (зашифрованы)
    legal_name: {
      type: String, // Зашифрованное название юридического лица
      required: true
    },
    
    siret_number: {
      type: String, // Зашифрованный SIRET номер (14 цифр)
      required: true,
      index: true
    },
    
    // ✅ ИСПРАВЛЕНО: legal_form НЕ ШИФРУЕТСЯ (не критично для безопасности)
    legal_form: {
      type: String, // ОТКРЫТО: SASU, SARL, SAS, etc.
      required: true,
      enum: [
        'SARL', 'EURL', 'SAS', 'SASU', 'SA', 
        'SNC', 'SCI', 'SELARL', 'Auto-entrepreneur',
        'Micro-entreprise', 'EI', 'EIRL', 'Autre'
      ]
    },
    
    // 🔐 АДРЕСНЫЕ ДАННЫЕ (зашифрованы)
    business_address: {
      type: String, // Зашифрованный юридический адрес
      required: true
    },
    
    // ✅ КОНТАКТНЫЕ ДАННЫЕ (открытые имена, зашифрованные контакты)
    contact_person: {
      type: String, // Имя контактного лица (ОТКРЫТО - не критично)
      required: true
    },
    
    contact_phone: {
      type: String, // 🔐 Зашифрованный телефон для связи
      required: true
    },
    
    // 🔐 ФИНАНСОВЫЕ ДАННЫЕ (зашифрованы)
    bank_details: {
      type: String, // Зашифрованные банковские реквизиты (JSON string)
      default: null
    },
    
    tax_number: {
      type: String, // 🔐 Зашифрованный налоговый номер
      default: null
    },
    
    // Дополнительная информация
    additional_info: {
      type: String, // 🔐 Зашифрованная дополнительная информация
      default: null
    }
  },
  
  // Статус верификации
  verification_status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'needs_correction'],
    default: 'pending',
    index: true
  },
  
  // Информация о проверке
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
    
    rejection_reason: String,
    
    // Примечания для исправлений
    correction_notes: String,
    
    // 🔐 ВАЖНО: История изменений (для аудита)
    verification_history: [{
      action: {
        type: String,
        enum: ['submitted', 'verified', 'rejected', 'corrected']
      },
      admin_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      notes: String
    }]
  },
  
  // 🔐 БЕЗОПАСНОСТЬ И АУДИТ
  security_info: {
    submitted_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    submitted_ip: String,
    user_agent: String,
    
    // Счетчик попыток расшифровки (для безопасности)
    decryption_attempts: {
      type: Number,
      default: 0
    },
    
    last_modified_at: Date,
    last_modified_by: {
      admin_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser'
      },
      role: String
    },
    
    // Логирование подозрительной активности
    last_unauthorized_access: {
      ip: String,
      timestamp: Date,
      user_agent: String
    }
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
partnerLegalInfoSchema.index({ verification_status: 1 });
partnerLegalInfoSchema.index({ 'security_info.submitted_at': 1 });

// Составной индекс для админской панели
partnerLegalInfoSchema.index({ 
  verification_status: 1, 
  'security_info.submitted_at': -1 
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * 🔐 БЕЗОПАСНОЕ одобрение юридических данных
 */
partnerLegalInfoSchema.methods.verify = function(adminId, notes = '') {
  this.verification_status = 'verified';
  this.verification_info.verified_by = adminId;
  this.verification_info.verified_at = new Date();
  
  // Добавляем в историю
  this.verification_info.verification_history.push({
    action: 'verified',
    admin_id: adminId,
    timestamp: new Date(),
    notes
  });
  
  // Обновляем информацию о последнем изменении
  this.security_info.last_modified_at = new Date();
  this.security_info.last_modified_by = {
    admin_id: adminId,
    role: 'admin'
  };
  
  return this.save();
};

/**
 * 🔐 БЕЗОПАСНОЕ отклонение юридических данных
 */
partnerLegalInfoSchema.methods.reject = function(adminId, reason, correctionNotes = '') {
  this.verification_status = 'rejected';
  this.verification_info.rejected_by = adminId;
  this.verification_info.rejected_at = new Date();
  this.verification_info.rejection_reason = reason;
  this.verification_info.correction_notes = correctionNotes;
  
  // Добавляем в историю
  this.verification_info.verification_history.push({
    action: 'rejected',
    admin_id: adminId,
    timestamp: new Date(),
    notes: `${reason}. ${correctionNotes}`
  });
  
  // Обновляем информацию о последнем изменении
  this.security_info.last_modified_at = new Date();
  this.security_info.last_modified_by = {
    admin_id: adminId,
    role: 'admin'
  };
  
  return this.save();
};

/**
 * 🔐 Запрос исправлений
 */
partnerLegalInfoSchema.methods.requestCorrection = function(adminId, notes) {
  this.verification_status = 'needs_correction';
  this.verification_info.correction_notes = notes;
  
  // Добавляем в историю
  this.verification_info.verification_history.push({
    action: 'corrected',
    admin_id: adminId,
    timestamp: new Date(),
    notes
  });
  
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * 🔍 Поиск по статусу верификации
 */
partnerLegalInfoSchema.statics.findByVerificationStatus = function(status) {
  return this.find({ verification_status: status })
    .populate('user_id', 'email role')
    .populate('partner_request_id')
    .sort({ 'security_info.submitted_at': -1 });
};

/**
 * 🔍 Поиск заявок для админской панели
 */
partnerLegalInfoSchema.statics.findForAdminReview = function(filters = {}) {
  const query = {};
  
  if (filters.status) {
    query.verification_status = filters.status;
  }
  
  if (filters.submitted_after) {
    query['security_info.submitted_at'] = { $gte: new Date(filters.submitted_after) };
  }
  
  return this.find(query)
    .populate('user_id', 'email role is_active')
    .populate('partner_request_id', 'business_data.business_name business_data.category status')
    .populate('verification_info.verified_by', 'full_name role')
    .populate('verification_info.rejected_by', 'full_name role')
    .sort({ 'security_info.submitted_at': -1 });
};

/**
 * 📊 Статистика для админской панели
 */
partnerLegalInfoSchema.statics.getVerificationStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$verification_status',
        count: { $sum: 1 },
        latest: { $max: '$security_info.submitted_at' }
      }
    }
  ]);
};

// ================ MIDDLEWARE ================

/**
 * 🔐 Pre-save middleware для безопасности
 */
partnerLegalInfoSchema.pre('save', function(next) {
  // Обновляем last_modified_at при любом изменении
  if (this.isModified() && !this.isNew) {
    this.security_info.last_modified_at = new Date();
  }
  
  next();
});

/**
 * 🔐 Post-save middleware для аудита
 */
partnerLegalInfoSchema.post('save', function(doc) {
  // Здесь можно добавить логирование изменений в отдельную коллекцию аудита
  console.log(`📋 Legal info ${doc._id} updated: status=${doc.verification_status}`);
});

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================

/**
 * Виртуальное поле для проверки просроченных заявок
 */
partnerLegalInfoSchema.virtual('isOverdue').get(function() {
  if (this.verification_status !== 'pending') return false;
  
  const submittedDate = new Date(this.security_info.submitted_at);
  const daysSinceSubmission = (Date.now() - submittedDate) / (1000 * 60 * 60 * 24);
  
  return daysSinceSubmission > 7; // Просрочена если больше 7 дней
});

/**
 * Виртуальное поле для получения последнего действия
 */
partnerLegalInfoSchema.virtual('lastAction').get(function() {
  const history = this.verification_info.verification_history;
  return history.length > 0 ? history[history.length - 1] : null;
});

// Настройка виртуальных полей в JSON
partnerLegalInfoSchema.set('toJSON', { virtuals: true });
partnerLegalInfoSchema.set('toObject', { virtuals: true });

// 🆕 ИСПРАВЛЕНО: ES6 export
const PartnerLegalInfo = mongoose.model('PartnerLegalInfo', partnerLegalInfoSchema);
export default PartnerLegalInfo;