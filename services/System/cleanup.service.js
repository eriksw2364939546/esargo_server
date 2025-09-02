// services/System/cleanup.service.js - Сервис автоочистки просроченных данных
import { Order, Cart, Product } from '../../models/index.js';
import mongoose from 'mongoose';

/**
 * 🧹 ОСНОВНАЯ ФУНКЦИЯ АВТООЧИСТКИ
 */
export const cleanupExpiredData = async () => {
  const startTime = new Date();
  
  try {
    console.log('🧹 STARTING CLEANUP OF EXPIRED DATA...', { started_at: startTime });
    
    const results = {
      expired_carts_cleaned: 0,
      expired_orders_cancelled: 0,
      stock_returned_items: 0,
      old_reservations_cleaned: 0,
      start_time: startTime
    };

    // 1. ✅ ОЧИСТКА ПРОСРОЧЕННЫХ КОРЗИН (старше 24 часов)
    const expiredCartsCount = await cleanupExpiredCarts();
    results.expired_carts_cleaned = expiredCartsCount;

    // 2. ✅ ОТМЕНА ЗАВИСШИХ ЗАКАЗОВ (pending дольше 30 минут)
    const expiredOrdersResult = await cancelExpiredOrders();
    results.expired_orders_cancelled = expiredOrdersResult.cancelled_count;
    results.stock_returned_items = expiredOrdersResult.stock_returned_items;

    // 3. ✅ ОЧИСТКА СТАРОЙ ИСТОРИИ РЕЗЕРВИРОВАНИЙ (старше 30 дней)
    const cleanedReservations = await cleanupOldReservations();
    results.old_reservations_cleaned = cleanedReservations;

    results.end_time = new Date();
    results.duration_ms = results.end_time - results.start_time;

    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY:', results);
    return results;

  } catch (error) {
    console.error('🚨 CLEANUP ERROR:', error);
    throw error;
  }
};

/**
 * 🗑️ ОЧИСТКА ПРОСРОЧЕННЫХ КОРЗИН
 */
async function cleanupExpiredCarts() {
  try {
    const now = new Date();
    const expiredCarts = await Cart.find({
      status: { $in: ['active', 'abandoned'] },
      expires_at: { $lt: now }
    });

    console.log(`🗑️ Found ${expiredCarts.length} expired carts`);

    let cleanedCount = 0;
    for (const cart of expiredCarts) {
      await cart.clear();
      cleanedCount++;
    }

    console.log(`✅ Cleaned ${cleanedCount} expired carts`);
    return cleanedCount;

  } catch (error) {
    console.error('🚨 CLEANUP EXPIRED CARTS ERROR:', error);
    throw error;
  }
}

/**
 * ⏰ ОТМЕНА ЗАВИСШИХ ЗАКАЗОВ (pending дольше 30 минут)
 */
async function cancelExpiredOrders() {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const now = new Date();
    const expiredOrders = await Order.find({
      status: 'pending',
      createdAt: { $lt: new Date(now - 30 * 60 * 1000) } // 30 минут назад
    }).session(session);

    console.log(`⏰ Found ${expiredOrders.length} expired pending orders`);

    let cancelledCount = 0;
    let stockReturnedItems = 0;

    for (const order of expiredOrders) {
      // Возвращаем товары на склад
      for (const item of order.items) {
        const product = await Product.findById(item.product_id).session(session);
        
        if (product && product.category === 'store' && typeof product.stock_quantity === 'number') {
          await Product.findByIdAndUpdate(
            item.product_id,
            { 
              $inc: { stock_quantity: item.quantity },
              $push: {
                reservation_history: {
                  order_id: order._id,
                  quantity_returned: item.quantity,
                  returned_at: new Date(),
                  type: 'auto_cleanup_expired_order',
                  reason: 'Order expired - not confirmed within 30 minutes'
                }
              }
            },
            { session }
          );
          
          stockReturnedItems++;
          console.log(`↩️ AUTO-RETURNED: ${item.quantity}x "${item.title}" to stock`);
        }
      }

      // Отменяем заказ
      await order.cancelOrder(
        'Автоматическая отмена - превышено время ожидания', 
        null, 
        'system', 
        'Заказ не был подтвержден в течение 30 минут'
      );
      
      cancelledCount++;
    }

    await session.commitTransaction();

    console.log(`✅ Auto-cancelled ${cancelledCount} expired orders, returned ${stockReturnedItems} items to stock`);
    
    return {
      cancelled_count: cancelledCount,
      stock_returned_items: stockReturnedItems
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 CANCEL EXPIRED ORDERS ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * 📚 ОЧИСТКА СТАРОЙ ИСТОРИИ РЕЗЕРВИРОВАНИЙ (старше 30 дней)
 */
async function cleanupOldReservations() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await Product.updateMany(
      {},
      {
        $pull: {
          reservation_history: {
            $or: [
              { reserved_at: { $lt: thirtyDaysAgo } },
              { returned_at: { $lt: thirtyDaysAgo } }
            ]
          }
        }
      }
    );

    console.log(`📚 Cleaned old reservation history from ${result.modifiedCount} products`);
    return result.modifiedCount;

  } catch (error) {
    console.error('🚨 CLEANUP OLD RESERVATIONS ERROR:', error);
    throw error;
  }
}

/**
 * 🔍 ПРОВЕРКА СОСТОЯНИЯ СИСТЕМЫ (диагностика)
 */
export const getSystemHealthCheck = async () => {
  try {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const healthCheck = {
      timestamp: now,
      pending_orders: await Order.countDocuments({ status: 'pending' }),
      expired_pending_orders: await Order.countDocuments({
        status: 'pending',
        createdAt: { $lt: thirtyMinutesAgo }
      }),
      active_carts: await Cart.countDocuments({ status: 'active' }),
      expired_carts: await Cart.countDocuments({
        status: { $in: ['active', 'abandoned'] },
        expires_at: { $lt: now }
      }),
      recent_orders: await Order.countDocuments({
        createdAt: { $gte: twentyFourHoursAgo }
      }),
      products_with_reservations: await Product.countDocuments({
        'reservation_history.0': { $exists: true }
      })
    };

    // Определяем нужна ли очистка
    healthCheck.needs_cleanup = 
      healthCheck.expired_pending_orders > 0 || 
      healthCheck.expired_carts > 0;

    console.log('🔍 SYSTEM HEALTH CHECK:', healthCheck);
    return healthCheck;

  } catch (error) {
    console.error('🚨 HEALTH CHECK ERROR:', error);
    throw error;
  }
};

/**
 * 🔧 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА КОНКРЕТНОГО ТИПА ДАННЫХ
 */
export const forceCleanupByType = async (cleanupType) => {
  try {
    console.log(`🔧 FORCE CLEANUP TYPE: ${cleanupType}`);

    let result;
    
    switch (cleanupType) {
      case 'carts':
        result = await cleanupExpiredCarts();
        break;
      
      case 'orders':
        result = await cancelExpiredOrders();
        break;
      
      case 'reservations':
        result = await cleanupOldReservations();
        break;
      
      case 'all':
        result = await cleanupExpiredData();
        break;
      
      default:
        throw new Error(`Неизвестный тип очистки: ${cleanupType}. Доступные: carts, orders, reservations, all`);
    }

    return {
      cleanup_type: cleanupType,
      result,
      completed_at: new Date()
    };

  } catch (error) {
    console.error(`🚨 FORCE CLEANUP ERROR [${cleanupType}]:`, error);
    throw error;
  }
};

// ================ ПЛАНИРОВЩИК БЕЗ node-cron ================

let cleanupInterval = null;
let deepCleanupInterval = null;

/**
 * 🕒 НАСТРОЙКА АВТОМАТИЧЕСКОЙ ОЧИСТКИ (без node-cron)
 */
export const setupCleanupScheduler = () => {
  // Запуск очистки каждые 30 минут (30 * 60 * 1000 мс)
  cleanupInterval = setInterval(async () => {
    try {
      console.log('⏰ SCHEDULED CLEANUP STARTED');
      await cleanupExpiredData();
    } catch (error) {
      console.error('🚨 SCHEDULED CLEANUP FAILED:', error);
    }
  }, 30 * 60 * 1000); // 30 минут

  // Глубокая очистка каждые 24 часа в 3:00 ночи
  const scheduleDeepCleanup = () => {
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(3, 0, 0, 0); // 3:00 AM
    
    // Если 3:00 уже прошло сегодня, планируем на завтра
    if (now > targetTime) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const timeUntilTarget = targetTime.getTime() - now.getTime();
    
    setTimeout(() => {
      // Выполняем глубокую очистку
      (async () => {
        try {
          console.log('🌙 DEEP CLEANUP STARTED (3:00 AM)');
          await cleanupExpiredData();
          
          // Дополнительная очистка старых логов заказов (старше 6 месяцев)
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          
          await Order.updateMany(
            { createdAt: { $lt: sixMonthsAgo } },
            { $unset: { status_history: 1 } }
          );
          
          console.log('🌙 DEEP CLEANUP COMPLETED');
        } catch (error) {
          console.error('🚨 DEEP CLEANUP FAILED:', error);
        }
      })();
      
      // Планируем следующую глубокую очистку через 24 часа
      deepCleanupInterval = setInterval(async () => {
        try {
          console.log('🌙 DEEP CLEANUP STARTED (3:00 AM)');
          await cleanupExpiredData();
          
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          
          await Order.updateMany(
            { createdAt: { $lt: sixMonthsAgo } },
            { $unset: { status_history: 1 } }
          );
          
          console.log('🌙 DEEP CLEANUP COMPLETED');
        } catch (error) {
          console.error('🚨 DEEP CLEANUP FAILED:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 часа
      
    }, timeUntilTarget);
  };

  scheduleDeepCleanup();

  console.log('✅ CLEANUP SCHEDULER INITIALIZED (without node-cron)');
  console.log('📅 Schedule: Every 30 minutes + Deep cleanup at 3:00 AM daily');
};

/**
 * 🛑 ОСТАНОВКА АВТООЧИСТКИ
 */
export const stopCleanupScheduler = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  if (deepCleanupInterval) {
    clearInterval(deepCleanupInterval);
    deepCleanupInterval = null;
  }
  
  console.log('🛑 CLEANUP SCHEDULER STOPPED');
};

// ================ ЭКСПОРТ ================

export default {
  cleanupExpiredData,
  getSystemHealthCheck,
  forceCleanupByType,
  setupCleanupScheduler,
  stopCleanupScheduler,
  
  // Отдельные функции для гибкости
  cleanupExpiredCarts,
  cancelExpiredOrders,
  cleanupOldReservations
};