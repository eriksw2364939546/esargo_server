// models/InitialPartnerRequest.model.js - ИСПРАВЛЕННАЯ ВАЛИДАЦИЯ 🎯
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
      type: String, // 🔐 ЗАШИФРОВАН (но копия есть в User открытая)
      required: true
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
  
  // 🎯 СТАТУС ЗАЯВКИ
  status: {
    type: String,
    enum: [
      'pending_documents',    // ЭТАП 1: Ждет подачи документов партнером
      'pending',             // ЭТАП 2: Ждет одобрения админом
      'approved',            // ЭТАП 3: Одобрено, можно подавать юр.данные
      'under_review',        // ЭТАП 4: Юр.данные на проверке
      'legal_approved',      // ЭТАП 5: Юр.данные одобрены, можно создать профиль
      'content_review',      // ЭТАП 6: Контент на модерации
      'completed',           // ЭТАП 7: ВСЁ ГОТОВО!
      'rejected'             // Отклонено на любом этапе
    ],
    default: 'pending_documents',
    index: true
  },
  
  // Workflow информация
  workflow_stage: {
    type: Number,
    default: 1,
    min: 1,
    max: 7
  },
  
  // Временные метки
  submitted_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  
  // Геолокация на уровне заявки
  location: {
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    address: String
  },
  
  // Информация о рассмотрении
  review_info: {
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reviewed_at: Date,
    rejection_reason: String,
    admin_notes: String,
    approved_at: Date,
    completed_at: Date
  },
  
  // Безопасность и метаданные
  security_info: {
    registration_ip: String,
    user_agent: String,
    email_verified: {
      type: Boolean,
      default: false
    },
    phone_verified: {
      type: Boolean,
      default: false
    }
  },
  
  // Маркетинговые согласия
  marketing_consent: {
    whatsapp: {
      type: Boolean,
      default: false
    },
    email_newsletter: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
initialPartnerRequestSchema.index({ user_id: 1 });
initialPartnerRequestSchema.index({ status: 1, submitted_at: -1 });
initialPartnerRequestSchema.index({ 'business_data.category': 1 });
initialPartnerRequestSchema.index({ 'business_data.location': '2dsphere' });
initialPartnerRequestSchema.index({ 'review_info.reviewed_by': 1 });
initialPartnerRequestSchema.index({ workflow_stage: 1 });

// Составной индекс для админской панели
initialPartnerRequestSchema.index({
  status: 1,
  'business_data.category': 1,
  submitted_at: -1
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * Обновление статуса с автоматическим workflow_stage
 */
initialPartnerRequestSchema.methods.updateStatus = function(newStatus, adminId = null, notes = '') {
  // Маппинг статус -> этап
  const statusToStage = {
    'pending_documents': 1,
    'pending': 2,
    'approved': 3,
    'under_review': 4,
    'legal_approved': 5,
    'content_review': 6,
    'completed': 7,
    'rejected': this.workflow_stage // Остается на текущем этапе
  };
  
  this.status = newStatus;
  this.workflow_stage = statusToStage[newStatus];
  this.updated_at = new Date();
  
  // Обновляем review_info
  if (adminId) {
    this.review_info.reviewed_by = adminId;
    this.review_info.reviewed_at = new Date();
    
    if (newStatus === 'approved') {
      this.review_info.approved_at = new Date();
    } else if (newStatus === 'completed') {
      this.review_info.completed_at = new Date();
    }
  }
  
  if (notes) {
    this.review_info.admin_notes = notes;
  }
  
  return this.save();
};

/**
 * Получение следующего действия для workflow
 */
initialPartnerRequestSchema.methods.getNextAction = function() {
  const actions = {
    'pending_documents': {
      action: 'submit_documents',
      description: 'Подача документов для рассмотрения',
      actor: 'partner'
    },
    'pending': {
      action: 'admin_review',
      description: 'Рассмотрение заявки администратором',
      actor: 'admin'
    },
    'approved': {
      action: 'submit_legal_info',
      description: 'Подача юридических документов',
      actor: 'partner'
    },
    'under_review': {
      action: 'admin_legal_review',
      description: 'Проверка юридических документов',
      actor: 'admin'
    },
    'legal_approved': {
      action: 'create_profile',
      description: 'Создание профиля партнера',
      actor: 'system'
    },
    'content_review': {
      action: 'admin_content_review',
      description: 'Модерация контента и публикация',
      actor: 'admin'
    },
    'completed': {
      action: 'manage_business',
      description: 'Управление бизнесом и товарами',
      actor: 'partner'
    },
    'rejected': {
      action: 'appeal_or_resubmit',
      description: 'Обжалование или повторная подача',
      actor: 'partner'
    }
  };
  
  return actions[this.status] || null;
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * Поиск заявок на рассмотрении
 */
initialPartnerRequestSchema.statics.findPending = function() {
  return this.find({ 
    status: 'pending' // На рассмотрении у админа
  }).sort({ submitted_at: 1 });
};

/**
 * Поиск заявок с документами на проверке
 */
initialPartnerRequestSchema.statics.findUnderReview = function() {
  return this.find({ 
    status: 'under_review' // Юридические документы на проверке
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

// ✅ ИСПРАВЛЕНО: Убрали проблемную валидацию email
// Поскольку email зашифрован, валидация должна происходить в контроллере до шифрования
initialPartnerRequestSchema.pre('save', function(next) {
  // Валидация координат (если они есть)
  if (this.business_data?.location?.coordinates) {
    const [lng, lat] = this.business_data.location.coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return next(new Error('Неверные координаты'));
    }
  }
  
  // Обновляем updated_at при любом сохранении
  this.updated_at = new Date();
  
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
      delete ret.personal_data.email;
    }
    return ret;
  }
});

initialPartnerRequestSchema.set('toObject', { virtuals: true });

// ================ ЭКСПОРТ ================
export default mongoose.model('InitialPartnerRequest', initialPartnerRequestSchema);