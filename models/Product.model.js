// models/Product.model.js - ОБЪЕДИНЁННАЯ МОДЕЛЬ С ПРАВИЛЬНЫМИ СВЯЗЯМИ И ДОПОЛНИТЕЛЬНЫМИ МЕТОДАМИ 🍽️
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  partner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerProfile',
    required: true,
    index: true
  },
  
  // Основная информация о товаре
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discount_price: {
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        return !value || value < this.price;
      },
      message: 'Цена со скидкой должна быть меньше обычной цены'
    }
  },
  image_url: {
    type: String
  },
  
  // 🎯 ГЛОБАЛЬНАЯ КАТЕГОРИЯ (restaurant/store)
  category: {
    type: String,
    required: true,
    enum: ['restaurant', 'store']
  },
  
  // 🆕 КАТЕГОРИЯ МЕНЮ ПАРТНЕРА (slug из menu_categories)
  subcategory: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    index: true
  },
  
  // 🆕 ID КАТЕГОРИИ МЕНЮ (для удобства запросов)
  menu_category_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Добавки (как было - отлично проработано)
  options_groups: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    },
    required: {
      type: Boolean,
      default: false
    },
    multiple_choice: {
      type: Boolean,
      default: false
    },
    max_selections: {
      type: Number,
      default: 1
    },
    options: [{
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      is_available: {
        type: Boolean,
        default: true
      }
    }]
  }],
  
  // Время приготовления (для ресторанов)
  preparation_time: {
    type: Number,
    min: 0,
    default: function() {
      return this.category === 'restaurant' ? 15 : 0;
    }
  },
  
  // Информация о товаре (для магазинов)
  product_info: {
    brand: { type: String, trim: true },
    weight_grams: { type: Number, min: 0 },
    volume_ml: { type: Number, min: 0 },
    unit_count: { type: Number, min: 1, default: 1 },
    expiry_date: { type: Date },
    storage_conditions: { type: String, trim: true }
  },
  
  // Информация о блюде (для ресторанов)
  dish_info: {
    ingredients: [{ type: String, trim: true }],
    allergens: [{
      type: String,
      enum: [
        'глютен', 'молочные продукты', 'яйца', 'орехи',
        'арахис', 'соя', 'рыба', 'морепродукты', 'сельдерей',
        'горчица', 'кунжут', 'сульфиты', 'люпин', 'моллюски'
      ]
    }],
    is_vegetarian: { type: Boolean, default: false },
    is_vegan: { type: Boolean, default: false },
    is_halal: { type: Boolean, default: false },
    is_spicy: { type: Boolean, default: false },
    spice_level: { type: Number, min: 0, max: 5, default: 0 },
    calories: { type: Number, min: 0 },
    portion_size: { type: String, trim: true }
  },
  
  // Наличие и доступность
  is_active: { type: Boolean, default: true },
  is_available: { type: Boolean, default: true },
  stock_quantity: { type: Number, min: 0 },
  low_stock_threshold: { type: Number, min: 0, default: 5 },
  
  // Статистика продаж
  sales_stats: {
    total_sold: { type: Number, default: 0 },
    weekly_sold: { type: Number, default: 0 },
    monthly_sold: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 }
  },
  
  // Рейтинг товара
  ratings: {
    avg_rating: { type: Number, default: 0, min: 0, max: 5 },
    total_ratings: { type: Number, default: 0 }
  },
  
  // Позиция в меню для сортировки
  sort_order: { type: Number, default: 0 },
  
  // Теги для поиска
  tags: [{ type: String, trim: true, lowercase: true }],
  
  // Информация о последнем обновлении
  last_updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ================ ИНДЕКСЫ ================
productSchema.index({ partner_id: 1, is_active: 1, is_available: 1 });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ partner_id: 1, menu_category_id: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.avg_rating': -1 });
productSchema.index({ 'sales_stats.total_sold': -1 });
productSchema.index({ sort_order: 1 });

// Текстовый индекс
productSchema.index({
  title: 'text',
  description: 'text',
  subcategory: 'text',
  'dish_info.ingredients': 'text',
  tags: 'text'
}, {
  weights: {
    title: 10,
    subcategory: 5,
    description: 3,
    'dish_info.ingredients': 2,
    tags: 1
  }
});

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================
productSchema.virtual('final_price').get(function() {
  return this.discount_price || this.price;
});
productSchema.virtual('has_discount').get(function() {
  return !!(this.discount_price && this.discount_price < this.price);
});
productSchema.virtual('discount_percentage').get(function() {
  if (this.has_discount) {
    return Math.round(((this.price - this.discount_price) / this.price) * 100);
  }
  return 0;
});
productSchema.virtual('is_low_stock').get(function() {
  return this.stock_quantity !== undefined &&
         this.stock_quantity <= this.low_stock_threshold;
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================
productSchema.methods.updateSalesStats = function(quantity, orderTotal) {
  this.sales_stats.total_sold += quantity;
  this.sales_stats.weekly_sold += quantity;
  this.sales_stats.monthly_sold += quantity;
  this.sales_stats.total_revenue += orderTotal;
  return this.save();
};
// Уменьшение остатков
productSchema.methods.decreaseStock = function(quantity) {
  if (this.stock_quantity !== undefined) {
    this.stock_quantity = Math.max(0, this.stock_quantity - quantity);
    if (this.stock_quantity === 0) {
      this.is_available = false;
    }
  }
  return this.save();
};

// Увеличение остатков
productSchema.methods.increaseStock = function(quantity) {
  if (this.stock_quantity !== undefined) {
    this.stock_quantity += quantity;
    if (this.stock_quantity > 0 && !this.is_available) {
      this.is_available = true;
    }
  }
  return this.save();
};

// Обновление рейтинга
productSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_ratings;
  const currentAvg = this.ratings.avg_rating;
  this.ratings.total_ratings = totalRatings + 1;
  this.ratings.avg_rating = ((currentAvg * totalRatings) + newRating) / this.ratings.total_ratings;
  return this.save();
};

// Добавление опции в группу
productSchema.methods.addOptionToGroup = function(groupIndex, optionData) {
  if (this.options_groups[groupIndex]) {
    this.options_groups[groupIndex].options.push(optionData);
    return this.save();
  }
  throw new Error('Группа опций не найдена');
};

// Удаление опции из группы
productSchema.methods.removeOptionFromGroup = function(groupIndex, optionIndex) {
  if (this.options_groups[groupIndex] && this.options_groups[groupIndex].options[optionIndex]) {
    this.options_groups[groupIndex].options.splice(optionIndex, 1);
    return this.save();
  }
  throw new Error('Опция не найдена');
};

// Проверка принадлежности продукта к категории партнера
productSchema.methods.validateCategory = async function() {
  const PartnerProfile = mongoose.model('PartnerProfile');
  const partner = await PartnerProfile.findById(this.partner_id);
  if (!partner) throw new Error('Партнер не найден');
  const category = partner.menu_categories.find(cat => cat.slug === this.subcategory);
  if (!category) throw new Error('Категория меню не найдена у этого партнера');
  this.menu_category_id = category._id;
  return true;
};

// Проверка доступности всех выбранных опций
productSchema.methods.validateSelectedOptions = function(selectedOptions) {
  const errors = [];
  selectedOptions.forEach(selection => {
    const group = this.options_groups.find(g => g.name === selection.groupName);
    if (!group) {
      errors.push(`Группа опций "${selection.groupName}" не найдена`);
      return;
    }
    const option = group.options.find(o => o.name === selection.optionName);
    if (!option) {
      errors.push(`Опция "${selection.optionName}" не найдена в группе "${selection.groupName}"`);
      return;
    }
    if (!option.is_available) {
      errors.push(`Опция "${selection.optionName}" недоступна`);
    }
  });
  return errors;
};

// Расчет общей стоимости с опциями
productSchema.methods.calculateTotalPrice = function(quantity = 1, selectedOptions = []) {
  let basePrice = this.final_price * quantity;
  let optionsPrice = 0;
  selectedOptions.forEach(selection => {
    const group = this.options_groups.find(g => g.name === selection.groupName);
    if (group) {
      const option = group.options.find(o => o.name === selection.optionName);
      if (option) {
        optionsPrice += option.price * quantity;
      }
    }
  });
  return basePrice + optionsPrice;
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================
productSchema.statics.findByPartnerCategory = function(partnerId, categorySlug, includeInactive = false) {
  const filter = { partner_id: partnerId, subcategory: categorySlug };
  if (!includeInactive) {
    filter.is_active = true;
    filter.is_available = true;
  }
  return this.find(filter).sort({ sort_order: 1, createdAt: -1 });
};

productSchema.statics.findByPartner = function(partnerId, includeInactive = false) {
  const filter = { partner_id: partnerId };
  if (!includeInactive) {
    filter.is_active = true;
    filter.is_available = true;
  }
  return this.find(filter).sort({ sort_order: 1, createdAt: -1 });
};

productSchema.statics.findByCategory = function(category, subcategory = null) {
  const filter = { category, is_active: true, is_available: true };
  if (subcategory) filter.subcategory = subcategory;
  return this.find(filter).sort({ 'ratings.avg_rating': -1 });
};

productSchema.statics.findPopular = function(limit = 10) {
  return this.find({ is_active: true, is_available: true })
    .sort({ 'sales_stats.total_sold': -1 })
    .limit(limit);
};

productSchema.statics.resetWeeklyStats = function() {
  return this.updateMany({}, { $set: { 'sales_stats.weekly_sold': 0 } });
};
productSchema.statics.resetMonthlyStats = function() {
  return this.updateMany({}, { $set: { 'sales_stats.monthly_sold': 0 } });
};

// ================= ДОПОЛНИТЕЛЬНЫЕ СТАТИЧЕСКИЕ МЕТОДЫ =================
productSchema.statics.findWithFilters = function(filters = {}) {
  const query = { is_active: true, is_available: true };
  if (filters.partner_id) query.partner_id = filters.partner_id;
  if (filters.category) query.category = filters.category;
  if (filters.subcategory) query.subcategory = filters.subcategory;
  if (filters.min_price || filters.max_price) {
    query.price = {};
    if (filters.min_price) query.price.$gte = parseFloat(filters.min_price);
    if (filters.max_price) query.price.$lte = parseFloat(filters.max_price);
  }
  if (filters.min_rating) query['ratings.avg_rating'] = { $gte: parseFloat(filters.min_rating) };
  if (filters.max_preparation_time) query.preparation_time = { $lte: parseInt(filters.max_preparation_time) };
  if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
  if (filters.has_discount) query.discount_price = { $gt: 0 };
  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
      { tags: { $in: [new RegExp(filters.search, 'i')] } }
    ];
  }
  let sort = {};
  switch (filters.sort) {
    case 'price_asc': sort = { price: 1 }; break;
    case 'price_desc': sort = { price: -1 }; break;
    case 'rating': sort = { 'ratings.avg_rating': -1 }; break;
    case 'popular': sort = { 'sales_stats.total_sold': -1 }; break;
    case 'newest': sort = { createdAt: -1 }; break;
    default: sort = { sort_order: 1, createdAt: -1 };
  }
  return this.find(query).sort(sort);
};

productSchema.statics.getPartnerProductStats = async function(partnerId) {
  const stats = await this.aggregate([
    { $match: { partner_id: mongoose.Types.ObjectId(partnerId) } },
    {
      $group: {
        _id: null,
        total_products: { $sum: 1 },
        active_products: { $sum: { $cond: [{ $and: ['$is_active', '$is_available'] }, 1, 0] } },
        avg_price: { $avg: '$price' },
        min_price: { $min: '$price' },
        max_price: { $max: '$price' },
        total_sold: { $sum: '$sales_stats.total_sold' },
        avg_rating: { $avg: '$ratings.avg_rating' },
        products_with_discounts: { $sum: { $cond: [{ $gt: ['$discount_price', 0] }, 1, 0] } }
      }
    }
  ]);
  return stats[0] || {
    total_products: 0,
    active_products: 0,
    avg_price: 0,
    min_price: 0,
    max_price: 0,
    total_sold: 0,
    avg_rating: 0,
    products_with_discounts: 0
  };
};

productSchema.statics.getTopProducts = function(criteria = 'rating', limit = 10, partnerId = null) {
  const match = { is_active: true, is_available: true };
  if (partnerId) match.partner_id = partnerId;
  let sort = {};
  switch (criteria) {
    case 'rating': sort = { 'ratings.avg_rating': -1, 'ratings.total_ratings': -1 }; break;
    case 'sales': sort = { 'sales_stats.total_sold': -1 }; break;
    case 'recent_sales': sort = { 'sales_stats.weekly_sold': -1 }; break;
    case 'newest': sort = { createdAt: -1 }; break;
    case 'price_low': sort = { price: 1 }; break;
    case 'price_high': sort = { price: -1 }; break;
    default: sort = { 'ratings.avg_rating': -1 };
  }
  return this.find(match).sort(sort).limit(limit)
    .populate('partner_id', 'business_name category location.address');
};

productSchema.statics.getPopularTags = async function(partnerId = null, limit = 20) {
  const match = { is_active: true, is_available: true };
  if (partnerId) match.partner_id = partnerId;
  const tags = await this.aggregate([
    { $match: match },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 }, avg_price: { $avg: '$price' } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  return tags.map(tag => ({
    name: tag._id,
    count: tag.count,
    avg_price: Math.round(tag.avg_price * 100) / 100
  }));
};

productSchema.statics.bulkUpdateStatus = function(productIds, updates) {
  const allowedUpdates = {
    is_active: updates.is_active,
    is_available: updates.is_available,
    sort_order: updates.sort_order
  };
  Object.keys(allowedUpdates).forEach(key => {
    if (allowedUpdates[key] === undefined) delete allowedUpdates[key];
  });
  return this.updateMany({ _id: { $in: productIds } }, { $set: allowedUpdates });
};

productSchema.statics.getExpiringDiscounts = function(daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  return this.find({
    is_active: true,
    is_available: true,
    discount_price: { $gt: 0 },
    'discount_info.end_date': { $gte: new Date(), $lte: futureDate }
  }).populate('partner_id', 'business_name contact_phone');
};

productSchema.statics.getMenuRecommendations = async function(partnerId) {
  const products = await this.find({ partner_id: partnerId });
  const activeProducts = products.filter(p => p.is_active && p.is_available);
  const recommendations = [];
  if (activeProducts.length < 5) {
    recommendations.push({ type: 'content', priority: 'high', message: 'Добавьте больше блюд в меню (минимум 5 активных позиций)', action: 'add_products' });
  }
  const productsWithoutImages = activeProducts.filter(p => !p.image_url);
  if (productsWithoutImages.length > 0) {
    recommendations.push({ type: 'visual', priority: 'high', message: `${productsWithoutImages.length} блюд без фото`, action: 'add_images', affected_products: productsWithoutImages.map(p => p._id) });
  }
  const productsWithShortDescriptions = activeProducts.filter(p => !p.description || p.description.length < 20);
  if (productsWithShortDescriptions.length > 0) {
    recommendations.push({ type: 'content', priority: 'medium', message: `${productsWithShortDescriptions.length} блюд с короткими описаниями`, action: 'improve_descriptions', affected_products: productsWithShortDescriptions.map(p => p._id) });
  }
  const productsWithoutTags = activeProducts.filter(p => !p.tags || p.tags.length === 0);
  if (productsWithoutTags.length > 0) {
    recommendations.push({ type: 'seo', priority: 'low', message: `${productsWithoutTags.length} блюд без тегов`, action: 'add_tags', affected_products: productsWithoutTags.map(p => p._id) });
  }
  const prices = activeProducts.map(p => p.final_price);
  if (prices.length > 0) {
    const priceRange = Math.max(...prices) - Math.min(...prices);
    if (priceRange < 5) {
      recommendations.push({ type: 'pricing', priority: 'low', message: 'Рассмотрите возможность расширения ценового диапазона', action: 'review_pricing' });
    }
  }
  return recommendations;
};

productSchema.statics.duplicateProduct = async function(productId, partnerId, newTitle = null) {
  const originalProduct = await this.findById(productId);
  if (!originalProduct) throw new Error('Продукт не найден');
  const duplicatedProduct = new this({
    ...originalProduct.toObject(),
    _id: undefined,
    partner_id: partnerId,
    title: newTitle || `${originalProduct.title} (копия)`,
    sales_stats: { total_sold: 0, weekly_sold: 0, monthly_sold: 0 },
    ratings: { avg_rating: 0, total_ratings: 0 },
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return duplicatedProduct.save();
};

// Настройка виртуальных полей в JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export default mongoose.model('Product', productSchema);
