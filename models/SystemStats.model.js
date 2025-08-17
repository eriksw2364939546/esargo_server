// models/SystemStats.model.js (исправленный - ES6 modules)
import mongoose from 'mongoose';

const systemStatsSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true // "2025-08-15" - дата в формате YYYY-MM-DD
  },
  
  // Общая статистика заказов
  orders: {
    total_orders: {
      type: Number,
      default: 0
    },
    completed_orders: {
      type: Number,
      default: 0
    },
    cancelled_orders: {
      type: Number,
      default: 0
    },
    pending_orders: {
      type: Number,
      default: 0
    },
    avg_order_value: {
      type: Number,
      default: 0
    },
    total_revenue: {
      type: Number,
      default: 0
    },
    platform_commission: {
      type: Number,
      default: 0
    }
  },
  
  // Статистика пользователей
  users: {
    total_customers: {
      type: Number,
      default: 0
    },
    active_customers: {
      type: Number,
      default: 0 // Активные за последние 30 дней
    },
    new_customers: {
      type: Number,
      default: 0 // Новые за день
    },
    total_partners: {
      type: Number,
      default: 0
    },
    active_partners: {
      type: Number,
      default: 0
    },
    new_partners: {
      type: Number,
      default: 0
    },
    total_couriers: {
      type: Number,
      default: 0
    },
    active_couriers: {
      type: Number,
      default: 0 // Активные за день
    },
    new_couriers: {
      type: Number,
      default: 0
    }
  },
  
  // Статистика по категориям
  categories: {
    restaurant: {
      orders_count: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      partners_count: { type: Number, default: 0 },
      avg_rating: { type: Number, default: 0 }
    },
    store: {
      orders_count: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      partners_count: { type: Number, default: 0 },
      avg_rating: { type: Number, default: 0 }
    }
  },
  
  // Статистика доставки
  delivery: {
    avg_delivery_time: {
      type: Number,
      default: 0 // в минутах
    },
    on_time_deliveries: {
      type: Number,
      default: 0
    },
    late_deliveries: {
      type: Number,
      default: 0
    },
    total_distance_km: {
      type: Number,
      default: 0
    },
    avg_distance_per_order: {
      type: Number,
      default: 0
    }
  },
  
  // Финансовая статистика
  finance: {
    gross_revenue: {
      type: Number,
      default: 0
    },
    net_revenue: {
      type: Number,
      default: 0
    },
    commission_earned: {
      type: Number,
      default: 0
    },
    delivery_fees: {
      type: Number,
      default: 0
    },
    refunds_amount: {
      type: Number,
      default: 0
    },
    taxes_amount: {
      type: Number,
      default: 0
    }
  },
  
  // Статистика качества
  quality: {
    avg_customer_rating: {
      type: Number,
      default: 0
    },
    total_reviews: {
      type: Number,
      default: 0
    },
    positive_reviews: {
      type: Number,
      default: 0
    },
    negative_reviews: {
      type: Number,
      default: 0
    },
    delivery_issues: {
      type: Number,
      default: 0
    },
    customer_complaints: {
      type: Number,
      default: 0
    }
  },
  
  // Маркетинговая статистика
  marketing: {
    new_user_acquisition_cost: {
      type: Number,
      default: 0
    },
    customer_lifetime_value: {
      type: Number,
      default: 0
    },
    retention_rate: {
      type: Number,
      default: 0 // Процент вернувшихся клиентов
    },
    repeat_orders_rate: {
      type: Number,
      default: 0
    }
  },
  
  // Техническая статистика
  technical: {
    api_requests_total: {
      type: Number,
      default: 0
    },
    api_errors_count: {
      type: Number,
      default: 0
    },
    avg_response_time: {
      type: Number,
      default: 0 // в миллисекундах
    },
    uptime_percentage: {
      type: Number,
      default: 100
    },
    peak_concurrent_users: {
      type: Number,
      default: 0
    }
  },
  
  // Метаданные
  calculation_info: {
    calculated_at: {
      type: Date,
      default: Date.now
    },
    calculation_duration: {
      type: Number,
      default: 0 // в миллисекундах
    },
    data_sources: [{
      type: String,
      enum: ['orders', 'users', 'reviews', 'payments', 'delivery']
    }],
    is_complete: {
      type: Boolean,
      default: true
    },
    errors: [{
      source: String,
      error: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
systemStatsSchema.index({ date: -1 });
systemStatsSchema.index({ 'calculation_info.calculated_at': -1 });
systemStatsSchema.index({ 'orders.total_revenue': -1 });
systemStatsSchema.index({ 'users.active_customers': -1 });

// Статические методы

// Генерация статистики за определенную дату
systemStatsSchema.statics.generateStatsForDate = async function(date) {
  const startTime = Date.now();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    // Удаляем существующую статистику за эту дату
    await this.deleteOne({ date: dateStr });
    
    const stats = {
      date: dateStr,
      orders: await this.calculateOrderStats(date),
      users: await this.calculateUserStats(date),
      categories: await this.calculateCategoryStats(date),
      delivery: await this.calculateDeliveryStats(date),
      finance: await this.calculateFinanceStats(date),
      quality: await this.calculateQualityStats(date),
      marketing: await this.calculateMarketingStats(date),
      technical: await this.calculateTechnicalStats(date),
      calculation_info: {
        calculated_at: new Date(),
        calculation_duration: Date.now() - startTime,
        data_sources: ['orders', 'users', 'reviews', 'payments', 'delivery'],
        is_complete: true,
        errors: []
      }
    };
    
    return this.create(stats);
    
  } catch (error) {
    console.error('Error generating stats for date:', error);
    
    // Создаем запись с ошибкой
    const errorStats = {
      date: dateStr,
      calculation_info: {
        calculated_at: new Date(),
        calculation_duration: Date.now() - startTime,
        is_complete: false,
        errors: [{
          source: 'general',
          error: error.message,
          timestamp: new Date()
        }]
      }
    };
    
    return this.create(errorStats);
  }
};

// Расчет статистики заказов
systemStatsSchema.statics.calculateOrderStats = async function(date) {
  const Order = mongoose.model('Order');
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const orderStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: null,
        total_orders: { $sum: 1 },
        completed_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelled_orders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        pending_orders: {
          $sum: { $cond: [{ $in: ['$status', ['pending', 'accepted', 'preparing']] }, 1, 0] }
        },
        total_revenue: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total_price', 0] }
        },
        avg_order_value: { $avg: '$total_price' },
        platform_commission: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$platform_fee', 0] }
        }
      }
    }
  ]);
  
  return orderStats[0] || {};
};

// Расчет статистики пользователей
systemStatsSchema.statics.calculateUserStats = async function(date) {
  const User = mongoose.model('User');
  const CustomerProfile = mongoose.model('CustomerProfile');
  const PartnerProfile = mongoose.model('PartnerProfile');
  const CourierProfile = mongoose.model('CourierProfile');
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const thirtyDaysAgo = new Date(date);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [totalCustomers, activeCustomers, newCustomers] = await Promise.all([
    CustomerProfile.countDocuments({ is_active: true }),
    User.countDocuments({ 
      role: 'customer', 
      last_activity_at: { $gte: thirtyDaysAgo }
    }),
    CustomerProfile.countDocuments({ 
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
  ]);
  
  const [totalPartners, activePartners, newPartners] = await Promise.all([
    PartnerProfile.countDocuments({ is_approved: true }),
    PartnerProfile.countDocuments({ 
      is_approved: true, 
      is_active: true 
    }),
    PartnerProfile.countDocuments({ 
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
  ]);
  
  const [totalCouriers, activeCouriers, newCouriers] = await Promise.all([
    CourierProfile.countDocuments({ is_approved: true }),
    CourierProfile.countDocuments({ 
      is_approved: true,
      is_available: true,
      last_activity: { $gte: startOfDay }
    }),
    CourierProfile.countDocuments({ 
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
  ]);
  
  return {
    total_customers: totalCustomers,
    active_customers: activeCustomers,
    new_customers: newCustomers,
    total_partners: totalPartners,
    active_partners: activePartners,
    new_partners: newPartners,
    total_couriers: totalCouriers,
    active_couriers: activeCouriers,
    new_couriers: newCouriers
  };
};

// Расчет статистики по категориям
systemStatsSchema.statics.calculateCategoryStats = async function(date) {
  const Order = mongoose.model('Order');
  const PartnerProfile = mongoose.model('PartnerProfile');
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const categoryStats = {};
  
  for (const category of ['restaurant', 'store']) {
    // Получаем партнеров категории
    const partnerIds = await PartnerProfile.find({ category }).distinct('_id');
    
    // Статистика заказов
    const orderStats = await Order.aggregate([
      {
        $match: {
          partner_id: { $in: partnerIds },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          orders_count: { $sum: 1 },
          revenue: { $sum: '$total_price' }
        }
      }
    ]);
    
    // Количество партнеров
    const partnersCount = await PartnerProfile.countDocuments({ 
      category, 
      is_active: true, 
      is_approved: true 
    });
    
    // Средний рейтинг
    const ratingStats = await PartnerProfile.aggregate([
      {
        $match: {
          category,
          is_active: true,
          'ratings.total_ratings': { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          avg_rating: { $avg: '$ratings.avg_rating' }
        }
      }
    ]);
    
    categoryStats[category] = {
      orders_count: orderStats[0]?.orders_count || 0,
      revenue: orderStats[0]?.revenue || 0,
      partners_count: partnersCount,
      avg_rating: ratingStats[0]?.avg_rating || 0
    };
  }
  
  return categoryStats;
};

// Расчет статистики доставки
systemStatsSchema.statics.calculateDeliveryStats = async function(date) {
  const Order = mongoose.model('Order');
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const deliveryStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'delivered',
        actual_delivery_time: { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        avg_delivery_time: { $avg: '$actual_delivery_time' },
        on_time_deliveries: {
          $sum: {
            $cond: [
              { $lte: ['$actual_delivery_time', 45] }, // 45 минут считается вовремя
              1,
              0
            ]
          }
        },
        late_deliveries: {
          $sum: {
            $cond: [
              { $gt: ['$actual_delivery_time', 45] },
              1,
              0
            ]
          }
        },
        total_orders: { $sum: 1 }
      }
    }
  ]);
  
  return deliveryStats[0] || {};
};

// Расчет финансовой статистики
systemStatsSchema.statics.calculateFinanceStats = async function(date) {
  const Order = mongoose.model('Order');
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const financeStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'delivered'
      }
    },
    {
      $group: {
        _id: null,
        gross_revenue: { $sum: '$total_price' },
        commission_earned: { $sum: '$platform_fee' },
        delivery_fees: { $sum: '$delivery_fee' },
        refunds_amount: { $sum: '$refund_amount' }
      }
    }
  ]);
  
  const stats = financeStats[0] || {};
  stats.net_revenue = (stats.gross_revenue || 0) - (stats.refunds_amount || 0);
  stats.taxes_amount = (stats.commission_earned || 0) * 0.2; // 20% налог
  
  return stats;
};

// Расчет статистики качества
systemStatsSchema.statics.calculateQualityStats = async function(date) {
  const Review = mongoose.model('Review');
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const qualityStats = await Review.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'active'
      }
    },
    {
      $group: {
        _id: null,
        total_reviews: { $sum: 1 },
        avg_customer_rating: { $avg: '$rating' },
        positive_reviews: {
          $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] }
        },
        negative_reviews: {
          $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] }
        }
      }
    }
  ]);
  
  const stats = qualityStats[0] || {};
  stats.positive_percentage = stats.total_reviews > 0 ? 
    (stats.positive_reviews / stats.total_reviews) * 100 : 0;
  
  return stats;
};

// Расчет маркетинговых метрик
systemStatsSchema.statics.calculateMarketingStats = async function(date) {
  // Здесь можно добавить расчеты CAC, LTV, retention rate
  return {
    new_user_acquisition_cost: 0,
    customer_lifetime_value: 0,
    retention_rate: 0,
    repeat_orders_rate: 0
  };
};

// Расчет технических метрик
systemStatsSchema.statics.calculateTechnicalStats = async function(date) {
  // Здесь можно добавить мониторинг API, uptime и т.д.
  return {
    api_requests_total: 0,
    api_errors_count: 0,
    avg_response_time: 0,
    uptime_percentage: 100,
    peak_concurrent_users: 0
  };
};

// Получение статистики за период
systemStatsSchema.statics.getStatsForPeriod = function(startDate, endDate) {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  
  return this.find({
    date: { $gte: start, $lte: end }
  }).sort({ date: 1 });
};

// Получение трендов
systemStatsSchema.statics.getTrends = function(days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.getStatsForPeriod(startDate, endDate);
};

// Сводная статистика для dashboard
systemStatsSchema.statics.getDashboardSummary = async function() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const [todayStats, yesterdayStats] = await Promise.all([
    this.findOne({ date: today }),
    this.findOne({ date: yesterdayStr })
  ]);
  
  // Расчет изменений в процентах
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };
  
  const summary = {
    orders: {
      total: todayStats?.orders.total_orders || 0,
      change: calculateChange(
        todayStats?.orders.total_orders || 0,
        yesterdayStats?.orders.total_orders || 0
      )
    },
    revenue: {
      total: todayStats?.orders.total_revenue || 0,
      change: calculateChange(
        todayStats?.orders.total_revenue || 0,
        yesterdayStats?.orders.total_revenue || 0
      )
    },
    customers: {
      active: todayStats?.users.active_customers || 0,
      change: calculateChange(
        todayStats?.users.active_customers || 0,
        yesterdayStats?.users.active_customers || 0
      )
    },
    partners: {
      active: todayStats?.users.active_partners || 0,
      change: calculateChange(
        todayStats?.users.active_partners || 0,
        yesterdayStats?.users.active_partners || 0
      )
    },
    couriers: {
      active: todayStats?.users.active_couriers || 0,
      change: calculateChange(
        todayStats?.users.active_couriers || 0,
        yesterdayStats?.users.active_couriers || 0
      )
    }
  };
  
  return summary;
};

// Автоматическая генерация статистики за вчерашний день
systemStatsSchema.statics.generateYesterdayStats = async function() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return this.generateStatsForDate(yesterday);
};

// Очистка старых статистик
systemStatsSchema.statics.cleanOldStats = function(daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  return this.deleteMany({ date: { $lt: cutoffStr } });
};

// 🆕 ИСПРАВЛЕНО: ES6 export
const SystemStats = mongoose.model('SystemStats', systemStatsSchema);
export default SystemStats;