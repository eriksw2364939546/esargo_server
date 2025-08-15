// models/SystemStats.js
const mongoose = require('mongoose');

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
      default: 0 // После вычета комиссий партнерам
    },
    delivery_fees: {
      type: Number,
      default: 0
    },
    refunds_total: {
      type: Number,
      default: 0
    },
    partner_payouts: {
      type: Number,
      default: 0
    },
    courier_payments: {
      type: Number,
      default: 0
    }
  },
  
  // Статистика качества сервиса
  quality: {
    avg_partner_rating: {
      type: Number,
      default: 0
    },
    avg_courier_rating: {
      type: Number,
      default: 0
    },
    total_reviews: {
      type: Number,
      default: 0
    },
    positive_reviews: {
      type: Number,
      default: 0 // 4-5 звезд
    },
    negative_reviews: {
      type: Number,
      default: 0 // 1-2 звезды
    },
    customer_satisfaction: {
      type: Number,
      default: 0 // Процент положительных отзывов
    }
  },
  
  // Активность по времени (почасовая статистика)
  hourly_activity: [{
    hour: {
      type: Number,
      min: 0,
      max: 23
    },
    orders_count: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    },
    active_couriers: {
      type: Number,
      default: 0
    }
  }],
  
  // География заказов (топ районы)
  top_locations: [{
    postal_code: {
      type: String
    },
    city: {
      type: String
    },
    orders_count: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    },
    avg_delivery_time: {
      type: Number,
      default: 0
    }
  }],
  
  // Популярные продукты
  top_products: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    product_title: {
      type: String
    },
    partner_name: {
      type: String
    },
    category: {
      type: String,
      enum: ['restaurant', 'store']
    },
    orders_count: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  }],
  
  // Статистика проблем
  issues: {
    cancelled_orders_by_partner: {
      type: Number,
      default: 0
    },
    cancelled_orders_by_customer: {
      type: Number,
      default: 0
    },
    cancelled_orders_by_courier: {
      type: Number,
      default: 0
    },
    payment_failures: {
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
      hourly_activity: await this.calculateHourlyActivity(date),
      top_locations: await this.calculateTopLocations(date),
      top_products: await this.calculateTopProducts(date),
      issues: await this.calculateIssueStats(date),
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
    console.error('Error generating stats:', error);
    throw error;
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
        total_revenue: { $sum: '$total_price' },
        avg_order_value: { $avg: '$total_price' },
        platform_commission: {
          $sum: { $multiply: ['$total_price', 0.12] } // 12% комиссия
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
  const Review = mongoose.model('Review');
  
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
        delivery_fees: { $sum: '$delivery_price' },
        platform_commission: {
          $sum: { $multiply: ['$items_price', 0.12] }
        }
      }
    }
  ]);
  
  const stats = financeStats[0] || {};
  stats.net_revenue = (stats.gross_revenue || 0) - (stats.platform_commission || 0);
  stats.partner_payouts = (stats.gross_revenue || 0) - (stats.delivery_fees || 0) - (stats.platform_commission || 0);
  
  return stats;
};

// Расчет статистики качества
systemStatsSchema.statics.calculateQualityStats = async function(date) {
  const Review = mongoose.model('Review');
  const PartnerProfile = mongoose.model('PartnerProfile');
  const CourierProfile = mongoose.model('CourierProfile');
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const [reviewStats, partnerRating, courierRating] = await Promise.all([
    Review.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          total_reviews: { $sum: 1 },
          avg_rating: { $avg: '$rating' },
          positive_reviews: {
            $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] }
          },
          negative_reviews: {
            $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] }
          }
        }
      }
    ]),
    PartnerProfile.aggregate([
      {
        $match: { 'ratings.total_ratings': { $gt: 0 } }
      },
      {
        $group: {
          _id: null,
          avg_partner_rating: { $avg: '$ratings.avg_rating' }
        }
      }
    ]),
    CourierProfile.aggregate([
      {
        $match: { 'ratings.total_ratings': { $gt: 0 } }
      },
      {
        $group: {
          _id: null,
          avg_courier_rating: { $avg: '$ratings.avg_rating' }
        }
      }
    ])
  ]);
  
  const stats = reviewStats[0] || {};
  stats.avg_partner_rating = partnerRating[0]?.avg_partner_rating || 0;
  stats.avg_courier_rating = courierRating[0]?.avg_courier_rating || 0;
  stats.customer_satisfaction = stats.total_reviews > 0 
    ? (stats.positive_reviews / stats.total_reviews) * 100 
    : 0;
  
  return stats;
};

// Расчет почасовой активности
systemStatsSchema.statics.calculateHourlyActivity = async function(date) {
  const Order = mongoose.model('Order');
  const CourierProfile = mongoose.model('CourierProfile');
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const hourlyStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        orders_count: { $sum: 1 },
        revenue: { $sum: '$total_price' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  // Заполняем все 24 часа
  const result = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourData = hourlyStats.find(h => h._id === hour);
    result.push({
      hour,
      orders_count: hourData?.orders_count || 0,
      revenue: hourData?.revenue || 0,
      active_couriers: 0 // Будет заполнено отдельно если нужно
    });
  }
  
  return result;
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

module.exports = mongoose.model('SystemStats', systemStatsSchema);