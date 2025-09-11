// models/CourierProfile.model.js - ПОЛНАЯ МОДЕЛЬ КУРЬЕРА ESARGO с исправлениями
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
  
  // ✅ ИСПРАВЛЕНО: profile_image_url → avatar_url (для соответствия FileUpload системе)
  avatar_url: {
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
  
  // ✅ ИСПРАВЛЕНО: documents → registration_documents (документы из заявки)
  registration_documents: {
    id_card_url: { type: String },
    driver_license_url: { type: String },
    insurance_url: { type: String },
    vehicle_registration_url: { type: String },
    bank_rib_url: { type: String }
  },
  
  // ✅ ДОБАВЛЕНО: additional_documents для новой файловой системы
  additional_documents: [{
    type: {
      type: String,
      enum: ['identity_document', 'driving_license', 'vehicle_registration', 'insurance', 'bank_details', 'other'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    filename: String,
    original_name: String,
    size: Number,
    uploaded_at: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'rejected', 'needs_update'],
      default: 'pending_review'
    },
    admin_notes: String,
    document_category: String
  }],
  
  // ✅ ДОБАВЛЕНО: documents_status для отслеживания статуса дополнительных документов
  documents_status: {
    type: String,
    enum: ['not_required', 'incomplete', 'complete', 'needs_update', 'pending_review'],
    default: 'not_required'
  },
  
  // ГЕОЛОКАЦИЯ (GeoJSON) - ✅ ИСПРАВЛЕНО: убрана обязательность
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: false  // ✅ НЕ обязательно при создании
    },
    coordinates: {
      type: [Number],
      required: false,  // ✅ НЕ обязательно при создании
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
  
  is_blocked: {
    type: Boolean,
    default: false,
    index: true
  },
  
  blocked_reason: {
    type: String,
    trim: true
  },
  
  blocked_until: {
    type: Date
  },
  
  // РАБОТА И ЗАРАБОТОК
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
    earnings_breakdown: {
      base_delivery_fees: {
        type: Number,
        default: 0,
        min: 0
      },
      peak_hour_bonuses: {
        type: Number,
        default: 0,
        min: 0
      },
      distance_bonuses: {
        type: Number,
        default: 0,
        min: 0
      },
      tips_received: {
        type: Number,
        default: 0,
        min: 0
      },
      special_bonuses: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    zone_stats: {
      zone_1_deliveries: {
        type: Number,
        default: 0,
        min: 0
      },
      zone_1_earnings: {
        type: Number,
        default: 0,
        min: 0
      },
      zone_2_deliveries: {
        type: Number,
        default: 0,
        min: 0
      },
      zone_2_earnings: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    completed_orders: {
      type: Number,
      default: 0,
      min: 0
    },
    cancelled_orders: {
      type: Number,
      default: 0,
      min: 0
    },
    last_payout_date: {
      type: Date
    },
    pending_payout: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // ПРЕДПОЧТЕНИЯ В РАБОТЕ
  work_preferences: {
    preferred_zones: [{
      type: Number,
      enum: [1, 2]
    }],
    max_distance_per_delivery: {
      type: Number,
      default: 15,
      min: 1,
      max: 50
    },
    peak_hours_only: {
      type: Boolean,
      default: false
    },
    min_order_value: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // РЕЙТИНГИ И ОТЗЫВЫ
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
    },
    rating_distribution: {
      five_star: { type: Number, default: 0, min: 0 },
      four_star: { type: Number, default: 0, min: 0 },
      three_star: { type: Number, default: 0, min: 0 },
      two_star: { type: Number, default: 0, min: 0 },
      one_star: { type: Number, default: 0, min: 0 }
    }
  },
  
  // АКТИВНОСТЬ И СТАТИСТИКА
  work_stats: {
    hours_worked_today: {
      type: Number,
      default: 0,
      min: 0
    },
    hours_worked_week: {
      type: Number,
      default: 0,
      min: 0
    },
    hours_worked_month: {
      type: Number,
      default: 0,
      min: 0
    },
    avg_delivery_time: {
      type: Number,
      default: 0,
      min: 0
    },
    last_delivery_at: {
      type: Date
    },
    total_distance_km: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // УВЕДОМЛЕНИЯ
  notification_settings: {
    new_orders: {
      type: Boolean,
      default: true
    },
    promotions: {
      type: Boolean,
      default: false
    },
    system_updates: {
      type: Boolean,
      default: true
    }
  },
  
  // ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  last_activity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
courierProfileSchema.index({ user_id: 1 });
courierProfileSchema.index({ is_available: 1, is_online: 1 });
courierProfileSchema.index({ is_approved: 1, is_active: 1 });
courierProfileSchema.index({ vehicle_type: 1 });

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================
courierProfileSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.last_name}`;
});

// ✅ ДОБАВЛЕНО: Виртуальное поле для подсчета дополнительных документов
courierProfileSchema.virtual('additional_documents_count').get(function() {
  return this.additional_documents ? this.additional_documents.length : 0;
});

// ✅ ДОБАВЛЕНО: Виртуальное поле для подсчета одобренных дополнительных документов
courierProfileSchema.virtual('approved_additional_documents_count').get(function() {
  return this.additional_documents ? 
    this.additional_documents.filter(doc => doc.status === 'approved').length : 0;
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
  const distanceBonus = delivery_distance_km > 7 ? 
    Math.round((delivery_distance_km - 7) * 0.5 * 100) / 100 : 0;
  
  if (distanceBonus > 0) {
    this.earnings.earnings_breakdown.distance_bonuses += distanceBonus;
  }
  
  // Обновляем статистику по зонам
  if (delivery_zone === 1) {
    this.earnings.zone_stats.zone_1_deliveries += 1;
    this.earnings.zone_stats.zone_1_earnings += totalEarning + distanceBonus;
  } else if (delivery_zone === 2) {
    this.earnings.zone_stats.zone_2_deliveries += 1;
    this.earnings.zone_stats.zone_2_earnings += totalEarning + distanceBonus;
  }
  
  this.last_activity = new Date();
  
  return this.save();
};

// Метод обработки выплаты
courierProfileSchema.methods.processPayout = function() {
  const payoutAmount = this.earnings.pending_payout;
  
  this.earnings.pending_payout = 0;
  this.earnings.last_payout_date = new Date();
  
  // Обнуляем недельный заработок
  this.earnings.weekly_earned = 0;
  
  return this.save();
};

// Метод проверки может ли курьер принимать заказы
courierProfileSchema.methods.canAcceptOrder = function(orderZone) {
  const isAvailable = this.is_available && this.is_online && this.is_approved && this.is_active && !this.is_blocked;
  
  if (!isAvailable) return false;
  
  // Проверяем предпочтения по зонам
  if (this.work_preferences.preferred_zones.length > 0) {
    return this.work_preferences.preferred_zones.includes(orderZone);
  }
  
  return true;
};

// Метод обновления статуса работы
courierProfileSchema.methods.updateWorkStatus = function(isAvailable, location = null) {
  this.is_available = isAvailable;
  this.is_online = isAvailable;
  
  if (location) {
    this.location = {
      type: 'Point',
      coordinates: [location.lng, location.lat]
    };
  }
  
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
    'earnings.completed_orders': { $gte: 10 }
  })
  .sort({ 
    'ratings.avg_rating': -1, 
    'earnings.completed_orders': -1 
  })
  .limit(limit);
};

// Поиск доступных курьеров
courierProfileSchema.statics.findAvailable = function(zone = null) {
  const query = {
    is_available: true,
    is_online: true,
    is_approved: true,
    is_active: true,
    is_blocked: false
  };
  
  if (zone) {
    query.$or = [
      { 'work_preferences.preferred_zones': { $size: 0 } },
      { 'work_preferences.preferred_zones': zone }
    ];
  }
  
  return this.find(query);
};

// Поиск ближайших курьеров
courierProfileSchema.statics.findNearby = function(lat, lng, radiusKm = 10, zone = null) {
  const query = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusKm * 1000
      }
    },
    is_available: true,
    is_online: true,
    is_approved: true,
    is_active: true,
    is_blocked: false
  };
  
  if (zone) {
    query.$or = [
      { 'work_preferences.preferred_zones': { $size: 0 } },
      { 'work_preferences.preferred_zones': zone }
    ];
  }
  
  return this.find(query).sort({ 'ratings.avg_rating': -1 });
};

// НАСТРОЙКИ JSON
courierProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

courierProfileSchema.set('toObject', { virtuals: true });

// БЕЗОПАСНАЯ РЕГИСТРАЦИЯ МОДЕЛИ
const CourierProfile = mongoose.models.CourierProfile || mongoose.model('CourierProfile', courierProfileSchema);
export default CourierProfile;