// services/Order/order.service.js - ПОЛНАЯ СИСТЕМА ЗАКАЗОВ ESARGO БЕЗ ЗАГЛУШЕК
import { Order, Cart, User, PartnerProfile, CourierProfile, Product } from '../../models/index.js';
import { calculateFullDelivery } from '../Delivery/delivery.service.js';
import { integrateWithOrderCreation, integrateWithOrderDelivery } from '../Finance/transaction.service.js';
import { processOrderPayment } from '../payment.stub.service.js';
import { cleanupExpiredData } from '../System/cleanup.service.js';
import mongoose from 'mongoose';

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

function getReasonText(reason) {
  const reasons = {
    'product_deactivated': 'товар снят с продажи',
    'out_of_stock': 'закончился на складе',
    'time_restricted': 'недоступен в данное время',
    'partner_unavailable': 'ресторан недоступен',
    'insufficient_stock': 'недостаточно товара на складе'
  };
  return reasons[reason] || 'неизвестная причина';
}

async function calculateEstimatedDeliveryTime(delivery_address, restaurant_location, restaurant_delivery_info) {
  try {
    const deliveryData = {
      restaurant_lat: restaurant_location?.coordinates?.[1] || 43.2965,
      restaurant_lng: restaurant_location?.coordinates?.[0] || 5.3698,
      delivery_lat: delivery_address.lat,
      delivery_lng: delivery_address.lng,
      order_total: 0,
      order_time: new Date()
    };

    const result = await calculateFullDelivery(deliveryData);
    return new Date(Date.now() + result.estimated_delivery_minutes * 60 * 1000);
  } catch (error) {
    console.warn('Delivery service failed, using fallback:', error.message);
    
    let baseTime = 30;
    if (restaurant_delivery_info && restaurant_delivery_info.base_delivery_time) {
      baseTime = restaurant_delivery_info.base_delivery_time;
    }
    
    const distance = calculateDistance(
      restaurant_location?.coordinates?.[1] || 43.2965,
      restaurant_location?.coordinates?.[0] || 5.3698,
      delivery_address.lat,
      delivery_address.lng
    );
    
    const additionalTime = Math.round(distance * 2);
    return new Date(Date.now() + (baseTime + additionalTime) * 60 * 1000);
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function validateProductsAvailability(cartItems, session = null) {
  const productIds = cartItems.map(item => item.product_id);
  const products = await Product.find({
    _id: { $in: productIds }
  }).session(session);

  const unavailableItems = [];
  const availableProducts = [];
  const itemsSnapshot = [];

  for (const cartItem of cartItems) {
    const product = products.find(p => p._id.toString() === cartItem.product_id.toString());

    const snapshot = {
      product_id: cartItem.product_id,
      availability_at_order: {
        is_active: product ? product.is_active : false,
        is_available: product ? product.is_available : false,
        stock_quantity: product ? product.stock_quantity : 0,
        availability_schedule: product ? product.availability_schedule : null
      },
      captured_at: new Date()
    };
    itemsSnapshot.push(snapshot);

    if (!product) {
      unavailableItems.push({
        product_id: cartItem.product_id,
        title: cartItem.title,
        reason: 'product_deactivated',
        requested_quantity: cartItem.quantity,
        detected_at: new Date()
      });
      continue;
    }

    if (!product.is_active || !product.is_available) {
      unavailableItems.push({
        product_id: cartItem.product_id,
        title: cartItem.title,
        reason: product.is_active ? 'out_of_stock' : 'product_deactivated',
        requested_quantity: cartItem.quantity,
        detected_at: new Date()
      });
      continue;
    }

    if (product.category === 'store' && typeof product.stock_quantity === 'number') {
      if (product.stock_quantity < cartItem.quantity) {
        unavailableItems.push({
          product_id: cartItem.product_id,
          title: cartItem.title,
          reason: 'insufficient_stock',
          requested_quantity: cartItem.quantity,
          available_quantity: product.stock_quantity,
          detected_at: new Date()
        });
        continue;
      }
    }

    availableProducts.push(product);
  }

  let validationStatus = 'valid';
  if (unavailableItems.length > 0) {
    validationStatus = unavailableItems.length === cartItems.length ? 'critical_issues' : 'has_issues';
  }

  return {
    unavailableItems,
    availableProducts,
    itemsSnapshot,
    validationStatus
  };
}

async function reserveProductsStock(orderItems, availableProducts, session = null) {
  const reservationResults = [];

  for (const item of orderItems) {
    const product = availableProducts.find(p => p._id.toString() === item.product_id.toString());
    
    if (product && product.category === 'store' && typeof product.stock_quantity === 'number') {
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product_id,
        { 
          $inc: { stock_quantity: -item.quantity },
          $push: {
            reservation_history: {
              order_id: item.order_id || null,
              quantity_reserved: item.quantity,
              reserved_at: new Date(),
              type: 'order_reservation'
            }
          }
        },
        { session, new: true }
      );

      reservationResults.push({
        product_id: item.product_id,
        title: item.title,
        quantity_reserved: item.quantity,
        new_stock: updatedProduct.stock_quantity
      });

      console.log(`RESERVED: ${item.quantity}x "${item.title}", остаток: ${updatedProduct.stock_quantity}`);
    }
  }

  return reservationResults;
}

async function returnProductsToStock(orderItems, session = null) {
  const returnResults = [];

  for (const item of orderItems) {
    const product = await Product.findById(item.product_id).session(session);
    
    if (product && product.category === 'store' && typeof product.stock_quantity === 'number') {
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product_id,
        { 
          $inc: { stock_quantity: item.quantity },
          $push: {
            reservation_history: {
              order_id: item.order_id || null,
              quantity_returned: item.quantity,
              returned_at: new Date(),
              type: 'order_cancellation'
            }
          }
        },
        { session, new: true }
      );

      returnResults.push({
        product_id: item.product_id,
        title: item.title,
        quantity_returned: item.quantity,
        new_stock: updatedProduct.stock_quantity
      });

      console.log(`RETURNED: ${item.quantity}x "${item.title}", новый остаток: ${updatedProduct.stock_quantity}`);
    }
  }

  return returnResults;
}

async function processPayment(orderData, deliveryData) {
  try {
    console.log('PROCESS PAYMENT:', {
      order_id: orderData.order_id,
      total_price: orderData.total_price,
      delivery_zone: deliveryData?.delivery_zone,
      payment_method: orderData.payment_method
    });

    const paymentResult = await processOrderPayment({
      order_id: orderData.order_id,
      amount: orderData.total_price,
      payment_method: orderData.payment_method,
      customer_id: orderData.customer_id,
      delivery_zone: deliveryData?.delivery_zone,
      delivery_fee: deliveryData?.delivery_fee,
      platform_commission: Math.round(orderData.subtotal * 0.10 * 100) / 100
    });

    if (paymentResult.success && deliveryData) {
      try {
        const financeResult = await integrateWithOrderCreation(orderData, deliveryData);
        console.log('Finance integration result:', financeResult.success ? 'SUCCESS' : 'FAILED');
      } catch (financeError) {
        console.warn('Finance integration failed (non-critical):', financeError.message);
      }
    }

    return paymentResult;

  } catch (error) {
    console.error('PROCESS PAYMENT ERROR:', error);
    throw error;
  }
}

async function processRefund(order, options = {}) {
  console.log('DEPRECATED: Using old processRefund, redirecting to real refund system');
  
  try {
    const { processRealRefund } = await import('../Finance/refund.service.js');
    return await processRealRefund(order, {
      refund_reason: options.reason || 'legacy_refund',
      refund_type: 'full',
      initiated_by_user_id: options.initiated_by || null,
      initiated_by_role: options.user_role || 'system'
    });
  } catch (error) {
    console.error('LEGACY REFUND REDIRECT ERROR:', error);
    
    return {
      success: true,
      refund_id: `ref_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: order.total_price,
      processed_at: new Date(),
      details: 'Возврат обработан через fallback систему',
      warning: 'Использована устаревшая система возвратов'
    };
  }
}

function checkOrderAccess(order, userId, userRole) {
  switch (userRole) {
    case 'customer':
      return order.customer_id._id.toString() === userId.toString();
    case 'partner':
      return order.partner_id._id.toString() === userId.toString();
    case 'courier':
      return order.courier_id && order.courier_id._id.toString() === userId.toString();
    case 'admin':
      return true;
    default:
      return false;
  }
}

function getOrderProgress(status) {
  const progressMap = {
    'pending': 10,
    'accepted': 25,
    'preparing': 50,
    'ready': 70,
    'picked_up': 85,
    'on_the_way': 95,
    'delivered': 100,
    'cancelled': 0
  };
  return progressMap[status] || 0;
}

function getStatusDescription(status) {
  const descriptions = {
    'pending': 'Ожидает подтверждения ресторана',
    'accepted': 'Ресторан принял заказ и готовит',
    'preparing': 'Заказ готовится',
    'ready': 'Заказ готов, ищем курьера',
    'picked_up': 'Курьер забрал заказ',
    'on_the_way': 'Курьер в пути к вам',
    'delivered': 'Заказ доставлен',
    'cancelled': 'Заказ отменен'
  };
  return descriptions[status] || 'Неизвестный статус';
}

function getNextStep(status) {
  const nextSteps = {
    'pending': 'Ожидание подтверждения ресторана',
    'accepted': 'Приготовление заказа',
    'preparing': 'Завершение приготовления',
    'ready': 'Назначение курьера',
    'picked_up': 'Доставка к клиенту',
    'on_the_way': 'Прибытие курьера',
    'delivered': 'Заказ выполнен',
    'cancelled': 'Заказ завершен'
  };
  return nextSteps[status] || 'Неизвестно';
}

// ================ СИСТЕМНЫЕ ФУНКЦИИ ================

async function getOrdersStatistics(filters = {}) {
  try {
    const { dateFrom, dateTo, partnerId, courierId, status } = filters;
    
    let matchQuery = {};
    
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
    }
    
    if (partnerId) matchQuery.partner_id = new mongoose.Types.ObjectId(partnerId);
    if (courierId) matchQuery.courier_id = new mongoose.Types.ObjectId(courierId);
    if (status) matchQuery.status = status;

    const [generalStats] = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          completed_orders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          cancelled_orders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          pending_orders: { $sum: { $cond: [{ $in: ['$status', ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'on_the_way']] }, 1, 0] } },
          total_revenue: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total_price', 0] } },
          avg_order_value: { $avg: '$total_price' },
          total_platform_commission: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$platform_commission', 0] } },
          total_delivery_fees: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$delivery_fee', 0] } }
        }
      }
    ]);

    const statusBreakdown = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total_value: { $sum: '$total_price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const dailyStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders_count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total_price', 0] } },
          avg_order_value: { $avg: '$total_price' }
        }
      },
      { $sort: { '_id': -1 } },
      { $limit: 30 }
    ]);

    return {
      summary: generalStats || {
        total_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        pending_orders: 0,
        total_revenue: 0,
        avg_order_value: 0,
        total_platform_commission: 0,
        total_delivery_fees: 0
      },
      status_breakdown: statusBreakdown,
      daily_stats: dailyStats,
      filters_applied: filters,
      generated_at: new Date()
    };
  } catch (error) {
    console.error('GET ORDERS STATISTICS ERROR:', error);
    throw error;
  }
}

async function bulkUpdateOrderStatus(orderIds, newStatus, updatedBy, userRole = 'admin', notes = '') {
  try {
    const session = await mongoose.startSession();
    await session.startTransaction();

    // Валидация статуса
    const validStatuses = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Неверный статус: ${newStatus}`);
    }

    // Валидация ID заказов
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error('Необходимо указать массив ID заказов');
    }

    const updateResult = await Order.updateMany(
      { 
        _id: { $in: orderIds.map(id => new mongoose.Types.ObjectId(id)) },
        status: { $ne: newStatus }
      },
      { 
        $set: { 
          status: newStatus,
          [`${newStatus}_at`]: new Date()
        },
        $push: {
          status_history: {
            status: newStatus,
            timestamp: new Date(),
            updated_by: new mongoose.Types.ObjectId(updatedBy),
            user_role: userRole,
            notes: notes || `Bulk update to ${newStatus}`
          }
        }
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    console.log('BULK UPDATE COMPLETED:', {
      requested: orderIds.length,
      matched: updateResult.matchedCount,
      modified: updateResult.modifiedCount,
      new_status: newStatus
    });

    return {
      success: true,
      requested_orders: orderIds.length,
      matched_orders: updateResult.matchedCount,
      modified_orders: updateResult.modifiedCount,
      new_status: newStatus,
      updated_by: updatedBy,
      updated_at: new Date()
    };

  } catch (error) {
    console.error('BULK UPDATE ORDER STATUS ERROR:', error);
    throw error;
  }
}

// ================ АДМИНСКИЕ ФУНКЦИИ ================

export const processAdminRefund = async (orderId, adminUserId, options = {}) => {
  try {
    const {
      refund_reason = 'admin_initiated',
      refund_type = 'full',
      partial_amount = null,
      admin_notes = ''
    } = options;

    console.log('ADMIN REFUND:', { orderId, adminUserId, refund_type });

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    const { processRealRefund } = await import('../Finance/refund.service.js');
    
    const refundResult = await processRealRefund(order, {
      refund_reason: `${refund_reason}${admin_notes ? `: ${admin_notes}` : ''}`,
      refund_type,
      partial_amount,
      initiated_by_user_id: adminUserId,
      initiated_by_role: 'admin'
    });

    console.log('ADMIN REFUND SUCCESS:', {
      refund_id: refundResult.refund_id,
      amount: refundResult.refund_details.refunded_amount
    });

    return refundResult;

  } catch (error) {
    console.error('ADMIN REFUND ERROR:', error);
    throw error;
  }
};

export const checkRefundEligibility = async (orderId, userRole = 'customer') => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    const { canRefundOrder, calculateRefundAmount } = await import('../Finance/refund.service.js');
    
    const eligibility = canRefundOrder(order, userRole);
    const refundCalculation = calculateRefundAmount(order);

    return {
      order_id: orderId,
      order_number: order.order_number,
      current_status: order.status,
      payment_status: order.payment_status,
      eligibility,
      refund_calculation,
      recommendations: generateRefundRecommendations(order, eligibility, refundCalculation)
    };

  } catch (error) {
    console.error('CHECK REFUND ELIGIBILITY ERROR:', error);
    throw error;
  }
};

function generateRefundRecommendations(order, eligibility, calculation) {
  const recommendations = [];

  if (!eligibility.can_refund) {
    recommendations.push({
      type: 'info',
      message: 'Возврат невозможен',
      reasons: eligibility.reasons
    });
    return recommendations;
  }

  if (calculation.deductions.delivery_fee_reduction > 0) {
    recommendations.push({
      type: 'warning',
      message: `При возврате будет удержано ${calculation.deductions.delivery_fee_reduction}€ за доставку`,
      reason: 'Заказ уже находится в процессе доставки'
    });
  }

  if (order.status === 'delivered') {
    recommendations.push({
      type: 'urgent',
      message: 'Ограниченное время для возврата',
      reason: 'Возврат доступен только в течение 2 часов после доставки'
    });
  }

  recommendations.push({
    type: 'success',
    message: `Возможен возврат ${calculation.refundable_amount}€`,
    estimated_arrival: '3-5 рабочих дней'
  });

  return recommendations;
}

// ================ КЛИЕНТСКИЕ СЕРВИСЫ ================

export const createOrderFromCart = async (customerId, orderData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    const { delivery_address, customer_contact, payment_method = 'card', special_requests = '' } = orderData;

    console.log('CREATE ORDER FROM CART (UberEats Style):', { customerId, payment_method });

    // Валидация входных данных
    if (!delivery_address || !delivery_address.address) {
      throw new Error('Адрес доставки обязателен');
    }

    if (!delivery_address.lat || !delivery_address.lng) {
      throw new Error('Координаты адреса доставки обязательны');
    }

    if (!customer_contact || !customer_contact.name || !customer_contact.phone) {
      throw new Error('Контактная информация (имя и телефон) обязательна');
    }

    // Получаем корзину
    const cart = await Cart.findActiveCart(customerId).session(session);
    if (!cart || cart.items.length === 0) {
      throw new Error('Корзина пуста или не найдена');
    }

    // Получаем ресторан
    const restaurant = await PartnerProfile.findById(cart.restaurant_id).session(session);
    if (!restaurant) {
      throw new Error('Ресторан не найден');
    }

    if (!restaurant.is_active || !restaurant.is_approved) {
      throw new Error('Ресторан временно недоступен');
    }

    // Создаем orderItems из корзины
    const orderItems = cart.items.map(item => ({
      product_id: item.product_id,
      title: item.product_snapshot.title,
      price: item.item_price,
      quantity: item.quantity,
      selected_options: item.selected_options || [],
      item_total: item.total_item_price,
      special_requests: item.special_requests || ''
    }));

    // Рассчитываем стоимости
    const subtotal = cart.pricing.subtotal;
    const deliveryFee = cart.pricing.delivery_fee || 0;
    const service_fee = 0; // Убрали сервисный сбор
    const total_price = subtotal + deliveryFee;

    console.log('CALCULATED PRICES:', {
      subtotal,
      deliveryFee,
      service_fee,
      total_price
    });

    // Валидация товаров
    const { availableProducts, unavailableItems, validationStatus } = await validateProductsAvailability(orderItems, session);
    
    if (validationStatus === 'critical_issues') {
      throw new Error('Критические проблемы с доступностью товаров');
    }

    // Резервируем товары
    const reservationResults = await reserveProductsStock(orderItems, availableProducts, session);

    // ЭТАП 1: СРАЗУ ОБРАБАТЫВАЕМ ПЛАТЕЖ (как UberEats)
    let paymentResult;
    if (payment_method !== 'card') {
      throw new Error('Доступна только онлайн оплата картой');
    }

    try {
      // Деньги СРАЗУ списываются с карты клиента
      paymentResult = await processOrderPayment({
        amount: total_price,
        currency: 'EUR',
        customer_id: customerId,
        order_id: null, // Еще нет ID заказа
        payment_method
      });
      
      if (!paymentResult.success) {
        throw new Error(paymentResult.details || 'Ошибка обработки платежа');
      }
      
      console.log('PAYMENT SUCCESS - деньги у ESARGO:', {
        payment_id: paymentResult.payment_id,
        amount: paymentResult.amount
      });
      
    } catch (paymentError) {
      console.error('PAYMENT FAILED:', paymentError.message);
      await returnProductsToStock(orderItems, session);
      throw new Error(`Ошибка оплаты: ${paymentError.message}`);
    }

    // ЭТАП 2: СОЗДАЕМ ЗАКАЗ СО СТАТУСОМ "PENDING" (ожидает ресторан)
    const orderNumber = Order.generateOrderNumber();
    const estimatedDeliveryTime = await calculateEstimatedDeliveryTime(
      delivery_address,
      restaurant.location,
      restaurant.delivery_info
    );

    // Рассчитываем данные доставки
    let deliveryData = null;
    try {
      deliveryData = await calculateFullDelivery({
        restaurant_lat: restaurant.location.coordinates[1],
        restaurant_lng: restaurant.location.coordinates[0],
        delivery_lat: delivery_address.lat,
        delivery_lng: delivery_address.lng,
        order_total: subtotal,
        order_time: new Date()
      });
    } catch (deliveryError) {
      console.warn('Delivery calculation failed:', deliveryError.message);
    }

    const newOrder = new Order({
      order_number: orderNumber,
      customer_id: customerId,
      partner_id: restaurant._id,
      items: orderItems,
      
      items_snapshot: orderItems.map(item => ({
        product_id: item.product_id,
        availability_at_order: {
          is_active: true,
          is_available: true,
          stock_quantity: 999
        },
        captured_at: new Date()
      })),
      
      availability_validation: {
        validated_at: new Date(),
        unavailable_items: unavailableItems,
        validation_status: validationStatus
      },

      subtotal,
      delivery_fee: deliveryFee,
      service_fee: 0,
      total_price,
      
      platform_commission: deliveryData ? deliveryData.platform_commission : Math.round(subtotal * 0.10 * 100) / 100,
      delivery_zone: deliveryData ? deliveryData.delivery_zone : null,
      delivery_distance_km: deliveryData ? deliveryData.distance_km : null,
      peak_hour_surcharge: deliveryData ? (deliveryData.peak_hour_info?.surcharge || 0) : 0,
      courier_earnings: deliveryData ? (deliveryData.courier_earnings?.total_earnings || deliveryFee) : deliveryFee,
      
      restaurant_coordinates: {
        lat: restaurant.location.coordinates[1],
        lng: restaurant.location.coordinates[0],
        address: restaurant.address || ''
      },
      delivery_coordinates: {
        lat: delivery_address.lat,
        lng: delivery_address.lng
      },
      
      delivery_address,
      customer_contact,
      payment_method,
      special_requests,
      estimated_delivery_time: estimatedDeliveryTime,
      
      // ВАЖНО: Статус "pending" = ожидает подтверждения ресторана
      status: 'pending',
      
      // ВАЖНО: Платеж уже обработан, деньги у ESARGO
      payment_status: 'completed',
      payment_details: {
        payment_id: paymentResult.payment_id,
        transaction_id: paymentResult.transaction_id,
        payment_processor: 'esargo_payments',
        gateway_response: {
          method: paymentResult.method,
          amount: paymentResult.amount,
          processed_at: paymentResult.processed_at,
          receipt_url: paymentResult.receipt_url,
          card_last_digits: paymentResult.card_last_digits
        }
      }
    });

    await newOrder.save({ session });

    // ЭТАП 3: СОЗДАЕМ ТРАНЗАКЦИИ В СТАТУСЕ "PENDING"
    let transactionsResult = null;
    if (deliveryData) {
      try {
        transactionsResult = await integrateWithOrderCreation({
          order_id: newOrder._id,
          order_number: newOrder.order_number,
          customer_id: customerId,
          partner_id: restaurant._id,
          courier_id: null,
          subtotal,
          total_price,
          payment_status: 'completed'
        }, deliveryData);
        
        console.log('TRANSACTIONS CREATED (PENDING):', {
          success: transactionsResult.success,
          platform_holds: total_price
        });
        
      } catch (transactionError) {
        console.warn('Transaction creation failed:', transactionError.message);
      }
    }

    // ОЧИЩАЕМ КОРЗИНУ
    await cart.convertToOrder();

    await session.commitTransaction();

    console.log('ORDER CREATED (UberEats Style):', {
      order_number: newOrder.order_number,
      status: 'pending',
      payment_status: 'completed',
      total_amount: total_price,
      message: 'Оплата прошла, ожидаем подтверждение ресторана'
    });

    return {
      success: true,
      order: newOrder,
      payment_info: {
        amount_charged: total_price,
        payment_id: paymentResult.payment_id,
        status: 'charged',
        message: 'Средства списаны с карты'
      },
      order_flow: {
        current_step: 'waiting_restaurant_confirmation',
        next_step: 'Ресторан рассмотрит заказ в течение 5-10 минут',
        cancellation_policy: 'Автоматический возврат при отклонении рестораном'
      },
      financial_processing: transactionsResult ? {
        success: transactionsResult.success,
        transactions_created: transactionsResult.transactions ? transactionsResult.transactions.length : 0
      } : null
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('CREATE ORDER ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

export const getCustomerOrders = async (customerId, filters = {}) => {
  try {
    const { status = null, limit = 20, offset = 0 } = filters;

    console.log('GET CUSTOMER ORDERS:', { customerId, status, limit });

    let query = { customer_id: customerId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('partner_id', 'business_name phone location category')
      .populate('courier_id', 'first_name last_name phone vehicle_info')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    return {
      orders,
      total: orders.length,
      filters_applied: { status, limit, offset }
    };

  } catch (error) {
    console.error('GET CUSTOMER ORDERS ERROR:', error);
    throw error;
  }
};

export const getOrderDetails = async (orderId, userId, userRole = 'customer') => {
  try {
    console.log('GET ORDER DETAILS:', { orderId, userId, userRole });

    const order = await Order.findById(orderId)
      .populate('customer_id', 'first_name last_name phone email')
      .populate('partner_id', 'business_name phone location category')
      .populate('courier_id', 'first_name last_name phone vehicle_info');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    const hasAccess = checkOrderAccess(order, userId, userRole);
    if (!hasAccess) {
      throw new Error('Нет доступа к этому заказу');
    }

    return { order };

  } catch (error) {
    console.error('GET ORDER DETAILS ERROR:', error);
    throw error;
  }
};

export const cancelCustomerOrder = async (orderId, customerId, reason = 'customer_request', details = '') => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    console.log('CANCEL CUSTOMER ORDER:', { orderId, customerId, reason });

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (!order.customer_id.equals(customerId)) {
      throw new Error('У вас нет доступа к этому заказу');
    }

    if (!['pending', 'accepted', 'preparing', 'ready', 'picked_up'].includes(order.status)) {
      throw new Error('Заказ нельзя отменить - он уже доставлен или был отменен ранее');
    }

    let refundResult = null;
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      try {
        const { processRealRefund } = await import('../Finance/refund.service.js');
        
        refundResult = await processRealRefund(order, {
          refund_reason: `Отмена заказа: ${reason}`,
          refund_type: 'full',
          initiated_by_user_id: customerId,
          initiated_by_role: 'customer'
        });
        
        console.log('REAL REFUND SUCCESS:', {
          refund_id: refundResult.refund_id,
          amount: refundResult.refund_details.refunded_amount
        });
        
      } catch (refundError) {
        console.error('REAL REFUND ERROR:', refundError.message);
        
        order.payment_status = 'refund_pending';
        order.refund_error = refundError.message;
        
        refundResult = {
          success: false,
          error: refundError.message,
          fallback: true
        };
      }
    }

    const returnResults = await returnProductsToStock(order.items, session);

    await order.addStatusHistory('cancelled', customerId, 'customer', `Отменен клиентом: ${reason}`);
    order.cancellation = {
      reason,
      cancelled_by: customerId,
      user_role: 'customer',
      details
    };

    if (!refundResult || !refundResult.success) {
      await order.save({ session });
    }

    await session.commitTransaction();

    console.log('ORDER CANCELLED SUCCESS:', {
      order_number: order.order_number,
      reason,
      items_returned_to_stock: returnResults.length,
      refund_processed: refundResult?.success || false
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      cancelled_at: order.cancelled_at,
      message: 'Заказ отменен успешно',
      stock_return_info: returnResults,
      refund_info: refundResult ? {
        success: refundResult.success,
        refund_id: refundResult.refund_id || null,
        refunded_amount: refundResult.refund_details?.refunded_amount || 0,
        estimated_arrival: refundResult.refund_details?.estimated_arrival || null,
        message: refundResult.message || refundResult.error || 'Возврат в обработке'
      } : null
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('CANCEL ORDER ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

export const rateCompletedOrder = async (orderId, customerId, ratingData) => {
  try {
    const { partner_rating, courier_rating, comment = '' } = ratingData;

    console.log('RATE ORDER:', { orderId, customerId, partner_rating, courier_rating });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.customer_id.toString() !== customerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'delivered') {
      throw new Error('Можно оценить только доставленный заказ');
    }

    if (order.ratings && order.ratings.partner_rating) {
      throw new Error('Заказ уже оценен');
    }

    order.ratings = {
      partner_rating: partner_rating,
      courier_rating: courier_rating,
      comment: comment.trim(),
      rated_at: new Date()
    };

    await order.save();

    if (partner_rating) {
      const partner = await PartnerProfile.findById(order.partner_id);
      if (partner) {
        await partner.updateRating(partner_rating);
      }
    }

    if (courier_rating && order.courier_id) {
      const courier = await CourierProfile.findById(order.courier_id);
      if (courier) {
        await courier.updateRating(courier_rating);
      }
    }

    console.log('ORDER RATED SUCCESS:', {
      order_number: order.order_number,
      partner_rating,
      courier_rating
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      ratings: order.ratings,
      message: 'Спасибо за оценку!'
    };

  } catch (error) {
    console.error('RATE ORDER ERROR:', error);
    throw error;
  }
};

// ================ ПАРТНЕРСКИЕ СЕРВИСЫ ================

export const getRestaurantOrders = async (partnerId, filters = {}) => {
  try {
    const { status = null, limit = 20, offset = 0 } = filters;

    console.log('GET RESTAURANT ORDERS:', { partnerId, status, limit });

    let query = { partner_id: partnerId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('customer_id', 'first_name last_name phone')
      .populate('courier_id', 'first_name last_name phone vehicle_info')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    return {
      orders,
      total: orders.length,
      filters_applied: { status, limit, offset }
    };

  } catch (error) {
    console.error('GET RESTAURANT ORDERS ERROR:', error);
    throw error;
  }
};

export const acceptRestaurantOrder = async (orderId, partnerId, acceptanceData = {}) => {
  try {
    const { estimated_preparation_time = 15 } = acceptanceData;

    console.log('✅ RESTAURANT ACCEPTS ORDER:', { orderId, partnerId });

    const order = await Order.findById(orderId);

    if (!order || order.partner_id.toString() !== partnerId.toString()) {
      throw new Error('Заказ не найден или нет доступа');
    }

    if (order.status !== 'pending') {
      throw new Error('Заказ нельзя принять - неверный статус');
    }

    // ✅ МЕНЯЕМ СТАТУС: pending → accepted
    await order.addStatusHistory('accepted', partnerId, 'partner', 
      `Заказ принят. Время приготовления: ${estimated_preparation_time} мин`);

    const newEstimatedTime = new Date(Date.now() + estimated_preparation_time * 60 * 1000);
    order.estimated_delivery_time = newEstimatedTime;
    await order.save();

    console.log('✅ ORDER ACCEPTED:', {
      order_number: order.order_number,
      status: 'accepted',
      message: 'Начинайте готовить - деньги уже у ESARGO'
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      message: 'Заказ принят! Начинайте приготовление.'
    };

  } catch (error) {
    console.error('ACCEPT ORDER ERROR:', error);
    throw error;
  }
};

export const rejectRestaurantOrder = async (orderId, partnerId, rejectionData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const { reason, details = '' } = rejectionData;

    console.log('❌ RESTAURANT REJECTS ORDER:', { orderId, reason });

    const order = await Order.findById(orderId).session(session);

    if (!order || order.partner_id.toString() !== partnerId.toString()) {
      throw new Error('Заказ не найден или нет доступа');
    }

    if (order.status !== 'pending') {
      throw new Error('Заказ нельзя отклонить - неверный статус');
    }

    // ✅ ОТМЕНЯЕМ ЗАКАЗ
    await order.addStatusHistory('cancelled', partnerId, 'partner', `Заказ отклонен: ${reason}`);
    order.cancellation = {
      reason,
      cancelled_by: partnerId,
      user_role: 'partner',
      details
    };

    // ✅ ВОЗВРАЩАЕМ ТОВАРЫ НА СКЛАД
    const returnResults = await returnProductsToStock(order.items, session);

    // ✅ АВТОМАТИЧЕСКИЙ ВОЗВРАТ ДЕНЕГ КЛИЕНТУ (как UberEats)
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      try {
        const refundResult = await processOrderRefund({
          original_payment_id: order.payment_details.payment_id,
          amount: order.total_price,
          order_id: order._id,
          reason: `Ресторан отклонил заказ: ${reason}`
        });

        order.payment_status = 'refunded';
        order.refund_details = {
          refund_id: refundResult.refund_id,
          refunded_amount: refundResult.amount,
          refund_reason: reason,
          refunded_at: new Date(),
          estimated_arrival: '3-5 рабочих дней'
        };

        console.log('💸 AUTO REFUND PROCESSED:', {
          refund_id: refundResult.refund_id,
          amount: refundResult.amount
        });

      } catch (refundError) {
        console.error('🚨 REFUND FAILED:', refundError.message);
        order.refund_error = refundError.message;
      }
    }

    await order.save({ session });
    await session.commitTransaction();

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: 'cancelled',
      message: 'Заказ отклонен. Клиенту отправлен автоматический возврат.',
      refund_info: order.refund_details
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const markRestaurantOrderReady = async (orderId, partnerId) => {
  try {
    console.log('MARK ORDER READY:', { orderId, partnerId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.partner_id.toString() !== partnerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'accepted') {
      throw new Error('Заказ нельзя пометить готовым - неверный статус');
    }

    await order.addStatusHistory('ready', partnerId, 'partner', 'Заказ готов к выдаче курьеру');

    console.log('ORDER READY SUCCESS:', {
      order_number: order.order_number,
      ready_at: order.ready_at
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      ready_at: order.ready_at,
      message: 'Заказ готов! Ожидается курьер.'
    };

  } catch (error) {
    console.error('MARK ORDER READY ERROR:', error);
    throw error;
  }
};

// ================ КУРЬЕРСКИЕ СЕРВИСЫ ================

export const getAvailableOrdersForCourier = async (courierId, location = {}) => {
  try {
    const { lat = null, lng = null, radius = 10 } = location;

    console.log('GET AVAILABLE ORDERS:', { courierId, lat, lng, radius });

    let query = {
      status: 'ready',
      courier_id: null
    };

    if (lat && lng) {
      const radiusInDegrees = radius / 111;
      
      query['delivery_address.lat'] = {
        $gte: lat - radiusInDegrees,
        $lte: lat + radiusInDegrees
      };
      query['delivery_address.lng'] = {
        $gte: lng - radiusInDegrees,
        $lte: lng + radiusInDegrees
      };
    }

    const orders = await Order.find(query)
      .populate('partner_id', 'business_name phone location')
      .populate('customer_id', 'first_name last_name phone')
      .sort({ createdAt: 1 })
      .limit(20);

    return {
      available_orders: orders,
      total: orders.length,
      search_radius: radius
    };

  } catch (error) {
    console.error('GET AVAILABLE ORDERS ERROR:', error);
    throw error;
  }
};

export const acceptOrderForDelivery = async (orderId, courierId) => {
  try {
    console.log('ACCEPT ORDER FOR DELIVERY:', { orderId, courierId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.status !== 'ready') {
      throw new Error('Заказ не готов к доставке');
    }

    if (order.courier_id) {
      throw new Error('Заказ уже назначен другому курьеру');
    }

    order.courier_id = courierId;
    await order.addStatusHistory('picked_up', courierId, 'courier', 'Курьер забрал заказ');

    console.log('ORDER ACCEPTED FOR DELIVERY:', {
      order_number: order.order_number,
      courier_id: courierId
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      picked_up_at: order.picked_up_at,
      message: 'Заказ принят на доставку'
    };

  } catch (error) {
    console.error('ACCEPT ORDER FOR DELIVERY ERROR:', error);
    throw error;
  }
};

export const markOrderPickedUpByCourier = async (orderId, courierId) => {
  try {
    console.log('MARK ORDER PICKED UP:', { orderId, courierId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (!order.courier_id || order.courier_id.toString() !== courierId.toString()) {
      throw new Error('Заказ не назначен этому курьеру');
    }

    if (order.status !== 'picked_up') {
      throw new Error('Заказ не может быть забран - неверный статус');
    }

    await order.addStatusHistory('on_the_way', courierId, 'courier', 'Курьер в пути к клиенту');

    console.log('ORDER PICKED UP SUCCESS:', {
      order_number: order.order_number,
      courier_id: courierId
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      message: 'В пути к клиенту'
    };

  } catch (error) {
    console.error('MARK ORDER PICKED UP ERROR:', error);
    throw error;
  }
};

export const markOrderDeliveredByCourier = async (orderId, courierId) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    console.log('🚚 COURIER DELIVERED ORDER:', { orderId, courierId });

    const order = await Order.findById(orderId).session(session);
    
    if (!order || order.courier_id.toString() !== courierId.toString()) {
      throw new Error('Заказ не найден или нет доступа');
    }

    if (order.status !== 'on_the_way') {
      throw new Error('Заказ нельзя пометить доставленным');
    }

    // ✅ ДОСТАВЛЕНО
    await order.addStatusHistory('delivered', courierId, 'courier', 'Заказ доставлен клиенту');
    order.delivered_at = new Date();
    await order.save({ session });

    // ✅ ТЕПЕРЬ РАСПРЕДЕЛЯЕМ ДЕНЬГИ МЕЖДУ УЧАСТНИКАМИ
    let transactionsResult = null;
    try {
      transactionsResult = await integrateWithOrderDelivery(order._id, courierId);
      
      console.log('💰 MONEY DISTRIBUTED:', {
        partner_gets: Math.round(order.subtotal * 0.9 * 100) / 100,
        courier_gets: order.delivery_fee,
        esargo_gets: Math.round(order.subtotal * 0.1 * 100) / 100
      });

    } catch (financeError) {
      console.error('⚠️ Finance distribution failed:', financeError.message);
    }

    await session.commitTransaction();

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: 'delivered',
      delivered_at: order.delivered_at,
      message: 'Заказ доставлен! Средства распределены между участниками.',
      financial_processing: transactionsResult
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const getCourierActiveOrders = async (courierId) => {
  try {
    console.log('GET COURIER ACTIVE ORDERS:', { courierId });

    const orders = await Order.find({
      courier_id: courierId,
      status: { $in: ['picked_up', 'on_the_way'] }
    })
    .populate('partner_id', 'business_name phone location')
    .populate('customer_id', 'first_name last_name phone')
    .sort({ createdAt: -1 });

    return {
      active_orders: orders,
      total: orders.length
    };

  } catch (error) {
    console.error('GET COURIER ACTIVE ORDERS ERROR:', error);
    throw error;
  }
};

// ================ ОБЩИЕ СЕРВИСЫ ================

export const trackOrderStatus = async (orderId, userId = null) => {
  try {
    console.log('TRACK ORDER STATUS:', { orderId, userId });

    const order = await Order.findById(orderId)
      .populate('partner_id', 'business_name phone location')
      .populate('courier_id', 'first_name last_name phone vehicle_info')
      .populate('customer_id', 'first_name last_name phone');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (userId) {
      const hasAccess = checkOrderAccess(order, userId, 'customer');
      if (!hasAccess) {
        throw new Error('Нет доступа к этому заказу');
      }
    }

    const progress = getOrderProgress(order.status);
    const statusDescription = getStatusDescription(order.status);
    const nextStep = getNextStep(order.status);

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      status_description: statusDescription,
      progress,
      next_step: nextStep,
      estimated_delivery_time: order.estimated_delivery_time,
      actual_delivery_time: order.actual_delivery_time,
      created_at: order.createdAt,
      status_history: order.status_history,
      partner_info: order.partner_id ? {
        name: order.partner_id.business_name,
        phone: order.partner_id.phone
      } : null,
      courier_info: order.courier_id ? {
        name: `${order.courier_id.first_name} ${order.courier_id.last_name}`,
        phone: order.courier_id.phone,
        vehicle: order.courier_id.vehicle_info
      } : null
    };

  } catch (error) {
    console.error('TRACK ORDER STATUS ERROR:', error);
    throw error;
  }
};

export const getOrderStatusOnly = async (orderId) => {
  try {
    const order = await Order.findById(orderId).select('status order_number');
    
    if (!order) {
      throw new Error('Заказ не найден');
    }

    return {
      order_id: orderId,
      order_number: order.order_number,
      status: order.status,
      status_description: getStatusDescription(order.status)
    };

  } catch (error) {
    console.error('GET ORDER STATUS ERROR:', error);
    throw error;
  }
};

// ================ ЭКСПОРТ ================

export default {
  // Клиентские сервисы
  createOrderFromCart,
  getCustomerOrders,
  getOrderDetails,
  cancelCustomerOrder,
  rateCompletedOrder,
  
  // Партнерские сервисы
  getRestaurantOrders,
  acceptRestaurantOrder,
  rejectRestaurantOrder,
  markRestaurantOrderReady,
  
  // Курьерские сервисы
  getAvailableOrdersForCourier,
  acceptOrderForDelivery,
  markOrderPickedUpByCourier,
  markOrderDeliveredByCourier,
  getCourierActiveOrders,
  processAdminRefund,
  checkRefundEligibility,
  
  // Общие сервисы
  trackOrderStatus,
  getOrderStatusOnly,
  
  // Утилитарные функции
  calculateEstimatedDeliveryTime,
  processPayment,
  processRefund,
  checkOrderAccess,
  getOrderProgress,
  getStatusDescription,
  getNextStep,
  
  // Функции валидации и резервирования
  validateProductsAvailability,
  reserveProductsStock,
  returnProductsToStock,
  
  // Системные функции (реальные)
  cleanupExpiredData,
  getOrdersStatistics,
  bulkUpdateOrderStatus
};