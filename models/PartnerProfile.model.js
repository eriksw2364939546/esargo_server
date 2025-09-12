// models/PartnerProfile.model.js - ПОЛНАЯ МОДЕЛЬ С МИНИМАЛЬНЫМИ ИСПРАВЛЕНИЯМИ
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
  
  // ЗАШИФРОВАННЫЕ ДАННЫЕ
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
  
  // СВЯЗЬ С ЮРИДИЧЕСКОЙ ИНФОРМАЦИЕЙ
  legal_info_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerLegalInfo',
    index: true
  },
  
  // МЕДИА
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
  
  // ✅ ЕДИНСТВЕННОЕ ДОБАВЛЕНИЕ: additional_documents для новой файловой системы
  additional_documents: [{
    type: {
      type: String,
      enum: ['menu_certificate', 'hygiene_certificate', 'business_license', 'tax_document', 'other'],
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
  
  // КАТЕГОРИИ МЕНЮ
menu_categories: [{
  name: { type: String, required: true, trim: true, maxlength: 50 },
  slug: { type: String, required: true, trim: true, maxlength: 100 }, // ✅ ДОБАВЬ ЭТУ СТРОКУ
  description: { type: String, trim: true, maxlength: 200 },
  image_url: { type: String, trim: true },
  sort_order: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  products_count: { type: Number, default: 0 }, // ✅ ДОБАВЬ ЭТУ СТРОКУ тоже
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }  // ✅ И ЭТУ СТРОКУ
}],
  
  // ВРЕМЯ РАБОТЫ
  working_hours: {
    monday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '22:00' },
      break_start: { type: String },
      break_end: { type: String }
    },
    tuesday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '22:00' },
      break_start: { type: String },
      break_end: { type: String }
    },
    wednesday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '22:00' },
      break_start: { type: String },
      break_end: { type: String }
    },
    thursday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '22:00' },
      break_start: { type: String },
      break_end: { type: String }
    },
    friday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '22:00' },
      break_start: { type: String },
      break_end: { type: String }
    },
    saturday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '10:00' },
      close_time: { type: String, default: '23:00' },
      break_start: { type: String },
      break_end: { type: String }
    },
    sunday: {
      is_open: { type: Boolean, default: false },
      open_time: { type: String, default: '11:00' },
      close_time: { type: String, default: '21:00' },
      break_start: { type: String },
      break_end: { type: String }
    }
  },
  
  // НАСТРОЙКИ ДОСТАВКИ
  delivery_settings: {
    delivery_fee: { type: Number, default: 3.50, min: 0 },
    free_delivery_threshold: { type: Number, default: 25, min: 0 },
    min_order_amount: { type: Number, default: 15, min: 0 },
    max_delivery_distance: { type: Number, default: 10, min: 1 },
    estimated_delivery_time: { type: Number, default: 30, min: 10 },
    max_items_per_order: { type: Number, default: 50, min: 1 }
  },
  
  // ЗОНЫ ДОСТАВКИ
  available_delivery_zones: [{
    zone_number: { type: Number, required: true, enum: [1, 2] },
    zone_name: { type: String, required: true },
    delivery_fee: { type: Number, required: true, min: 0 },
    min_order_amount: { type: Number, default: 15, min: 0 },
    estimated_time: { type: Number, default: 30, min: 10 },
    is_active: { type: Boolean, default: true }
  }],
  
  // РЕЙТИНГИ И ОТЗЫВЫ
  ratings: {
    avg_rating: { type: Number, default: 0, min: 0, max: 5 },
    total_ratings: { type: Number, default: 0, min: 0 },
    rating_distribution: {
      five_star: { type: Number, default: 0, min: 0 },
      four_star: { type: Number, default: 0, min: 0 },
      three_star: { type: Number, default: 0, min: 0 },
      two_star: { type: Number, default: 0, min: 0 },
      one_star: { type: Number, default: 0, min: 0 }
    }
  },
  
  // ЗАРАБОТОК И ФИНАНСЫ
  earnings: {
    total_earned: { type: Number, default: 0, min: 0 },
    weekly_earned: { type: Number, default: 0, min: 0 },
    monthly_earned: { type: Number, default: 0, min: 0 },
    daily_earned: { type: Number, default: 0, min: 0 },
    last_earnings_update: { type: Date },
    earnings_breakdown: {
      food_sales: { type: Number, default: 0, min: 0 },
      commission_paid: { type: Number, default: 0, min: 0 }
    }
  },
  
  // СТАТИСТИКА БИЗНЕСА
  business_stats: {
    total_orders: { type: Number, default: 0, min: 0 },
    completed_orders: { type: Number, default: 0, min: 0 },
    cancelled_orders: { type: Number, default: 0, min: 0 },
    avg_order_value: { type: Number, default: 0, min: 0 },
    total_revenue: { type: Number, default: 0, min: 0 },
    most_popular_items: [{ 
      product_id: mongoose.Schema.Types.ObjectId, 
      name: String, 
      order_count: Number 
    }],
    total_products: { type: Number, default: 0 },
    active_products: { type: Number, default: 0 },
    total_menu_items: { type: Number, default: 0 },
    total_categories: { type: Number, default: 0 },
    total_gallery_images: { type: Number, default: 0 },
    last_stats_update: { type: Date }
  },
  
  // ИНФОРМАЦИЯ О ПОДАЧЕ НА ПРОВЕРКУ
  submission_info: {
    submitted_for_review_at: {
      type: Date
    },
    submission_notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    admin_review_notes: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    last_reviewed_at: {
      type: Date
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    }
  },
  
  // СТАТУСЫ
  content_status: { 
    type: String, 
    enum: ['awaiting_content', 'content_added', 'pending_review', 'approved', 'rejected'], 
    default: 'awaiting_content', 
    index: true 
  },
  approval_status: { 
    type: String, 
    enum: ['awaiting_approval', 'approved', 'rejected'], 
    default: 'awaiting_approval', 
    index: true 
  },
  is_approved: { type: Boolean, default: false, index: true },
  is_active: { type: Boolean, default: true, index: true },
  is_public: { type: Boolean, default: false, index: true },
  is_currently_open: { type: Boolean, default: false },
  
  // ДОПОЛНИТЕЛЬНО
  notes: { type: String, trim: true },
  last_login: { type: Date }
}, {
  timestamps: true
});

// ИНДЕКСЫ
partnerProfileSchema.index({ user_id: 1 });
partnerProfileSchema.index({ category: 1, is_public: 1, is_approved: 1 });
partnerProfileSchema.index({ location: '2dsphere' });
partnerProfileSchema.index({ 'ratings.avg_rating': -1 });
partnerProfileSchema.index({ is_approved: 1, is_active: 1, is_public: 1 });
partnerProfileSchema.index({ 'available_delivery_zones.zone_number': 1 });
partnerProfileSchema.index({ content_status: 1, approval_status: 1 });

// ВИРТУАЛЬНЫЕ ПОЛЯ
partnerProfileSchema.virtual('full_owner_name').get(function() {
  return `${this.owner_name} ${this.owner_surname}`;
});

partnerProfileSchema.virtual('is_currently_accepting_orders').get(function() {
  return this.is_approved && this.is_active && this.is_public && this.is_currently_open;
});

partnerProfileSchema.virtual('avg_preparation_time').get(function() {
  return this.delivery_settings.estimated_delivery_time - 15; // Вычитаем время доставки
});

partnerProfileSchema.virtual('rating_percentage').get(function() {
  return this.ratings.avg_rating ? Math.round((this.ratings.avg_rating / 5) * 100) : 0;
});

partnerProfileSchema.virtual('total_gallery_count').get(function() {
  if (!this.gallery || !Array.isArray(this.gallery)) {
    return 0;
  }
  return this.gallery.length;
});

partnerProfileSchema.virtual('active_zones_count').get(function() {
  if (!this.available_delivery_zones || !Array.isArray(this.available_delivery_zones)) {
    return 0;
  }
  return this.available_delivery_zones.filter(zone => zone.is_active).length;
});

// ✅ ЕДИНСТВЕННЫЕ ДОБАВЛЕННЫЕ ВИРТУАЛЬНЫЕ ПОЛЯ: для подсчета дополнительных документов
partnerProfileSchema.virtual('additional_documents_count').get(function() {
  return this.additional_documents ? this.additional_documents.length : 0;
});

partnerProfileSchema.virtual('approved_additional_documents_count').get(function() {
  return this.additional_documents ? 
    this.additional_documents.filter(doc => doc.status === 'approved').length : 0;
});

// МЕТОДЫ ЭКЗЕМПЛЯРА

// Методы для earnings
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

partnerProfileSchema.methods.addEarnings = function(orderData) {
  const { total_amount, commission_rate = 0.15 } = orderData;
  const commission = total_amount * commission_rate;
  const partnerEarning = total_amount - commission;
  
  this.earnings.total_earned += partnerEarning;
  this.earnings.weekly_earned += partnerEarning;
  this.earnings.monthly_earned += partnerEarning;
  this.earnings.last_earnings_update = new Date();
  
  this.earnings.earnings_breakdown.food_sales += total_amount;
  this.earnings.earnings_breakdown.commission_paid += commission;
  
  this.business_stats.total_orders += 1;
  this.business_stats.total_revenue += total_amount;
  this.business_stats.avg_order_value = this.business_stats.total_revenue / this.business_stats.total_orders;
  
  return this.save();
};

partnerProfileSchema.methods.resetWeeklyEarnings = function() {
  this.earnings.weekly_earned = 0;
  return this.save();
};

partnerProfileSchema.methods.resetMonthlyEarnings = function() {
  this.earnings.monthly_earned = 0;
  return this.save();
};

partnerProfileSchema.methods.resetDailyEarnings = function() {
  this.earnings.daily_earned = 0;
  return this.save();
};

// Методы для delivery zones
partnerProfileSchema.methods.getActiveDeliveryZones = function() {
  return this.available_delivery_zones.filter(zone => zone.is_active);
};

partnerProfileSchema.methods.canDeliverToZone = function(zoneNumber) {
  const zone = this.available_delivery_zones.find(z => 
    z.zone_number === zoneNumber && z.is_active
  );
  return !!zone;
};

partnerProfileSchema.methods.getDeliveryFeeForZone = function(zoneNumber, orderTotal = 0) {
  const zone = this.available_delivery_zones.find(z => 
    z.zone_number === zoneNumber && z.is_active
  );
  
  if (!zone) return null;
  
  // Если заказ больше минимальной суммы, используем льготный тариф
  return orderTotal >= zone.min_order_amount ?
    zone.delivery_fee : zone.delivery_fee + 2; // Доплата за маленький заказ
};

// Обновление рейтинга
partnerProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_ratings;
  const currentAvgRating = this.ratings.avg_rating;
  
  this.ratings.total_ratings += 1;
  this.ratings.avg_rating = ((currentAvgRating * totalRatings) + newRating) / this.ratings.total_ratings;
  
  // Обновляем распределение рейтингов
  switch (newRating) {
    case 5: this.ratings.rating_distribution.five_star += 1; break;
    case 4: this.ratings.rating_distribution.four_star += 1; break;
    case 3: this.ratings.rating_distribution.three_star += 1; break;
    case 2: this.ratings.rating_distribution.two_star += 1; break;
    case 1: this.ratings.rating_distribution.one_star += 1; break;
  }
  
  return this.save();
};

// Проверка открыт ли ресторан сейчас
partnerProfileSchema.methods.isOpenNow = function() {
  const now = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  const todaySchedule = this.working_hours[dayOfWeek];
  
  if (!todaySchedule.is_open) {
    return false;
  }
  
  // Простая проверка времени
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
};

// Добавление категории меню
partnerProfileSchema.methods.addMenuCategory = function(categoryData) {
  this.menu_categories.push({
    ...categoryData,
    sort_order: this.menu_categories.length
  });
  
  this.business_stats.total_categories = this.menu_categories.length;
  return this.save();
};

// Обновление статистики бизнеса
partnerProfileSchema.methods.updateBusinessStats = function() {
  this.business_stats.total_menu_items = this.menu_items ? this.menu_items.length : 0;
  this.business_stats.total_categories = this.menu_categories.length;
  this.business_stats.total_gallery_images = this.gallery.length;
  this.business_stats.last_stats_update = new Date();
  
  return this.save();
};



// Проверка может ли партнер принимать заказы
partnerProfileSchema.methods.canAcceptOrders = function() {
  return this.is_approved && this.is_active && this.is_public && this.is_currently_open;
};

partnerProfileSchema.methods.updateProductStats = async function() {
  try {
    const Product = mongoose.model('Product');
    
    // Подсчитываем продукты
    const totalProducts = await Product.countDocuments({ partner_id: this._id });
    const activeProducts = await Product.countDocuments({ 
      partner_id: this._id, 
      is_active: true, 
      is_available: true 
    });
    
    // Обновляем статистику
    this.business_stats.total_products = totalProducts;
    this.business_stats.active_products = activeProducts;
    this.business_stats.last_stats_update = new Date();
    
    // Обновляем счетчики категорий
    for (const category of this.menu_categories) {
      const categoryProducts = await Product.countDocuments({ 
        partner_id: this._id, 
        subcategory: category.slug 
      });
      category.products_count = categoryProducts;
    }
    
    return this.save();
  } catch (error) {
    console.error('Ошибка обновления статистики продуктов:', error);
    throw error;
  }
};

// СТАТИЧЕСКИЕ МЕТОДЫ

// Поиск партнеров по зоне доставки
partnerProfileSchema.statics.findByDeliveryZone = function(zoneNumber) {
  return this.find({
    'available_delivery_zones.zone_number': zoneNumber,
    'available_delivery_zones.is_active': true,
    is_approved: true,
    is_active: true,
    is_public: true
  });
};

// Статистика earnings по партнерам
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

// Поиск партнеров поблизости
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

// Поиск популярных партнеров
partnerProfileSchema.statics.findPopular = function(limit = 10, category = null) {
  const matchConditions = {
    is_approved: true,
    is_active: true,
    is_public: true,
    'ratings.total_reviews': { $gte: 5 }
  };
  
  if (category) {
    matchConditions.category = category;
  }
  
  return this.find(matchConditions)
    .sort({ 'ratings.avg_rating': -1, 'ratings.total_reviews': -1 })
    .limit(limit);
};

// НАСТРОЙКИ JSON
partnerProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Убираем зашифрованные поля из JSON ответа
    delete ret.address;
    delete ret.phone;
    delete ret.email;
    delete ret.owner_name;
    delete ret.owner_surname;
    delete ret.__v;
    return ret;
  }
});

partnerProfileSchema.set('toObject', { virtuals: true });

// БЕЗОПАСНАЯ РЕГИСТРАЦИЯ МОДЕЛИ
const PartnerProfile = mongoose.models.PartnerProfile || mongoose.model('PartnerProfile', partnerProfileSchema);
export default PartnerProfile;