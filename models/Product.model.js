// ================ models/Product.model.js - ПОЛНАЯ МОДЕЛЬ ПРОДУКТА ================
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  // ============ ОСНОВНЫЕ СВЯЗИ ============
  partner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerProfile',
    required: true,
    index: true
  },
  
  // ============ БАЗОВЫЕ ПОЛЯ ПРОДУКТА ============
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  description: {
    type: String,
    trim: true,
    maxlength: 800
  },
  price: {
    type: Number,
    required: true,
    min: 0.01 // Минимум 1 цент
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
    type: String,
    default: ''
  },
  
  // ============ КАТЕГОРИЗАЦИЯ ============
  category: {
    type: String,
    required: true,
    enum: ['restaurant', 'store'],
    index: true
  },
  subcategory: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    index: true
  },
  menu_category_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // ============ ОПЦИИ ДЛЯ РЕСТОРАНОВ (добавки к блюдам) ============
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
      maxlength: 200,
      default: ''
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
      default: 1,
      min: 1
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
  
  // ============ ВРЕМЯ ПРИГОТОВЛЕНИЯ (только для ресторанов) ============
  preparation_time: {
    type: Number,
    min: 0,
    default: function() {
      return this.category === 'restaurant' ? 15 : 0;
    }
  },
  
  // ============ ИНФОРМАЦИЯ О БЛЮДЕ (для ресторанов) ============
  dish_info: {
    ingredients: [{ 
      type: String, 
      trim: true,
      maxlength: 100 
    }],
    
    // ✅ ОБРАТНАЯ СОВМЕСТИМОСТЬ: поддерживаем старые + новые аллергены
    allergens: [{
      type: String,
      enum: [
        // Старые русские (совместимость)
        'глютен', 'молочные продукты', 'яйца', 'орехи',
        'арахис', 'соя', 'рыба', 'морепродукты', 'сельдерей',
        'горчица', 'кунжут', 'сульфиты', 'люпин', 'моллюски',
        
        // 🆕 Новые французские стандарты
        'gluten', 'lait', 'œufs', 'fruits_à_coque',
        'arachides', 'soja', 'poissons', 'crustacés', 'céleri',
        'moutarde', 'graines_de_sésame', 'anhydride_sulfureux_et_sulfites',
        'lupin', 'mollusques',
        
        // 🆕 Английские (интернационализация)  
        'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'tree_nuts',
        'shellfish', 'sesame', 'mustard', 'celery', 'sulfites'
      ]
    }],
    
    // Уровень остроты (поддержка строк и чисел)
    spice_level: {
      type: mongoose.Schema.Types.Mixed, // Поддержка строк и чисел
      default: 0,
      validate: {
        validator: function(value) {
          if (typeof value === 'number') {
            return value >= 0 && value <= 5;
          }
          if (typeof value === 'string') {
            const allowedStrings = [
              'нет', 'слабо', 'средне', 'остро', 'очень остро', 'экстрим',
              'none', 'mild', 'medium', 'hot', 'very hot', 'extreme',
              'aucun', 'doux', 'moyen', 'piquant', 'très piquant', 'extrême'
            ];
            return allowedStrings.includes(value.toLowerCase());
          }
          return false;
        },
        message: 'Недопустимый уровень остроты'
      }
    },
    
    // Дополнительная информация о блюде
    cuisine_type: { 
      type: String, 
      trim: true,
      maxlength: 50 
    },
    cooking_method: {
      type: String,
      enum: ['grilled', 'fried', 'baked', 'steamed', 'raw', 'boiled', 'roasted'],
      trim: true
    },
    portion_size: {
      type: String,
      enum: ['small', 'medium', 'large', 'extra_large'],
      default: 'medium'
    }
  },
  
  // ============ ИНФОРМАЦИЯ О ТОВАРЕ (для магазинов) ============
  product_info: {
    brand: { 
      type: String, 
      trim: true,
      maxlength: 100 
    },
    weight_grams: { 
      type: Number, 
      min: 0 
    },
    volume_ml: { 
      type: Number, 
      min: 0 
    },
    unit_count: { 
      type: Number, 
      min: 1, 
      default: 1 
    },
    expiry_date: { 
      type: Date 
    },
    storage_conditions: { 
      type: String, 
      trim: true,
      maxlength: 200 
    },
    
    // 🆕 ФРАНЦУЗСКИЕ СТАНДАРТЫ ДЛЯ МАГАЗИНОВ
    packaging_type: {
      type: String,
      enum: [
        'vrac',        // россыпью
        'emballé',     // упакованный
        'sous_vide',   // в вакууме
        'conserve',    // консервы
        'frais',       // свежий
        'surgelé',     // замороженный
        'sec'          // сухой
      ]
    },
    origin_country: { 
      type: String, 
      default: 'France',
      trim: true,
      maxlength: 50 
    },
    
    // Штрих-коды (французские стандарты)
    barcode_ean13: { 
      type: String, 
      match: /^\d{13}$/,
      validate: {
        validator: function(value) {
          if (!value) return true; // Опционально
          return /^\d{13}$/.test(value);
        },
        message: 'Штрих-код EAN13 должен содержать ровно 13 цифр'
      }
    },
    barcode_ean8: { 
      type: String, 
      match: /^\d{8}$/,
      validate: {
        validator: function(value) {
          if (!value) return true; // Опционально
          return /^\d{8}$/.test(value);
        },
        message: 'Штрих-код EAN8 должен содержать ровно 8 цифр'
      }
    },
    
    // Дополнительная информация об упаковке
    packaging_metadata: {
      has_weight: { type: Boolean, default: false },
      has_volume: { type: Boolean, default: false },
      has_barcode: { type: Boolean, default: false },
      unit_type: { 
        type: String, 
        enum: ['weight', 'volume', 'count'],
        default: 'count'
      }
    }
  },
  
  // ============ МУЛЬТИЯЗЫЧНАЯ ПОДДЕРЖКА ============
  multilingual: {
    title_en: { type: String, trim: true },
    title_fr: { type: String, trim: true },
    description_en: { type: String, trim: true },
    description_fr: { type: String, trim: true }
  },
  
  // ============ ФРАНЦУЗСКАЯ НАЛОГОВАЯ ИНФОРМАЦИЯ ============
  tax_info: {
    tva_rate: {
      type: Number,
      min: 0,
      max: 1,
      default: function() {
        return this.category === 'restaurant' ? 0.10 : 0.20; // 10% для ресторанов, 20% для магазинов
      }
    },
    tax_category: {
      type: String,
      enum: ['standard', 'reduced', 'super_reduced', 'zero'],
      default: function() {
        return this.category === 'restaurant' ? 'reduced' : 'standard';
      }
    },
    eco_tax: { type: Number, min: 0, default: 0 }
  },
  
  // ============ ДИЕТИЧЕСКИЕ МЕТКИ ============
  dietary_labels: [{
    type: String,
    enum: [
      'vegetarian', 'vegan', 'gluten_free', 'lactose_free',
      'organic', 'kosher', 'halal', 'sugar_free', 'low_fat',
      'high_protein', 'keto_friendly', 'raw'
    ]
  }],
  
  // ============ ДОСТУПНОСТЬ И РАСПИСАНИЕ ============
  availability_schedule: {
    monday: { available: { type: Boolean, default: true }, start_time: String, end_time: String },
    tuesday: { available: { type: Boolean, default: true }, start_time: String, end_time: String },
    wednesday: { available: { type: Boolean, default: true }, start_time: String, end_time: String },
    thursday: { available: { type: Boolean, default: true }, start_time: String, end_time: String },
    friday: { available: { type: Boolean, default: true }, start_time: String, end_time: String },
    saturday: { available: { type: Boolean, default: true }, start_time: String, end_time: String },
    sunday: { available: { type: Boolean, default: true }, start_time: String, end_time: String }
  },
  
  // ============ СТАТУС И УПРАВЛЕНИЕ ============
  is_active: { type: Boolean, default: true },
  is_available: { type: Boolean, default: true },
  stock_quantity: { type: Number, min: 0 },
  low_stock_threshold: { type: Number, min: 0, default: 5 },
  
  // ============ СТАТИСТИКА ПРОДАЖ ============
  sales_stats: {
    total_sold: { type: Number, default: 0 },
    weekly_sold: { type: Number, default: 0 },
    monthly_sold: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 }
  },
  
  // ============ РЕЙТИНГИ ============
  ratings: {
    avg_rating: { type: Number, default: 0, min: 0, max: 5 },
    total_ratings: { type: Number, default: 0 }
  },
  
  // ============ МЕТАДАННЫЕ ============
  sort_order: { type: Number, default: 0 },
  tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
  last_updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============ ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ ============
productSchema.index({ partner_id: 1, is_active: 1, is_available: 1 });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.avg_rating': -1 });
productSchema.index({ 'sales_stats.total_sold': -1 });
productSchema.index({ tags: 1 });
productSchema.index({ dietary_labels: 1 });

// ============ ВИРТУАЛЬНЫЕ ПОЛЯ ============

/**
 * Финальная цена (с учетом скидки)
 */
productSchema.virtual('final_price').get(function() {
  return this.discount_price && this.discount_price > 0 ? this.discount_price : this.price;
});

/**
 * Есть ли скидка
 */
productSchema.virtual('has_discount').get(function() {
  return !!this.discount_price && this.discount_price < this.price;
});

/**
 * Процент скидки
 */
productSchema.virtual('discount_percentage').get(function() {
  if (!this.has_discount) return 0;
  return Math.round(((this.price - this.discount_price) / this.price) * 100);
});

/**
 * Статус наличия на складе
 */
productSchema.virtual('stock_status').get(function() {
  if (this.stock_quantity === undefined || this.stock_quantity === null) return 'unlimited';
  if (this.stock_quantity === 0) return 'out_of_stock';
  if (this.stock_quantity <= this.low_stock_threshold) return 'low_stock';
  return 'in_stock';
});

/**
 * Информация о доступности сейчас
 */
productSchema.virtual('current_availability').get(function() {
  if (!this.is_active || !this.is_available) return false;
  
  // Проверяем расписание доступности
  if (this.availability_schedule) {
    const now = new Date();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const daySchedule = this.availability_schedule[currentDay];
    
    if (!daySchedule || !daySchedule.available) return false;
    
    if (daySchedule.start_time && daySchedule.end_time) {
      const currentTime = now.toTimeString().slice(0, 5);
      return currentTime >= daySchedule.start_time && currentTime <= daySchedule.end_time;
    }
  }
  
  return true;
});

// ============ МЕТОДЫ ЭКЗЕМПЛЯРА ============

/**
 * Валидация принадлежности к партнеру через категорию
 */
productSchema.methods.validateCategory = async function() {
  const PartnerProfile = mongoose.model('PartnerProfile');
  const partner = await PartnerProfile.findById(this.partner_id);
  
  if (!partner) {
    throw new Error('Партнер не найден');
  }
  
  const category = partner.menu_categories.find(cat => cat.slug === this.subcategory);
  if (!category) {
    throw new Error('Категория меню не найдена у этого партнера');
  }
  
  this.menu_category_id = category._id;
  return true;
};

/**
 * Расчет общей стоимости с учетом опций и количества
 * @param {number} quantity - Количество товара
 * @param {Array} selectedOptions - Выбранные опции [{ groupName, optionName }]
 * @returns {object} - Детальный расчет стоимости
 */
productSchema.methods.calculateTotalPrice = function(quantity = 1, selectedOptions = []) {
  let basePrice = this.final_price * quantity;
  let optionsPrice = 0;
  const appliedOptions = [];
  
  // Обрабатываем опции только для ресторанов
  if (this.category === 'restaurant' && this.options_groups.length > 0) {
    selectedOptions.forEach(selection => {
      const group = this.options_groups.find(g => g.name === selection.groupName);
      if (group) {
        const option = group.options.find(o => o.name === selection.optionName);
        if (option && option.is_available) {
          const optionTotal = option.price * quantity;
          optionsPrice += optionTotal;
          appliedOptions.push({
            group: group.name,
            option: option.name,
            unit_price: option.price,
            total_price: optionTotal
          });
        }
      }
    });
  }
  
  const totalPrice = basePrice + optionsPrice;
  
  // Расчет налогов
  let taxCalculation = null;
  if (this.tax_info?.tva_rate) {
    const tvaAmount = totalPrice * this.tax_info.tva_rate;
    const ecoTax = this.tax_info.eco_tax || 0;
    
    taxCalculation = {
      price_before_tax: totalPrice,
      tva_rate: this.tax_info.tva_rate,
      tva_amount: Math.round(tvaAmount * 100) / 100,
      eco_tax: ecoTax * quantity,
      total_tax: Math.round((tvaAmount + (ecoTax * quantity)) * 100) / 100,
      price_with_tax: Math.round((totalPrice + tvaAmount + (ecoTax * quantity)) * 100) / 100
    };
  }
  
  return {
    base_price: Math.round(basePrice * 100) / 100,
    options_price: Math.round(optionsPrice * 100) / 100,
    total_price: Math.round(totalPrice * 100) / 100,
    quantity: quantity,
    applied_options: appliedOptions,
    tax_calculation: taxCalculation,
    currency: 'EUR',
    business_type: this.category
  };
};

/**
 * Получение локализованного названия
 * @param {string} language - Код языка (ru, en, fr)
 * @returns {string} - Локализованное название
 */
productSchema.methods.getLocalizedTitle = function(language = 'ru') {
  if (this.multilingual) {
    const field = `title_${language}`;
    return this.multilingual[field] || this.title;
  }
  return this.title;
};

/**
 * Получение локализованного описания
 * @param {string} language - Код языка (ru, en, fr)
 * @returns {string} - Локализованное описание
 */
productSchema.methods.getLocalizedDescription = function(language = 'ru') {
  if (this.multilingual) {
    const field = `description_${language}`;
    return this.multilingual[field] || this.description;
  }
  return this.description;
};

/**
 * Получение отображаемого уровня остроты
 * @param {string} language - Код языка
 * @returns {string} - Локализованный уровень остроты
 */
productSchema.methods.getSpiceLevelDisplay = function(language = 'ru') {
  const value = this.dish_info?.spice_level;
  
  if (typeof value === 'number') {
    const levelMaps = {
      ru: ['нет', 'слабо', 'средне', 'остро', 'очень остро', 'экстрим'],
      fr: ['aucun', 'doux', 'moyen', 'piquant', 'très piquant', 'extrême'],
      en: ['none', 'mild', 'medium', 'hot', 'very hot', 'extreme']
    };
    return levelMaps[language]?.[value] || value.toString();
  }
  
  return value || 'нет';
};

/**
 * Расчет французских налогов
 * @returns {object} - Детальная информация о налогах
 */
productSchema.methods.calculateTaxes = function() {
  if (!this.tax_info?.tva_rate) return null;
  
  const basePrice = this.final_price;
  const tvaAmount = basePrice * this.tax_info.tva_rate;
  const ecoTax = this.tax_info.eco_tax || 0;
  
  return {
    base_price: Math.round(basePrice * 100) / 100,
    tva_rate: this.tax_info.tva_rate,
    tva_amount: Math.round(tvaAmount * 100) / 100,
    eco_tax: ecoTax,
    total_tax: Math.round((tvaAmount + ecoTax) * 100) / 100,
    final_price_with_tax: Math.round((basePrice + tvaAmount + ecoTax) * 100) / 100,
    tax_category: this.tax_info.tax_category,
    currency: 'EUR'
  };
};

/**
 * Получение информации для отображения (адаптировано под тип заведения)
 * @returns {object} - Объект для отображения в UI
 */
productSchema.methods.getDisplayInfo = function() {
  const base = {
    id: this._id,
    title: this.title,
    description: this.description,
    price: this.price,
    discount_price: this.discount_price,
    final_price: this.final_price,
    has_discount: this.has_discount,
    discount_percentage: this.discount_percentage,
    image_url: this.image_url,
    category: this.category,
    subcategory: this.subcategory,
    is_active: this.is_active,
    is_available: this.is_available,
    current_availability: this.current_availability,
    stock_status: this.stock_status,
    tags: this.tags,
    ratings: this.ratings,
    created_at: this.createdAt,
    updated_at: this.updatedAt
  };
  
  if (this.category === 'restaurant') {
    // 🍽️ ИНФОРМАЦИЯ ДЛЯ РЕСТОРАНА
    return {
      ...base,
      preparation_time: this.preparation_time,
      options_groups: this.options_groups,
      dish_info: this.dish_info,
      dietary_labels: this.dietary_labels,
      has_options: this.options_groups.length > 0,
      business_features: {
        type: 'restaurant',
        supports_customization: this.options_groups.length > 0,
        estimated_time: this.preparation_time
      }
    };
  } else if (this.category === 'store') {
    // 🏪 ИНФОРМАЦИЯ ДЛЯ МАГАЗИНА
    return {
      ...base,
      product_info: this.product_info,
      stock_quantity: this.stock_quantity,
      low_stock_threshold: this.low_stock_threshold,
      has_packaging_info: !!this.product_info,
      business_features: {
        type: 'store',
        has_weight: !!this.product_info?.weight_grams,
        has_volume: !!this.product_info?.volume_ml,
        has_barcode: !!(this.product_info?.barcode_ean13 || this.product_info?.barcode_ean8),
        origin_country: this.product_info?.origin_country
      }
    };
  }
  
  return base;
};

/**
 * Проверка доступности в текущее время
 * @returns {boolean} - Доступен ли продукт сейчас
 */
productSchema.methods.isAvailableNow = function() {
  if (!this.is_active || !this.is_available) return false;
  
  // Проверка складского остатка для магазинов
  if (this.category === 'store' && this.stock_quantity !== undefined) {
    if (this.stock_quantity <= 0) return false;
  }
  
  // Проверка расписания доступности
  if (this.availability_schedule) {
    const now = new Date();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const daySchedule = this.availability_schedule[currentDay];
    
    if (!daySchedule || !daySchedule.available) return false;
    
    if (daySchedule.start_time && daySchedule.end_time) {
      const currentTime = now.toTimeString().slice(0, 5);
      return currentTime >= daySchedule.start_time && currentTime <= daySchedule.end_time;
    }
  }
  
  return true;
};

/**
 * Получение совместимых диетических меток
 * @returns {Array} - Массив совместимых диетических меток
 */
productSchema.methods.getCompatibleDietaryLabels = function() {
  const compatible = [];
  
  if (this.dish_info?.allergens) {
    const allergens = this.dish_info.allergens;
    
    // Проверяем на отсутствие определенных аллергенов
    if (!allergens.some(a => ['глютен', 'gluten'].includes(a))) {
      compatible.push('gluten_free');
    }
    if (!allergens.some(a => ['молочные продукты', 'lait', 'milk'].includes(a))) {
      compatible.push('lactose_free');
    }
    if (!allergens.some(a => ['яйца', 'œufs', 'eggs'].includes(a))) {
      compatible.push('vegan_friendly');
    }
  }
  
  return compatible;
};

// ============ СТАТИЧЕСКИЕ МЕТОДЫ ============

/**
 * Поиск продуктов партнера по категории
 * @param {ObjectId} partnerId - ID партнера (PartnerProfile._id)
 * @param {string} categorySlug - Slug категории
 * @param {boolean} includeInactive - Включить неактивные продукты
 * @returns {Promise<Array>} - Массив продуктов
 */
productSchema.statics.findByPartnerCategory = function(partnerId, categorySlug, includeInactive = false) {
  const query = { 
    partner_id: partnerId, 
    subcategory: categorySlug 
  };
  
  if (!includeInactive) {
    query.is_active = true;
    query.is_available = true;
  }
  
  return this.find(query).sort({ sort_order: 1, createdAt: -1 });
};

/**
 * Поиск всех продуктов партнера
 * @param {ObjectId} partnerId - ID партнера (PartnerProfile._id)
 * @param {boolean} includeInactive - Включить неактивные продукты
 * @returns {Promise<Array>} - Массив продуктов
 */
productSchema.statics.findByPartner = function(partnerId, includeInactive = false) {
  const query = { partner_id: partnerId };
  
  if (!includeInactive) {
    query.is_active = true;
    query.is_available = true;
  }
  
  return this.find(query).sort({ subcategory: 1, sort_order: 1, createdAt: -1 });
};

/**
 * Поиск продуктов с французскими фильтрами
 * @param {ObjectId} partnerId - ID партнера
 * @param {object} filters - Объект фильтров
 * @returns {Promise<Array>} - Отфильтрованные продукты
 */
productSchema.statics.findWithFrenchFilters = function(partnerId, filters = {}) {
  const query = { partner_id: partnerId, is_active: true };
  
  // Базовые фильтры
  if (filters.category_slug) {
    query.subcategory = filters.category_slug;
  }
  
  if (filters.price_min || filters.price_max) {
    query.price = {};
    if (filters.price_min) query.price.$gte = parseFloat(filters.price_min);
    if (filters.price_max) query.price.$lte = parseFloat(filters.price_max);
  }
  
  // Диетические фильтры
  if (filters.dietary_labels && filters.dietary_labels.length > 0) {
    query.dietary_labels = { $in: filters.dietary_labels };
  }
  
  // Фильтр по аллергенам (исключение)
  if (filters.allergen_free && filters.allergen_free.length > 0) {
    query['dish_info.allergens'] = { $nin: filters.allergen_free };
  }
  
  // Фильтр по типу кухни
  if (filters.cuisine_type) {
    query['dish_info.cuisine_type'] = filters.cuisine_type;
  }
  
  // Фильтр по максимальному уровню остроты
  if (filters.spice_level_max !== undefined) {
    query['dish_info.spice_level'] = { $lte: parseInt(filters.spice_level_max) };
  }
  
  // Фильтр по времени доступности
  if (filters.availability_time) {
    const [day, time] = filters.availability_time.split('_');
    if (day && time) {
      query[`availability_schedule.${day}.available`] = true;
      if (time !== 'all') {
        query[`availability_schedule.${day}.start_time`] = { $lte: time };
        query[`availability_schedule.${day}.end_time`] = { $gte: time };
      }
    }
  }
  
  // Фильтр по наличию на складе (для магазинов)
  if (filters.in_stock_only === 'true') {
    query.$or = [
      { stock_quantity: { $exists: false } }, // Неограниченный запас
      { stock_quantity: { $gt: 0 } }          // Есть на складе
    ];
  }
  
  return this.find(query).sort({ 
    sort_order: 1, 
    'ratings.avg_rating': -1, 
    createdAt: -1 
  });
};

/**
 * Поиск популярных продуктов партнера
 * @param {ObjectId} partnerId - ID партнера
 * @param {number} limit - Лимит результатов
 * @returns {Promise<Array>} - Популярные продукты
 */
productSchema.statics.findPopularByPartner = function(partnerId, limit = 10) {
  return this.find({ 
    partner_id: partnerId, 
    is_active: true, 
    is_available: true 
  })
  .sort({ 
    'sales_stats.total_sold': -1, 
    'ratings.avg_rating': -1 
  })
  .limit(limit);
};

/**
 * Поиск продуктов по тегам
 * @param {ObjectId} partnerId - ID партнера
 * @param {Array} tags - Массив тегов
 * @returns {Promise<Array>} - Продукты с указанными тегами
 */
productSchema.statics.findByTags = function(partnerId, tags) {
  return this.find({
    partner_id: partnerId,
    is_active: true,
    is_available: true,
    tags: { $in: tags }
  }).sort({ 'ratings.avg_rating': -1, createdAt: -1 });
};

/**
 * Поиск продуктов в ценовом диапазоне
 * @param {ObjectId} partnerId - ID партнера
 * @param {number} minPrice - Минимальная цена
 * @param {number} maxPrice - Максимальная цена
 * @returns {Promise<Array>} - Продукты в диапазоне
 */
productSchema.statics.findByPriceRange = function(partnerId, minPrice, maxPrice) {
  return this.find({
    partner_id: partnerId,
    is_active: true,
    is_available: true,
    price: { $gte: minPrice, $lte: maxPrice }
  }).sort({ price: 1 });
};

/**
 * Массовое обновление статуса продуктов
 * @param {Array} productIds - Массив ID продуктов
 * @param {object} statusUpdate - Объект с обновлениями статуса
 * @returns {Promise<object>} - Результат обновления
 */
productSchema.statics.bulkUpdateStatus = function(productIds, statusUpdate) {
  const objectIds = productIds.map(id => new mongoose.Types.ObjectId(id));
  
  return this.updateMany(
    { _id: { $in: objectIds } },
    { 
      ...statusUpdate,
      updatedAt: new Date()
    }
  );
};

/**
 * Получение агрегированной статистики по партнеру
 * @param {ObjectId} partnerId - ID партнера
 * @returns {Promise<object>} - Агрегированная статистика
 */
productSchema.statics.getPartnerStats = function(partnerId) {
  return this.aggregate([
    { $match: { partner_id: partnerId } },
    {
      $group: {
        _id: '$subcategory',
        total_products: { $sum: 1 },
        active_products: {
          $sum: {
            $cond: [
              { $and: ['$is_active', '$is_available'] },
              1,
              0
            ]
          }
        },
        avg_price: { $avg: '$price' },
        min_price: { $min: '$price' },
        max_price: { $max: '$price' },
        total_sales: { $sum: '$sales_stats.total_sold' },
        total_revenue: { $sum: '$sales_stats.total_revenue' },
        avg_rating: { $avg: '$ratings.avg_rating' }
      }
    },
    { $sort: { total_products: -1 } }
  ]);
};

// ============ MIDDLEWARE СХЕМЫ ============

/**
 * Pre-save middleware: Обновление метаданных упаковки для магазинов
 */
productSchema.pre('save', function(next) {
  // Автоматическое обновление метаданных упаковки для магазинов
  if (this.category === 'store' && this.product_info) {
    if (!this.product_info.packaging_metadata) {
      this.product_info.packaging_metadata = {};
    }
    
    this.product_info.packaging_metadata.has_weight = !!this.product_info.weight_grams;
    this.product_info.packaging_metadata.has_volume = !!this.product_info.volume_ml;
    this.product_info.packaging_metadata.has_barcode = !!(this.product_info.barcode_ean13 || this.product_info.barcode_ean8);
    
    // Определяем тип единицы измерения
    if (this.product_info.weight_grams) {
      this.product_info.packaging_metadata.unit_type = 'weight';
    } else if (this.product_info.volume_ml) {
      this.product_info.packaging_metadata.unit_type = 'volume';
    } else {
      this.product_info.packaging_metadata.unit_type = 'count';
    }
  }
  
  // Автоматическая установка налоговой ставки по умолчанию
  if (!this.tax_info?.tva_rate) {
    if (!this.tax_info) this.tax_info = {};
    this.tax_info.tva_rate = this.category === 'restaurant' ? 0.10 : 0.20;
    this.tax_info.tax_category = this.category === 'restaurant' ? 'reduced' : 'standard';
  }
  
  next();
});

/**
 * Pre-save middleware: Валидация бизнес-правил
 */
productSchema.pre('save', function(next) {
  // Ресторан: должно быть время приготовления
  if (this.category === 'restaurant') {
    if (!this.preparation_time || this.preparation_time === 0) {
      this.preparation_time = 15; // По умолчанию 15 минут
    }
  }
  
  // Магазин: не должно быть опций и времени приготовления
  if (this.category === 'store') {
    if (this.options_groups && this.options_groups.length > 0) {
      return next(new Error('Магазины не могут иметь опции (добавки)'));
    }
    this.preparation_time = 0;
  }
  
  next();
});

/**
 * Post-save middleware: Обновление статистики партнера
 */
productSchema.post('save', async function() {
  try {
    const PartnerProfile = mongoose.model('PartnerProfile');
    const partner = await PartnerProfile.findById(this.partner_id);
    if (partner) {
      await partner.updateProductStats();
    }
  } catch (error) {
    console.error('Ошибка обновления статистики партнера после сохранения продукта:', error);
  }
});

/**
 * Post-remove middleware: Обновление статистики после удаления
 */
productSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const PartnerProfile = mongoose.model('PartnerProfile');
      const partner = await PartnerProfile.findById(doc.partner_id);
      if (partner) {
        await partner.updateProductStats();
      }
    } catch (error) {
      console.error('Ошибка обновления статистики партнера после удаления продукта:', error);
    }
  }
});

// ============ ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ============

/**
 * Статический метод: Валидация данных продукта перед созданием
 * @param {object} productData - Данные продукта
 * @param {string} partnerCategory - Категория партнера
 * @returns {object} - Результат валидации
 */
productSchema.statics.validateProductData = function(productData, partnerCategory) {
  const errors = [];
  const warnings = [];
  
  // Базовая валидация
  if (!productData.title || productData.title.trim().length === 0) {
    errors.push('Название продукта обязательно');
  }
  
  if (!productData.price || productData.price <= 0) {
    errors.push('Цена должна быть больше нуля');
  }
  
  if (productData.discount_price && productData.discount_price >= productData.price) {
    errors.push('Скидочная цена должна быть меньше обычной цены');
  }
  
  // Валидация по типу заведения
  if (partnerCategory === 'restaurant') {
    if (!productData.preparation_time || productData.preparation_time < 1) {
      warnings.push('Рекомендуется указать время приготовления');
    }
    
    if (productData.product_info && Object.keys(productData.product_info).length > 0) {
      warnings.push('Информация об упаковке обычно не используется для ресторанных блюд');
    }
  }
  
  if (partnerCategory === 'store') {
    if (productData.options_groups && productData.options_groups.length > 0) {
      errors.push('Магазины не могут иметь опции (добавки)');
    }
    
    if (productData.preparation_time && productData.preparation_time > 0) {
      warnings.push('Время приготовления не применимо для товаров магазина');
    }
    
    if (!productData.product_info || 
        (!productData.product_info.weight_grams && 
         !productData.product_info.volume_ml && 
         !productData.product_info.unit_count)) {
      warnings.push('Рекомендуется указать информацию об упаковке (вес, объём или количество)');
    }
  }
  
  return {
    is_valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Статический метод: Поиск по текстовому запросу
 * @param {ObjectId} partnerId - ID партнера
 * @param {string} searchQuery - Поисковый запрос
 * @returns {Promise<Array>} - Найденные продукты
 */
productSchema.statics.searchByText = function(partnerId, searchQuery) {
  const regex = new RegExp(searchQuery, 'i');
  
  return this.find({
    partner_id: partnerId,
    is_active: true,
    is_available: true,
    $or: [
      { title: regex },
      { description: regex },
      { tags: { $in: [regex] } },
      { 'dish_info.ingredients': { $in: [regex] } }
    ]
  }).sort({ 'ratings.avg_rating': -1, 'sales_stats.total_sold': -1 });
};

/**
 * Статический метод: Получение продуктов со скидками
 * @param {ObjectId} partnerId - ID партнера
 * @returns {Promise<Array>} - Продукты со скидками
 */
productSchema.statics.findDiscountedByPartner = function(partnerId) {
  return this.find({
    partner_id: partnerId,
    is_active: true,
    is_available: true,
    discount_price: { $exists: true, $gt: 0 }
  }).sort({ 
    discount_percentage: -1, 
    'ratings.avg_rating': -1 
  });
};

/**
 * Статический метод: Получение товаров с низким остатком (для магазинов)
 * @param {ObjectId} partnerId - ID партнера
 * @returns {Promise<Array>} - Товары с низким остатком
 */
productSchema.statics.findLowStockByPartner = function(partnerId) {
  return this.find({
    partner_id: partnerId,
    category: 'store',
    is_active: true,
    stock_quantity: { $exists: true },
    $expr: { $lte: ['$stock_quantity', '$low_stock_threshold'] }
  }).sort({ stock_quantity: 1 });
};

// ============ ЭКСПОРТ МОДЕЛИ ============

const Product = mongoose.model('Product', productSchema);

export default Product;