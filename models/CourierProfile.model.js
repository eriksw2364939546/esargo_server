// models/CourierProfile.model.js (исправленный - ES6 modules)
import mongoose from 'mongoose';

const courierProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Личная информация
  first_name: {
    type: String,
    required: true,
    trim: true
  },
  last_name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  avatar_url: {
    type: String
  },
  
  // Тип транспорта (из макета регистрации)
  vehicle_type: {
    type: String,
    required: true,
    enum: ['bike', 'motorbike', 'car']
  },
  
  // Геолокация курьера (обновляется в реальном времени)
  location: {
    lat: {
      type: Number
    },
    lng: {
      type: Number
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  
  // Документы для верификации
  documents: {
    id_card_url: {
      type: String,
      required: true
    },
    driver_license_url: {
      type: String // Требуется для motorbike и car
    },
    insurance_url: {
      type: String // Требуется для motorbike и car
    },
    vehicle_registration_url: {
      type: String // Для car
    }
  },
  
  // Статусы работы
  is_available: {
    type: Boolean,
    default: false // On-e/Off-e переключатель
  },
  is_online: {
    type: Boolean,
    default: false // В сети сейчас
  },
  is_approved: {
    type: Boolean,
    default: false // Одобрен админом
  },
  
  // Радиус работы в км
  work_radius: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  
  // Статус заявки
  application_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'blocked'],
    default: 'pending'
  },
  rejection_reason: {
    type: String
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  approved_at: {
    type: Date
  },
  
  // Статистика и заработок
  earnings: {
    total_earned: {
      type: Number,
      default: 0
    },
    weekly_earned: {
      type: Number,
      default: 0
    },
    monthly_earned: {
      type: Number,
      default: 0
    },
    completed_orders: {
      type: Number,
      default: 0
    },
    cancelled_orders: {
      type: Number,
      default: 0
    }
  },
  
  // Рейтинг курьера
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
  
  // Статистика работы
  work_stats: {
    total_distance_km: {
      type: Number,
      default: 0
    },
    avg_delivery_time: {
      type: Number,
      default: 0 // в минутах
    },
    best_delivery_time: {
      type: Number,
      default: 0 // в минутах
    },
    total_working_hours: {
      type: Number,
      default: 0
    }
  },
  
  // Настройки уведомлений
  notifications: {
    new_orders: {
      type: Boolean,
      default: true
    },
    order_updates: {
      type: Boolean,
      default: true
    },
    payment_received: {
      type: Boolean,
      default: true
    }
  },
  
  // Информация о последней активности
  last_activity: {
    type: Date,
    default: Date.now
  },
  last_order_at: {
    type: Date
  },
  
  // Заблокирован ли курьер
  is_blocked: {
    type: Boolean,
    default: false
  },
  blocked_reason: {
    type: String
  },
  blocked_until: {
    type: Date
  }
}, {
  timestamps: true
});

// Индекс для поиска по user_id
courierProfileSchema.index({ user_id: 1 });

// Индекс для поиска доступных курьеров
courierProfileSchema.index({ 
  is_available: 1, 
  is_approved: 1, 
  is_online: 1,
  is_blocked: 1 
});

// Геоиндекс для поиска курьеров поблизости
courierProfileSchema.index({ location: '2dsphere' });

// Индекс для статуса заявки
courierProfileSchema.index({ application_status: 1 });

// Индекс для рейтинга
courierProfileSchema.index({ 'ratings.avg_rating': -1 });

// Индекс для последней активности
courierProfileSchema.index({ last_activity: -1 });

// Виртуальное поле для полного имени
courierProfileSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.last_name}`;
});

// Метод для обновления геолокации
courierProfileSchema.methods.updateLocation = function(lat, lng) {
  this.location.lat = lat;
  this.location.lng = lng;
  this.location.updated_at = new Date();
  this.last_activity = new Date();
  
  return this.save();
};

// Метод для переключения статуса доступности (On-e/Off-e)
courierProfileSchema.methods.toggleAvailability = function() {
  this.is_available = !this.is_available;
  this.last_activity = new Date();
  
  // Если выключил доступность, то и онлайн статус тоже
  if (!this.is_available) {
    this.is_online = false;
  }
  
  return this.save();
};

// Метод для установки онлайн статуса
courierProfileSchema.methods.setOnlineStatus = function(isOnline) {
  this.is_online = isOnline;
  this.last_activity = new Date();
  
  // Если вышел из онлайна, то и доступность отключается
  if (!isOnline) {
    this.is_available = false;
  }
  
  return this.save();
};

// Метод для одобрения курьера
courierProfileSchema.methods.approve = function(adminId) {
  this.is_approved = true;
  this.application_status = 'approved';
  this.approved_by = adminId;
  this.approved_at = new Date();
  this.rejection_reason = undefined;
  
  return this.save();
};

// Метод для отклонения курьера
courierProfileSchema.methods.reject = function(reason) {
  this.is_approved = false;
  this.application_status = 'rejected';
  this.rejection_reason = reason;
  this.approved_by = undefined;
  this.approved_at = undefined;
  
  return this.save();
};

// Метод для блокировки курьера
courierProfileSchema.methods.block = function(reason, duration) {
  this.is_blocked = true;
  this.blocked_reason = reason;
  this.is_available = false;
  this.is_online = false;
  
  if (duration) {
    this.blocked_until = new Date(Date.now() + duration);
  }
  
  return this.save();
};

// Метод для разблокировки курьера
courierProfileSchema.methods.unblock = function() {
  this.is_blocked = false;
  this.blocked_reason = undefined;
  this.blocked_until = undefined;
  
  return this.save();
};

// Метод для обновления рейтинга
courierProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_ratings;
  const currentAvg = this.ratings.avg_rating;
  
  this.ratings.total_ratings = totalRatings + 1;
  this.ratings.avg_rating = ((currentAvg * totalRatings) + newRating) / this.ratings.total_ratings;
  
  return this.save();
};

// Метод для добавления заработка
courierProfileSchema.methods.addEarnings = function(amount) {
  this.earnings.total_earned += amount;
  this.earnings.weekly_earned += amount;
  this.earnings.monthly_earned += amount;
  this.earnings.completed_orders += 1;
  this.last_order_at = new Date();
  
  return this.save();
};

// Статический метод для поиска доступных курьеров поблизости
courierProfileSchema.statics.findAvailableNearby = function(lat, lng, radiusKm = 5) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: radiusKm * 1000 // конвертируем км в метры
      }
    },
    is_available: true,
    is_approved: true,
    is_online: true,
    is_blocked: false
  }).sort({ 'ratings.avg_rating': -1 });
};

// Настройка виртуальных полей в JSON
courierProfileSchema.set('toJSON', { virtuals: true });
courierProfileSchema.set('toObject', { virtuals: true });

// 🆕 ИСПРАВЛЕНО: ES6 export вместо module.exports
export default mongoose.model('CourierProfile', courierProfileSchema);