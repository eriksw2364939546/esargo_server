// models/CourierProfile.model.js - ПОЛНАЯ МОДЕЛЬ КУРЬЕРА ESARGO
import mongoose from 'mongoose';

const courierProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // ОСНОВНАЯ ИНФОРМАЦИЯ
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
    type: String,
    required: true,
    trim: true
  },
  
  email: {
    type: String,
    required: true,
    trim: true
  },
  
  profile_image_url: {
    type: String,
    trim: true
  },
  
  // ИНФОРМАЦИЯ О ТРАНСПОРТЕ
  vehicle_type: {
    type: String,
    required: true,
    enum: ['bike', 'motorbike', 'car'],
    index: true
  },
  
  vehicle_info: {
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    license_plate: { type: String, trim: true },
    color: { type: String, trim: true }
  },
  
  // ДОКУМЕНТЫ (зашифрованные ссылки)
  documents: {
    id_card_url: { type: String },
    driver_license_url: { type: String },
    insurance_url: { type: String },
    vehicle_registration_url: { type: String },
    bank_rib_url: { type: String }
  },
  
  // ГЕОЛОКАЦИЯ (GeoJSON)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      index: '2dsphere'
    }
  },
  
  // СТАТУСЫ КУРЬЕРА
  is_available: {
    type: Boolean,
    default: false,
    index: true
  },
  
  is_online: {
    type: Boolean,
    default: false,
    index: true
  },
  
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  application_status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  
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
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // РАСШИРЕННАЯ СИСТЕМА ЗАРАБОТКА ESARGO
  earnings: {
    total_earned: {
      type: Number,
      default: 0,
      min: 0
    },
    weekly_earned: {
      type: Number,
      default: 0,
      min: 0
    },
    monthly_earned: {
      type: Number,
      default: 0,
      min: 0
    },
    daily_earned: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // НОВАЯ ДЕТАЛИЗАЦИЯ заработка по типам
    earnings_breakdown: {
      base_delivery_fees: {
        type: Number,
        default: 0
      },
      peak_hour_bonuses: {
        type: Number,
        default: 0
      },
      distance_bonuses: {
        type: Number,
        default: 0
      },
      tips_received: {
        type: Number,
        default: 0
      },
      special_bonuses: {
        type: Number,
        default: 0
      }
    },
    
    // НОВАЯ СТАТИСТИКА по зонам доставки
    zone_stats: {
      zone_1_deliveries: {
        type: Number,
        default: 0
      },
      zone_1_earnings: {
        type: Number,
        default: 0
      },
      zone_2_deliveries: {
        type: Number,
        default: 0
      },
      zone_2_earnings: {
        type: Number,
        default: 0
      }
    },
    
    completed_orders: {
      type: Number,
      default: 0
    },
    cancelled_orders: {
      type: Number,
      default: 0
    },
    
    // Статистика платежей
    last_payout_date: {
      type: Date
    },
    last_earnings_update: {
      type: Date,
      default: Date.now
    },
    pending_payout: {
      type: Number,
      default: 0
    }
  },
  
  // НОВЫЕ ПОЛЯ для предпочтений работы
  work_preferences: {
    preferred_zones: [{
      type: Number,
      enum: [1, 2]
    }],
    max_distance_per_delivery: {
      type: Number,
      default: 10, // максимум 10км
      min: 1,
      max: 10
    },
    peak_hours_only: {
      type: Boolean,
      default: false
    },
    min_order_value: {
      type: Number,
      default: 0 // минимальная стоимость заказа для принятия
    }
  },
  
  // РЕЙТИНГ КУРЬЕРА (ИСПРАВЛЕНО: rating_distribution вместо rating_breakdown)
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
    },
    rating_distribution: {
      five_star: { type: Number, default: 0 },
      four_star: { type: Number, default: 0 },
      three_star: { type: Number, default: 0 },
      two_star: { type: Number, default: 0 },
      one_star: { type: Number, default: 0 }
    }
  },
  
  // СТАТИСТИКА РАБОТЫ
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
  
  // НАСТРОЙКИ УВЕДОМЛЕНИЙ
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
  
  // ИНФОРМАЦИЯ О ПОСЛЕДНЕЙ АКТИВНОСТИ
  last_activity: {
    type: Date,
    default: Date.now
  },
  last_order_at: {
    type: Date
  },
  
  // ЗАБЛОКИРОВАН ЛИ КУРЬЕР
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

// ================ ИНДЕКСЫ ================
courierProfileSchema.index({ user_id: 1 });
courierProfileSchema.index({ 
  is_available: 1, 
  is_approved: 1, 
  is_online: 1,
  is_blocked: 1 
});
courierProfileSchema.index({ location: '2dsphere' });
courierProfileSchema.index({ application_status: 1 });
courierProfileSchema.index({ 'ratings.avg_rating': -1 });
courierProfileSchema.index({ last_activity: -1 });
courierProfileSchema.index({ 'work_preferences.preferred_zones': 1 });
courierProfileSchema.index({ vehicle_type: 1 });

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================
courierProfileSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.last_name}`;
});

// НОВОЕ ВИРТУАЛЬНОЕ ПОЛЕ: Эффективность курьера
courierProfileSchema.virtual('efficiency_rating').get(function() {
  if (this.earnings.completed_orders === 0) return 0;
  
  const completionRate = this.earnings.completed_orders / 
    (this.earnings.completed_orders + this.earnings.cancelled_orders);
  const avgRating = this.ratings.avg_rating || 0;
  
  return Math.round((completionRate * 0.6 + (avgRating / 5) * 0.4) * 100) / 100;
});

// НОВОЕ ВИРТУАЛЬНОЕ ПОЛЕ: Предпочитаемые зоны как строка
courierProfileSchema.virtual('preferred_zones_text').get(function() {
  if (this.work_preferences.preferred_zones.length === 0) {
    return 'Все зоны';
  }
  return this.work_preferences.preferred_zones.map(z => `Зона ${z}`).join(', ');
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

// ОБНОВЛЕННЫЙ МЕТОД добавления заработка с детализацией
courierProfileSchema.methods.addEarnings = function(orderData) {
  const {
    delivery_fee = 0,
    peak_hour_surcharge = 0,
    delivery_zone = 1,
    delivery_distance_km = 0,
    tip_amount = 0,
    bonus_amount = 0
  } = orderData;
  
  const totalEarning = delivery_fee + peak_hour_surcharge + tip_amount + bonus_amount;
  
  // Обновляем общий заработок
  this.earnings.total_earned += totalEarning;
  this.earnings.weekly_earned += totalEarning;
  this.earnings.monthly_earned += totalEarning;
  this.earnings.daily_earned += totalEarning;
  this.earnings.completed_orders += 1;
  
  // Обновляем детализацию
  this.earnings.earnings_breakdown.base_delivery_fees += delivery_fee;
  this.earnings.earnings_breakdown.peak_hour_bonuses += peak_hour_surcharge;
  this.earnings.earnings_breakdown.tips_received += tip_amount;
  this.earnings.earnings_breakdown.special_bonuses += bonus_amount;
  
  // Если есть бонус за расстояние (для длинных доставок)
  const distanceBonus = delivery_distance_km > 7 ? 1 : 0;
  this.earnings.earnings_breakdown.distance_bonuses += distanceBonus;
  
  // Обновляем статистику по зонам
  if (delivery_zone === 1) {
    this.earnings.zone_stats.zone_1_deliveries += 1;
    this.earnings.zone_stats.zone_1_earnings += totalEarning;
  } else if (delivery_zone === 2) {
    this.earnings.zone_stats.zone_2_deliveries += 1;
    this.earnings.zone_stats.zone_2_earnings += totalEarning;
  }
  
  this.earnings.last_earnings_update = new Date();
  this.earnings.pending_payout += totalEarning;
  this.last_order_at = new Date();
  
  return this.save();
};

// НОВЫЙ МЕТОД: Обработка выплаты курьеру
courierProfileSchema.methods.processPayout = function(amount) {
  if (amount > this.earnings.pending_payout) {
    throw new Error('Сумма выплаты превышает доступный баланс');
  }
  
  this.earnings.pending_payout -= amount;
  this.earnings.last_payout_date = new Date();
  
  return this.save();
};

// МЕТОДЫ сброса периодических заработков
courierProfileSchema.methods.resetWeeklyEarnings = function() {
  this.earnings.weekly_earned = 0;
  return this.save();
};

courierProfileSchema.methods.resetMonthlyEarnings = function() {
  this.earnings.monthly_earned = 0;
  return this.save();
};

courierProfileSchema.methods.resetDailyEarnings = function() {
  this.earnings.daily_earned = 0;
  return this.save();
};

// НОВЫЙ МЕТОД: Проверка предпочтений работы
courierProfileSchema.methods.prefersZone = function(zoneNumber) {
  return this.work_preferences.preferred_zones.includes(zoneNumber);
};

// НОВЫЙ МЕТОД: Проверка готовности принять заказ
courierProfileSchema.methods.canAcceptOrder = function(orderData) {
  const {
    delivery_distance_km = 0,
    delivery_zone = 1,
    subtotal = 0
  } = orderData;
  
  // Проверка максимального расстояния
  if (delivery_distance_km > this.work_preferences.max_distance_per_delivery) {
    return false;
  }
  
  // Проверка минимальной стоимости заказа
  if (subtotal < this.work_preferences.min_order_value) {
    return false;
  }
  
  // Проверка предпочитаемых зон (если настроено)
  if (this.work_preferences.preferred_zones.length > 0) {
    if (!this.work_preferences.preferred_zones.includes(delivery_zone)) {
      return false;
    }
  }
  
  return true;
};

// Метод для обновления геолокации в формате GeoJSON
courierProfileSchema.methods.updateLocation = function(lat, lng) {
  this.location = {
    type: 'Point',
    coordinates: [lng, lat], // [longitude, latitude] - порядок важен для MongoDB!
  };
  this.last_activity = new Date();
  
  return this.save();
};

// Метод проверки доступности
courierProfileSchema.methods.isAvailableForDelivery = function() {
  return this.is_available && 
         this.is_online && 
         this.is_approved && 
         this.is_active && 
         !this.is_blocked;
};

// Метод для обновления рейтинга (ИСПРАВЛЕНО: rating_distribution)
courierProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_ratings;
  const currentAvgRating = this.ratings.avg_rating;
  
  this.ratings.total_ratings += 1;
  this.ratings.avg_rating = ((currentAvgRating * totalRatings) + newRating) / this.ratings.total_ratings;
  
  // ИСПРАВЛЕНО: Обновляем распределение рейтингов
  switch (newRating) {
    case 5: this.ratings.rating_distribution.five_star += 1; break;
    case 4: this.ratings.rating_distribution.four_star += 1; break;
    case 3: this.ratings.rating_distribution.three_star += 1; break;
    case 2: this.ratings.rating_distribution.two_star += 1; break;
    case 1: this.ratings.rating_distribution.one_star += 1; break;
  }
  
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

// НОВЫЙ МЕТОД: Статистика заработка всех курьеров
courierProfileSchema.statics.getEarningsStats = function() {
  return this.aggregate([
    {
      $match: {
        is_approved: true,
        'earnings.completed_orders': { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        total_couriers: { $sum: 1 },
        total_earnings: { $sum: '$earnings.total_earned' },
        total_deliveries: { $sum: '$earnings.completed_orders' },
        total_zone_1_deliveries: { $sum: '$earnings.zone_stats.zone_1_deliveries' },
        total_zone_1_earnings: { $sum: '$earnings.zone_stats.zone_1_earnings' },
        total_zone_2_deliveries: { $sum: '$earnings.zone_stats.zone_2_deliveries' },
        total_zone_2_earnings: { $sum: '$earnings.zone_stats.zone_2_earnings' },
        avg_earnings_per_courier: { $avg: '$earnings.total_earned' },
        total_peak_hour_bonuses: { $sum: '$earnings.earnings_breakdown.peak_hour_bonuses' },
        total_distance_bonuses: { $sum: '$earnings.earnings_breakdown.distance_bonuses' }
      }
    }
  ]);
};

// НОВЫЙ МЕТОД: Найти лучших курьеров по эффективности
courierProfileSchema.statics.findTopPerformers = function(limit = 10) {
  return this.find({
    is_approved: true,
    is_active: true,
    'earnings.completed_orders': { $gte: 10 }, // Минимум 10 заказов
    'ratings.total_ratings': { $gte: 5 } // Минимум 5 оценок
  })
  .sort({ 
    'ratings.avg_rating': -1,
    'earnings.completed_orders': -1 
  })
  .limit(limit);
};

// Поиск доступных курьеров поблизости
courierProfileSchema.statics.findAvailableNearby = function(lat, lng, radiusKm = 5) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat] // [longitude, latitude]
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

// ================ НАСТРОЙКИ JSON ================
courierProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Скрываем чувствительные данные из JSON ответа
    delete ret.phone; // Если это зашифрованное поле
    delete ret.__v;
    return ret;
  }
});

courierProfileSchema.set('toObject', { virtuals: true });

// БЕЗОПАСНАЯ РЕГИСТРАЦИЯ МОДЕЛИ
const CourierProfile = mongoose.models.CourierProfile || mongoose.model('CourierProfile', courierProfileSchema);
export default CourierProfile;