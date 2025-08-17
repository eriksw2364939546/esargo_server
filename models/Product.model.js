// models/Product.model.js (исправленный - ES6 modules)
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
  
  // Категория соответствует категории партнера
  category: {
    type: String,
    required: true,
    enum: ['restaurant', 'store']
  },
  
  // Подкатегория для группировки товаров (например: "Бургеры", "Салаты", "Напитки")
  subcategory: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  // Добавки (из модального окна товара)
  options_groups: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50 // "Добавки", "Соусы", "Размер"
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    },
    required: {
      type: Boolean,
      default: false // Обязательно ли выбрать опцию
    },
    multiple_choice: {
      type: Boolean,
      default: false // Можно ли выбрать несколько опций
    },
    max_selections: {
      type: Number,
      default: 1 // Максимальное количество выбираемых опций
    },
    options: [{
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50 // "Дополнительный сыр", "Кетчуп"
      },
      price: {
        type: Number,
        required: true,
        min: 0 // +25 грн, +0 для бесплатных опций
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
      return this.category === 'restaurant' ? 15 : 0; // в минутах
    }
  },
  
  // Информация о товаре (для магазинов)
  product_info: {
    brand: {
      type: String,
      trim: true
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
      trim: true
    }
  },
  
  // Информация о блюде (для ресторанов)
  dish_info: {
    ingredients: [{
      type: String,
      trim: true
    }],
    allergens: [{
      type: String,
      enum: [
        'глютен', 'молочные продукты', 'яйца', 'орехи',
        'арахис', 'соя', 'рыба', 'морепродукты', 'сельдерей',
        'горчица', 'кунжут', 'сульфиты', 'люпин', 'моллюски'
      ]
    }],
    is_vegetarian: {
      type: Boolean,
      default: false
    },
    is_vegan: {
      type: Boolean,
      default: false
    },
    is_halal: {
      type: Boolean,
      default: false
    },
    is_spicy: {
      type: Boolean,
      default: false
    },
    spice_level: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    calories: {
      type: Number,
      min: 0
    },
    portion_size: {
      type: String,
      trim: true // "300г", "Большая порция"
    }
  },
  
  // Наличие и доступность
  is_active: {
    type: Boolean,
    default: true
  },
  is_available: {
    type: Boolean,
    default: true
  },
  stock_quantity: {
    type: Number,
    min: 0 // Для отслеживания остатков (для магазинов)
  },
  low_stock_threshold: {
    type: Number,
    min: 0,
    default: 5
  },
  
  // Статистика продаж
  sales_stats: {
    total_sold: {
      type: Number,
      default: 0
    },
    weekly_sold: {
      type: Number,
      default: 0
    },
    monthly_sold: {
      type: Number,
      default: 0
    },
    total_revenue: {
      type: Number,
      default: 0
    }
  },
  
  // Рейтинг товара
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
  
  // Позиция в меню для сортировки
  sort_order: {
    type: Number,
    default: 0
  },
  
  // Теги для поиска
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Информация о последнем обновлении
  last_updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Индексы для оптимизации поиска
productSchema.index({ partner_id: 1, is_active: 1, is_available: 1 });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.avg_rating': -1 });
productSchema.index({ 'sales_stats.total_sold': -1 });
productSchema.index({ sort_order: 1 });

// Текстовый индекс для поиска
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

// Виртуальные поля

// Финальная цена с учетом скидки
productSchema.virtual('final_price').get(function() {
  return this.discount_price || this.price;
});

// Есть ли скидка
productSchema.virtual('has_discount').get(function() {
  return !!(this.discount_price && this.discount_price < this.price);
});

// Процент скидки
productSchema.virtual('discount_percentage').get(function() {
  if (this.has_discount) {
    return Math.round(((this.price - this.discount_price) / this.price) * 100);
  }
  return 0;
});

// Заканчивается ли товар
productSchema.virtual('is_low_stock').get(function() {
  return this.stock_quantity !== undefined && 
         this.stock_quantity <= this.low_stock_threshold;
});

// Методы экземпляра

// Обновление статистики продаж
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
    
    // Автоматически делаем недоступным если кончился товар
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
    
    // Если товар был недоступен из-за отсутствия, делаем доступным
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

// Статические методы

// Поиск товаров партнера
productSchema.statics.findByPartner = function(partnerId, includeInactive = false) {
  const filter = { partner_id: partnerId };
  if (!includeInactive) {
    filter.is_active = true;
    filter.is_available = true;
  }
  return this.find(filter).sort({ sort_order: 1, createdAt: -1 });
};

// Поиск по категории
productSchema.statics.findByCategory = function(category, subcategory = null) {
  const filter = { 
    category, 
    is_active: true, 
    is_available: true 
  };
  if (subcategory) {
    filter.subcategory = subcategory;
  }
  return this.find(filter).sort({ 'ratings.avg_rating': -1 });
};

// Популярные товары
productSchema.statics.findPopular = function(limit = 10) {
  return this.find({ 
    is_active: true, 
    is_available: true 
  })
  .sort({ 'sales_stats.total_sold': -1 })
  .limit(limit);
};

// Сброс недельной статистики (для cron задач)
productSchema.statics.resetWeeklyStats = function() {
  return this.updateMany({}, { 
    $set: { 'sales_stats.weekly_sold': 0 } 
  });
};

// Сброс месячной статистики (для cron задач)
productSchema.statics.resetMonthlyStats = function() {
  return this.updateMany({}, { 
    $set: { 'sales_stats.monthly_sold': 0 } 
  });
};

// Настройка виртуальных полей в JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// 🆕 ИСПРАВЛЕНО: ES6 export вместо module.exports
export default mongoose.model('Product', productSchema);