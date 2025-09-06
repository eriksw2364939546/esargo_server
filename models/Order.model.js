// models/Order.model.js - ПОЛНАЯ МОДЕЛЬ ЗАКАЗОВ ESARGO с расширенными полями
import mongoose from 'mongoose';

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
  
  // ✅ ФИНАНСОВАЯ ИНФОРМАЦИЯ ESARGO (РАСШИРЕННАЯ)
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
    min: 0,
    default: 0
  },
  
  // ✅ НОВЫЕ ПОЛЯ ДЛЯ СИСТЕМЫ ДОСТАВКИ ESARGO
  platform_commission: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  // Информация о доставке
  delivery_zone: {
    type: Number,
    enum: [1, 2], // Зона 1: 0-5км, Зона 2: 5-10км
    required: true,
    index: true
  },
  
  delivery_distance_km: {
    type: Number,
    required: true,
    min: 0,
    max: 10 // Максимум 10км для доставки
  },
  
  // Доплата за час пик (+1-2€)
  peak_hour_surcharge: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Заработок курьера за доставку
  courier_earnings: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Координаты ресторана
  restaurant_coordinates: {
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    }
  },
  
  // Координаты доставки
  delivery_coordinates: {
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    }
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
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  
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
  
  cancellation_reason: {
    type: String,
    trim: true
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
orderSchema.index({ payment_status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ estimated_delivery_time: 1 });
orderSchema.index({ delivery_zone: 1 }); // ✅ НОВЫЙ ИНДЕКС
orderSchema.index({ delivery_distance_km: 1 }); // ✅ НОВЫЙ ИНДЕКС

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
  
  // Обновляем временные метки в зависимости от статуса
  switch (newStatus) {
    case 'accepted':
      this.accepted_at = new Date();
      break;
    case 'ready':
      this.ready_at = new Date();
      break;
    case 'picked_up':
      this.picked_up_at = new Date();
      break;
    case 'delivered':
      this.delivered_at = new Date();
      if (this.createdAt) {
        this.actual_delivery_time = Math.round((Date.now() - this.createdAt) / (1000 * 60));
      }
      break;
    case 'cancelled':
      this.cancelled_at = new Date();
      break;
  }
  
  return this.save();
};

/**
 * ✅ НОВЫЙ МЕТОД: Расчет финансовых показателей заказа
 */
orderSchema.methods.calculateFinancials = function() {
  // Комиссия ESARGO: 10% от суммы товаров (subtotal)
  this.platform_commission = Math.round(this.subtotal * 0.10 * 100) / 100;
  
  // Заработок курьера зависит от зоны и часа пик
  let courierBase = 0;
  if (this.delivery_zone === 1) {
    courierBase = this.subtotal >= 30 ? 6 : 8; // Зона 1: 6€ или 8€
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
 * ✅ НОВЫЙ МЕТОД: Проверка возможности отмены
 */
orderSchema.methods.canBeCancelled = function() {
  const unCancellableStatuses = ['picked_up', 'on_the_way', 'delivered'];
  return !unCancellableStatuses.includes(this.status);
};

/**
 * ✅ НОВЫЙ МЕТОД: Получение времени доставки
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
 * ✅ НОВЫЙ МЕТОД: Статистика по зонам доставки
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
        total_platform_commission: { $sum: '$platform_commission' }, // ✅ НОВОЕ ПОЛЕ
        delivered_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelled_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        avg_delivery_time: {
          $avg: '$actual_delivery_time'
        },
        zone_1_orders: { // ✅ НОВОЕ ПОЛЕ
          $sum: { $cond: [{ $eq: ['$delivery_zone', 1] }, 1, 0] }
        },
        zone_2_orders: { // ✅ НОВОЕ ПОЛЕ
          $sum: { $cond: [{ $eq: ['$delivery_zone', 2] }, 1, 0] }
        }
      }
    }
  ]);
};

// Включаем виртуальные поля в JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

export default mongoose.model('Order', orderSchema);