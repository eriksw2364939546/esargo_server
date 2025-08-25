// models/Product.model.js - БЕЗОПАСНОЕ ОБНОВЛЕНИЕ С ОБРАТНОЙ СОВМЕСТИМОСТЬЮ

import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  partner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerProfile',
    required: true,
    index: true
  },
  
  // ============ БАЗОВЫЕ ПОЛЯ (НЕ МЕНЯЕМ!) ============
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150 // Увеличено для французских названий
  },
  description: {
    type: String,
    trim: true,
    maxlength: 800 // Увеличено для детальных описаний
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
  image_url: { type: String },
  category: {
    type: String,
    required: true,
    enum: ['restaurant', 'store']
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
  
  // ============ ОПЦИИ (НЕ МЕНЯЕМ!) ============
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
    required: { type: Boolean, default: false },
    multiple_choice: { type: Boolean, default: false },
    max_selections: { type: Number, default: 1 },
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
      is_available: { type: Boolean, default: true }
    }]
  }],
  
  preparation_time: {
    type: Number,
    min: 0,
    default: function() {
      return this.category === 'restaurant' ? 15 : 0;
    }
  },
  
  // ============ ИНФОРМАЦИЯ О ТОВАРЕ (РАСШИРЯЕМ ОСТОРОЖНО) ============
  product_info: {
    brand: { type: String, trim: true },
    weight_grams: { type: Number, min: 0 },
    volume_ml: { type: Number, min: 0 },
    unit_count: { type: Number, min: 1, default: 1 },
    expiry_date: { type: Date },
    storage_conditions: { type: String, trim: true },
    
    // 🆕 НОВЫЕ ФРАНЦУЗСКИЕ ПОЛЯ (опционально)
    packaging_type: {
      type: String,
      enum: ['vrac', 'emballé', 'sous_vide', 'conserve', 'frais', 'surgelé', 'sec']
    },
    origin_country: { type: String, default: 'France', maxlength: 50 },
    barcode_ean13: { type: String, match: /^\d{13}$/ },
    barcode_ean8: { type: String, match: /^\d{8}$/ }
  },
  
  // ============ ИНФОРМАЦИЯ О БЛЮДЕ (ОСТОРОЖНО РАСШИРЯЕМ) ============
  dish_info: {
    ingredients: [{ type: String, trim: true }],
    
    // ✅ ОБРАТНАЯ СОВМЕСТИМОСТЬ: поддерживаем старые русские аллергены
    allergens: [{
      type: String,
      enum: [
        // Старые русские (совместимость)
        'глютен', 'молочные продукты', 'яйца', 'орехи',
        'арахис', 'соя', 'рыба', 'морепродукты', 'сельдерей',
        'горчица', 'кунжут', 'сульфиты', 'люпин', 'моллюски',
        
        // 🆕 Новые французские
        'gluten', 'lait', 'œufs', 'fruits_à_coque',
        'arachides', 'soja', 'poissons', 'crustacés', 'céleri',
        'moutarde', 'graines_de_sésame', 'anhydride_sulfureux_et_sulfites',
        'lupin', 'mollusques',
        
        // 🆕 Английские (интернационализация)  
        'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'tree_nuts',
        'celery', 'mustard', 'sesame_seeds', 'sulfur_dioxide_and_sulfites'
      ]
    }],
    
    // ✅ СТАРЫЕ БУЛЕВЫ ФЛАГИ (совместимость)
    is_vegetarian: { type: Boolean, default: false },
    is_vegan: { type: Boolean, default: false },
    is_halal: { type: Boolean, default: false },
    is_spicy: { type: Boolean, default: false },
    
    // ✅ ГИБКИЙ spice_level (поддерживаем число И строку)
    spice_level: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function(value) {
          // Числовой формат (старый)
          if (typeof value === 'number') {
            return Number.isInteger(value) && value >= 0 && value <= 5;
          }
          // Строковый формат (новый)
          if (typeof value === 'string') {
            const validLevels = [
              'aucun', 'doux', 'moyen', 'piquant', 'très_piquant', 'extrême',
              'none', 'mild', 'medium', 'hot', 'very_hot', 'extreme',
              'нет', 'слабо', 'средне', 'остро', 'очень_остро', 'экстрим'
            ];
            return validLevels.includes(value.toLowerCase());
          }
          return value === null || value === undefined;
        },
        message: 'spice_level: число 0-5 или строка (doux/mild/средне)'
      },
      default: 0
    },
    
    calories: { type: Number, min: 0 },
    portion_size: { type: String, trim: true },
    
    // 🆕 НОВЫЕ ФРАНЦУЗСКИЕ ПОЛЯ (опционально)
    cuisine_type: {
      type: String,
      enum: [
        'arménienne', 'française_traditionnelle', 'italienne', 'japonaise',
        'chinoise', 'thaïlandaise', 'vietnamienne', 'indienne', 'moyen_orientale',
        'armenian', 'french', 'italian', 'japanese', 'chinese', 'mediterranean'
      ]
    },
    
    cooking_method: {
      type: String,
      enum: [
        'grillé', 'rôti', 'braisé', 'sauté', 'poché', 'frit', 'cru',
        'grilled', 'roasted', 'braised', 'sautéed', 'fried', 'raw'
      ]
    },
    
    may_contain_traces: [{ 
      type: String,
      enum: [
        'глютен', 'молочные продукты', 'яйца', 'орехи',
        'gluten', 'lait', 'œufs', 'fruits_à_coque'
      ]
    }],
    
    // Пищевая ценность
    nutrition: {
      calories_per_100g: { type: Number, min: 0 },
      protein_g: { type: Number, min: 0 },
      carbs_g: { type: Number, min: 0 },
      fat_g: { type: Number, min: 0 },
      fiber_g: { type: Number, min: 0 },
      sugar_g: { type: Number, min: 0 },
      salt_g: { type: Number, min: 0 }
    }
  },
  
  // ============ НОВЫЕ ФРАНЦУЗСКИЕ РАСШИРЕНИЯ (ОПЦИОНАЛЬНО) ============
  
  // 🆕 Мультиязычность (опционально)
  multilingual: {
    title_fr: { type: String, trim: true, maxlength: 150 },
    title_en: { type: String, trim: true, maxlength: 150 },
    title_ru: { type: String, trim: true, maxlength: 150 },
    description_fr: { type: String, trim: true, maxlength: 800 },
    description_en: { type: String, trim: true, maxlength: 800 },
    description_ru: { type: String, trim: true, maxlength: 800 }
  },
  
  // 🆕 Французские налоги (опционально)
  tax_info: {
    tva_rate: {
      type: Number,
      enum: [0, 5.5, 10, 20],
      default: function() {
        return this.category === 'restaurant' ? 5.5 : 20;
      }
    },
    price_includes_tva: { type: Boolean, default: true },
    tva_amount: { type: Number, default: 0 }
  },
  
  // 🆕 Расписание доступности (опционально)
  availability_schedule: {
    breakfast: { type: Boolean, default: false },
    lunch: { type: Boolean, default: true },
    dinner: { type: Boolean, default: true },
    late_night: { type: Boolean, default: false }
  },
  
  // 🆕 Диетические метки (французские стандарты)
  dietary_labels: [{
    type: String,
    enum: [
      // Французские
      'végétarien', 'végétalien', 'halal', 'casher', 'sans_gluten', 
      'sans_lactose', 'bio', 'aop', 'igp', 'label_rouge',
      // Английские
      'vegetarian', 'vegan', 'organic', 'gluten_free', 'lactose_free',
      'keto', 'paleo', 'raw',
      // Русские
      'вегетарианский', 'веганский', 'халяль', 'кошерный', 'без_глютена'
    ]
  }],
  
  // ============ СТАРЫЕ ПОЛЯ (НЕ МЕНЯЕМ!) ============
  is_active: { type: Boolean, default: true },
  is_available: { type: Boolean, default: true },
  stock_quantity: { type: Number, min: 0 },
  low_stock_threshold: { type: Number, min: 0, default: 5 },
  
  sales_stats: {
    total_sold: { type: Number, default: 0 },
    weekly_sold: { type: Number, default: 0 },
    monthly_sold: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 }
  },
  
  ratings: {
    avg_rating: { type: Number, default: 0, min: 0, max: 5 },
    total_ratings: { type: Number, default: 0 }
  },
  
  sort_order: { type: Number, default: 0 },
  tags: [{ type: String, trim: true, lowercase: true }],
  last_updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  
}, { timestamps: true });

// ============ ИНДЕКСЫ (как было) ============
productSchema.index({ partner_id: 1, is_active: 1, is_available: 1 });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.avg_rating': -1 });

// ============ ВИРТУАЛЬНЫЕ ПОЛЯ (как было) ============
productSchema.virtual('final_price').get(function() {
  return this.discount_price || this.price;
});

productSchema.virtual('has_discount').get(function() {
  return !!this.discount_price && this.discount_price < this.price;
});

// ============ НОВЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ ============

/**
 * Нормализация spice_level для отображения
 */
productSchema.methods.getSpiceLevelDisplay = function(language = 'ru') {
  const value = this.dish_info?.spice_level;
  
  if (typeof value === 'number') {
    const levelMaps = {
      ru: ['нет', 'слабо', 'средне', 'остро', 'очень остро', 'экстрим'],
      fr: ['aucun', 'doux', 'moyen', 'piquant', 'très piquant', 'extrême'],
      en: ['none', 'mild', 'medium', 'hot', 'very hot', 'extreme']
    };
    return levelMaps[language]?.[value] || value;
  }
  
  return value || 'нет';
};

/**
 * Получение локализованного названия
 */
productSchema.methods.getLocalizedTitle = function(language = 'ru') {
  if (this.multilingual) {
    const field = `title_${language}`;
    return this.multilingual[field] || this.title;
  }
  return this.title;
};

/**
 * Расчет французских налогов
 */
productSchema.methods.calculateTaxes = function() {
  const tvaRate = this.tax_info?.tva_rate || (this.category === 'restaurant' ? 5.5 : 20);
  const priceIncludesTva = this.tax_info?.price_includes_tva !== false;
  
  if (priceIncludesTva) {
    const priceWithoutTva = this.final_price / (1 + tvaRate / 100);
    const tvaAmount = this.final_price - priceWithoutTva;
    return {
      price_with_tva: this.final_price,
      price_without_tva: Math.round(priceWithoutTva * 100) / 100,
      tva_amount: Math.round(tvaAmount * 100) / 100,
      tva_rate: tvaRate
    };
  } else {
    const tvaAmount = this.final_price * (tvaRate / 100);
    return {
      price_without_tva: this.final_price,
      price_with_tva: Math.round((this.final_price + tvaAmount) * 100) / 100,
      tva_amount: Math.round(tvaAmount * 100) / 100,
      tva_rate: tvaRate
    };
  }
};

// ============ PRE HOOKS (автоматические вычисления) ============
productSchema.pre('save', function(next) {
  // Автоматический расчет НДС если указан tax_info
  if (this.tax_info && this.tax_info.tva_rate) {
    const taxes = this.calculateTaxes();
    this.tax_info.tva_amount = taxes.tva_amount;
  }
  
  // Автоматическое определение языка title
  if (this.title && !this.multilingual?.title_ru) {
    if (!this.multilingual) this.multilingual = {};
    
    if (/[а-яё]/i.test(this.title)) {
      this.multilingual.title_ru = this.title;
    } else if (/[àâäçéèêëïîôùûüÿñæœ]/i.test(this.title)) {
      this.multilingual.title_fr = this.title;
    } else {
      this.multilingual.title_en = this.title;
    }
  }
  
  next();
});

// ============ СТАРЫЕ МЕТОДЫ (сохраняем совместимость) ============
productSchema.methods.validateCategory = async function() {
  const PartnerProfile = mongoose.model('PartnerProfile');
  const partner = await PartnerProfile.findById(this.partner_id);
  if (!partner) throw new Error('Партнер не найден');
  const category = partner.menu_categories.find(cat => cat.slug === this.subcategory);
  if (!category) throw new Error('Категория меню не найдена у этого партнера');
  this.menu_category_id = category._id;
  return true;
};

productSchema.methods.calculateTotalPrice = function(quantity = 1, selectedOptions = []) {
  let basePrice = this.final_price * quantity;
  let optionsPrice = 0;
  
  selectedOptions.forEach(selection => {
    const group = this.options_groups.find(g => g.name === selection.groupName);
    if (group) {
      const option = group.options.find(o => o.name === selection.optionName);
      if (option && option.is_available) {
        optionsPrice += option.price * quantity;
      }
    }
  });
  
  const totalPrice = basePrice + optionsPrice;
  
  // Если есть налоговая информация, возвращаем детальный расчет
  if (this.tax_info?.tva_rate) {
    const taxes = this.calculateTaxes();
    return {
      base_price: basePrice,
      options_price: optionsPrice,
      total_price: totalPrice,
      tax_info: taxes,
      currency: 'EUR'
    };
  }
  
  return totalPrice;
};

// ============ СТАТИЧЕСКИЕ МЕТОДЫ (сохраняем старые + новые) ============

/**
 * Поиск продуктов с поддержкой французских фильтров
 */
productSchema.statics.findWithFrenchFilters = function(partnerId, filters = {}) {
  const query = { partner_id: partnerId, is_active: true };
  
  // Старые фильтры (совместимость)
  if (filters.category_slug) {
    query.subcategory = filters.category_slug;
  }
  
  if (filters.price_min || filters.price_max) {
    query.price = {};
    if (filters.price_min) query.price.$gte = filters.price_min;
    if (filters.price_max) query.price.$lte = filters.price_max;
  }
  
  // 🆕 Новые французские фильтры
  if (filters.dietary_labels && filters.dietary_labels.length > 0) {
    query.dietary_labels = { $in: filters.dietary_labels };
  }
  
  if (filters.allergen_free && filters.allergen_free.length > 0) {
    query['dish_info.allergens'] = { $nin: filters.allergen_free };
  }
  
  if (filters.cuisine_type) {
    query['dish_info.cuisine_type'] = filters.cuisine_type;
  }
  
  if (filters.spice_level_max !== undefined) {
    // Поддерживаем и числовой и строковый формат
    if (typeof filters.spice_level_max === 'number') {
      query['dish_info.spice_level'] = { $lte: filters.spice_level_max };
    } else {
      const spiceLevels = ['aucun', 'doux', 'moyen', 'piquant', 'très_piquant', 'extrême'];
      const maxIndex = spiceLevels.indexOf(filters.spice_level_max);
      if (maxIndex >= 0) {
        query.$or = [
          { 'dish_info.spice_level': { $lte: maxIndex } },
          { 'dish_info.spice_level': { $in: spiceLevels.slice(0, maxIndex + 1) } }
        ];
      }
    }
  }
  
  if (filters.availability_time) {
    query[`availability_schedule.${filters.availability_time}`] = true;
  }
  
  if (!filters.include_unavailable) {
    query.is_available = true;
  }
  
  return this.find(query);
};

/**
 * Старый метод поиска (совместимость)
 */
productSchema.statics.findByPartnerCategory = function(partnerId, categorySlug, includeInactive = false) {
  const filter = { 
    partner_id: partnerId, 
    subcategory: categorySlug 
  };
  
  if (!includeInactive) {
    filter.is_active = true;
    filter.is_available = true;
  }
  
  return this.find(filter);
};

productSchema.statics.findByPartner = function(partnerId, includeInactive = false) {
  const filter = { partner_id: partnerId };
  
  if (!includeInactive) {
    filter.is_active = true;
    filter.is_available = true;
  }
  
  return this.find(filter);
};

export default mongoose.model('Product', productSchema);