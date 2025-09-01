// models/Cart.model.js - Модель корзины покупок
import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  // Связь с пользователем
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // ID сессии (для привязки к express-session)
  session_id: {
    type: String,
    required: true,
    index: true
  },
  
  // Ресторан (можно добавлять товары только из одного ресторана)
  restaurant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerProfile',
    required: true,
    index: true
  },
  
  restaurant_info: {
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    delivery_fee: {
      type: Number,
      default: 0,
      min: 0
    },
    min_order_amount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Товары в корзине
  items: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    
    // Копия данных продукта (на момент добавления в корзину)
    product_snapshot: {
      title: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      image_url: String,
      category: String
    },
    
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    
    // Выбранные опции (для ресторанов - размер, добавки и т.д.)
    selected_options: [{
      group_name: {
        type: String,
        required: true
      },
      option_name: {
        type: String,
        required: true
      },
      option_price: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    
    // Особые пожелания к товару
    special_requests: {
      type: String,
      trim: true,
      maxlength: 200
    },
    
    // Стоимость позиции
    item_price: {
      type: Number,
      required: true,
      min: 0
    },
    
    options_price: {
      type: Number,
      default: 0,
      min: 0
    },
    
    total_item_price: {
      type: Number,
      required: true,
      min: 0
    },
    
    added_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Расчет стоимости
  pricing: {
    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    delivery_fee: {
      type: Number,
      default: 0,
      min: 0
    },
    service_fee: {
      type: Number,
      default: 0,
      min: 0
    },
    discount_amount: {
      type: Number,
      default: 0,
      min: 0
    },
    total_price: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Информация о доставке (если рассчитывалась)
  delivery_info: {
    address: String,
    lat: Number,
    lng: Number,
    distance_km: Number,
    estimated_delivery_time: Number, // в минутах
    calculated_at: Date
  },
  
  // Метаданные
  status: {
    type: String,
    enum: ['active', 'abandoned', 'converted_to_order'],
    default: 'active'
  },
  
  last_activity: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 часа
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
cartSchema.index({ customer_id: 1, status: 1 });
cartSchema.index({ session_id: 1 });
cartSchema.index({ restaurant_id: 1 });
cartSchema.index({ last_activity: -1 });
cartSchema.index({ expires_at: 1 });

// Составной индекс для быстрого поиска активных корзин пользователя
cartSchema.index({ customer_id: 1, status: 1, last_activity: -1 });

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * 🧮 Пересчитать стоимость корзины
 */
cartSchema.methods.recalculatePricing = function() {
  // Подсчет subtotal из всех items
  this.pricing.subtotal = this.items.reduce((sum, item) => {
    return sum + item.total_item_price;
  }, 0);
  
  // Сервисный сбор (например, 2% от суммы заказа)
  this.pricing.service_fee = Math.round(this.pricing.subtotal * 0.02 * 100) / 100;
  
  // Общая стоимость
  this.pricing.total_price = 
    this.pricing.subtotal + 
    this.pricing.delivery_fee + 
    this.pricing.service_fee - 
    this.pricing.discount_amount;
  
  return this.pricing;
};

/**
 * ➕ Добавить товар в корзину
 */
cartSchema.methods.addItem = function(itemData) {
  const {
    product_id,
    product_snapshot,
    quantity,
    selected_options = [],
    special_requests = ''
  } = itemData;
  
  // Рассчитываем стоимость опций
  const options_price = selected_options.reduce((sum, option) => {
    return sum + option.option_price;
  }, 0);
  
  // Общая стоимость за единицу (продукт + опции)
  const item_price = product_snapshot.price;
  const total_item_price = (item_price + options_price) * quantity;
  
  // Проверяем, есть ли уже такой товар с теми же опциями
  const existingItemIndex = this.items.findIndex(item => {
    if (item.product_id.toString() !== product_id.toString()) return false;
    if (item.special_requests !== special_requests) return false;
    
    // Сравниваем выбранные опции
    if (item.selected_options.length !== selected_options.length) return false;
    
    return item.selected_options.every(existingOption => {
      return selected_options.some(newOption => 
        newOption.group_name === existingOption.group_name &&
        newOption.option_name === existingOption.option_name
      );
    });
  });
  
  if (existingItemIndex !== -1) {
    // Увеличиваем количество существующего товара
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].total_item_price = 
      (this.items[existingItemIndex].item_price + this.items[existingItemIndex].options_price) * 
      this.items[existingItemIndex].quantity;
  } else {
    // Добавляем новый товар
    this.items.push({
      product_id,
      product_snapshot,
      quantity,
      selected_options,
      special_requests,
      item_price,
      options_price,
      total_item_price,
      added_at: new Date()
    });
  }
  
  // Пересчитываем общую стоимость
  this.recalculatePricing();
  this.last_activity = new Date();
  
  return this.save();
};

/**
 * ✏️ Обновить товар в корзине
 */
cartSchema.methods.updateItem = function(itemId, updateData) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Товар не найден в корзине');
  }
  
  if (updateData.quantity !== undefined) {
    item.quantity = updateData.quantity;
  }
  
  if (updateData.selected_options !== undefined) {
    item.selected_options = updateData.selected_options;
    
    // Пересчитываем стоимость опций
    item.options_price = updateData.selected_options.reduce((sum, option) => {
      return sum + option.option_price;
    }, 0);
  }
  
  if (updateData.special_requests !== undefined) {
    item.special_requests = updateData.special_requests;
  }
  
  // Пересчитываем общую стоимость товара
  item.total_item_price = (item.item_price + item.options_price) * item.quantity;
  
  // Пересчитываем общую стоимость корзины
  this.recalculatePricing();
  this.last_activity = new Date();
  
  return this.save();
};

/**
 * ❌ Удалить товар из корзины
 */
cartSchema.methods.removeItem = function(itemId) {
  this.items.id(itemId).remove();
  
  // Если корзина стала пустой, помечаем как заброшенную
  if (this.items.length === 0) {
    this.status = 'abandoned';
  }
  
  this.recalculatePricing();
  this.last_activity = new Date();
  
  return this.save();
};

/**
 * 🗑️ Очистить корзину
 */
cartSchema.methods.clear = function() {
  this.items = [];
  this.pricing = {
    subtotal: 0,
    delivery_fee: 0,
    service_fee: 0,
    discount_amount: 0,
    total_price: 0
  };
  this.delivery_info = {};
  this.status = 'abandoned';
  this.last_activity = new Date();
  
  return this.save();
};

/**
 * 🚚 Установить информацию о доставке
 */
cartSchema.methods.setDeliveryInfo = function(deliveryData) {
  this.delivery_info = {
    ...deliveryData,
    calculated_at: new Date()
  };
  
  // Обновляем стоимость доставки
  this.pricing.delivery_fee = deliveryData.delivery_fee || 0;
  this.recalculatePricing();
  this.last_activity = new Date();
  
  return this.save();
};

/**
 * ✅ Конвертировать корзину в заказ
 */
cartSchema.methods.convertToOrder = function() {
  this.status = 'converted_to_order';
  this.last_activity = new Date();
  return this.save();
};

/**
 * ⏰ Обновить время активности
 */
cartSchema.methods.updateActivity = function() {
  this.last_activity = new Date();
  // Продлеваем время жизни корзины еще на 24 часа
  this.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * 🔍 Найти активную корзину пользователя
 */
cartSchema.statics.findActiveCart = function(customerId, sessionId = null) {
  const query = {
    customer_id: customerId,
    status: 'active'
  };
  
  if (sessionId) {
    query.session_id = sessionId;
  }
  
  return this.findOne(query).sort({ last_activity: -1 });
};

/**
 * 📊 Получить статистику заброшенных корзин
 */
cartSchema.statics.getAbandonedCartsStats = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        status: 'abandoned',
        last_activity: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$last_activity' }
        },
        total_carts: { $sum: 1 },
        avg_subtotal: { $avg: '$pricing.subtotal' },
        total_lost_revenue: { $sum: '$pricing.total_price' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

/**
 * 🧹 Очистить устаревшие корзины
 */
cartSchema.statics.cleanupExpiredCarts = function() {
  return this.deleteMany({
    expires_at: { $lt: new Date() },
    status: { $ne: 'converted_to_order' }
  });
};

// ================ MIDDLEWARE ================

// Pre-save middleware для автоматического пересчета при изменениях
cartSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    this.recalculatePricing();
  }
  next();
});

// ================ НАСТРОЙКИ ВИРТУАЛЬНЫХ ПОЛЕЙ ================
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

// Виртуальное поле для подсчета общего количества товаров
cartSchema.virtual('total_items').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Виртуальное поле для проверки минимальной суммы заказа
cartSchema.virtual('meets_minimum_order').get(function() {
  return this.pricing.subtotal >= this.restaurant_info.min_order_amount;
});

// 🆕 ЭКСПОРТ
export default mongoose.model('Cart', cartSchema);