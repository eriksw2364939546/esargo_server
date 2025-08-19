// models/PartnerProfile.model.js - ОБНОВЛЕННАЯ МОДЕЛЬ С КАТЕГОРИЯМИ МЕНЮ 🍽️
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
  
  // 🔐 ЗАШИФРОВАННЫЕ ДАННЫЕ (как было)
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
  
  // 🎨 МЕДИА КОНТЕНТ (обновленное)
  cover_image_url: {
    type: String
  },
  
  // 🆕 ГАЛЕРЕЯ ФОТОГРАФИЙ
  gallery: [{
    url: {
      type: String,
      required: true
    },
    title: {
      type: String,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    },
    type: {
      type: String,
      enum: ['interior', 'exterior', 'food', 'staff', 'other'],
      default: 'other'
    },
    uploaded_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // 🆕 КАТЕГОРИИ МЕНЮ (КАЖДЫЙ ПАРТНЕР СОЗДАЕТ СВОИ!)
  menu_categories: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50 // "Бургеры", "Салаты", "Напитки", "Хлеб", "Молочка"
    },
    slug: {
      type: String,
      required: true,
      trim: true // "burgers", "salads", "drinks", "bread", "dairy"
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    },
    image_url: {
      type: String // Фото категории
    },
    sort_order: {
      type: Number,
      default: 0
    },
    is_active: {
      type: Boolean,
      default: true
    },
    created_at: {
      type: Date,
      default: Date.now
    },
    // Статистика категории
    products_count: {
      type: Number,
      default: 0
    }
  }],
  
  // График работы (как было)
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
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    sunday: {
      is_open: { type: Boolean, default: false },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    }
  },
  
  // ⭐ РЕЙТИНГИ (как было)
  ratings: {
    avg_rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    total_reviews: {
      type: Number,
      default: 0
    },
    rating_breakdown: {
      five_star: { type: Number, default: 0 },
      four_star: { type: Number, default: 0 },
      three_star: { type: Number, default: 0 },
      two_star: { type: Number, default: 0 },
      one_star: { type: Number, default: 0 }
    }
  },
  
  // 📊 СТАТИСТИКА (обновленная)
  stats: {
    total_orders: { type: Number, default: 0 },
    completed_orders: { type: Number, default: 0 },
    cancelled_orders: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 },
    avg_order_value: { type: Number, default: 0 },
    
    // 🆕 СТАТИСТИКА КОНТЕНТА
    total_products: { type: Number, default: 0 },
    active_products: { type: Number, default: 0 },
    total_categories: { type: Number, default: 0 },
    total_gallery_images: { type: Number, default: 0 }
  },
  
  // 🎯 СТАТУСЫ WORKFLOW (как было)
  content_status: {
    type: String,
    enum: ['awaiting_content', 'content_added', 'pending_review', 'approved', 'rejected'],
    default: 'awaiting_content',
    index: true
  },
  
  approval_status: {
    type: String,
    enum: ['awaiting_content', 'pending_review', 'approved', 'rejected'],
    default: 'awaiting_content',
    index: true
  },
  
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
  
  is_public: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // АДМИНИСТРАТИВНЫЕ ПОЛЯ (как было)
  published_at: {
    type: Date,
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
    trim: true
  },
  
  // ССЫЛКА НА ЮРИДИЧЕСКИЕ ДАННЫЕ (как было)
  legal_info_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerLegalInfo'
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ (обновленные) ================
partnerProfileSchema.index({ location: '2dsphere' });
partnerProfileSchema.index({ category: 1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ 'ratings.avg_rating': -1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ content_status: 1, createdAt: -1 });
partnerProfileSchema.index({ 'menu_categories.slug': 1 }); // 🆕 Индекс для категорий

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ (как было) ================
partnerProfileSchema.virtual('owner_full_name').get(function() {
  return `${this.owner_name} ${this.owner_surname}`;
});

partnerProfileSchema.virtual('is_currently_open').get(function() {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5);
  
  const todaySchedule = this.working_hours[currentDay];
  
  if (!todaySchedule.is_open) {
    return false;
  }
  
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
});

// 🆕 Связь с продуктами
partnerProfileSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'partner_id'
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * 🆕 Добавление категории меню
 */
partnerProfileSchema.methods.addMenuCategory = function(categoryData) {
  // Создаем slug из названия
  const slug = categoryData.name.toLowerCase()
    .replace(/[^a-zа-я0-9\s]/gi, '')
    .replace(/\s+/g, '-');
  
  // Проверяем уникальность slug
  const existingCategory = this.menu_categories.find(cat => cat.slug === slug);
  if (existingCategory) {
    throw new Error('Категория с таким названием уже существует');
  }
  
  this.menu_categories.push({
    name: categoryData.name,
    slug: slug,
    description: categoryData.description || '',
    image_url: categoryData.image_url || '',
    sort_order: categoryData.sort_order || this.menu_categories.length
  });
  
  this.stats.total_categories = this.menu_categories.length;
  
  return this.save();
};

/**
 * 🆕 Удаление категории меню
 */
partnerProfileSchema.methods.removeMenuCategory = function(categoryId) {
  this.menu_categories = this.menu_categories.filter(cat => 
    cat._id.toString() !== categoryId.toString()
  );
  
  this.stats.total_categories = this.menu_categories.length;
  
  return this.save();
};

/**
 * 🆕 Обновление категории меню
 */
partnerProfileSchema.methods.updateMenuCategory = function(categoryId, updateData) {
  const category = this.menu_categories.id(categoryId);
  if (!category) {
    throw new Error('Категория не найдена');
  }
  
  if (updateData.name) {
    category.name = updateData.name;
    category.slug = updateData.name.toLowerCase()
      .replace(/[^a-zа-я0-9\s]/gi, '')
      .replace(/\s+/g, '-');
  }
  
  if (updateData.description !== undefined) category.description = updateData.description;
  if (updateData.image_url !== undefined) category.image_url = updateData.image_url;
  if (updateData.sort_order !== undefined) category.sort_order = updateData.sort_order;
  if (updateData.is_active !== undefined) category.is_active = updateData.is_active;
  
  return this.save();
};

/**
 * 🆕 Добавление фото в галерею
 */
partnerProfileSchema.methods.addGalleryImage = function(imageData) {
  this.gallery.push({
    url: imageData.url,
    title: imageData.title || '',
    description: imageData.description || '',
    type: imageData.type || 'other'
  });
  
  this.stats.total_gallery_images = this.gallery.length;
  
  return this.save();
};

/**
 * 🆕 Обновление статистики продуктов
 */
partnerProfileSchema.methods.updateProductStats = async function() {
  const Product = mongoose.model('Product');
  
  const totalProducts = await Product.countDocuments({ partner_id: this._id });
  const activeProducts = await Product.countDocuments({ 
    partner_id: this._id, 
    is_active: true, 
    is_available: true 
  });
  
  this.stats.total_products = totalProducts;
  this.stats.active_products = activeProducts;
  
  // Обновляем количество продуктов в каждой категории
  for (const category of this.menu_categories) {
    const categoryProducts = await Product.countDocuments({
      partner_id: this._id,
      subcategory: category.slug,
      is_active: true,
      is_available: true
    });
    category.products_count = categoryProducts;
  }
  
  return this.save();
};

/**
 * Обновление рейтинга (как было)
 */
partnerProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_reviews;
  const currentAvg = this.ratings.avg_rating;
  
  this.ratings.avg_rating = ((currentAvg * totalRatings) + newRating) / (totalRatings + 1);
  this.ratings.total_reviews += 1;
  
  // Обновляем breakdown
  const starKey = `${newRating}_star`;
  if (newRating === 5) this.ratings.rating_breakdown.five_star += 1;
  else if (newRating === 4) this.ratings.rating_breakdown.four_star += 1;
  else if (newRating === 3) this.ratings.rating_breakdown.three_star += 1;
  else if (newRating === 2) this.ratings.rating_breakdown.two_star += 1;
  else if (newRating === 1) this.ratings.rating_breakdown.one_star += 1;
  
  return this.save();
};

/**
 * 🆕 Проверка готовности контента для модерации
 */
partnerProfileSchema.methods.isContentReady = function() {
  const hasBasicInfo = this.business_name && this.description;
  const hasCover = this.cover_image_url;
  const hasWorkingHours = Object.values(this.working_hours).some(day => day.is_open);
  const hasCategories = this.menu_categories.length > 0;
  const hasProducts = this.stats.total_products > 0;
  
  return hasBasicInfo && hasCover && hasWorkingHours && hasCategories && hasProducts;
};

/**
 * 🆕 Отправка контента на модерацию
 */
partnerProfileSchema.methods.submitForReview = function() {
  if (!this.isContentReady()) {
    throw new Error('Контент не готов для модерации');
  }
  
  this.content_status = 'pending_review';
  this.approval_status = 'pending_review';
  
  return this.save();
};

export default mongoose.model('PartnerProfile', partnerProfileSchema);