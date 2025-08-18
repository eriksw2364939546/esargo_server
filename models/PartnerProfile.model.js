// models/PartnerProfile.model.js (ЧИСТАЯ МОДЕЛЬ БЕЗ ЛИШНЕГО КОДА)
import mongoose from 'mongoose';

const partnerProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
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
  
  // 🔐 ЗАШИФРОВАННЫЕ ДАННЫЕ
  address: {
    type: String, // Зашифрованный адрес
    required: true
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  
  phone: {
    type: String, // Зашифрованный телефон
    required: true
  },
  
  email: {
    type: String, // Зашифрованный email
    required: true
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
  
  floor_unit: {
    type: String, // Зашифрованный этаж/люкс
    trim: true
  },
  
  cover_image_url: {
    type: String
  },
  
  // График работы
  working_hours: {
    monday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    tuesday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    wednesday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    thursday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    friday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    saturday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '10:00' },
      close_time: { type: String, default: '22:00' }
    },
    sunday: {
      is_open: { type: Boolean, default: false },
      open_time: { type: String, default: null },
      close_time: { type: String, default: null }
    }
  },
  
  // Рейтинги и отзывы
  ratings: {
    avg_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    total_ratings: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Статус партнера
  is_approved: {
    type: Boolean,
    default: false,
    index: true
  },
  
  is_active: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // 🆕 ДОБАВЛЕНО: Статус одобрения (для отслеживания этапов)
  approval_status: {
    type: String,
    enum: [
      'awaiting_legal_info',    // Ждет юридических данных
      'under_review',           // Юридические данные на проверке  
      'approved',               // Полностью одобрен
      'rejected',               // Отклонен
      'suspended'               // Приостановлен
    ],
    default: 'awaiting_legal_info',
    index: true
  },
  
  // 🆕 НОВОЕ: Статус контента (для этапа 4-6)
  content_status: {
    type: String,
    enum: [
      'awaiting_content',       // Ждет добавления контента (меню, фото)
      'content_added',          // Контент добавлен, готов к модерации
      'pending_review',         // Контент на модерации
      'approved',               // Контент одобрен
      'needs_revision',         // Требует доработки
      'rejected'                // Контент отклонен
    ],
    default: 'awaiting_content',
    index: true
  },
  
  // 🆕 НОВОЕ: Публичная видимость (финальный этап)
  is_public: {
    type: Boolean,
    default: false,
    index: true  // Важно для поиска публичных партнеров
  },
  
  // 🆕 НОВОЕ: Дата публикации
  published_at: {
    type: Date,
    index: true
  },
  
  // Информация об одобрении
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  
  approved_at: {
    type: Date
  },
  
  rejection_reason: {
    type: String,
    trim: true
  },
  
  // Юридическая информация (ссылка)
  legal_info: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerLegalInfo'
  },
  
  // Статистика партнера
  stats: {
    total_orders: { type: Number, default: 0 },
    completed_orders: { type: Number, default: 0 },
    cancelled_orders: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 },
    avg_order_value: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
partnerProfileSchema.index({ location: '2dsphere' });
partnerProfileSchema.index({ category: 1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ 'ratings.avg_rating': -1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ approval_status: 1, createdAt: -1 });

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================
partnerProfileSchema.virtual('owner_full_name').get(function() {
  return `${this.owner_name} ${this.owner_surname}`;
});

partnerProfileSchema.virtual('is_currently_open').get(function() {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  
  const todaySchedule = this.working_hours[currentDay];
  
  if (!todaySchedule.is_open) {
    return false;
  }
  
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================
partnerProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_ratings;
  const currentAvg = this.ratings.avg_rating;
  
  this.ratings.total_ratings = totalRatings + 1;
  this.ratings.avg_rating = ((currentAvg * totalRatings) + newRating) / this.ratings.total_ratings;
  
  return this.save();
};

partnerProfileSchema.methods.approve = function(adminId) {
  this.is_approved = true;
  this.is_active = true;
  this.approval_status = 'approved';
  this.approved_by = adminId;
  this.approved_at = new Date();
  this.rejection_reason = undefined;
  
  return this.save();
};

partnerProfileSchema.methods.reject = function(reason) {
  this.is_approved = false;
  this.is_active = false;
  this.approval_status = 'rejected';
  this.rejection_reason = reason;
  this.approved_by = undefined;
  this.approved_at = undefined;
  
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================
partnerProfileSchema.statics.findNearby = function(lat, lng, radiusKm = 5, category = null) {
  const query = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: radiusKm * 1000 // конвертируем км в метры
      }
    },
    is_approved: true,
    is_active: true
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query).sort({ 'ratings.avg_rating': -1 });
};

partnerProfileSchema.statics.findApproved = function() {
  return this.find({ 
    is_approved: true, 
    is_active: true 
  }).sort({ 'ratings.avg_rating': -1 });
};

partnerProfileSchema.statics.findPendingApproval = function() {
  return this.find({ 
    $or: [
      { approval_status: 'awaiting_legal_info' },
      { approval_status: 'under_review' }
    ]
  }).sort({ createdAt: 1 });
};

// ================ НАСТРОЙКИ JSON ================
partnerProfileSchema.set('toJSON', { virtuals: true });
partnerProfileSchema.set('toObject', { virtuals: true });

// ================ ЭКСПОРТ ================
export default mongoose.model('PartnerProfile', partnerProfileSchema);