// models/Order.model.js - ПОЛНАЯ модель заказов с добавлением валидации доступности
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // Уникальный номер заказа
  order_number: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Ссылки на участников заказа
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  partner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerProfile',
    required: true,
    index: true
  },
  courier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourierProfile',
    index: true
  },
  
  // Товары в заказе
  items: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    // Выбранные опции (добавки, размер и т.д.)
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
    item_total: {
      type: Number,
      required: true,
      min: 0
    },
    special_requests: {
      type: String,
      trim: true,
      maxlength: 200
    }
  }],

  // ДОБАВЛЕННЫЕ ПОЛЯ ДЛЯ ВАЛИДАЦИИ ДОСТУПНОСТИ ТОВАРОВ
  availability_validation: {
    validated_at: {
      type: Date,
      default: Date.now
    },
    unavailable_items: [{
      product_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      title: {
        type: String,
        required: true
      },
      reason: {
        type: String,
        enum: ['product_deactivated', 'out_of_stock', 'time_restricted', 'partner_unavailable'],
        required: true
      },
      detected_at: {
        type: Date,
        default: Date.now
      }
    }],
    validation_status: {
      type: String,
      enum: ['valid', 'has_issues', 'critical_issues'],
      default: 'valid'
    }
  },

  // ДОБАВЛЕННЫЕ ПОЛЯ: Снимок товаров на момент заказа
  items_snapshot: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    availability_at_order: {
      is_active: Boolean,
      is_available: Boolean,
      stock_quantity: Number,
      availability_schedule: mongoose.Schema.Types.Mixed
    },
    captured_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Стоимость заказа
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  delivery_fee: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  service_fee: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  discount_amount: {
    type: Number,
    min: 0,
    default: 0
  },
  tax_amount: {
    type: Number,
    min: 0,
    default: 0
  },
  total_price: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Адрес доставки
  delivery_address: {
    address: {
      type: String,
      required: true,
      trim: true
    },
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    },
    apartment: {
      type: String,
      trim: true
    },
    entrance: {
      type: String,
      trim: true
    },
    intercom: {
      type: String,
      trim: true
    },
    delivery_notes: {
      type: String,
      trim: true,
      maxlength: 300
    }
  },
  
  // Контактная информация клиента
  customer_contact: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  },
  
  // Статусы заказа
  status: {
    type: String,
    required: true,
    enum: [
      'pending',      // Ожидает подтверждения партнера
      'accepted',     // Партнер принял заказ
      'preparing',    // Партнер готовит заказ
      'ready',        // Заказ готов, ищем курьера
      'picked_up',    // Курьер забрал заказ
      'on_the_way',   // Курьер в пути к клиенту
      'delivered',    // Заказ доставлен
      'cancelled'     // Заказ отменен
    ],
    default: 'pending',
    index: true
  },
  
  // Временные метки
  estimated_delivery_time: {
    type: Date,
    required: true
  },
  actual_delivery_time: {
    type: Number // в минутах от создания заказа
  },
  accepted_at: Date,
  ready_at: Date,
  picked_up_at: Date,
  delivered_at: Date,
  cancelled_at: Date,
  
  // Платежная информация
  payment_method: {
    type: String,
    enum: ['card', 'cash'],
    required: true
  },
  payment_status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  payment_details: {
    transaction_id: String,
    payment_processor: String,
    gateway_response: mongoose.Schema.Types.Mixed
  },
  
  // История статусов
  status_history: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    user_role: {
      type: String,
      enum: ['customer', 'partner', 'courier', 'admin']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    }
  }],
  
  // Информация об отмене
  cancellation: {
    reason: {
      type: String,
      trim: true
    },
    cancelled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    user_role: {
      type: String,
      enum: ['customer', 'partner', 'courier', 'admin']
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // Особые запросы от клиента
  special_requests: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Система рейтингов
  ratings: {
    partner_rating: {
      type: Number,
      min: 1,
      max: 5
    },
    courier_rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500
    },
    rated_at: {
      type: Date
    }
  },
  
  // Метаданные
  source: {
    type: String,
    enum: ['web', 'mobile_app'],
    default: 'web'
  },
  user_agent: {
    type: String
  },
  ip_address: {
    type: String
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ================
orderSchema.index({ order_number: 1 });
orderSchema.index({ customer_id: 1, createdAt: -1 });
orderSchema.index({ partner_id: 1, status: 1 });
orderSchema.index({ courier_id: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ payment_status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ estimated_delivery_time: 1 });

// Составной индекс для поиска заказов курьеров
orderSchema.index({ 
  status: 1, 
  courier_id: 1,
  createdAt: -1 
});

// Геоиндекс для поиска заказов поблизости
orderSchema.index({ 'delivery_address.lat': 1, 'delivery_address.lng': 1 });

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * Добавление записи в историю статусов
 */
orderSchema.methods.addStatusHistory = function(newStatus, updatedBy, userRole, notes = '') {
  this.status_history.push({
    status: newStatus,
    timestamp: new Date(),
    updated_by: updatedBy,
    user_role: userRole,
    notes: notes
  });
  
  this.status = newStatus;
  
  // Обновляем соответствующие временные метки
  const now = new Date();
  switch(newStatus) {
    case 'accepted':
      this.accepted_at = now;
      break;
    case 'ready':
      this.ready_at = now;
      break;
    case 'picked_up':
      this.picked_up_at = now;
      break;
    case 'delivered':
      this.delivered_at = now;
      this.actual_delivery_time = Math.round((now - this.createdAt) / (1000 * 60));
      break;
    case 'cancelled':
      this.cancelled_at = now;
      break;
  }
  
  return this.save();
};

/**
 * НОВЫЙ МЕТОД: Валидация доступности товаров в заказе
 */
orderSchema.methods.validateItemsAvailability = async function() {
  const Product = mongoose.model('Product');
  const unavailableItems = [];
  
  for (const orderItem of this.items) {
    const currentProduct = await Product.findById(orderItem.product_id);
    
    if (!currentProduct) {
      unavailableItems.push({
        product_id: orderItem.product_id,
        title: orderItem.title,
        reason: 'product_deactivated'
      });
      continue;
    }

    // Проверяем базовую доступность
    if (!currentProduct.is_active || !currentProduct.is_available) {
      unavailableItems.push({
        product_id: orderItem.product_id,
        title: orderItem.title,
        reason: 'product_deactivated'
      });
      continue;
    }

    // Проверяем складские остатки для магазинов
    if (currentProduct.category === 'store' && currentProduct.stock_quantity !== undefined) {
      if (currentProduct.stock_quantity < orderItem.quantity) {
        unavailableItems.push({
          product_id: orderItem.product_id,
          title: orderItem.title,
          reason: 'out_of_stock'
        });
        continue;
      }
    }

    // Проверяем временные ограничения
    if (currentProduct.isAvailableNow && !currentProduct.isAvailableNow()) {
      unavailableItems.push({
        product_id: orderItem.product_id,
        title: orderItem.title,
        reason: 'time_restricted'
      });
    }
  }

  // Обновляем статус валидации
  this.availability_validation = {
    validated_at: new Date(),
    unavailable_items: unavailableItems,
    validation_status: unavailableItems.length === 0 ? 'valid' : 
                      unavailableItems.length < this.items.length ? 'has_issues' : 'critical_issues'
  };

  await this.save();
  return unavailableItems;
};

/**
 * Отмена заказа
 */
orderSchema.methods.cancelOrder = function(reason, cancelledBy, userRole, details = '') {
  this.cancellation = {
    reason: reason,
    cancelled_by: cancelledBy,
    user_role: userRole,
    details: details
  };
  
  return this.addStatusHistory('cancelled', cancelledBy, userRole, `Заказ отменен: ${reason}`);
};

/**
 * Расчет общей стоимости заказа
 */
orderSchema.methods.calculateTotal = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + item.item_total, 0);
  this.total_price = this.subtotal + this.delivery_fee + this.service_fee - this.discount_amount + this.tax_amount;
  return this.total_price;
};

/**
 * Получить оставшееся время доставки
 */
orderSchema.methods.getRemainingDeliveryTime = function() {
  if (!this.estimated_delivery_time || this.status === 'delivered' || this.status === 'cancelled') {
    return null;
  }
  
  const timeLeft = this.estimated_delivery_time - new Date();
  return Math.max(0, Math.round(timeLeft / (1000 * 60))); // в минутах
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * Генерация уникального номера заказа
 */
orderSchema.statics.generateOrderNumber = async function() {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `${year}${month}${day}`;
  
  // Находим последний заказ за сегодня
  const lastOrder = await this.findOne({
    order_number: new RegExp(`^${prefix}`)
  }).sort({ order_number: -1 });
  
  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.order_number.slice(-4));
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${String(sequence).padStart(4, '0')}`;
};

/**
 * Поиск заказов клиента
 */
orderSchema.statics.findByCustomer = function(customerId, status = null) {
  const filter = { customer_id: customerId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

/**
 * Поиск заказов партнера
 */
orderSchema.statics.findByPartner = function(partnerId, status = null) {
  const filter = { partner_id: partnerId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

/**
 * Поиск заказов курьера
 */
orderSchema.statics.findByCourier = function(courierId, status = null) {
  const filter = { courier_id: courierId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

/**
 * Поиск доступных заказов для курьеров
 */
orderSchema.statics.findAvailableOrders = function(lat, lng, radiusKm = 10) {
  const radiusInDegrees = radiusKm / 111; // Примерное преобразование км в градусы
  
  return this.find({
    status: 'ready',
    courier_id: null,
    'delivery_address.lat': {
      $gte: lat - radiusInDegrees,
      $lte: lat + radiusInDegrees
    },
    'delivery_address.lng': {
      $gte: lng - radiusInDegrees,
      $lte: lng + radiusInDegrees
    }
  }).sort({ createdAt: 1 }); // Сначала старые заказы
};

/**
 * Статистика заказов за период
 */
orderSchema.statics.getStatsForPeriod = function(startDate, endDate, partnerId = null) {
  const matchFilter = {
    createdAt: { $gte: startDate, $lte: endDate }
  };
  
  if (partnerId) {
    matchFilter.partner_id = partnerId;
  }
  
  return this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        total_orders: { $sum: 1 },
        total_revenue: { $sum: '$total_price' },
        delivered_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelled_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        avg_order_value: { $avg: '$total_price' },
        avg_delivery_time: { $avg: '$actual_delivery_time' }
      }
    }
  ]);
};

/**
 * Поиск заказа по номеру
 */
orderSchema.statics.findByOrderNumber = function(orderNumber) {
  return this.findOne({ order_number: orderNumber });
};

/**
 * Получить популярные товары
 */
orderSchema.statics.getPopularItems = function(partnerId = null, limit = 10) {
  const matchFilter = { status: 'delivered' };
  if (partnerId) {
    matchFilter.partner_id = partnerId;
  }
  
  return this.aggregate([
    { $match: matchFilter },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product_id',
        title: { $first: '$items.title' },
        total_ordered: { $sum: '$items.quantity' },
        total_revenue: { $sum: '$items.item_total' },
        avg_price: { $avg: '$items.price' }
      }
    },
    { $sort: { total_ordered: -1 } },
    { $limit: limit }
  ]);
};

/**
 * Получить заказы по временному интервалу
 */
orderSchema.statics.findByTimeRange = function(startTime, endTime, status = null) {
  const filter = {
    createdAt: { $gte: startTime, $lte: endTime }
  };
  
  if (status) {
    filter.status = status;
  }
  
  return this.find(filter).sort({ createdAt: -1 });
};

/**
 * Расчет выручки за период
 */
orderSchema.statics.calculateRevenue = function(startDate, endDate, partnerId = null) {
  const matchFilter = {
    status: 'delivered',
    createdAt: { $gte: startDate, $lte: endDate }
  };
  
  if (partnerId) {
    matchFilter.partner_id = partnerId;
  }
  
  return this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: '$total_price' },
        total_orders: { $sum: 1 },
        avg_order_value: { $avg: '$total_price' }
      }
    }
  ]);
};

export default mongoose.model('Order', orderSchema);