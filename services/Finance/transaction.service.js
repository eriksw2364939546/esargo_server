// services/Finance/transaction.service.js - СЕРВИС ФИНАНСОВЫХ ОПЕРАЦИЙ ESARGO
import { Transaction, Order, PartnerProfile, CourierProfile } from '../../models/index.js';
import mongoose from 'mongoose';

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ СОЗДАНИЯ ТРАНЗАКЦИЙ
// ============================================

/**
 * ✅ ГЛАВНАЯ ФУНКЦИЯ: Создание всех финансовых транзакций для заказа
 * Интегрируется с существующим Order Service
 * @param {Object} orderData - Данные заказа
 * @param {Object} deliveryData - Данные доставки из Delivery Service
 * @returns {Object} Результат создания транзакций
 */
export const createOrderTransactions = async (orderData, deliveryData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    const {
      order_id,
      order_number,
      customer_id,
      partner_id,
      courier_id = null,
      subtotal,
      total_price,
      payment_status
    } = orderData;

    console.log('💰 CREATE ORDER TRANSACTIONS:', {
      order_number,
      subtotal,
      delivery_zone: deliveryData?.delivery_zone,
      has_courier: !!courier_id
    });

    const transactions = [];

    // 1. ✅ КОМИССИЯ ESARGO (10% от суммы товаров)
    const platformCommission = await createPlatformCommissionTransaction({
      order_id,
      order_number,
      partner_id,
      subtotal,
      session
    });
    transactions.push(platformCommission);

    // 2. ✅ ВЫПЛАТА ПАРТНЕРУ (90% от суммы товаров)
    const partnerPayout = await createPartnerPayoutTransaction({
      order_id,
      order_number,
      partner_id,
      subtotal,
      commission: platformCommission.amount,
      session
    });
    transactions.push(partnerPayout);

    // 3. ✅ ОПЛАТА КУРЬЕРУ (если назначен и есть данные доставки)
    if (courier_id && deliveryData) {
      const courierPayment = await createCourierPaymentTransaction({
        order_id,
        order_number,
        courier_id,
        deliveryData,
        session
      });
      transactions.push(courierPayment);
    }

    // 4. ✅ ОБНОВЛЯЕМ EARNINGS УЧАСТНИКОВ
    await updateParticipantsEarnings(orderData, deliveryData, session);

    await session.commitTransaction();

    console.log('✅ TRANSACTIONS CREATED SUCCESS:', {
      order_number,
      transactions_count: transactions.length,
      total_commission: platformCommission.amount,
      partner_payout: partnerPayout.amount,
      courier_payment: courier_id ? transactions.find(t => t.transaction_type === 'courier_payment')?.amount : 0
    });

    return {
      success: true,
      order_id,
      order_number,
      transactions,
      financial_summary: {
        subtotal,
        platform_commission: platformCommission.amount,
        partner_earnings: partnerPayout.amount,
        courier_earnings: courier_id ? deliveryData.courier_earnings?.total_earnings || 0 : 0,
        delivery_fee: deliveryData?.delivery_fee || 0
      }
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 CREATE TRANSACTIONS ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Создание транзакции курьера при принятии заказа
 * Вызывается когда курьер берет заказ на доставку
 */
export const createCourierTransactionOnAccept = async (order_id, courier_id) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    console.log('💰 CREATE COURIER TRANSACTION:', { order_id, courier_id });

    // Получаем данные заказа
    const order = await Order.findById(order_id).session(session);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    // ПРАВИЛЬНЫЙ РАСЧЕТ: Курьер получает 100% от доставки
    let courierAmount = 0;
    
    // Сначала пытаемся использовать готовый расчет courier_earnings
    if (order.courier_earnings && order.courier_earnings > 0) {
      courierAmount = order.courier_earnings;
      console.log('📊 Using order.courier_earnings:', courierAmount);
    }
    // Если нет courier_earnings, рассчитываем сами
    else {
      // Базовая стоимость доставки
      const baseDeliveryFee = order.delivery_fee || 0;
      
      // Если delivery_fee тоже 0, рассчитываем по тарифам
      if (baseDeliveryFee === 0) {
        const zone = order.delivery_zone || 1;
        const orderTotal = order.subtotal || 0;
        
        // Тарифы согласно документации:
        // Зона 1: 6€ (≥30€) или 9€ (<30€)
        // Зона 2: 10€ (≥30€) или 13€ (<30€)
        if (zone === 1) {
          courierAmount = orderTotal >= 30 ? 6 : 9;
        } else if (zone === 2) {
          courierAmount = orderTotal >= 30 ? 10 : 13;
        }
        
        console.log('📊 Calculated base delivery fee:', {
          zone,
          orderTotal,
          baseCalculated: courierAmount
        });
      } else {
        courierAmount = baseDeliveryFee;
      }
      
      // Добавляем доплату за час пик (курьер получает все)
      const peakSurcharge = order.peak_hour_surcharge || 0;
      courierAmount += peakSurcharge;
      
      console.log('📊 Total courier amount:', {
        baseFee: courierAmount - peakSurcharge,
        peakSurcharge,
        total: courierAmount
      });
    }

    // Проверяем что сумма больше 0
    if (courierAmount <= 0) {
      throw new Error('Сумма оплаты курьера должна быть больше 0');
    }

    console.log('📊 FINAL COURIER PAYMENT CALCULATION:', {
      order_number: order.order_number,
      delivery_fee: order.delivery_fee,
      courier_earnings: order.courier_earnings,
      peak_hour_surcharge: order.peak_hour_surcharge,
      final_amount: courierAmount,
      zone: order.delivery_zone,
      subtotal: order.subtotal
    });

    // Создаем pending транзакцию курьера
    const courierPayment = new Transaction({
      transaction_id: Transaction.generateTransactionId(),
      order_id,
      transaction_type: 'courier_payment',
      from_user_type: 'platform',
      to_user_id: courier_id,
      to_user_type: 'courier',
      amount: courierAmount, // 100% от стоимости доставки + час пик
      status: 'pending', // Станет completed при доставке
      description: `Оплата за доставку заказа ${order.order_number}`,
      metadata: {
        delivery_zone: order.delivery_zone,
        delivery_distance_km: order.delivery_distance_km,
        base_delivery_fee: order.delivery_fee,
        peak_hour_surcharge: order.peak_hour_surcharge || 0,
        is_peak_hour: (order.peak_hour_surcharge || 0) > 0,
        courier_earnings_original: order.courier_earnings,
        calculation_method: order.courier_earnings > 0 ? 'from_order_field' : 'calculated_from_tariffs'
      }
    });

    await courierPayment.save({ session });
    await session.commitTransaction();

    console.log('✅ COURIER TRANSACTION CREATED:', {
      transaction_id: courierPayment.transaction_id,
      amount: courierPayment.amount,
      status: 'pending',
      description: courierPayment.description
    });

    return {
      success: true,
      transaction: courierPayment,
      amount: courierAmount,
      message: 'Транзакция курьера создана в статусе pending'
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 CREATE COURIER TRANSACTION ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * ✅ ОБРАБОТКА ТРАНЗАКЦИЙ ПРИ ДОСТАВКЕ ЗАКАЗА
 * Вызывается когда курьер доставил заказ
 */
export const processDeliveryTransactions = async (order_id, courier_id) => {
  try {
    console.log('🚚 PROCESS DELIVERY TRANSACTIONS:', { order_id, courier_id });

    // Находим все pending транзакции для этого заказа
    const pendingTransactions = await Transaction.find({
      order_id,
      status: 'pending'
    });

    const processedTransactions = [];

    for (const transaction of pendingTransactions) {
      try {
        // Обрабатываем транзакцию (меняем статус на completed)
        await transaction.process();
        processedTransactions.push({
          transaction_id: transaction.transaction_id,
          type: transaction.transaction_type,
          amount: transaction.amount,
          to_user_type: transaction.to_user_type,
          status: 'completed'
        });

        console.log(`✅ Transaction processed: ${transaction.transaction_type} - ${transaction.amount}€`);
      } catch (transactionError) {
        console.error(`❌ Failed to process transaction ${transaction.transaction_id}:`, transactionError);
        processedTransactions.push({
          transaction_id: transaction.transaction_id,
          type: transaction.transaction_type,
          status: 'failed',
          error: transactionError.message
        });
      }
    }

    return {
      success: true,
      order_id,
      processed_transactions: processedTransactions,
      total_processed: processedTransactions.filter(t => t.status === 'completed').length,
      total_failed: processedTransactions.filter(t => t.status === 'failed').length
    };

  } catch (error) {
    console.error('🚨 PROCESS DELIVERY TRANSACTIONS ERROR:', error);
    throw error;
  }
};

/**
 * ✅ ОБРАБОТКА ВОЗВРАТА ТРАНЗАКЦИЙ ПРИ ОТМЕНЕ ЗАКАЗА
 * Интегрируется с существующей системой refund
 */
export const processOrderRefundTransactions = async (order_id, refund_reason = 'order_cancelled') => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    console.log('💸 PROCESS REFUND TRANSACTIONS:', { order_id, refund_reason });

    // Находим все транзакции для заказа
    const orderTransactions = await Transaction.find({ order_id }).session(session);

    if (orderTransactions.length === 0) {
      console.log('ℹ️ No transactions found for order:', order_id);
      await session.commitTransaction();
      return { success: true, refunded_transactions: [] };
    }

    const refundedTransactions = [];

    for (const transaction of orderTransactions) {
      // Создаем обратную транзакцию для возврата
      const refundTransaction = new Transaction({
        transaction_id: Transaction.generateTransactionId(),
        order_id,
        transaction_type: 'refund',
        from_user_id: transaction.to_user_id,
        from_user_type: transaction.to_user_type,
        to_user_id: transaction.from_user_id,
        to_user_type: transaction.from_user_type,
        amount: transaction.amount,
        status: 'completed',
        description: `Возврат: ${transaction.description}`,
        metadata: {
          original_transaction_id: transaction.transaction_id,
          refund_reason,
          original_type: transaction.transaction_type
        }
      });

      await refundTransaction.save({ session });
      
      // Помечаем оригинальную транзакцию как возвращенную
      transaction.status = 'refunded';
      transaction.refunded_at = new Date();
      await transaction.save({ session });

      refundedTransactions.push({
        original_transaction_id: transaction.transaction_id,
        refund_transaction_id: refundTransaction.transaction_id,
        amount: transaction.amount,
        type: transaction.transaction_type
      });

      console.log(`💸 Refund created: ${transaction.transaction_type} - ${transaction.amount}€`);
    }

    await session.commitTransaction();

    return {
      success: true,
      order_id,
      refunded_transactions: refundedTransactions,
      total_refunded_amount: refundedTransactions.reduce((sum, t) => sum + t.amount, 0)
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 PROCESS REFUND TRANSACTIONS ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ СОЗДАНИЯ ТРАНЗАКЦИЙ
// ============================================

/**
 * Создание транзакции комиссии платформы ESARGO
 */
async function createPlatformCommissionTransaction(data) {
  const { order_id, order_number, partner_id, subtotal, session } = data;
  
  const commissionAmount = Math.round(subtotal * 0.10 * 100) / 100; // 10%
  
  const transaction = new Transaction({
    transaction_id: Transaction.generateTransactionId(),
    order_id,
    transaction_type: 'platform_commission',
    from_user_id: partner_id,
    from_user_type: 'partner',
    to_user_type: 'platform',
    amount: commissionAmount,
    status: 'pending', // Станет completed при доставке
    description: `Комиссия ESARGO (10%) за заказ ${order_number}`,
    metadata: {
      commission_rate: 0.10,
      order_subtotal: subtotal,
      calculation_method: 'percentage'
    }
  });

  await transaction.save({ session });
  return transaction;
}

/**
 * Создание транзакции выплаты партнеру
 */
async function createPartnerPayoutTransaction(data) {
  const { order_id, order_number, partner_id, subtotal, commission, session } = data;
  
  const payoutAmount = Math.round((subtotal - commission) * 100) / 100; // 90%
  
  const transaction = new Transaction({
    transaction_id: Transaction.generateTransactionId(),
    order_id,
    transaction_type: 'partner_payout',
    from_user_type: 'platform',
    to_user_id: partner_id,
    to_user_type: 'partner',
    amount: payoutAmount,
    status: 'pending', // Станет completed при доставке
    description: `Выплата за заказ ${order_number}`,
    metadata: {
      order_subtotal: subtotal,
      commission_deducted: commission,
      payout_rate: 0.90
    }
  });

  await transaction.save({ session });
  return transaction;
}

/**
 * Создание транзакции оплаты курьеру
 */
async function createCourierPaymentTransaction(data) {
  const { order_id, order_number, courier_id, deliveryData, session } = data;
  
  const courierEarnings = deliveryData.courier_earnings?.total_earnings || deliveryData.delivery_fee || 0;
  
  const transaction = new Transaction({
    transaction_id: Transaction.generateTransactionId(),
    order_id,
    transaction_type: 'courier_payment',
    from_user_type: 'platform',
    to_user_id: courier_id,
    to_user_type: 'courier',
    amount: courierEarnings,
    status: 'pending', // Станет completed при доставке
    description: `Оплата за доставку заказа ${order_number}`,
    metadata: {
      delivery_zone: deliveryData.delivery_zone,
      delivery_distance_km: deliveryData.distance_km,
      base_delivery_fee: deliveryData.delivery_fee,
      peak_hour_surcharge: deliveryData.peak_hour_info?.surcharge || 0,
      is_peak_hour: deliveryData.peak_hour_info?.is_peak_hour || false
    }
  });

  await transaction.save({ session });
  return transaction;
}

/**
 * Обновление earnings участников
 */
async function updateParticipantsEarnings(orderData, deliveryData, session) {
  const { partner_id, courier_id, subtotal } = orderData;

  // Обновляем earnings партнера
  if (partner_id) {
    const partner = await PartnerProfile.findById(partner_id).session(session);
    if (partner) {
      await partner.updateEarnings({ subtotal });
    }
  }

  // Обновляем earnings курьера
  if (courier_id && deliveryData) {
    const courier = await CourierProfile.findById(courier_id).session(session);
    if (courier) {
      await courier.addEarnings({
        delivery_fee: deliveryData.delivery_fee,
        peak_hour_surcharge: deliveryData.peak_hour_info?.surcharge || 0,
        delivery_zone: deliveryData.delivery_zone,
        delivery_distance_km: deliveryData.distance_km
      });
    }
  }
}

// ============================================
// ФУНКЦИИ ПОЛУЧЕНИЯ СТАТИСТИКИ
// ============================================

/**
 * ✅ ПОЛУЧЕНИЕ ФИНАНСОВОЙ СТАТИСТИКИ ПО ПОЛЬЗОВАТЕЛЮ
 */
export const getUserEarningsHistory = async (userId, userType, options = {}) => {
  try {
    const {
      limit = 20,
      offset = 0,
      dateFrom,
      dateTo,
      transaction_type = null
    } = options;

    console.log('📊 GET USER EARNINGS:', { userId, userType, limit, transaction_type });

    const transactions = await Transaction.getByUser(userId, userType, {
      status: 'completed',
      limit,
      offset,
      dateFrom,
      dateTo
    });

    // Группируем по типам транзакций
    const summary = transactions.reduce((acc, transaction) => {
      const type = transaction.transaction_type;
      if (!acc[type]) {
        acc[type] = { count: 0, total_amount: 0 };
      }
      acc[type].count += 1;
      acc[type].total_amount += transaction.amount;
      return acc;
    }, {});

    const totalEarnings = transactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      user_id: userId,
      user_type: userType,
      transactions,
      summary: {
        total_transactions: transactions.length,
        total_earnings: Math.round(totalEarnings * 100) / 100,
        by_type: summary
      },
      pagination: {
        limit,
        offset,
        has_more: transactions.length === limit
      }
    };

  } catch (error) {
    console.error('🚨 GET USER EARNINGS ERROR:', error);
    throw error;
  }
};

/**
 * ✅ ОБЩАЯ ФИНАНСОВАЯ СТАТИСТИКА ПЛАТФОРМЫ
 */
export const getPlatformFinancialStats = async (dateFrom, dateTo) => {
  try {
    console.log('📊 GET PLATFORM FINANCIAL STATS:', { dateFrom, dateTo });

    const stats = await Transaction.getStatsForPeriod(dateFrom, dateTo);

    // Группируем по типам пользователей
    const partnerStats = await Transaction.getStatsForPeriod(dateFrom, dateTo, { userType: 'partner' });
    const courierStats = await Transaction.getStatsForPeriod(dateFrom, dateTo, { userType: 'courier' });
    const platformStats = await Transaction.getStatsForPeriod(dateFrom, dateTo, { 
      transactionType: 'platform_commission' 
    });

    return {
      period: { from: dateFrom, to: dateTo },
      platform_commission: {
        total_amount: platformStats.reduce((sum, stat) => sum + stat.total_amount, 0),
        transaction_count: platformStats.reduce((sum, stat) => sum + stat.count, 0)
      },
      partner_payouts: {
        total_amount: partnerStats.reduce((sum, stat) => sum + stat.total_amount, 0),
        transaction_count: partnerStats.reduce((sum, stat) => sum + stat.count, 0)
      },
      courier_payments: {
        total_amount: courierStats.reduce((sum, stat) => sum + stat.total_amount, 0),
        transaction_count: courierStats.reduce((sum, stat) => sum + stat.count, 0)
      },
      daily_breakdown: stats
    };

  } catch (error) {
    console.error('🚨 GET PLATFORM STATS ERROR:', error);
    throw error;
  }
};

// ============================================
// УТИЛИТЫ ДЛЯ ИНТЕГРАЦИИ
// ============================================

/**
 * ✅ ФУНКЦИЯ ДЛЯ ИНТЕГРАЦИИ С ORDER SERVICE
 * Вызывается из Order Service при создании заказа
 */
export const integrateWithOrderCreation = async (orderData, deliveryData) => {
  try {
    // Создаем транзакции только если заказ оплачен
    if (orderData.payment_status === 'completed') {
      const result = await createOrderTransactions(orderData, deliveryData);
      return { success: true, transactions: result.transactions };
    }
    
    return { success: true, message: 'Payment not completed, transactions skipped' };
  } catch (error) {
    console.error('🚨 INTEGRATION ERROR:', error);
    // НЕ бросаем ошибку, чтобы не сломать создание заказа
    return { success: false, error: error.message };
  }
};

/**
 * ✅ ФУНКЦИЯ ДЛЯ ИНТЕГРАЦИИ С ПРИНЯТИЕМ ЗАКАЗА КУРЬЕРОМ
 * Вызывается когда курьер берет заказ на доставку
 */
export const integrateWithCourierAccept = async (order_id, courier_id) => {
  try {
    const result = await createCourierTransactionOnAccept(order_id, courier_id);
    return { success: true, transaction: result.transaction };
  } catch (error) {
    console.error('🚨 COURIER ACCEPT INTEGRATION ERROR:', error);
    // НЕ бросаем ошибку, чтобы не сломать принятие заказа
    return { success: false, error: error.message };
  }
};

/**
 * ✅ ФУНКЦИЯ ДЛЯ ИНТЕГРАЦИИ С DELIVERY
 * Вызывается когда курьер доставил заказ
 */
export const integrateWithOrderDelivery = async (order_id, courier_id) => {
  try {
    const result = await processDeliveryTransactions(order_id, courier_id);
    return { success: true, processed: result.processed_transactions };
  } catch (error) {
    console.error('🚨 DELIVERY INTEGRATION ERROR:', error);
    // НЕ бросаем ошибку, чтобы не сломать доставку
    return { success: false, error: error.message };
  }
};

// ============================================
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ
// ============================================

export default {
  // Основные функции
  createOrderTransactions,
  processDeliveryTransactions,
  processOrderRefundTransactions,
  createCourierTransactionOnAccept, // ✅ НОВАЯ ФУНКЦИЯ
  
  // Статистика
  getUserEarningsHistory,
  getPlatformFinancialStats,
  
  // Интеграция (безопасные функции)
  integrateWithOrderCreation,
  integrateWithOrderDelivery,
  integrateWithCourierAccept, // ✅ НОВАЯ ИНТЕГРАЦИЯ
  
  // Утилиты
  Transaction // Экспортируем модель для прямого использования
};