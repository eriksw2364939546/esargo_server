// models/PartnerRequest.js
const mongoose = require('mongoose');

const partnerRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Временные метки заявки
  submitted_at: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Статус заявки
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  
  // Информация о рассмотрении заявки
  review_info: {
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reviewed_at: {
      type: Date
    },
    rejection_reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    admin_notes: {
      type: String,
      trim: true,
      maxlength: 1000 // Внутренние заметки для админов
    }
  },
  
  // Основные данные бизнеса (из первой формы)
  business_data: {
    business_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    category: {
      type: String,
      required: true,
      enum: ['restaurant', 'store'] // ТОЛЬКО 2 категории!
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    owner_name: {
      type: String,
      required: true,
      trim: true
    },
    owner_surname: {
      type: String,
      required: true,
      trim: true
    },
    cover_image_url: {
      type: String
    },
    working_hours: {
      type: String,
      trim: true // Произвольное описание часов работы
    }
  },
  
  // Французские юридические данные (из второй формы)
  legal_data: {
    legal_name: {
      type: String,
      required: true,
      trim: true // Название юридического лица
    },
    siret_number: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^\d{14}$/.test(v); // SIRET должен быть 14 цифр
        },
        message: 'SIRET номер должен содержать 14 цифр'
      }
    },
    legal_form: {
      type: String,
      required: true,
      enum: ['SASU', 'SARL', 'SAS', 'EURL', 'Auto-entrepreneur', 'Autre']
    },
    tva_number: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Опциональное поле
          return /^FR\d{11}$/.test(v); // Французский формат TVA
        },
        message: 'TVA номер должен быть в формате FR12345678901'
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
      trim: true // ФИО директора/представителя
    },
    iban: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^FR\d{12}\w{11}\d{2}$/.test(v.replace(/\s/g, '')); // Французский IBAN
        },
        message: 'Некорректный формат французского IBAN'
      }
    },
    bic: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[A-Z]{4}FR[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v); // BIC код
        },
        message: 'Некорректный формат BIC кода'
      }
    },
    legal_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Некорректный формат email'
      }
    },
    legal_phone: {
      type: String,
      required: true,
      trim: true
    }
  },
  
  // Документы (файлы)
  documents: {
    business_license_url: {
      type: String // Лицензия на ведение деятельности
    },
    insurance_url: {
      type: String // Страховка
    },
    id_card_url: {
      type: String // Паспорт владельца
    },
    kbis_extract_url: {
      type: String // Выписка из реестра Kbis
    },
    other_documents: [{
      name: String,
      url: String,
      uploaded_at: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Проверка данных админом
  verification: {
    // Проверка юридических данных
    legal_data_verified: {
      type: Boolean,
      default: false
    },
    legal_verification_notes: {
      type: String,
      trim: true
    },
    
    // Проверка адреса
    address_verified: {
      type: Boolean,
      default: false
    },
    address_verification_notes: {
      type: String,
      trim: true
    },
    
    // Проверка документов
    documents_verified: {
      type: Boolean,
      default: false
    },
    documents_verification_notes: {
      type: String,
      trim: true
    },
    
    // Общий статус проверки
    overall_verification_status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending'
    }
  },
  
  // Дублирование данных (для предотвращения повторных заявок)
  duplicate_check: {
    siret_exists: {
      type: Boolean,
      default: false
    },
    address_exists: {
      type: Boolean,
      default: false
    },
    phone_exists: {
      type: Boolean,
      default: false
    },
    email_exists: {
      type: Boolean,
      default: false
    }
  },
  
  // Метаданные
  source: {
    type: String,
    enum: ['web', 'mobile_app', 'admin_created'],
    default: 'web'
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

// Индексы для оптимизации
partnerRequestSchema.index({ user_id: 1 });
partnerRequestSchema.index({ status: 1, submitted_at: -1 });
partnerRequestSchema.index({ 'business_data.category': 1 });
partnerRequestSchema.index({ 'legal_data.siret_number': 1 });
partnerRequestSchema.index({ 'review_info.reviewed_by': 1 });
partnerRequestSchema.index({ submitted_at: -1 });

// Составной индекс для админской панели
partnerRequestSchema.index({ 
  status: 1, 
  'verification.overall_verification_status': 1,
  submitted_at: -1 
});

// Геоиндекс для поиска по местоположению
partnerRequestSchema.index({ 'business_data.location': '2dsphere' });

// Методы экземпляра

// Одобрение заявки
partnerRequestSchema.methods.approve = function(adminId, adminNotes = '') {
  this.status = 'approved';
  this.review_info.reviewed_by = adminId;
  this.review_info.reviewed_at = new Date();
  this.review_info.admin_notes = adminNotes;
  this.verification.overall_verification_status = 'completed';
  
  return this.save();
};

// Отклонение заявки
partnerRequestSchema.methods.reject = function(adminId, reason, adminNotes = '') {
  this.status = 'rejected';
  this.review_info.reviewed_by = adminId;
  this.review_info.reviewed_at = new Date();
  this.review_info.rejection_reason = reason;
  this.review_info.admin_notes = adminNotes;
  this.verification.overall_verification_status = 'failed';
  
  return this.save();
};

// Обновление статуса проверки
partnerRequestSchema.methods.updateVerificationStatus = function(section, verified, notes = '') {
  switch(section) {
    case 'legal':
      this.verification.legal_data_verified = verified;
      this.verification.legal_verification_notes = notes;
      break;
    case 'address':
      this.verification.address_verified = verified;
      this.verification.address_verification_notes = notes;
      break;
    case 'documents':
      this.verification.documents_verified = verified;
      this.verification.documents_verification_notes = notes;
      break;
  }
  
  // Проверяем общий статус
  if (this.verification.legal_data_verified && 
      this.verification.address_verified && 
      this.verification.documents_verified) {
    this.verification.overall_verification_status = 'completed';
  } else if (!this.verification.legal_data_verified || 
             !this.verification.address_verified || 
             !this.verification.documents_verified) {
    this.verification.overall_verification_status = 'in_progress';
  }
  
  return this.save();
};

// Добавление документа
partnerRequestSchema.methods.addDocument = function(name, url) {
  this.documents.other_documents.push({
    name,
    url,
    uploaded_at: new Date()
  });
  
  return this.save();
};

// Проверка на дублирование
partnerRequestSchema.methods.checkForDuplicates = async function() {
  const existingRequests = await this.constructor.find({
    _id: { $ne: this._id },
    status: { $in: ['pending', 'approved'] },
    $or: [
      { 'legal_data.siret_number': this.legal_data.siret_number },
      { 'business_data.address': this.business_data.address },
      { 'business_data.phone': this.business_data.phone },
      { 'legal_data.legal_email': this.legal_data.legal_email }
    ]
  });
  
  this.duplicate_check.siret_exists = existingRequests.some(req => 
    req.legal_data.siret_number === this.legal_data.siret_number
  );
  this.duplicate_check.address_exists = existingRequests.some(req => 
    req.business_data.address === this.business_data.address
  );
  this.duplicate_check.phone_exists = existingRequests.some(req => 
    req.business_data.phone === this.business_data.phone
  );
  this.duplicate_check.email_exists = existingRequests.some(req => 
    req.legal_data.legal_email === this.legal_data.legal_email
  );
  
  return this.save();
};

// Создание PartnerProfile после одобрения
partnerRequestSchema.methods.createPartnerProfile = async function() {
  if (this.status !== 'approved') {
    throw new Error('Заявка должна быть одобрена');
  }
  
  const PartnerProfile = mongoose.model('PartnerProfile');
  
  const partnerProfile = new PartnerProfile({
    user_id: this.user_id,
    business_name: this.business_data.business_name,
    description: this.business_data.description,
    address: this.business_data.address,
    location: this.business_data.location,
    category: this.business_data.category,
    phone: this.business_data.phone,
    owner_name: this.business_data.owner_name,
    owner_surname: this.business_data.owner_surname,
    cover_image_url: this.business_data.cover_image_url,
    legal_info: this.legal_data,
    is_approved: true,
    approved_by: this.review_info.reviewed_by,
    approved_at: this.review_info.reviewed_at
  });
  
  return partnerProfile.save();
};

// Статические методы

// Поиск заявок по статусу
partnerRequestSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ submitted_at: -1 });
};

// Поиск заявок ожидающих рассмотрения
partnerRequestSchema.statics.findPending = function() {
  return this.find({ status: 'pending' }).sort({ submitted_at: 1 });
};

// Поиск заявок в процессе проверки
partnerRequestSchema.statics.findInProgress = function() {
  return this.find({ 
    status: 'pending',
    'verification.overall_verification_status': 'in_progress'
  }).sort({ submitted_at: 1 });
};

// Поиск заявок по категории
partnerRequestSchema.statics.findByCategory = function(category) {
  return this.find({ 
    'business_data.category': category 
  }).sort({ submitted_at: -1 });
};

// Поиск заявок админа
partnerRequestSchema.statics.findByAdmin = function(adminId) {
  return this.find({ 
    'review_info.reviewed_by': adminId 
  }).sort({ 'review_info.reviewed_at': -1 });
};

// Статистика заявок
partnerRequestSchema.statics.getStats = function(period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  return this.aggregate([
    {
      $match: {
        submitted_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        by_category: {
          $push: '$business_data.category'
        }
      }
    }
  ]);
};

// Поиск просроченных заявок (не рассмотренных более 3 дней)
partnerRequestSchema.statics.findOverdue = function(daysOld = 3) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.find({
    status: 'pending',
    submitted_at: { $lt: cutoffDate }
  }).sort({ submitted_at: 1 });
};

module.exports = mongoose.model('PartnerRequest', partnerRequestSchema);