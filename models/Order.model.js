// models/Order.model.js - ПОЛНАЯ МОДЕЛЬ ЗАКАЗОВ ESARGO с исправлениями
import mongoose from 'mongoose';

// Удаляем модель если она уже существует (для hot reload)
if (mongoose.models.Order) {
  delete mongoose.models.Order;
}

const orderSchema = new mongoose.Schema({
  // Основная информация
  order_number: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Связи с пользователями
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
    selected_options: [{
      group_name: String,
      option_name: String,
      option_price: { type: Number, default: 0 }
    }],
    item_total: {
      type: Number,
      required: true,
      min: 0
    },
    special_requests: {
      type: String,
      trim: true,
      maxlength: 300
    }
  }],
  
  // Снимок товаров на момент заказа
  items_snapshot: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
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
  
  // Результаты валидации доступности
  availability_validation: {
    validated_at: {
      type: Date,
      default: Date.now
    },
    unavailable_items: [{
      product_id: mongoose.Schema.Types.ObjectId,
      title: String,
      reason: String,
      requested_quantity: Number,
      available_quantity: Number,
      detected_at: Date
    }],
    validation_status: {
      type: String,
      enum: ['valid', 'has_issues', 'critical_issues'],
      default: 'valid'
    }
  },
  
  // ФИНАНСОВАЯ ИНФОРМАЦИЯ
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
    min: 0,
    default: 0
  },
  
  total_price: {
    type: Number,
    required: true,
    min: 0
  },
  
  // НОВЫЕ ПОЛЯ СИСТЕМЫ ДОСТАВКИ ESARGO
  platform_commission: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  delivery_zone: {
    type: Number,
    enum: [1, 2], // Зона 1: 0-5км, Зона 2: 5-10км
    index: true
  },
  
  delivery_distance_km: {
    type: Number,
    min: 0,
    max: 15
  },
  
  peak_hour_surcharge: {
    type: Number,
    min: 0,
    default: 0
  },
  
  courier_earnings: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Координаты для доставки
  restaurant_coordinates: {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    address: {
      type: String,
      trim: true
    }
  },
  
  delivery_coordinates: {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  },
  
  // Адрес доставки
  delivery_address: {
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    },
    details: {
      apartment: String,
      floor: String,
      entrance: String,
      intercom: String,
      building: String
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
    }
  },
  
  // Статус заказа
  status: {
    type: String,
    enum: [
      'pending',      // Ожидает подтверждения ресторана
      'accepted',     // Принят рестораном, готовится
      'preparing',    // В процессе приготовления
      'ready',        // Готов к выдаче курьеру
      'picked_up',    // Курьер забрал заказ
      'on_the_way',   // Курьер в пути к клиенту
      'delivered',    // Заказ доставлен
      'cancelled'     // Заказ отменен
    ],
    default: 'pending',
    index: true
  },
  
  // История изменения статусов
  status_history: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'status_history.user_role'
    },
    user_role: {
      type: String,
      enum: ['customer', 'partner', 'courier', 'admin']
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  
  // Платежная информация
  payment_method: {
    type: String,
    enum: ['card', 'cash', 'paypal'],
    required: true
  },
  
  payment_status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'refund_pending'],
    default: 'pending',
    index: true
  },
  
  payment_details: {
    payment_id: String,
    transaction_id: String,
    payment_processor: String,
    gateway_response: mongoose.Schema.Types.Mixed
  },
  
  // Информация о возврате
  refund_details: {
    refund_id: String,
    refunded_amount: Number,
    refund_reason: String,
    refunded_at: Date,
    estimated_arrival: String
  },
  
  refund_error: String,
  
  // Временные метки
  estimated_delivery_time: {
    type: Date
  },
  
  actual_delivery_time: {
    type: Number // в минутах
  },
  
  accepted_at: {
    type: Date
  },
  
  ready_at: {
    type: Date
  },
  
  picked_up_at: {
    type: Date
  },
  
  delivered_at: {
    type: Date
  },
  
  cancelled_at: {
    type: Date
  },
  
  // Дополнительная информация
  special_requests: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  cancellation: {
    reason: String,
    cancelled_by: mongoose.Schema.Types.ObjectId,
    user_role: String,
    details: String
  },
  
  // Рейтинги
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
orderSchema.index({ delivery_zone: 1, status: 1 });
orderSchema.index({ payment_status: 1 });
orderSchema.index({ createdAt: -1 });

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * Добавить запись в историю статусов
 */
orderSchema.methods.addStatusHistory = function(status, updatedBy, userRole, notes = '') {
  this.status = status;
  this[`${status}_at`] = new Date();
  
  this.status_history.push({
    status,
    timestamp: new Date(),
    updated_by: updatedBy,
    user_role: userRole,
    notes
  });
  
  // Рассчитываем время доставки если заказ доставлен
  if (status === 'delivered' && this.createdAt) {
    this.actual_delivery_time = Math.round((Date.now() - this.createdAt.getTime()) / (1000 * 60));
  }
  
  return this.save();
};

/**
 * Расчет финансовых показателей ESARGO
 */
orderSchema.methods.calculateEsargoFinancials = function() {
  // Базовая комиссия платформы (10% от subtotal)
  this.platform_commission = Math.round(this.subtotal * 0.10 * 100) / 100;
  
  // Расчет заработка курьера (зависит от зоны и суммы заказа)
  let courierBase = 0;
  if (this.delivery_zone === 1) {
    courierBase = this.subtotal >= 30 ? 6 : 9; // Зона 1: 6€ или 9€
  } else if (this.delivery_zone === 2) {
    courierBase = this.subtotal >= 30 ? 10 : 13; // Зона 2: 10€ или 13€
  }
  
  this.courier_earnings = courierBase + (this.peak_hour_surcharge || 0);
  
  return {
    platform_commission: this.platform_commission,
    courier_earnings: this.courier_earnings,
    delivery_fee: this.delivery_fee,
    total_price: this.total_price
  };
};

/**
 * Проверка возможности отмены
 */
orderSchema.methods.canBeCancelled = function() {
  const unCancellableStatuses = ['picked_up', 'on_the_way', 'delivered'];
  return !unCancellableStatuses.includes(this.status);
};

/**
 * Получение времени доставки
 */
orderSchema.methods.getDeliveryTime = function() {
  if (this.actual_delivery_time) {
    return this.actual_delivery_time;
  }
  
  if (this.estimated_delivery_time) {
    const estimatedMinutes = Math.round((this.estimated_delivery_time - this.createdAt) / (1000 * 60));
    return estimatedMinutes;
  }
  
  return null;
};

/**
 * Проверка доступа к заказу
 */
orderSchema.methods.hasAccessBy = function(userId, userRole) {
  switch (userRole) {
    case 'customer':
      return this.customer_id.toString() === userId.toString();
    case 'partner':
      return this.partner_id.toString() === userId.toString();
    case 'courier':
      return this.courier_id && this.courier_id.toString() === userId.toString();
    case 'admin':
      return true;
    default:
      return false;
  }
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * Генерация уникального номера заказа
 */
orderSchema.statics.generateOrderNumber = function() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ES${timestamp}${random}`;
};

/**
 * Статистика по зонам доставки
 */
orderSchema.statics.getDeliveryZoneStats = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: '$delivery_zone',
        total_orders: { $sum: 1 },
        total_revenue: { $sum: '$subtotal' },
        total_delivery_fees: { $sum: '$delivery_fee' },
        total_platform_commission: { $sum: '$platform_commission' },
        total_courier_earnings: { $sum: '$courier_earnings' },
        avg_distance: { $avg: '$delivery_distance_km' },
        peak_hour_orders: { 
          $sum: { $cond: [{ $gt: ['$peak_hour_surcharge', 0] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
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
        total_platform_commission: { $sum: '$platform_commission' },
        delivered_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelled_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        avg_delivery_time: {
          $avg: '$actual_delivery_time'
        },
        zone_1_orders: {
          $sum: { $cond: [{ $eq: ['$delivery_zone', 1] }, 1, 0] }
        },
        zone_2_orders: {
          $sum: { $cond: [{ $eq: ['$delivery_zone', 2] }, 1, 0] }
        }
      }
    }
  ]);
};

/**
 * Поиск заказов по статусу с пагинацией
 */
orderSchema.statics.findByStatusWithPagination = function(status, options = {}) {
  const { limit = 20, offset = 0, partnerId, courierId } = options;
  
  let query = { status };
  if (partnerId) query.partner_id = partnerId;
  if (courierId) query.courier_id = courierId;
  
  return this.find(query)
    .populate('customer_id', 'first_name last_name phone')
    .populate('partner_id', 'business_name phone location')
    .populate('courier_id', 'first_name last_name phone vehicle_info')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
};

/**
 * Поиск просроченных заказов для автоочистки
 */
orderSchema.statics.findExpiredOrders = function(minutes = 30) {
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
  
  return this.find({
    status: 'pending',
    createdAt: { $lt: cutoffTime },
    payment_status: { $ne: 'completed' }
  });
};

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================

orderSchema.virtual('total_items').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.virtual('estimated_delivery_minutes').get(function() {
  if (!this.estimated_delivery_time || !this.createdAt) return null;
  return Math.round((this.estimated_delivery_time - this.createdAt) / (1000 * 60));
});

orderSchema.virtual('is_delivered').get(function() {
  return this.status === 'delivered';
});

orderSchema.virtual('is_active').get(function() {
  return !['delivered', 'cancelled'].includes(this.status);
});

// ================ MIDDLEWARE ================

// Pre-save middleware
orderSchema.pre('save', function(next) {
  // Автоматический расчет финансовых показателей при создании
  if (this.isNew && this.delivery_zone) {
    this.calculateEsargoFinancials();
  }
  
  next();
});

// Включаем виртуальные поля в JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

// ================ БЕЗОПАСНАЯ РЕГИСТРАЦИЯ МОДЕЛИ ================

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export default Order;