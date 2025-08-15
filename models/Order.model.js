// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_number: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // ОДИН партнер на заказ!
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerProfile',
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
      trim: true // Дублируется для истории
    },
    price: {
      type: Number,
      required: true,
      min: 0 // Цена на момент покупки
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    
    // Выбранные добавки (из модального окна)
    selected_options: [{
      group_name: {
        type: String,
        required: true,
        trim: true // "Добавки", "Соусы"
      },
      option_name: {
        type: String,
        required: true,
        trim: true // "Дополнительный сыр", "Кетчуп"
      },
      price: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    
    item_subtotal: {
      type: Number,
      required: true,
      min: 0 // Общая стоимость позиции (цена + опции) * количество
    },
    
    notes: {
      type: String,
      trim: true,
      maxlength: 200 // Комментарий к позиции
    }
  }],
  
  // Расчеты стоимости
  items_price: {
    type: Number,
    required: true,
    min: 0 // Сумма всех товаров
  },
  delivery_price: {
    type: Number,
    required: true,
    min: 0 // Стоимость доставки
  },
  total_price: {
    type: Number,
    required: true,
    min: 0 // Общая сумма (товары + доставка)
  },
  
  // Информация о доставке
  delivery_address: {
    text: {
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
    floor: {
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
  
  // Статусы заказа (из макетов)
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
  
  // История изменений статуса
  status_history: [{
    status: {
      type: String,
      required: true,
      enum: [
        'pending', 'accepted', 'preparing', 'ready', 
        'picked_up', 'on_the_way', 'delivered', 'cancelled'
      ]
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    user_role: {
      type: String,
      enum: ['customer', 'partner', 'courier', 'admin', 'system']
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  
  // Информация об оплате
  payment_status: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  payment_id: {
    type: String // Stripe payment ID
  },
  payment_method: {
    type: String,
    enum: ['card', 'cash', 'apple_pay', 'google_pay'],
    default: 'card'
  },
  
  // Временные метки
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
  
  // Расчетное время доставки
  estimated_delivery_time: {
    type: Date
  },
  actual_delivery_time: {
    type: Number // в минутах от создания заказа
  },
  
  // Информация об отмене
  cancellation_info: {
    reason: {
      type: String,
      enum: [
        'customer_request',
        'partner_unavailable', 
        'courier_unavailable',
        'payment_failed',
        'address_unreachable',
        'items_unavailable',
        'technical_issue',
        'other'
      ]
    },
    cancelled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelled_by_role: {
      type: String,
      enum: ['customer', 'partner', 'courier', 'admin']
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // Дополнительная информация
  notes: {
    type: String,
    trim: true,
    maxlength: 500 // Комментарий клиента к заказу
  },
  special_instructions: {
    type: String,
    trim: true,
    maxlength: 300 // Особые инструкции для курьера
  },
  
  // Настройки доставки
  delivery_type: {
    type: String,
    enum: ['standard', 'express'],
    default: 'standard'
  },
  
  // Рейтинги (заполняются после доставки)
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

// Индексы для оптимизации
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

// Методы экземпляра

// Добавление записи в историю статусов
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
      this.calculateActualDeliveryTime();
      break;
    case 'cancelled':
      this.cancelled_at = now;
      break;
  }
  
  return this.save();
};

// Расчет фактического времени доставки
orderSchema.methods.calculateActualDeliveryTime = function() {
  if (this.delivered_at && this.createdAt) {
    this.actual_delivery_time = Math.round(
      (this.delivered_at - this.createdAt) / (1000 * 60) // в минутах
    );
  }
};

// Отмена заказа
orderSchema.methods.cancelOrder = function(reason, cancelledBy, cancelledByRole, details = '') {
  this.status = 'cancelled';
  this.cancelled_at = new Date();
  this.cancellation_info = {
    reason,
    cancelled_by: cancelledBy,
    cancelled_by_role: cancelledByRole,
    details
  };
  
  this.addStatusHistory('cancelled', cancelledBy, cancelledByRole, details);
  
  return this.save();
};

// Назначение курьера
orderSchema.methods.assignCourier = function(courierId) {
  this.courier_id = courierId;
  return this.save();
};

// Добавление рейтинга партнера
orderSchema.methods.ratePartner = function(rating) {
  if (this.status !== 'delivered') {
    throw new Error('Можно оценить только доставленный заказ');
  }
  
  this.ratings.partner_rating = rating;
  this.ratings.rated_at = new Date();
  
  return this.save();
};

// Добавление рейтинга курьера
orderSchema.methods.rateCourier = function(rating) {
  if (this.status !== 'delivered') {
    throw new Error('Можно оценить только доставленный заказ');
  }
  
  this.ratings.courier_rating = rating;
  this.ratings.rated_at = new Date();
  
  return this.save();
};

// Проверка можно ли отменить заказ
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'accepted', 'preparing'].includes(this.status);
};

// Проверка просрочен ли заказ
orderSchema.methods.isOverdue = function() {
  if (!this.estimated_delivery_time || this.status === 'delivered' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > this.estimated_delivery_time;
};

// Расчет времени до доставки
orderSchema.methods.getTimeToDelivery = function() {
  if (!this.estimated_delivery_time || this.status === 'delivered' || this.status === 'cancelled') {
    return null;
  }
  
  const timeLeft = this.estimated_delivery_time - new Date();
  return Math.max(0, Math.round(timeLeft / (1000 * 60))); // в минутах
};

// Статические методы

// Генерация уникального номера заказа
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

// Поиск заказов клиента
orderSchema.statics.findByCustomer = function(customerId, status = null) {
  const filter = { customer_id: customerId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

// Поиск заказов партнера
orderSchema.statics.findByPartner = function(partnerId, status = null) {
  const filter = { partner_id: partnerId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

// Поиск заказов курьера
orderSchema.statics.findByCourier = function(courierId, status = null) {
  const filter = { courier_id: courierId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

// Поиск доступных заказов для курьеров
orderSchema.statics.findAvailableForCouriers = function(lat, lng, radiusKm = 5) {
  const radiusInMeters = radiusKm * 1000;
  
  return this.find({
    status: 'ready',
    courier_id: { $exists: false },
    'delivery_address.lat': {
      $gte: lat - (radiusKm / 111), // примерное расстояние в градусах
      $lte: lat + (radiusKm / 111)
    },
    'delivery_address.lng': {
      $gte: lng - (radiusKm / (111 * Math.cos(lat * Math.PI / 180))),
      $lte: lng + (radiusKm / (111 * Math.cos(lat * Math.PI / 180)))
    }
  }).sort({ createdAt: 1 }); // старые заказы в приоритете
};

// Поиск просроченных заказов
orderSchema.statics.findOverdue = function() {
  return this.find({
    estimated_delivery_time: { $lt: new Date() },
    status: { $nin: ['delivered', 'cancelled'] }
  });
};

// Статистика заказов за период
orderSchema.statics.getStatsForPeriod = function(startDate, endDate, partnerId = null) {
  const filter = {
    createdAt: { $gte: startDate, $lte: endDate }
  };
  
  if (partnerId) {
    filter.partner_id = partnerId;
  }
  
  return this.aggregate([
    { $match: filter },
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

module.exports = mongoose.model('Order', orderSchema);