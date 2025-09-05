// models/Transaction.model.js - Модель для учета всех финансовых операций
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  // Основная информация о транзакции
  transaction_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Связь с заказом
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  
  // Тип транзакции
  transaction_type: {
    type: String,
    enum: [
      'platform_commission',    // Комиссия ESARGO
      'courier_payment',        // Оплата курьеру
      'partner_payout',         // Выплата партнеру
      'delivery_fee',           // Сбор за доставку
      'peak_hour_surcharge',    // Доплата за час пик
      'refund',                 // Возврат средств
      'penalty'                 // Штрафы
    ],
    required: true,
    index: true
  },
  
  // Участники транзакции
  from_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  from_user_type: {
    type: String,
    enum: ['customer', 'partner', 'courier', 'platform'],
    index: true
  },
  
  to_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  to_user_type: {
    type: String,
    enum: ['customer', 'partner', 'courier', 'platform'],
    index: true
  },
  
  // Финансовая информация
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD']
  },
  
  // Статус транзакции
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Описание и метаданные
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  metadata: {
    // Зона доставки
    delivery_zone: {
      type: Number,
      min: 1,
      max: 2
    },
    
    // Расстояние доставки
    delivery_distance_km: {
      type: Number,
      min: 0
    },
    
    // Был ли час пик
    is_peak_hour: {
      type: Boolean,
      default: false
    },
    
    // Размер заказа для скидки
    order_size_category: {
      type: String,
      enum: ['small', 'large'], // <30€ или ≥30€
    },
    
    // Дополнительная информация
    original_delivery_fee: Number,
    commission_rate: Number,
    peak_hour_surcharge: Number
  },
  
  // Даты обработки
  processed_at: {
    type: Date
  },
  
  scheduled_for: {
    type: Date // Для отложенных выплат
  },
  
  // Связь с платежной системой
  payment_reference: {
    type: String,
    index: true
  },
  
  // Ошибки и логи
  error_message: {
    type: String
  },
  
  processing_logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: String,
    details: String,
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'metadata.delivery_zone': 1 });
transactionSchema.index({ amount: -1 });
transactionSchema.index({ 
  order_id: 1, 
  transaction_type: 1 
});

// Составной индекс для отчетов
transactionSchema.index({ 
  to_user_id: 1, 
  status: 1, 
  createdAt: -1 
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

// Обработка транзакции
transactionSchema.methods.process = async function() {
  try {
    this.status = 'completed';
    this.processed_at = new Date();
    
    // Добавляем лог
    this.processing_logs.push({
      action: 'processed',
      details: 'Transaction processed successfully'
    });
    
    await this.save();
    return true;
  } catch (error) {
    this.status = 'failed';
    this.error_message = error.message;
    
    this.processing_logs.push({
      action: 'failed',
      details: `Processing failed: ${error.message}`
    });
    
    await this.save();
    throw error;
  }
};

// Отмена транзакции
transactionSchema.methods.cancel = async function(reason) {
  this.status = 'failed';
  this.error_message = reason;
  
  this.processing_logs.push({
    action: 'cancelled',
    details: reason
  });
  
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

// Генерация уникального ID транзакции
transactionSchema.statics.generateTransactionId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN_${timestamp}_${random}`.toUpperCase();
};

// Создание транзакции комиссии платформы
transactionSchema.statics.createPlatformCommission = function(orderData) {
  const amount = orderData.subtotal * 0.10; // 10% комиссия
  
  return new this({
    transaction_id: this.generateTransactionId(),
    order_id: orderData.order_id,
    transaction_type: 'platform_commission',
    from_user_id: orderData.partner_id,
    from_user_type: 'partner',
    to_user_type: 'platform',
    amount,
    description: `Комиссия ESARGO (10%) за заказ ${orderData.order_number}`,
    metadata: {
      commission_rate: 0.10,
      order_size_category: orderData.subtotal >= 30 ? 'large' : 'small'
    }
  });
};

// Создание транзакции оплаты курьеру
transactionSchema.statics.createCourierPayment = function(orderData, deliveryData) {
  return new this({
    transaction_id: this.generateTransactionId(),
    order_id: orderData.order_id,
    transaction_type: 'courier_payment',
    from_user_type: 'platform',
    to_user_id: orderData.courier_id,
    to_user_type: 'courier',
    amount: deliveryData.courier_earnings,
    description: `Оплата за доставку заказа ${orderData.order_number}`,
    metadata: {
      delivery_zone: deliveryData.zone,
      delivery_distance_km: deliveryData.distance,
      is_peak_hour: deliveryData.is_peak_hour,
      original_delivery_fee: deliveryData.delivery_fee,
      peak_hour_surcharge: deliveryData.peak_surcharge || 0
    }
  });
};

// Получение транзакций по пользователю
transactionSchema.statics.getByUser = function(userId, userType, options = {}) {
  const {
    status = 'completed',
    limit = 20,
    offset = 0,
    dateFrom,
    dateTo
  } = options;
  
  let query = {
    to_user_id: userId,
    to_user_type: userType,
    status
  };
  
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }
  
  return this.find(query)
    .populate('order_id', 'order_number status')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
};

// Статистика по периоду
transactionSchema.statics.getStatsForPeriod = function(dateFrom, dateTo, options = {}) {
  const { userType, transactionType } = options;
  
  let matchQuery = {
    status: 'completed',
    createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
  };
  
  if (userType) matchQuery.to_user_type = userType;
  if (transactionType) matchQuery.transaction_type = transactionType;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          transaction_type: '$transaction_type',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        total_amount: { $sum: '$amount' },
        count: { $sum: 1 },
        avg_amount: { $avg: '$amount' }
      }
    },
    { $sort: { '_id.date': -1 } }
  ]);
};

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;