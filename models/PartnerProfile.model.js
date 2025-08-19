// models/PartnerProfile.model.js - МОДЕЛЬ С КАТЕГОРИЯМИ МЕНЮ + СТАТИСТИКОЙ 🍽️
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
  
  // 🆕 ГАЛЕРЕЯ
  gallery: [{
    url: { type: String, required: true },
    title: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 200 },
    type: { type: String, enum: ['interior', 'exterior', 'food', 'staff', 'other'], default: 'other' },
    uploaded_at: { type: Date, default: Date.now }
  }],
  
  // 🆕 КАТЕГОРИИ МЕНЮ
  menu_categories: [{
    name: { type: String, required: true, trim: true, maxlength: 50 },
    slug: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 200 },
    image_url: { type: String },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    products_count: { type: Number, default: 0 },
    active_products_count: { type: Number, default: 0 }
  }],
  
  // ГРАФИК
  working_hours: {
    monday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '21:00' } },
    tuesday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '21:00' } },
    wednesday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '21:00' } },
    thursday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '21:00' } },
    friday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '21:00' } },
    saturday: { is_open: { type: Boolean, default: true }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '21:00' } },
    sunday: { is_open: { type: Boolean, default: false }, open_time: { type: String, default: '09:00' }, close_time: { type: String, default: '21:00' } }
  },
  
  // ⭐ РЕЙТИНГИ
  ratings: {
    avg_rating: { type: Number, min: 0, max: 5, default: 0 },
    total_reviews: { type: Number, default: 0 },
    rating_breakdown: {
      five_star: { type: Number, default: 0 },
      four_star: { type: Number, default: 0 },
      three_star: { type: Number, default: 0 },
      two_star: { type: Number, default: 0 },
      one_star: { type: Number, default: 0 }
    }
  },
  
  // 📊 СТАТИСТИКА
  stats: {
    total_orders: { type: Number, default: 0 },
    completed_orders: { type: Number, default: 0 },
    cancelled_orders: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 },
    avg_order_value: { type: Number, default: 0 },
    total_products: { type: Number, default: 0 },
    active_products: { type: Number, default: 0 },
    total_categories: { type: Number, default: 0 },
    total_gallery_images: { type: Number, default: 0 },
    last_stats_update: { type: Date }
  },
  
  // 🎯 СТАТУСЫ
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

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================
partnerProfileSchema.virtual('owner_full_name').get(function() {
  return `${this.owner_name} ${this.owner_surname}`;
});

partnerProfileSchema.virtual('is_currently_open').get(function() {
  const now = new Date();
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5);
  const todaySchedule = this.working_hours[currentDay];
  if (!todaySchedule.is_open) return false;
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
});

partnerProfileSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'partner_id'
});

// ================ МЕТОДЫ ================
partnerProfileSchema.methods.addMenuCategory = function(categoryData) {
  const slug = categoryData.name.toLowerCase()
    .replace(/[^a-zа-я0-9\s]/gi, '')
    .replace(/\s+/g, '-');
  const existingCategory = this.menu_categories.find(cat => cat.slug === slug);
  if (existingCategory) throw new Error('Категория с таким названием уже существует');
  this.menu_categories.push({
    name: categoryData.name,
    slug,
    description: categoryData.description || '',
    image_url: categoryData.image_url || '',
    sort_order: categoryData.sort_order || this.menu_categories.length
  });
  this.stats.total_categories = this.menu_categories.length;
  return this.save();
};

partnerProfileSchema.methods.removeMenuCategory = function(categoryId) {
  this.menu_categories = this.menu_categories.filter(cat => cat._id.toString() !== categoryId.toString());
  this.stats.total_categories = this.menu_categories.length;
  return this.save();
};

partnerProfileSchema.methods.updateMenuCategory = function(categoryId, updateData) {
  const category = this.menu_categories.id(categoryId);
  if (!category) throw new Error('Категория не найдена');
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
 * 🆕 Обновление статистики продуктов (полная версия)
 */
partnerProfileSchema.methods.updateProductStats = async function() {
  const Product = mongoose.model('Product');
  try {
    const totalProducts = await Product.countDocuments({ partner_id: this._id });
    const activeProducts = await Product.countDocuments({ partner_id: this._id, is_active: true, is_available: true });
    this.stats.total_products = totalProducts;
    this.stats.active_products = activeProducts;
    this.stats.last_stats_update = new Date();
    for (let category of this.menu_categories) {
      const categoryProducts = await Product.countDocuments({ partner_id: this._id, subcategory: category.slug });
      const activeCategoryProducts = await Product.countDocuments({ partner_id: this._id, subcategory: category.slug, is_active: true, is_available: true });
      category.products_count = categoryProducts;
      category.active_products_count = activeCategoryProducts;
    }
    return this.save();
  } catch (error) {
    console.error('Ошибка обновления статистики продуктов:', error);
    throw error;
  }
};

/**
 * 🆕 Получение полной статистики меню
 */
partnerProfileSchema.methods.getFullMenuStats = async function() {
  const Product = mongoose.model('Product');
  try {
    const allProducts = await Product.find({ partner_id: this._id });
    const activeProducts = allProducts.filter(p => p.is_active && p.is_available);
    const prices = activeProducts.map(p => p.final_price);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const categoryStats = this.menu_categories.map(category => {
      const categoryProducts = allProducts.filter(p => p.subcategory === category.slug);
      const activeCategoryProducts = categoryProducts.filter(p => p.is_active && p.is_available);
      return {
        category: { id: category._id, name: category.name, slug: category.slug, description: category.description },
        products: { total: categoryProducts.length, active: activeCategoryProducts.length, inactive: categoryProducts.length - activeCategoryProducts.length },
        pricing: {
          avg_price: activeCategoryProducts.length > 0 ? (activeCategoryProducts.reduce((sum, p) => sum + p.final_price, 0) / activeCategoryProducts.length).toFixed(2) : 0,
          min_price: activeCategoryProducts.length > 0 ? Math.min(...activeCategoryProducts.map(p => p.final_price)).toFixed(2) : 0,
          max_price: activeCategoryProducts.length > 0 ? Math.max(...activeCategoryProducts.map(p => p.final_price)).toFixed(2) : 0
        },
        features: {
          has_discounts: categoryProducts.some(p => p.discount_price && p.discount_price > 0),
          has_options: categoryProducts.some(p => p.options_groups && p.options_groups.length > 0),
          avg_preparation_time: categoryProducts.length > 0 ? Math.round(categoryProducts.reduce((sum, p) => sum + (p.preparation_time || 0), 0) / categoryProducts.length) : 0
        }
      };
    });
    return {
      overview: {
        total_categories: this.menu_categories.length,
        total_products: allProducts.length,
        active_products: activeProducts.length,
        inactive_products: allProducts.length - activeProducts.length,
        completion_percentage: this.menu_categories.length > 0 
          ? Math.round((this.menu_categories.filter(cat => allProducts.some(p => p.subcategory === cat.slug)).length / this.menu_categories.length) * 100)
          : 0
      },
      pricing: {
        avg_price: avgPrice.toFixed(2),
        min_price: minPrice.toFixed(2),
        max_price: maxPrice.toFixed(2),
        products_with_discounts: allProducts.filter(p => p.discount_price && p.discount_price > 0).length,
        discount_percentage: allProducts.length > 0 
          ? Math.round((allProducts.filter(p => p.discount_price && p.discount_price > 0).length / allProducts.length) * 100)
          : 0
      },
      categories: categoryStats,
      last_updated: new Date(),
      business_info: { business_name: this.business_name, category: this.category, is_approved: this.is_approved, is_active: this.is_active }
    };
  } catch (error) {
    console.error('Ошибка получения полной статистики меню:', error);
    throw error;
  }
};

/**
 * 🆕 Проверка готовности меню к публикации
 */
partnerProfileSchema.methods.validateMenuCompleteness = function() {
  const issues = [];
  const warnings = [];
  if (this.menu_categories.length === 0) issues.push('Нет категорий меню');
  if (this.menu_categories.length < 2) warnings.push('Рекомендуется создать минимум 2 категории');
  this.menu_categories.forEach(category => {
    if (!category.products_count || category.products_count === 0) issues.push(`В категории "${category.name}" нет продуктов`);
    if (category.products_count < 3) warnings.push(`В категории "${category.name}" мало продуктов (${category.products_count})`);
    if (!category.description || category.description.length < 10) warnings.push(`У категории "${category.name}" слишком короткое описание`);
  });
  if (!this.business_description || this.business_description.length < 50) warnings.push('Рекомендуется добавить подробное описание заведения');
  if (!this.gallery || this.gallery.length === 0) warnings.push('Рекомендуется добавить фото заведения');
  if (this.gallery && this.gallery.length < 3) warnings.push('Рекомендуется добавить больше фото (минимум 3)');
  const workingDays = Object.values(this.working_hours || {}).filter(day => day.is_open);
  if (workingDays.length === 0) issues.push('Не указаны рабочие часы');
  return {
    is_ready: issues.length === 0,
    readiness_score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5)),
    issues,
    warnings,
    recommendations: [
      'Добавьте качественные фото блюд',
      'Укажите время приготовления для каждого блюда',
      'Добавьте теги для лучшего поиска',
      'Проверьте актуальность цен'
    ]
  };
};

partnerProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_reviews;
  const currentAvg = this.ratings.avg_rating;
  this.ratings.avg_rating = ((currentAvg * totalRatings) + newRating) / (totalRatings + 1);
  this.ratings.total_reviews += 1;
  if (newRating === 5) this.ratings.rating_breakdown.five_star += 1;
  else if (newRating === 4) this.ratings.rating_breakdown.four_star += 1;
  else if (newRating === 3) this.ratings.rating_breakdown.three_star += 1;
  else if (newRating === 2) this.ratings.rating_breakdown.two_star += 1;
  else if (newRating === 1) this.ratings.rating_breakdown.one_star += 1;
  return this.save();
};

partnerProfileSchema.methods.isContentReady = function() {
  const hasBasicInfo = this.business_name && this.description;
  const hasCover = this.cover_image_url;
  const hasWorkingHours = Object.values(this.working_hours).some(day => day.is_open);
  const hasCategories = this.menu_categories.length > 0;
  const hasProducts = this.stats.total_products > 0;
  return hasBasicInfo && hasCover && hasWorkingHours && hasCategories && hasProducts;
};

partnerProfileSchema.methods.submitForReview = function() {
  if (!this.isContentReady()) throw new Error('Контент не готов для модерации');
  this.content_status = 'pending_review';
  this.approval_status = 'pending_review';
  return this.save();
};

export default mongoose.model('PartnerProfile', partnerProfileSchema);
