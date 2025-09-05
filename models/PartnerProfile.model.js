// models/PartnerProfile.model.js - РАСШИРЕННАЯ МОДЕЛЬ С EARNINGS И DELIVERY ZONES
import mongoose from 'mongoose';

const partnerProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // ОСНОВНАЯ ИНФОРМАЦИЯ БИЗНЕСА
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
  
  // 🎨 МЕДИА
  cover_image_url: {
    type: String
  },
  
  // ГАЛЕРЕЯ
  gallery: [{
    url: { type: String, required: true },
    title: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 200 },
    type: { type: String, enum: ['interior', 'exterior', 'food', 'staff', 'other'], default: 'other' },
    uploaded_at: { type: Date, default: Date.now }
  }],
  
  // КАТЕГОРИИ МЕНЮ
  menu_categories: [{
    name: { type: String, required: true, trim: true, maxlength: 50 },
    slug: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 200 },
    image_url: { type: String },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now }
  }],
  
  // ЧАСЫ РАБОТЫ
  operating_hours: {
    monday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '22:00' } },
    tuesday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '22:00' } },
    wednesday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '22:00' } },
    thursday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '22:00' } },
    friday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '22:00' } },
    saturday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '22:00' } },
    sunday: { is_open: { type: Boolean, default: false }, open_time: { type: String, default: '10:00' }, close_time: { type: String, default: '20:00' } }
  },
  
  // ✅ НОВЫЕ ПОЛЯ: СИСТЕМА ЗАРАБОТКА ESARGO
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
    
    // Детализация по источникам дохода
    earnings_breakdown: {
      food_sales: {
        type: Number,
        default: 0
      },
      commission_paid: {
        type: Number,
        default: 0
      },
      bonus_payments: {
        type: Number,
        default: 0
      }
    },
    
    // Статистика периодов
    last_payout_date: {
      type: Date
    },
    last_earnings_update: {
      type: Date,
      default: Date.now
    }
  },
  
  // ✅ НОВЫЕ ПОЛЯ: ЗОНЫ ДОСТАВКИ ESARGO
  available_delivery_zones: [{
    zone_number: {
      type: Number,
      enum: [1, 2], // Зона 1: 0-5км, Зона 2: 5-10км
      required: true
    },
    max_distance_km: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    delivery_fee: {
      type: Number,
      required: true,
      min: 0
    },
    min_order_amount: {
      type: Number,
      default: 30 // Минимальная сумма заказа
    },
    is_active: {
      type: Boolean,
      default: true
    }
  }],
  
  // РЕЙТИНГИ
  ratings: {
    avg_rating: { type: Number, default: 0, min: 0, max: 5 },
    total_ratings: { type: Number, default: 0 },
    rating_distribution: {
      five_star: { type: Number, default: 0 },
      four_star: { type: Number, default: 0 },
      three_star: { type: Number, default: 0 },
      two_star: { type: Number, default: 0 },
      one_star: { type: Number, default: 0 }
    }
  },
  
  // БИЗНЕС СТАТИСТИКА
  business_stats: {
    total_orders: { type: Number, default: 0 },
    completed_orders: { type: Number, default: 0 },
    cancelled_orders: { type: Number, default: 0 },
    avg_order_value: { type: Number, default: 0 },
    total_products: { type: Number, default: 0 },
    active_products: { type: Number, default: 0 },
    total_categories: { type: Number, default: 0 },
    total_gallery_images: { type: Number, default: 0 },
    last_stats_update: { type: Date }
  },
  
  // СТАТУСЫ
  content_status: { type: String, enum: ['awaiting_content', 'content_added', 'pending_review', 'approved', 'rejected'], default: 'awaiting_content', index: true },
  approval_status: { type: String, enum: ['awaiting_content', 'pending_review', 'approved', 'rejected'], default: 'awaiting_content', index: true },
  is_approved: { type: Boolean, default: false, index: true },
  is_active: { type: Boolean, default: false, index: true },
  is_public: { type: Boolean, default: false, index: true },
  
  // АДМИНИСТРАТИВНЫЕ
  published_at: { type: Date, index: true },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  approved_at: { type: Date },
  rejection_reason: { type: String, trim: true },
  
  // ЮРИДИЧЕСКИЕ
  legal_info_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerLegalInfo' }
}, { timestamps: true });

// ================ ИНДЕКСЫ ================
partnerProfileSchema.index({ location: '2dsphere' });
partnerProfileSchema.index({ category: 1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ 'ratings.avg_rating': -1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ content_status: 1, createdAt: -1 });
partnerProfileSchema.index({ 'menu_categories.slug': 1 });
partnerProfileSchema.index({ 'available_delivery_zones.zone_number': 1 }); // ✅ НОВЫЙ ИНДЕКС

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================
partnerProfileSchema.virtual('owner_full_name').get(function() {
  return `${this.owner_name} ${this.owner_surname}`;
});

partnerProfileSchema.virtual('is_currently_open').get(function() {
  const now = new Date();
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const currentDay = dayNames[now.getDay()];
  const todayHours = this.operating_hours[currentDay];
  
  if (!todayHours || !todayHours.is_open) return false;
  
  const currentTime = now.toTimeString().slice(0, 5);
  return currentTime >= todayHours.open_time && currentTime <= todayHours.close_time;
});

// ✅ НОВОЕ ВИРТУАЛЬНОЕ ПОЛЕ: Активные зоны доставки
partnerProfileSchema.virtual('active_zones').get(function() {
  return this.available_delivery_zones.filter(zone => zone.is_active);
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

// ✅ НОВЫЕ МЕТОДЫ ДЛЯ EARNINGS
/**
 * Обновление заработка партнера
 */
partnerProfileSchema.methods.updateEarnings = function(orderData) {
  const orderTotal = orderData.subtotal || 0;
  const commissionRate = 0.10; // 10% комиссия ESARGO
  const commission = orderTotal * commissionRate;
  const partnerEarning = orderTotal - commission;
  
  this.earnings.total_earned += partnerEarning;
  this.earnings.weekly_earned += partnerEarning;
  this.earnings.monthly_earned += partnerEarning;
  this.earnings.daily_earned += partnerEarning;
  
  // Обновляем детализацию
  this.earnings.earnings_breakdown.food_sales += orderTotal;
  this.earnings.earnings_breakdown.commission_paid += commission;
  
  this.earnings.last_earnings_update = new Date();
  
  return this.save();
};

/**
 * Сброс недельного заработка (вызывается каждую неделю)
 */
partnerProfileSchema.methods.resetWeeklyEarnings = function() {
  this.earnings.weekly_earned = 0;
  return this.save();
};

/**
 * Сброс месячного заработка (вызывается каждый месяц)
 */
partnerProfileSchema.methods.resetMonthlyEarnings = function() {
  this.earnings.monthly_earned = 0;
  return this.save();
};

/**
 * Сброс дневного заработка (вызывается каждый день)
 */
partnerProfileSchema.methods.resetDailyEarnings = function() {
  this.earnings.daily_earned = 0;
  return this.save();
};

// ✅ НОВЫЕ МЕТОДЫ ДЛЯ DELIVERY ZONES
/**
 * Получение зон доставки партнера
 */
partnerProfileSchema.methods.getActiveDeliveryZones = function() {
  return this.available_delivery_zones.filter(zone => zone.is_active);
};

/**
 * Проверка может ли партнер доставлять в зону
 */
partnerProfileSchema.methods.canDeliverToZone = function(zoneNumber) {
  const zone = this.available_delivery_zones.find(z => 
    z.zone_number === zoneNumber && z.is_active
  );
  return !!zone;
};

/**
 * Получение стоимости доставки для зоны
 */
partnerProfileSchema.methods.getDeliveryFeeForZone = function(zoneNumber, orderTotal = 0) {
  const zone = this.available_delivery_zones.find(z => 
    z.zone_number === zoneNumber && z.is_active
  );
  
  if (!zone) return null;
  
  // Если заказ больше минимальной суммы, используем льготный тариф
  return orderTotal >= zone.min_order_amount ? zone.delivery_fee : zone.delivery_fee + 3;
};

/**
 * Добавление новой зоны доставки
 */
partnerProfileSchema.methods.addDeliveryZone = function(zoneData) {
  // Проверяем, что зона не существует
  const existingZone = this.available_delivery_zones.find(z => 
    z.zone_number === zoneData.zone_number
  );
  
  if (existingZone) {
    throw new Error(`Зона ${zoneData.zone_number} уже настроена`);
  }
  
  this.available_delivery_zones.push(zoneData);
  return this.save();
};

// СУЩЕСТВУЮЩИЕ МЕТОДЫ (сохраняем без изменений)

/**
 * Добавление категории меню
 */
partnerProfileSchema.methods.addMenuCategory = function(categoryName, description = '') {
  const slug = categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  const existingCategory = this.menu_categories.find(cat => cat.slug === slug);
  if (existingCategory) {
    throw new Error('Категория с таким названием уже существует');
  }
  
  const newCategory = {
    name: categoryName,
    slug: slug,
    description: description,
    sort_order: this.menu_categories.length
  };
  
  this.menu_categories.push(newCategory);
  this.business_stats.total_categories = this.menu_categories.length;
  
  return this.save();
};

/**
 * Обновление рейтинга
 */
partnerProfileSchema.methods.updateRating = function(newRating) {
  const currentTotal = this.ratings.total_ratings;
  const currentAvg = this.ratings.avg_rating;
  
  this.ratings.total_ratings += 1;
  this.ratings.avg_rating = ((currentAvg * currentTotal) + newRating) / this.ratings.total_ratings;
  
  // Обновляем распределение рейтингов
  const ratingKey = ['one_star', 'two_star', 'three_star', 'four_star', 'five_star'][newRating - 1];
  if (this.ratings.rating_distribution[ratingKey] !== undefined) {
    this.ratings.rating_distribution[ratingKey] += 1;
  }
  
  return this.save();
};

/**
 * Обновление статистики продуктов
 */
partnerProfileSchema.methods.updateProductStats = async function() {
  const Product = mongoose.model('Product');
  
  const stats = await Product.aggregate([
    { $match: { partner_id: this._id } },
    {
      $group: {
        _id: null,
        total_products: { $sum: 1 },
        active_products: { $sum: { $cond: [{ $and: ['$is_active', '$is_available'] }, 1, 0] } }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.business_stats.total_products = stats[0].total_products;
    this.business_stats.active_products = stats[0].active_products;
  } else {
    this.business_stats.total_products = 0;
    this.business_stats.active_products = 0;
  }
  
  this.business_stats.total_categories = this.menu_categories.length;
  this.business_stats.total_gallery_images = this.gallery.length;
  this.business_stats.last_stats_update = new Date();
  
  return this.save();
};

/**
 * Проверка может ли партнер принимать заказы
 */
partnerProfileSchema.methods.canAcceptOrders = function() {
  return this.is_approved && this.is_active && this.is_public && this.is_currently_open;
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * ✅ НОВЫЙ МЕТОД: Поиск партнеров по зоне доставки
 */
partnerProfileSchema.statics.findByDeliveryZone = function(zoneNumber) {
  return this.find({
    'available_delivery_zones.zone_number': zoneNumber,
    'available_delivery_zones.is_active': true,
    is_approved: true,
    is_active: true,
    is_public: true
  });
};

/**
 * ✅ НОВЫЙ МЕТОД: Статистика earnings по партнерам
 */
partnerProfileSchema.statics.getEarningsStats = function(dateFrom, dateTo) {
  return this.aggregate([
    {
      $match: {
        is_approved: true,
        'earnings.last_earnings_update': { 
          $gte: new Date(dateFrom), 
          $lte: new Date(dateTo) 
        }
      }
    },
    {
      $group: {
        _id: '$category',
        total_partners: { $sum: 1 },
        total_earnings: { $sum: '$earnings.total_earned' },
        total_commission: { $sum: '$earnings.earnings_breakdown.commission_paid' },
        avg_earnings_per_partner: { $avg: '$earnings.total_earned' },
        total_food_sales: { $sum: '$earnings.earnings_breakdown.food_sales' }
      }
    },
    { $sort: { total_earnings: -1 } }
  ]);
};

/**
 * Поиск партнеров поблизости
 */
partnerProfileSchema.statics.findNearby = function(lat, lng, radiusKm = 10, category = null) {
  const matchConditions = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusKm * 1000
      }
    },
    is_approved: true,
    is_active: true,
    is_public: true
  };
  
  if (category) {
    matchConditions.category = category;
  }
  
  return this.find(matchConditions).sort({ 'ratings.avg_rating': -1 });
};

/**
 * Поиск популярных партнеров
 */
partnerProfileSchema.statics.findPopular = function(limit = 10, category = null) {
  const matchConditions = {
    is_approved: true,
    is_active: true,
    is_public: true,
    'ratings.total_ratings': { $gte: 5 }
  };
  
  if (category) {
    matchConditions.category = category;
  }
  
  return this.find(matchConditions)
    .sort({ 'ratings.avg_rating': -1, 'ratings.total_ratings': -1 })
    .limit(limit);
};

// ================ НАСТРОЙКИ JSON ================
partnerProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Убираем зашифрованные поля из JSON ответа
    delete ret.address;
    delete ret.phone;
    delete ret.email;
    delete ret.owner_name;
    delete ret.owner_surname;
    return ret;
  }
});

partnerProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model('PartnerProfile', partnerProfileSchema);