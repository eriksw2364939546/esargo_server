// models/PartnerProfile.model.js (исправленный - ES6 modules)
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
  
  // Зашифрованные данные
  address: {
    type: String,
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
    type: String,
    required: true
  },
  
  email: {
    type: String,
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
    type: String,
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
  
  // Статус одобрения
  is_approved: {
    type: Boolean,
    default: false,
    index: true
  },
  
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  
  approved_at: {
    type: Date
  },
  
  rejection_reason: {
    type: String
  },
  
  // Статус активности
  is_active: {
    type: Boolean,
    default: true
  },
  
  // Рейтинг и статистика
  ratings: {
    avg_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    total_ratings: {
      type: Number,
      default: 0
    }
  },
  
  business_stats: {
    total_orders: {
      type: Number,
      default: 0
    },
    total_revenue: {
      type: Number,
      default: 0
    },
    avg_preparation_time: {
      type: Number,
      default: 30
    }
  },
  
  // Настройки доставки
  delivery_settings: {
    min_order_amount: {
      type: Number,
      default: 15,
      min: 0
    },
    delivery_radius_km: {
      type: Number,
      default: 15,
      min: 1,
      max: 50
    },
    delivery_fee: {
      type: Number,
      default: 3,
      min: 0
    }
  }
}, {
  timestamps: true
});

// Индекс для поиска по user_id
partnerProfileSchema.index({ user_id: 1 });

// Индекс для поиска по категории
partnerProfileSchema.index({ category: 1 });

// Индекс для поиска по статусу
partnerProfileSchema.index({ is_approved: 1, is_active: 1 });

// Индекс для геопоиска
partnerProfileSchema.index({ location: '2dsphere' });

// Индекс для текстового поиска
partnerProfileSchema.index({
  business_name: 'text',
  description: 'text'
});

// Индекс для рейтинга
partnerProfileSchema.index({ 'ratings.avg_rating': -1 });

// Виртуальное поле для полного имени владельца
partnerProfileSchema.virtual('owner_full_name').get(function() {
  return `${this.owner_name} ${this.owner_surname}`;
});

// Метод для проверки работает ли сейчас
partnerProfileSchema.methods.isOpenNow = function() {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  
  const todaySchedule = this.working_hours[currentDay];
  
  if (!todaySchedule.is_open) {
    return false;
  }
  
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
};

// Метод для обновления рейтинга
partnerProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_ratings;
  const currentAvg = this.ratings.avg_rating;
  
  this.ratings.total_ratings = totalRatings + 1;
  this.ratings.avg_rating = ((currentAvg * totalRatings) + newRating) / this.ratings.total_ratings;
  
  return this.save();
};

// Метод для одобрения партнера
partnerProfileSchema.methods.approve = function(adminId) {
  this.is_approved = true;
  this.approved_by = adminId;
  this.approved_at = new Date();
  this.rejection_reason = undefined;
  
  return this.save();
};

// Метод для отклонения партнера
partnerProfileSchema.methods.reject = function(reason) {
  this.is_approved = false;
  this.rejection_reason = reason;
  this.approved_by = undefined;
  this.approved_at = undefined;
  
  return this.save();
};

// Настройка виртуальных полей в JSON
partnerProfileSchema.set('toJSON', { virtuals: true });
partnerProfileSchema.set('toObject', { virtuals: true });

// 🆕 ИСПРАВЛЕНО: ES6 export вместо module.exports
export default mongoose.model('PartnerProfile', partnerProfileSchema);