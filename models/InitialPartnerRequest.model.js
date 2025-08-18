// models/InitialPartnerRequest.model.js - ИСПРАВЛЕННАЯ МОДЕЛЬ 🎯
import mongoose from 'mongoose';

const initialPartnerRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // 🔐 ПЕРСОНАЛЬНЫЕ ДАННЫЕ (частично зашифрованы)
  personal_data: {
    first_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    phone: {
      type: String, // 🔐 ЗАШИФРОВАН
      required: true
    },
    email: {
      type: String, // ✅ Открытый (копия из User)
      required: true,
      lowercase: true,
      trim: true
    }
  },
  
  // 🔐 БИЗНЕС ДАННЫЕ (микс открытого и зашифрованного)
  business_data: {
    // ✅ ОТКРЫТЫЕ ДАННЫЕ (для каталога и фильтров)
    business_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    brand_name: {
      type: String,
      trim: true,
      maxlength: 100
    },
    category: {
      type: String,
      required: true,
      enum: ['restaurant', 'store'],
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    
    // 🔐 ЗАШИФРОВАННЫЕ ДАННЫЕ (адреса и контакты)
    address: {
      type: String, // 🔐 ЗАШИФРОВАН
      required: true
    },
    phone: {
      type: String, // 🔐 ЗАШИФРОВАН
      required: true
    },
    email: {
      type: String, // 🔐 ЗАШИФРОВАН (копия для безопасности)
      required: true
    },
    floor_unit: {
      type: String, // 🔐 ЗАШИФРОВАН
      trim: true
    },
    
    // ✅ ГЕОЛОКАЦИЯ (неточная, можно открыто)
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    
    // ✅ ВЛАДЕЛЕЦ (имена не критичны)
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
    
    // Дополнительные данные
    cover_image_url: {
      type: String
    }
  },
  
  // 🎯 СТАТУС ЗАЯВКИ (ИСПРАВЛЕННЫЙ!)
  status: {
    type: String,
    enum: [
      'pending',           // ЭТАП 1: Ждет одобрения админом
      'approved',          // ЭТАП 2: Одобрено, можно подавать юр.данные
      'under_review',      // ЭТАП 3: Юр.данные на проверке
      'legal_approved',    // 🆕 ЭТАП 4: Юр.данные одобрены, PartnerProfile создан
      'content_review',    // ЭТАП 5: Контент на модерации
      'completed',         // ЭТАП 6: ВСЁ ГОТОВО! Публичный доступ
      'rejected'           // Отклонено на любом этапе
    ],
    default: 'pending',
    index: true
  },
  
  // Информация о рассмотрении заявки
  review_info: {
    // Первичное рассмотрение (ЭТАП 1→2)
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reviewed_at: {
      type: Date
    },
    decision: {
      type: String,
      enum: ['approved', 'rejected']
    },
    admin_notes: {
      type: String,
      trim: true
    },
    rejection_reason: {
      type: String,
      trim: true
    },
    
    // Одобрение юр.данных (ЭТАП 3→4)
    legal_approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    legal_approved_at: {
      type: Date
    },
    legal_notes: {
      type: String,
      trim: true
    },
    
    // Финальное завершение (ЭТАП 5→6)
    completed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    completed_at: {
      type: Date
    },
    completion_notes: {
      type: String,
      trim: true
    }
  },
  
  // Метаданные регистрации
  registration_info: {
    registration_ip: {
      type: String,
      index: true
    },
    user_agent: {
      type: String
    },
    whatsapp_consent: {
      type: Boolean,
      default: false
    },
    consent_date: {
      type: Date,
      default: Date.now
    }
  },
  
  // Даты
  submitted_at: {
    type: Date,
    default: Date.now,
    index: true
  }
  
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
initialPartnerRequestSchema.index({ 'business_data.category': 1, status: 1 });
initialPartnerRequestSchema.index({ 'business_data.location': '2dsphere' });
initialPartnerRequestSchema.index({ status: 1, submitted_at: 1 });

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================
initialPartnerRequestSchema.virtual('owner_full_name').get(function() {
  return `${this.business_data.owner_name} ${this.business_data.owner_surname}`;
});

initialPartnerRequestSchema.virtual('days_pending').get(function() {
  const now = new Date();
  const submitted = this.submitted_at;
  return Math.floor((now - submitted) / (1000 * 60 * 60 * 24));
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * 🎯 ЭТАП 1→2: Одобрение первичной заявки (переход к юр.данным)
 */
initialPartnerRequestSchema.methods.approve = function(adminId, notes = '') {
  this.status = 'approved';
  this.review_info = {
    ...this.review_info,
    reviewed_by: adminId,
    reviewed_at: new Date(),
    decision: 'approved',
    admin_notes: notes
  };
  
  return this.save();
};

/**
 * ❌ Отклонение заявки
 */
initialPartnerRequestSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.review_info = {
    ...this.review_info,
    reviewed_by: adminId,
    reviewed_at: new Date(),
    decision: 'rejected',
    rejection_reason: reason
  };
  
  return this.save();
};

/**
 * 🆕 ЭТАП 3→4: Перевод в статус "юр.данные одобрены"
 * Вызывается после одобрения PartnerLegalInfo и создания PartnerProfile
 */
initialPartnerRequestSchema.methods.approveLegal = function(adminId, notes = '') {
  this.status = 'legal_approved';
  if (!this.review_info) {
    this.review_info = {};
  }
  this.review_info.legal_approved_by = adminId;
  this.review_info.legal_approved_at = new Date();
  this.review_info.legal_notes = notes;
  
  return this.save();
};

/**
 * 🆕 ЭТАП 4→5: Перевод в статус "контент на модерации"
 * Вызывается когда партнер отправляет контент на проверку
 */
initialPartnerRequestSchema.methods.submitForContentReview = function() {
  this.status = 'content_review';
  return this.save();
};

/**
 * 🆕 ЭТАП 5→6: Финальное завершение (публичный доступ)
 * Вызывается после одобрения контента админом
 */
initialPartnerRequestSchema.methods.complete = function(adminId, notes = '') {
  this.status = 'completed';
  if (!this.review_info) {
    this.review_info = {};
  }
  this.review_info.completed_by = adminId;
  this.review_info.completed_at = new Date();
  this.review_info.completion_notes = notes;
  
  return this.save();
};

/**
 * 🔄 Возврат к предыдущему статусу (если нужно исправить ошибку)
 */
initialPartnerRequestSchema.methods.revertStatus = function(newStatus, reason) {
  const allowedReverts = {
    'approved': ['pending'],
    'under_review': ['approved'],
    'legal_approved': ['under_review'],
    'content_review': ['legal_approved'],
    'completed': ['content_review']
  };
  
  if (!allowedReverts[this.status] || !allowedReverts[this.status].includes(newStatus)) {
    throw new Error(`Нельзя изменить статус с '${this.status}' на '${newStatus}'`);
  }
  
  this.status = newStatus;
  this.review_info.revert_reason = reason;
  this.review_info.reverted_at = new Date();
  
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * Поиск заявок по статусу
 */
initialPartnerRequestSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ submitted_at: 1 });
};

/**
 * Поиск заявок ожидающих одобрения админом
 */
initialPartnerRequestSchema.statics.findPendingApproval = function() {
  return this.find({ 
    status: { $in: ['pending', 'under_review', 'content_review'] }
  }).sort({ submitted_at: 1 });
};

/**
 * 🆕 Поиск заявок готовых для подачи юр.данных
 */
initialPartnerRequestSchema.statics.findReadyForLegalInfo = function() {
  return this.find({ 
    status: 'approved' // Одобрены, но еще нет юр.данных
  }).sort({ submitted_at: 1 });
};

/**
 * 🆕 Поиск заявок с одобренными юр.данными (готовые для контента)
 */
initialPartnerRequestSchema.statics.findWithApprovedLegal = function() {
  return this.find({ 
    status: 'legal_approved' // Юр.данные одобрены, можно наполнять контент
  }).sort({ submitted_at: 1 });
};

/**
 * Поиск заявок с контентом на модерации
 */
initialPartnerRequestSchema.statics.findContentReview = function() {
  return this.find({ 
    status: 'content_review' // Контент на модерации
  }).sort({ submitted_at: 1 });
};

/**
 * Поиск завершенных заявок (публичные партнеры)
 */
initialPartnerRequestSchema.statics.findCompleted = function() {
  return this.find({ 
    status: 'completed' // Опубликованные партнеры
  }).sort({ 'review_info.completed_at': -1 });
};

/**
 * Статистика по заявкам
 */
initialPartnerRequestSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avg_days_pending: { 
          $avg: { 
            $divide: [
              { $subtract: [new Date(), '$submitted_at'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      }
    }
  ]);
  
  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      count: stat.count,
      avg_days_pending: Math.round(stat.avg_days_pending || 0)
    };
    return acc;
  }, {});
};

/**
 * Поиск заявок по категории бизнеса
 */
initialPartnerRequestSchema.statics.findByCategory = function(category) {
  return this.find({ 
    'business_data.category': category 
  }).sort({ submitted_at: -1 });
};

/**
 * Поиск просроченных заявок (долго на рассмотрении)
 */
initialPartnerRequestSchema.statics.findOverdue = function(days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    status: { $in: ['pending', 'under_review', 'content_review'] },
    submitted_at: { $lt: cutoffDate }
  }).sort({ submitted_at: 1 });
};

// ================ MIDDLEWARE ================

// Валидация перед сохранением
initialPartnerRequestSchema.pre('save', function(next) {
  // Валидация email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(this.personal_data.email)) {
    return next(new Error('Неверный формат email'));
  }
  
  // Валидация координат
  const [lng, lat] = this.business_data.location.coordinates;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return next(new Error('Неверные координаты'));
  }
  
  next();
});

// ================ НАСТРОЙКИ JSON ================
initialPartnerRequestSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Не возвращаем зашифрованные данные в обычном JSON
    if (ret.business_data) {
      delete ret.business_data.address;
      delete ret.business_data.phone;
      delete ret.business_data.email;
      delete ret.business_data.floor_unit;
    }
    if (ret.personal_data) {
      delete ret.personal_data.phone;
    }
    return ret;
  }
});

initialPartnerRequestSchema.set('toObject', { virtuals: true });

// ================ ЭКСПОРТ ================
export default mongoose.model('InitialPartnerRequest', initialPartnerRequestSchema);