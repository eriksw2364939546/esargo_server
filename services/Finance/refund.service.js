// services/Finance/refund.service.js - РЕАЛЬНАЯ СИСТЕМА ВОЗВРАТОВ ESARGO
import { Transaction, Order, PartnerProfile, CourierProfile } from '../../models/index.js';
import { processOrderRefund } from '../payment.stub.service.js'; // Платежная система
import mongoose from 'mongoose';

// ================ РЕАЛЬНАЯ СИСТЕМА ВОЗВРАТОВ ================

/**
 * 💸 ПОЛНОЦЕННАЯ ОБРАБОТКА ВОЗВРАТА СРЕДСТВ
 * @param {Object} order - Заказ для возврата
 * @param {Object} options - Опции возврата
 * @returns {Object} - Результат возврата с реальными транзакциями
 */
export const processRealRefund = async (order, options = {}) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    const {
      refund_reason = 'order_cancelled',
      refund_type = 'full', // full | partial
      partial_amount = null,
      initiated_by_user_id,
      initiated_by_role = 'customer' // customer | partner | admin
    } = options;

    console.log('💸 PROCESS REAL REFUND:', {
      order_id: order._id,
      order_number: order.order_number,
      total_price: order.total_price,
      refund_type,
      refund_reason,
      initiated_by_role
    });

    // ================ 1. ВАЛИДАЦИЯ ВОЗМОЖНОСТИ ВОЗВРАТА ================

    if (order.payment_status !== 'completed') {
      throw new Error('Возврат невозможен: заказ не был оплачен или уже возвращен');
    }

    if (order.status === 'delivered' && initiated_by_role === 'customer') {
      // Проверяем время доставки (можно вернуть в течение 2 часов после доставки)
      const deliveredAt = order.status_history?.find(h => h.status === 'delivered')?.timestamp;
      if (deliveredAt && Date.now() - deliveredAt.getTime() > 2 * 60 * 60 * 1000) {
        throw new Error('Возврат невозможен: прошло более 2 часов после доставки');
      }
    }

    // ================ 2. РАСЧЕТ СУММЫ ВОЗВРАТА ================

    let refundAmount = order.total_price;
    let refundBreakdown = {
      subtotal: order.pricing?.subtotal || 0,
      delivery_fee: order.pricing?.delivery_fee || 0,
      service_fee: order.pricing?.service_fee || 0,
      total: order.total_price
    };

    // Частичный возврат
    if (refund_type === 'partial' && partial_amount) {
      if (partial_amount > order.total_price) {
        throw new Error('Сумма частичного возврата не может превышать стоимость заказа');
      }
      refundAmount = partial_amount;
      refundBreakdown.total = partial_amount;
    }

    // Логика уменьшения возврата в зависимости от статуса заказа
    if (order.status === 'preparing' || order.status === 'ready') {
      // Если заказ уже готовится, возвращаем без комиссии за доставку
      refundBreakdown.delivery_fee = 0;
      refundAmount = refundBreakdown.subtotal + refundBreakdown.service_fee;
    } else if (order.status === 'picked_up') {
      // Если заказ уже забран курьером, удерживаем 50% от стоимости доставки
      refundBreakdown.delivery_fee = refundBreakdown.delivery_fee * 0.5;
      refundAmount = refundBreakdown.subtotal + refundBreakdown.service_fee + refundBreakdown.delivery_fee;
    }

    console.log('💰 REFUND CALCULATION:', {
      original_amount: order.total_price,
      refund_amount: refundAmount,
      breakdown: refundBreakdown
    });

    // ================ 3. ОБРАБОТКА ВОЗВРАТА В ПЛАТЕЖНОЙ СИСТЕМЕ ================

    let paymentRefundResult = null;
    if (order.payment_method === 'card') {
      try {
        paymentRefundResult = await processOrderRefund({
          original_payment_id: order.payment_details?.payment_id,
          amount: refundAmount,
          order_id: order._id,
          reason: refund_reason
        });

        console.log('✅ PAYMENT REFUND SUCCESS:', {
          refund_id: paymentRefundResult.refund_id,
          amount: paymentRefundResult.amount
        });

      } catch (paymentError) {
        console.error('🚨 PAYMENT REFUND FAILED:', paymentError);
        throw new Error(`Ошибка возврата в платежной системе: ${paymentError.message}`);
      }
    }

    // ================ 4. СОЗДАНИЕ ФИНАНСОВЫХ ТРАНЗАКЦИЙ ВОЗВРАТА ================

    const refundTransactions = await createRefundTransactions({
      order,
      refundAmount,
      refundBreakdown,
      refund_reason,
      payment_refund_id: paymentRefundResult?.refund_id,
      session
    });

    // ================ 5. ОБНОВЛЕНИЕ EARNINGS УЧАСТНИКОВ ================

    await updateParticipantsEarningsOnRefund({
      order,
      refundBreakdown,
      session
    });

    // ================ 6. ОБНОВЛЕНИЕ ЗАКАЗА ================

    order.payment_status = refund_type === 'full' ? 'refunded' : 'partially_refunded';
    order.refund_details = {
      refund_id: paymentRefundResult?.refund_id || `ref_internal_${Date.now()}`,
      refund_type,
      refund_reason,
      original_amount: order.total_price,
      refunded_amount: refundAmount,
      refund_breakdown: refundBreakdown,
      processed_at: new Date(),
      estimated_arrival: paymentRefundResult?.estimated_arrival || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      initiated_by: {
        user_id: initiated_by_user_id,
        role: initiated_by_role
      },
      transactions: refundTransactions.map(t => t.transaction_id)
    };

    // Добавляем в историю статусов
    order.status_history.push({
      status: refund_type === 'full' ? 'refunded' : 'partially_refunded',
      timestamp: new Date(),
      updated_by: initiated_by_user_id,
      user_role: initiated_by_role,
      notes: `Возврат средств: ${refund_reason}`
    });

    await order.save({ session });

    await session.commitTransaction();

    // ================ 7. РЕЗУЛЬТАТ ================

    const result = {
      success: true,
      refund_id: order.refund_details.refund_id,
      order_id: order._id,
      order_number: order.order_number,
      refund_details: {
        type: refund_type,
        reason: refund_reason,
        original_amount: order.total_price,
        refunded_amount: refundAmount,
        breakdown: refundBreakdown,
        estimated_arrival: order.refund_details.estimated_arrival
      },
      financial_impact: {
        transactions_created: refundTransactions.length,
        participant_earnings_updated: true,
        payment_system_processed: !!paymentRefundResult
      },
      message: `Возврат ${refundAmount}€ успешно обработан. Средства поступят на карту в течение 3-5 рабочих дней.`
    };

    console.log('✅ REAL REFUND COMPLETED:', {
      refund_id: result.refund_id,
      amount: refundAmount,
      transactions: refundTransactions.length
    });

    return result;

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 REAL REFUND ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * Создание транзакций возврата
 */
async function createRefundTransactions({ order, refundAmount, refundBreakdown, refund_reason, payment_refund_id, session }) {
  const transactions = [];

  // 1. Основная транзакция возврата клиенту
  const mainRefundTransaction = new Transaction({
    transaction_id: Transaction.generateTransactionId(),
    order_id: order._id,
    transaction_type: 'customer_refund',
    from_user_type: 'platform',
    to_user_id: order.customer_id,
    to_user_type: 'customer',
    amount: refundAmount,
    status: 'completed',
    description: `Возврат средств за заказ ${order.order_number}`,
    metadata: {
      refund_reason,
      payment_refund_id,
      original_order_amount: order.total_price,
      refund_breakdown: refundBreakdown
    }
  });

  await mainRefundTransaction.save({ session });
  transactions.push(mainRefundTransaction);

  // 2. Корректировка earnings партнера (если заказ был принят)
  if (order.status !== 'pending' && order.partner_id) {
    const partnerRefundAmount = Math.round((refundBreakdown.subtotal * 0.9) * 100) / 100; // 90% от возвращаемой суммы товаров
    
    if (partnerRefundAmount > 0) {
      const partnerRefundTransaction = new Transaction({
        transaction_id: Transaction.generateTransactionId(),
        order_id: order._id,
        transaction_type: 'partner_refund_deduction',
        from_user_id: order.partner_id,
        from_user_type: 'partner',
        to_user_type: 'platform',
        amount: partnerRefundAmount,
        status: 'completed',
        description: `Корректировка заработка партнера при возврате заказа ${order.order_number}`,
        metadata: {
          refund_reason,
          original_earnings: refundBreakdown.subtotal * 0.9
        }
      });

      await partnerRefundTransaction.save({ session });
      transactions.push(partnerRefundTransaction);
    }
  }

  // 3. Корректировка earnings курьера (если заказ был принят к доставке)
  if (order.courier_id && (order.status === 'picked_up' || order.status === 'delivered')) {
    const courierRefundAmount = refundBreakdown.delivery_fee;
    
    if (courierRefundAmount > 0) {
      const courierRefundTransaction = new Transaction({
        transaction_id: Transaction.generateTransactionId(),
        order_id: order._id,
        transaction_type: 'courier_refund_deduction',
        from_user_id: order.courier_id,
        from_user_type: 'courier',
        to_user_type: 'platform',
        amount: courierRefundAmount,
        status: 'completed',
        description: `Корректировка заработка курьера при возврате заказа ${order.order_number}`,
        metadata: {
          refund_reason,
          original_delivery_fee: order.pricing?.delivery_fee || 0
        }
      });

      await courierRefundTransaction.save({ session });
      transactions.push(courierRefundTransaction);
    }
  }

  return transactions;
}

/**
 * Обновление earnings участников при возврате
 */
async function updateParticipantsEarningsOnRefund({ order, refundBreakdown, session }) {
  // Обновляем earnings партнера
  if (order.partner_id) {
    const partner = await PartnerProfile.findById(order.partner_id).session(session);
    if (partner) {
      const deduction = Math.round((refundBreakdown.subtotal * 0.9) * 100) / 100;
      
      partner.earnings.total_earned = Math.max(0, partner.earnings.total_earned - deduction);
      partner.earnings.monthly_earned = Math.max(0, partner.earnings.monthly_earned - deduction);
      partner.earnings.weekly_earned = Math.max(0, partner.earnings.weekly_earned - deduction);
      
      await partner.save({ session });
    }
  }

  // Обновляем earnings курьера
  if (order.courier_id) {
    const courier = await CourierProfile.findById(order.courier_id).session(session);
    if (courier) {
      const deduction = refundBreakdown.delivery_fee;
      
      courier.earnings.total_earned = Math.max(0, courier.earnings.total_earned - deduction);
      courier.earnings.monthly_earned = Math.max(0, courier.earnings.monthly_earned - deduction);
      courier.earnings.weekly_earned = Math.max(0, courier.earnings.weekly_earned - deduction);
      
      await courier.save({ session });
    }
  }
}

// ================ УТИЛИТАРНЫЕ ФУНКЦИИ ================

/**
 * Проверка возможности возврата
 */
export const canRefundOrder = (order, userRole = 'customer') => {
  const checks = {
    can_refund: false,
    reasons: []
  };

  // Основные проверки
  if (order.payment_status !== 'completed') {
    checks.reasons.push('Заказ не был оплачен');
    return checks;
  }

  if (order.payment_status === 'refunded') {
    checks.reasons.push('Заказ уже возвращен');
    return checks;
  }

  // Проверки по статусам
  switch (order.status) {
    case 'pending':
    case 'accepted':
      checks.can_refund = true;
      break;
      
    case 'preparing':
    case 'ready':
      checks.can_refund = true;
      checks.reasons.push('Возможен возврат без стоимости доставки');
      break;
      
    case 'picked_up':
      checks.can_refund = true;
      checks.reasons.push('Возможен возврат с удержанием 50% стоимости доставки');
      break;
      
    case 'delivered':
      if (userRole === 'customer') {
        const deliveredAt = order.status_history?.find(h => h.status === 'delivered')?.timestamp;
        if (deliveredAt && Date.now() - deliveredAt.getTime() <= 2 * 60 * 60 * 1000) {
          checks.can_refund = true;
          checks.reasons.push('Возврат возможен в течение 2 часов после доставки');
        } else {
          checks.reasons.push('Прошло более 2 часов после доставки');
        }
      } else {
        checks.can_refund = true; // Админ может возвращать всегда
      }
      break;
      
    case 'cancelled':
    case 'refunded':
      checks.reasons.push('Заказ уже отменен или возвращен');
      break;
      
    default:
      checks.reasons.push('Неизвестный статус заказа');
  }

  return checks;
};

/**
 * Расчет возможной суммы возврата
 */
export const calculateRefundAmount = (order) => {
  const breakdown = {
    subtotal: order.pricing?.subtotal || 0,
    delivery_fee: order.pricing?.delivery_fee || 0,
    service_fee: order.pricing?.service_fee || 0,
    total: order.total_price
  };

  let refundable_amount = breakdown.total;

  // Корректировки по статусу
  switch (order.status) {
    case 'preparing':
    case 'ready':
      breakdown.delivery_fee = 0;
      refundable_amount = breakdown.subtotal + breakdown.service_fee;
      break;
      
    case 'picked_up':
      breakdown.delivery_fee = breakdown.delivery_fee * 0.5;
      refundable_amount = breakdown.subtotal + breakdown.service_fee + breakdown.delivery_fee;
      break;
  }

  return {
    refundable_amount: Math.round(refundable_amount * 100) / 100,
    breakdown,
    deductions: {
      delivery_fee_reduction: (order.pricing?.delivery_fee || 0) - breakdown.delivery_fee
    }
  };
};

// ================ ЭКСПОРТ ================

export default {
  processRealRefund,
  canRefundOrder,
  calculateRefundAmount
};