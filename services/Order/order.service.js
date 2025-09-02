// services/Order/order.service.js - ПОЛНАЯ система заказов с валидацией и резервированием
import { Order, Cart, User, PartnerProfile, CourierProfile, Product } from '../../models/index.js';
import mongoose from 'mongoose';

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * Получение текстового описания причины недоступности
 */
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

/**
 * Расчет времени доставки
 */
function calculateEstimatedDeliveryTime(delivery_address, restaurant_location, restaurant_delivery_info) {
  let baseTime = 30; // минут
  
  if (restaurant_delivery_info && restaurant_delivery_info.base_delivery_time) {
    baseTime = restaurant_delivery_info.base_delivery_time;
  }
  
  // Добавляем время в зависимости от расстояния
  const distance = calculateDistance(
    restaurant_location?.coordinates?.[1] || 48.8566,
    restaurant_location?.coordinates?.[0] || 2.3522,
    delivery_address.lat,
    delivery_address.lng
  );
  
  const extraTime = Math.round(distance * 2); // 2 минуты на км
  return baseTime + extraTime;
}

/**
 * Расчет расстояния между координатами (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * НОВАЯ ФУНКЦИЯ: Детальная валидация доступности товаров
 */
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
    
    if (!product) {
      unavailableItems.push({
        product_id: cartItem.product_id,
        title: cartItem.product_snapshot?.title || 'Неизвестный товар',
        reason: 'product_deactivated',
        requested_quantity: cartItem.quantity
      });
      continue;
    }

    // Создаем снимок состояния товара на момент заказа
    itemsSnapshot.push({
      product_id: product._id,
      availability_at_order: {
        is_active: product.is_active,
        is_available: product.is_available,
        stock_quantity: product.stock_quantity,
        availability_schedule: product.availability_schedule,
        captured_at: new Date()
      }
    });

    // Проверка базовой доступности
    if (!product.is_active || !product.is_available) {
      unavailableItems.push({
        product_id: product._id,
        title: product.title,
        reason: 'product_deactivated',
        requested_quantity: cartItem.quantity
      });
      continue;
    }

    // Проверка складских остатков для магазинов
    if (product.category === 'store' && typeof product.stock_quantity === 'number') {
      if (product.stock_quantity < cartItem.quantity) {
        if (product.stock_quantity > 0) {
          // Частичная доступность
          unavailableItems.push({
            product_id: product._id,
            title: product.title,
            reason: 'insufficient_stock',
            requested_quantity: cartItem.quantity,
            available_quantity: product.stock_quantity
          });
        } else {
          // Полная недоступность
          unavailableItems.push({
            product_id: product._id,
            title: product.title,
            reason: 'out_of_stock',
            requested_quantity: cartItem.quantity,
            available_quantity: 0
          });
        }
        continue;
      }
    }

    // Проверка временной доступности
    if (product.isAvailableNow && !product.isAvailableNow()) {
      unavailableItems.push({
        product_id: product._id,
        title: product.title,
        reason: 'time_restricted',
        requested_quantity: cartItem.quantity
      });
      continue;
    }

    availableProducts.push(product);
  }

  return {
    unavailableItems,
    availableProducts,
    itemsSnapshot,
    validationStatus: unavailableItems.length === 0 ? 'valid' : 
                     unavailableItems.length < cartItems.length ? 'has_issues' : 'critical_issues'
  };
}

/**
 * НОВАЯ ФУНКЦИЯ: Резервирование товаров на складе
 */
async function reserveProductsStock(orderItems, availableProducts, session = null) {
  const reservationResults = [];

  for (const product of availableProducts) {
    if (product.category === 'store' && typeof product.stock_quantity === 'number') {
      const orderItem = orderItems.find(item => 
        item.product_id.toString() === product._id.toString()
      );
      
      if (orderItem) {
        // Резервируем товар (снимаем со склада)
        const updatedProduct = await Product.findByIdAndUpdate(
          product._id,
          { 
            $inc: { stock_quantity: -orderItem.quantity },
            $push: {
              reservation_history: {
                order_id: null, // Будет обновлен после создания заказа
                quantity_reserved: orderItem.quantity,
                reserved_at: new Date(),
                type: 'order_creation'
              }
            }
          },
          { session, new: true }
        );

        reservationResults.push({
          product_id: product._id,
          title: product.title,
          quantity_reserved: orderItem.quantity,
          remaining_stock: updatedProduct.stock_quantity,
          reserved_at: new Date()
        });

        console.log(`📦 RESERVED: ${orderItem.quantity}x "${product.title}", осталось: ${updatedProduct.stock_quantity}`);
      }
    }
  }

  return reservationResults;
}

/**
 * НОВАЯ ФУНКЦИЯ: Возврат товаров на склад при отмене заказа
 */
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

      console.log(`↩️ RETURNED: ${item.quantity}x "${item.title}", новый остаток: ${updatedProduct.stock_quantity}`);
    }
  }

  return returnResults;
}

/**
 * Заглушка платежной системы - ИСПРАВЛЕНА
 */
async function processPayment(order, options = {}) {
  // Имитация обработки платежа - только успешные для card
  const isSuccess = Math.random() > 0.08; // 92% успешных платежей
  
  if (isSuccess) {
    return {
      success: true,
      transaction_id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method: 'card',
      amount: order.total_price,
      processed_at: new Date(),
      details: 'Платеж успешно обработан'
    };
  } else {
    return {
      success: false,
      error_code: 'PAYMENT_DECLINED',
      method: 'card',
      amount: order.total_price,
      details: 'Карта отклонена банком'
    };
  }
}

/**
 * Заглушка возврата средств
 */
async function processRefund(order, options = {}) {
  return {
    success: true,
    refund_id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount: order.total_price,
    processed_at: new Date(),
    details: 'Возврат средств обработан'
  };
}

// ================ КЛИЕНТСКИЕ СЕРВИСЫ ================

/**
 * 🛒 СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ - с полной валидацией и резервированием
 */
export const createOrderFromCart = async (customerId, orderData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    const { delivery_address, customer_contact, payment_method = 'cash', special_requests = '' } = orderData;

    console.log('🆕 CREATE ORDER FROM CART:', { customerId, payment_method });

    // ✅ ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    if (!delivery_address || !delivery_address.address) {
      throw new Error('Адрес доставки обязателен');
    }

    if (!delivery_address.lat || !delivery_address.lng) {
      throw new Error('Координаты адреса доставки обязательны');
    }

    if (!customer_contact || !customer_contact.name || !customer_contact.phone) {
      throw new Error('Контактная информация (имя и телефон) обязательна');
    }

    // 1. Найти активную корзину
    const cart = await Cart.findActiveCart(customerId).session(session);
    if (!cart || cart.items.length === 0) {
      throw new Error('Корзина пуста или не найдена');
    }

    // 2. Проверить минимальную сумму заказа
    const minOrderAmount = cart.restaurant_info.min_order_amount || 0;
    if (cart.pricing.subtotal < minOrderAmount) {
      throw new Error(`Минимальная сумма заказа: ${minOrderAmount}€`);
    }

    // 3. Получить информацию о ресторане
    const restaurant = await PartnerProfile.findById(cart.restaurant_id).session(session);
    if (!restaurant || !restaurant.is_active || !restaurant.is_approved) {
      throw new Error('Ресторан недоступен для заказов');
    }

    // 4. ✅ НОВАЯ РАСШИРЕННАЯ ВАЛИДАЦИЯ ДОСТУПНОСТИ ТОВАРОВ
    const validation = await validateProductsAvailability(cart.items, session);
    const { unavailableItems, availableProducts, itemsSnapshot, validationStatus } = validation;

    // Обработка недоступных товаров
    if (validationStatus === 'critical_issues') {
      throw new Error(
        `Все товары в корзине недоступны:\n${unavailableItems.map(item => 
          `• "${item.title}" - ${getReasonText(item.reason)}`
        ).join('\n')}`
      );
    }

    // 5. Создать заказ только с доступными товарами
    const orderItems = cart.items
      .filter(cartItem => 
        availableProducts.some(p => p._id.toString() === cartItem.product_id.toString())
      )
      .map(cartItem => {
        // ✅ ИСПРАВЛЕНО: используем правильные поля из корзины
        const basePrice = parseFloat(cartItem.product_snapshot?.price || cartItem.item_price || 0);
        const quantity = parseInt(cartItem.quantity || 1);
        
        // Используем готовую сумму из корзины или рассчитываем
        let itemTotal = parseFloat(cartItem.total_item_price || cartItem.item_total || 0);
        
        if (!itemTotal || isNaN(itemTotal)) {
          // Если нет готовой суммы, рассчитываем
          const optionsPrice = parseFloat(cartItem.options_price || 0);
          itemTotal = (basePrice + optionsPrice) * quantity;
        }

        console.log(`💰 ITEM CALCULATION:`, {
          title: cartItem.product_snapshot?.title,
          base_price: basePrice,
          quantity: quantity,
          item_total: itemTotal,
          from_field: cartItem.total_item_price ? 'total_item_price' : 'calculated'
        });

        return {
          product_id: cartItem.product_id,
          title: cartItem.product_snapshot?.title || 'Unknown Product',
          price: basePrice,
          quantity: quantity,
          selected_options: cartItem.selected_options || [],
          item_total: itemTotal,
          special_requests: cartItem.special_requests || ''
        };
      });

    // ✅ ИСПРАВЛЕН РАСЧЕТ ОБЩИХ СУМ - используем данные корзины
    let subtotal = parseFloat(cart.pricing?.subtotal || 0);
    
    // Если нет subtotal в корзине, рассчитываем из товаров
    if (!subtotal || isNaN(subtotal)) {
      subtotal = orderItems.reduce((sum, item) => {
        const itemTotal = parseFloat(item.item_total || 0);
        return sum + (isNaN(itemTotal) ? 0 : itemTotal);
      }, 0);
    }
    
    const delivery_fee = parseFloat(cart.pricing?.delivery_fee || cart.restaurant_info?.delivery_fee || 3.50);
    const service_fee = parseFloat(cart.pricing?.service_fee || Math.round(subtotal * 0.05 * 100) / 100);
    const total_price = parseFloat(cart.pricing?.total_price || (subtotal + delivery_fee + service_fee));

    console.log('💰 FINAL PRICING:', {
      subtotal,
      delivery_fee,
      service_fee,
      total_price,
      cart_pricing: cart.pricing,
      all_numbers_valid: !isNaN(subtotal) && !isNaN(delivery_fee) && !isNaN(service_fee) && !isNaN(total_price)
    });

    // ✅ ПРОВЕРКА НА NaN
    if (isNaN(subtotal) || isNaN(delivery_fee) || isNaN(service_fee) || isNaN(total_price)) {
      throw new Error('Ошибка расчета стоимости заказа. Проверьте данные корзины.');
    }

    // 6. Сгенерировать уникальный номер заказа
    const orderNumber = await Order.generateOrderNumber();

    // 7. Расчет времени доставки
    const estimatedDeliveryTime = calculateEstimatedDeliveryTime(
      delivery_address,
      restaurant.location,
      restaurant.delivery_info
    );

    // 8. Создать заказ
    const newOrder = new Order({
      order_number: orderNumber,
      customer_id: customerId,
      partner_id: restaurant._id,
      items: orderItems,
      
      // ✅ СНИМОК ТОВАРОВ НА МОМЕНТ ЗАКАЗА
      items_snapshot: itemsSnapshot,
      
      // ✅ ИНФОРМАЦИЯ О ВАЛИДАЦИИ
      availability_validation: {
        validated_at: new Date(),
        unavailable_items: unavailableItems,
        validation_status: validationStatus
      },

      subtotal,
      delivery_fee,
      service_fee,
      total_price,
      
      delivery_address,
      customer_contact,
      payment_method,
      special_requests,
      
      estimated_delivery_time: estimatedDeliveryTime,
      
      status: 'pending',
      payment_status: payment_method === 'cash' ? 'pending' : 'pending'
    });

    await newOrder.save({ session });

    // 9. ✅ РЕЗЕРВИРОВАНИЕ ТОВАРОВ НА СКЛАДЕ
    const reservationResults = await reserveProductsStock(orderItems, availableProducts, session);

    // 10. Обработать платеж
let paymentResult;
if (payment_method !== 'card') {
  throw new Error('Доступна только онлайн оплата картой');
}

try {
  paymentResult = await processPayment(newOrder, { session });
  
  if (!paymentResult.success) {
    throw new Error(paymentResult.details || 'Ошибка обработки платежа');
  }
  
  newOrder.payment_status = 'completed';
  newOrder.payment_details = {
    transaction_id: paymentResult.transaction_id,
    payment_processor: 'stub',
    gateway_response: {
      method: paymentResult.method,
      amount: paymentResult.amount,
      processed_at: paymentResult.processed_at,
      details: paymentResult.details
    }
  };
  
  console.log('💳 PAYMENT SUCCESS:', {
    payment_id: paymentResult.transaction_id,
    amount: paymentResult.amount
  });
  
} catch (paymentError) {
  console.error('💳 PAYMENT FAILED:', paymentError.message);
  await returnProductsToStock(orderItems, session);
  throw new Error(`Ошибка оплаты: ${paymentError.message}`);
}

await newOrder.save({ session });

    // 11. Конвертировать корзину в заказ
    await cart.convertToOrder();
    await cart.save({ session });

    // 12. Обновить статистику ресторана
    await PartnerProfile.findByIdAndUpdate(
      cart.restaurant_id,
      { 
        $inc: { 
          'ratings.total_orders': 1,
          'business_stats.total_orders': 1
        }
      },
      { session }
    );

    await session.commitTransaction();

    console.log('✅ ORDER CREATED SUCCESS:', {
      order_id: newOrder._id,
      order_number: orderNumber,
      total_price: newOrder.total_price,
      payment_status: newOrder.payment_status,
      unavailable_items_count: unavailableItems.length,
      reserved_items: reservationResults.length
    });

    // ✅ ФОРМИРУЕМ ОТВЕТ С УВЕДОМЛЕНИЯМИ О ПРОБЛЕМАХ
    const response = {
      order: newOrder,
      payment: paymentResult,
      estimatedDelivery: estimatedDeliveryTime,
      reservation_info: reservationResults
    };

    if (unavailableItems.length > 0) {
      response.warnings = {
        message: `${unavailableItems.length} товар(ов) были исключены из заказа`,
        unavailable_items: unavailableItems.map(item => ({
          title: item.title,
          reason: getReasonText(item.reason),
          requested_quantity: item.requested_quantity,
          available_quantity: item.available_quantity || 0
        })),
        price_adjustment: {
          original_total: cart.pricing.total_price,
          new_total: newOrder.total_price,
          saved_amount: Math.round((cart.pricing.total_price - newOrder.total_price) * 100) / 100
        }
      };
    }

    return response;

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 CREATE ORDER ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * 📋 ПОЛУЧИТЬ ЗАКАЗЫ КЛИЕНТА
 */
export const getCustomerOrders = async (customerId, filters = {}) => {
  try {
    const { status, limit = 10, offset = 0 } = filters;

    console.log('📋 GET CUSTOMER ORDERS:', { customerId, status, limit, offset });

    const query = { customer_id: customerId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('partner_id', 'business_name category location phone')
      .populate('courier_id', 'user_id vehicle_info phone')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    const totalCount = await Order.countDocuments(query);

    return {
      orders,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    };

  } catch (error) {
    console.error('🚨 GET CUSTOMER ORDERS ERROR:', error);
    throw error;
  }
};

/**
 * 📄 ПОЛУЧИТЬ ДЕТАЛИ ЗАКАЗА
 */
export const getOrderDetails = async (orderId, userId, userRole = 'customer') => {
  try {
    console.log('📄 GET ORDER DETAILS:', { orderId, userId, userRole });

    const order = await Order.findById(orderId)
      .populate('customer_id', 'first_name last_name phone email')
      .populate('partner_id', 'business_name category phone location')
      .populate('courier_id', 'user_id vehicle_info phone');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Проверка прав доступа
    await checkOrderAccess(order, userId, userRole);

    // ✅ ПРОВЕРЯЕМ АКТУАЛЬНОСТЬ ТОВАРОВ если заказ еще не принят
    if (order.status === 'pending') {
      await order.validateItemsAvailability();
    }

    const canCancel = ['pending', 'accepted'].includes(order.status);
    const canRate = order.status === 'delivered' && !order.ratings?.partner_rating;

    return {
      order,
      canCancel,
      canRate,
      estimatedDelivery: order.estimated_delivery_time,
      availability_info: order.availability_validation
    };

  } catch (error) {
    console.error('🚨 GET ORDER DETAILS ERROR:', error);
    throw error;
  }
};

/**
 * ❌ ОТМЕНИТЬ ЗАКАЗ КЛИЕНТОМ - с возвратом товаров на склад
 */
export const cancelCustomerOrder = async (orderId, customerId, cancellationData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const { reason = 'Отмена клиентом', details = '' } = cancellationData;

    console.log('❌ CANCEL CUSTOMER ORDER:', { orderId, customerId, reason });

    const order = await Order.findById(orderId).session(session);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.customer_id.toString() !== customerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (!['pending', 'accepted'].includes(order.status)) {
      throw new Error('Заказ нельзя отменить - он уже готовится или доставляется');
    }

    // ✅ ВОЗВРАЩАЕМ ТОВАРЫ НА СКЛАД
    const returnResults = await returnProductsToStock(order.items, session);

    // Отменяем заказ
    await order.cancelOrder(reason, customerId, 'customer', details);

    // Возвращаем средства если заказ был оплачен картой
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      try {
        const { processOrderRefund } = await import('../payment.service.js');
        
        const refundResult = await processOrderRefund({
          original_payment_id: order.payment_details?.payment_id,
          amount: order.total_price,
          order_id: order._id,
          reason: `Отмена заказа: ${reason}`
        });
        
        order.payment_status = 'refunded';
        order.refund_details = {
          refund_id: refundResult.refund_id,
          amount: refundResult.amount,
          processed_at: refundResult.processed_at,
          estimated_arrival: refundResult.estimated_arrival
        };
        
        console.log('💸 REFUND SUCCESS:', {
          refund_id: refundResult.refund_id,
          amount: refundResult.amount
        });
        
      } catch (refundError) {
        console.error('💸 REFUND ERROR:', refundError.message);
        order.payment_status = 'refund_pending';
        order.refund_error = refundError.message;
      }
      
      await order.save({ session });
    }

    await session.commitTransaction();

    console.log('✅ ORDER CANCELLED SUCCESS:', {
      order_number: order.order_number,
      reason,
      items_returned_to_stock: returnResults.length
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      cancelled_at: order.cancelled_at,
      message: 'Заказ отменен успешно',
      stock_return_info: returnResults,
      refund_info: order.payment_method === 'card' ? 
        'Средства будут возвращены в течение 3-5 рабочих дней' : null
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 CANCEL CUSTOMER ORDER ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * ⭐ ОЦЕНИТЬ ЗАКАЗ
 */
export const rateCompletedOrder = async (orderId, customerId, ratingData) => {
  try {
    const { partner_rating, courier_rating, comment = '' } = ratingData;

    console.log('⭐ RATE ORDER:', { orderId, customerId, partner_rating, courier_rating });

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

    // Обновляем рейтинг заказа
    order.ratings = {
      partner_rating: partner_rating,
      courier_rating: courier_rating,
      comment: comment.trim(),
      rated_at: new Date()
    };

    await order.save();

    // Обновляем рейтинг ресторана
    if (partner_rating) {
      await PartnerProfile.findByIdAndUpdate(order.partner_id, {
        $inc: {
          'ratings.total_reviews': 1,
          'ratings.total_points': partner_rating
        }
      });
    }

    // Обновляем рейтинг курьера
    if (courier_rating && order.courier_id) {
      await CourierProfile.findByIdAndUpdate(order.courier_id, {
        $inc: {
          'ratings.total_reviews': 1,
          'ratings.total_points': courier_rating
        }
      });
    }

    console.log('✅ ORDER RATED SUCCESS:', {
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
    console.error('🚨 RATE ORDER ERROR:', error);
    throw error;
  }
};

// ================ ПАРТНЕРСКИЕ СЕРВИСЫ ================

/**
 * 📋 ПОЛУЧИТЬ ЗАКАЗЫ РЕСТОРАНА
 */
export const getRestaurantOrders = async (partnerId, filters = {}) => {
  try {
    const { status, date, limit = 20, offset = 0 } = filters;

    console.log('📋 GET RESTAURANT ORDERS:', { partnerId, status, date });

    const query = { partner_id: partnerId };
    
    if (status) {
      query.status = status;
    }
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const orders = await Order.find(query)
      .populate('customer_id', 'first_name last_name phone')
      .populate('courier_id', 'user_id vehicle_info phone')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    const totalCount = await Order.countDocuments(query);

    return {
      orders,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    };

  } catch (error) {
    console.error('🚨 GET RESTAURANT ORDERS ERROR:', error);
    throw error;
  }
};

/**
 * ✅ ПРИНЯТЬ ЗАКАЗ РЕСТОРАНОМ
 */
export const acceptRestaurantOrder = async (orderId, partnerId, acceptanceData = {}) => {
  try {
    const { estimated_preparation_time = 20 } = acceptanceData;

    console.log('✅ ACCEPT RESTAURANT ORDER:', { orderId, partnerId, estimated_preparation_time });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.partner_id.toString() !== partnerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'pending') {
      throw new Error('Заказ нельзя принять - неверный статус');
    }

    // ✅ ПОВТОРНАЯ ВАЛИДАЦИЯ ТОВАРОВ перед принятием
    const currentValidation = await validateProductsAvailability(order.items);
    if (currentValidation.validationStatus === 'critical_issues') {
      throw new Error('Заказ нельзя принять - товары больше недоступны');
    }

    // Принимаем заказ
    await order.addStatusHistory('accepted', partnerId, 'partner', 
      `Время приготовления: ${estimated_preparation_time} минут`);

    console.log('✅ ORDER ACCEPTED SUCCESS:', {
      order_number: order.order_number,
      estimated_preparation_time
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      accepted_at: order.accepted_at,
      message: 'Заказ принят успешно',
      next_step: `Время приготовления: ${estimated_preparation_time} минут`
    };

  } catch (error) {
    console.error('🚨 ACCEPT ORDER ERROR:', error);
    throw error;
  }
};

/**
 * ❌ ОТКЛОНИТЬ ЗАКАЗ РЕСТОРАНОМ - с возвратом товаров
 */
export const rejectRestaurantOrder = async (orderId, partnerId, rejectionData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const { reason, details = '' } = rejectionData;

    console.log('❌ REJECT RESTAURANT ORDER:', { orderId, partnerId, reason });

    const order = await Order.findById(orderId).session(session);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.partner_id.toString() !== partnerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'pending') {
      throw new Error('Заказ нельзя отклонить - неверный статус');
    }

    // ✅ ВОЗВРАЩАЕМ ТОВАРЫ НА СКЛАД
    const returnResults = await returnProductsToStock(order.items, session);

    // Отклоняем заказ
    await order.cancelOrder(reason, partnerId, 'partner', details);

    // Возвращаем средства клиенту если заказ был оплачен
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      const refundResult = await processRefund(order);
      order.payment_status = 'refunded';
      order.refund_details = refundResult;
      await order.save({ session });
    }

    await session.commitTransaction();

    console.log('✅ ORDER REJECTED SUCCESS:', {
      order_number: order.order_number,
      reason,
      items_returned_to_stock: returnResults.length
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      cancelled_at: order.cancelled_at,
      message: 'Заказ отклонен. Клиент получит уведомление.',
      stock_return_info: returnResults
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 REJECT ORDER ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * 🍳 ЗАКАЗ ГОТОВ К ВЫДАЧЕ
 */
export const markRestaurantOrderReady = async (orderId, partnerId) => {
  try {
    console.log('🍳 MARK ORDER READY:', { orderId, partnerId });

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

    // Помечаем заказ готовым
    await order.addStatusHistory('ready', partnerId, 'partner', 'Заказ готов к выдаче курьеру');

    console.log('✅ ORDER READY SUCCESS:', {
      order_number: order.order_number,
      ready_at: order.ready_at
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      ready_at: order.ready_at,
      message: 'Заказ готов! Ожидается курьер.',
      next_step: 'Дождитесь курьера для передачи заказа'
    };

  } catch (error) {
    console.error('🚨 MARK ORDER READY ERROR:', error);
    throw error;
  }
};

// ================ КУРЬЕРСКИЕ СЕРВИСЫ ================

/**
 * 📋 ПОЛУЧИТЬ ДОСТУПНЫЕ ЗАКАЗЫ ДЛЯ КУРЬЕРА
 */
export const getAvailableOrdersForCourier = async (courierId, location = {}) => {
  try {
    const { lat, lng, radius = 10 } = location; // радиус в км

    console.log('📋 GET AVAILABLE ORDERS FOR COURIER:', { courierId, lat, lng, radius });

    let query = {
      status: 'ready',
      courier_id: { $exists: false }
    };

    // Фильтр по географии если указаны координаты
    if (lat && lng) {
      query['delivery_address.lat'] = {
        $gte: lat - (radius * 0.009), // Примерно 1км = 0.009 градуса
        $lte: lat + (radius * 0.009)
      };
      query['delivery_address.lng'] = {
        $gte: lng - (radius * 0.009),
        $lte: lng + (radius * 0.009)
      };
    }

    const orders = await Order.find(query)
      .populate('partner_id', 'business_name phone location')
      .populate('customer_id', 'first_name last_name phone')
      .sort({ ready_at: 1 }) // Старые заказы первыми
      .limit(20);

    // Обогащаем данными о расстоянии и заработке
    const enrichedOrders = orders.map(order => {
      const distance = lat && lng ? calculateDistance(
        lat, lng,
        order.delivery_address.lat,
        order.delivery_address.lng
      ) : null;

      const estimatedEarnings = calculateCourierEarnings(order, distance);

      return {
        ...order.toObject(),
        distance_km: distance ? Math.round(distance * 10) / 10 : null,
        estimated_earnings: estimatedEarnings,
        delivery_time_estimate: distance ? Math.round(distance * 3) + 10 : 15 // 3 мин/км + 10 мин базовых
      };
    });

    return {
      available_orders: enrichedOrders,
      total: enrichedOrders.length,
      location_filter: lat && lng ? { lat, lng, radius } : null
    };

  } catch (error) {
    console.error('🚨 GET AVAILABLE ORDERS ERROR:', error);
    throw new Error('Ошибка получения доступных заказов');
  }
};

/**
 * 📦 ВЗЯТЬ ЗАКАЗ НА ДОСТАВКУ
 */
export const acceptOrderForDelivery = async (orderId, courierId) => {
  try {
    console.log('📦 ACCEPT ORDER FOR DELIVERY:', { orderId, courierId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.status !== 'ready') {
      throw new Error('Заказ недоступен для взятия - неверный статус');
    }

    if (order.courier_id) {
      throw new Error('Заказ уже взят другим курьером');
    }

    // Проверяем, что курьер не занят другим заказом
    const activeOrder = await Order.findOne({
      courier_id: courierId,
      status: { $in: ['picked_up', 'on_the_way'] }
    });

    if (activeOrder) {
      throw new Error('У вас уже есть активный заказ для доставки');
    }

    // Назначаем курьера
    order.courier_id = courierId;
    await order.addStatusHistory('picked_up', courierId, 'courier', 'Курьер взял заказ на доставку');

    console.log('✅ ORDER ACCEPTED FOR DELIVERY SUCCESS:', {
      order_number: order.order_number,
      courier_id: courierId
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      message: 'Заказ взят на доставку. Направляйтесь в ресторан.',
      partner_info: {
        name: order.partner_id?.business_name,
        phone: order.partner_id?.phone,
        address: order.partner_id?.location?.address
      }
    };

  } catch (error) {
    console.error('🚨 ACCEPT ORDER FOR DELIVERY ERROR:', error);
    throw error;
  }
};

/**
 * 🏪 ЗАБРАТЬ ЗАКАЗ У РЕСТОРАНА
 */
export const markOrderPickedUpByCourier = async (orderId, courierId) => {
  try {
    console.log('🏪 MARK ORDER PICKED UP:', { orderId, courierId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.courier_id.toString() !== courierId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'picked_up') {
      throw new Error('Заказ нельзя забрать - неверный статус');
    }

    // Обновляем статус
    await order.addStatusHistory('on_the_way', courierId, 'courier', 'Курьер забрал заказ и направляется к клиенту');

    console.log('✅ ORDER PICKED UP SUCCESS:', {
      order_number: order.order_number,
      picked_up_at: order.picked_up_at
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      picked_up_at: order.picked_up_at,
      message: 'Заказ забран! Направляйтесь к клиенту.',
      customer_info: {
        name: `${order.customer_contact?.name || 'Клиент'}`,
        phone: order.customer_contact?.phone,
        address: order.delivery_address?.address
      }
    };

  } catch (error) {
    console.error('🚨 MARK ORDER PICKED UP ERROR:', error);
    throw error;
  }
};

/**
 * 🚚 ДОСТАВИТЬ ЗАКАЗ КЛИЕНТУ
 */
export const markOrderDeliveredByCourier = async (orderId, courierId) => {
  try {
    console.log('🚚 MARK ORDER DELIVERED:', { orderId, courierId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.courier_id.toString() !== courierId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'on_the_way') {
      throw new Error('Заказ нельзя пометить доставленным - неверный статус');
    }

    // Обновляем статус
    await order.addStatusHistory('delivered', courierId, 'courier', 'Заказ доставлен клиенту');

    // Обновляем статистику курьера
    await CourierProfile.findByIdAndUpdate(courierId, {
      $inc: {
        'delivery_stats.total_deliveries': 1,
        'delivery_stats.total_earnings': calculateCourierEarnings(order)
      }
    });

    console.log('✅ ORDER DELIVERED SUCCESS:', {
      order_number: order.order_number,
      delivered_at: order.delivered_at,
      actual_delivery_time: order.actual_delivery_time
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      delivered_at: order.delivered_at,
      actual_delivery_time: order.actual_delivery_time,
      message: 'Заказ доставлен успешно! Спасибо за работу.'
    };

  } catch (error) {
    console.error('🚨 MARK ORDER DELIVERED ERROR:', error);
    throw error;
  }
};

/**
 * 📋 ПОЛУЧИТЬ АКТИВНЫЕ ЗАКАЗЫ КУРЬЕРА
 */
export const getCourierActiveOrders = async (courierId) => {
  try {
    console.log('🚴 GET COURIER ACTIVE ORDERS:', { courierId });

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
    console.error('🚨 GET COURIER ACTIVE ORDERS ERROR:', error);
    throw error;
  }
};

// ================ ОБЩИЕ СЕРВИСЫ ================

/**
 * 🔍 ОТСЛЕЖИВАНИЕ СТАТУСА ЗАКАЗА
 */
export const trackOrderStatus = async (orderId, userId = null) => {
  try {
    console.log('🔍 TRACK ORDER STATUS:', { orderId, userId });

    const order = await Order.findById(orderId)
      .populate('partner_id', 'business_name phone location')
      .populate('courier_id', 'user_id vehicle_info phone')
      .populate('customer_id', 'first_name last_name phone');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Если указан userId, проверяем доступ
    if (userId) {
      const hasAccess = await checkOrderAccess(order, userId);
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
        phone: order.courier_id.phone,
        vehicle: order.courier_id.vehicle_info?.vehicle_type
      } : null
    };

  } catch (error) {
    console.error('🚨 TRACK ORDER ERROR:', error);
    throw error;
  }
};

/**
 * 📊 ПОЛУЧИТЬ ТОЛЬКО СТАТУС ЗАКАЗА (быстрый метод)
 */
export const getOrderStatusOnly = async (orderId) => {
  try {
    const order = await Order.findById(orderId).select('status order_number estimated_delivery_time actual_delivery_time');
    
    if (!order) {
      throw new Error('Заказ не найден');
    }

    return {
      order_id: orderId,
      order_number: order.order_number,
      status: order.status,
      status_description: getStatusDescription(order.status),
      progress: getOrderProgress(order.status),
      estimated_delivery_time: order.estimated_delivery_time,
      actual_delivery_time: order.actual_delivery_time
    };

  } catch (error) {
    console.error('🚨 GET ORDER STATUS ERROR:', error);
    throw error;
  }
};

// ================ УТИЛИТАРНЫЕ ФУНКЦИИ ================

/**
 * ✅ ПРОВЕРКА ДОСТУПА К ЗАКАЗУ
 */
export const checkOrderAccess = async (order, userId, userRole = null) => {
  try {
    // Если роль не указана, определяем по мета-информации
    if (!userRole) {
      const Meta = mongoose.model('Meta');
      const meta = await Meta.findOne({ 
        $or: [
          { customer: userId },
          { partner: userId }, 
          { courier: userId }
        ]
      });
      
      if (meta) {
        userRole = meta.role;
      }
    }

    // Проверка прав доступа по ролям
    let hasAccess = false;
    
    if (userRole === 'customer' && order.customer_id._id.toString() === userId.toString()) {
      hasAccess = true;
    } else if (userRole === 'partner' && order.partner_id.user_id?.toString() === userId.toString()) {
      hasAccess = true;
    } else if (userRole === 'courier' && order.courier_id?.user_id?.toString() === userId.toString()) {
      hasAccess = true;
    }

    if (!hasAccess) {
      throw new Error('Нет доступа к этому заказу');
    }

    return true;

  } catch (error) {
    console.error('🚨 CHECK ORDER ACCESS ERROR:', error);
    throw error;
  }
};

/**
 * 💰 РАСЧЕТ ЗАРАБОТКА КУРЬЕРА
 */
export const calculateCourierEarnings = (order, distance = null) => {
  const baseEarning = 4.50; // Базовая ставка за доставку
  const distanceBonus = distance ? Math.round(distance * 0.50 * 100) / 100 : 1.50; // 0.50€ за км
  const orderSizeBonus = order.total_price > 30 ? 1.00 : 0; // Бонус за крупный заказ
  
  return Math.round((baseEarning + distanceBonus + orderSizeBonus) * 100) / 100;
};

/**
 * 📊 ПОЛУЧИТЬ ПРОГРЕСС ЗАКАЗА (в процентах)
 */
export const getOrderProgress = (status) => {
  const progressMap = {
    'pending': 10,
    'accepted': 30,
    'ready': 60,
    'picked_up': 70,
    'on_the_way': 90,
    'delivered': 100,
    'cancelled': 0
  };
  
  return progressMap[status] || 0;
};

/**
 * 📝 ПОЛУЧИТЬ ОПИСАНИЕ СТАТУСА
 */
export const getStatusDescription = (status) => {
  const descriptions = {
    'pending': 'Ожидает подтверждения ресторана',
    'accepted': 'Заказ принят, готовится',
    'ready': 'Готов к выдаче, ожидается курьер',
    'picked_up': 'Курьер забрал заказ',
    'on_the_way': 'Курьер в пути к вам',
    'delivered': 'Заказ доставлен',
    'cancelled': 'Заказ отменен'
  };
  
  return descriptions[status] || 'Неизвестный статус';
};

/**
 * ➡️ ПОЛУЧИТЬ СЛЕДУЮЩИЙ ШАГ
 */
export const getNextStep = (status) => {
  const nextSteps = {
    'pending': 'Ожидаем подтверждения от ресторана',
    'accepted': 'Ваш заказ готовится',
    'ready': 'Ищем курьера для доставки',
    'picked_up': 'Курьер забирает заказ у ресторана',
    'on_the_way': 'Курьер направляется к вам',
    'delivered': 'Заказ доставлен! Можете оценить сервис',
    'cancelled': 'Заказ был отменен'
  };
  
  return nextSteps[status] || 'Обратитесь в поддержку';
};

// ================ НОВЫЕ ФУНКЦИИ ДЛЯ АВТООЧИСТКИ ================

/**
 * 🧹 АВТООЧИСТКА ПРОСРОЧЕННЫХ КОРЗИН И ЗАКАЗОВ
 */
export const cleanupExpiredData = async () => {
  try {
    console.log('🧹 STARTING CLEANUP OF EXPIRED DATA...');
    
    const now = new Date();
    const results = {
      expired_carts_cleaned: 0,
      expired_orders_cleaned: 0,
      stock_returned: 0,
      start_time: now
    };

    // 1. Очистка просроченных корзин (старше 24 часов)
    const expiredCarts = await Cart.find({
      status: { $in: ['active', 'abandoned'] },
      expires_at: { $lt: now }
    });

    for (const cart of expiredCarts) {
      await cart.clear();
      results.expired_carts_cleaned++;
    }

    // 2. Очистка зависших заказов (pending дольше 30 минут)
    const expiredOrders = await Order.find({
      status: 'pending',
      createdAt: { $lt: new Date(now - 30 * 60 * 1000) } // 30 минут назад
    });

    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      for (const order of expiredOrders) {
        // Возвращаем товары на склад
        const returnResults = await returnProductsToStock(order.items, session);
        results.stock_returned += returnResults.length;

        // Отменяем заказ
        await order.cancelOrder('Автоматическая отмена - превышено время ожидания', null, 'system', 'Заказ не был подтвержден в течение 30 минут');
        results.expired_orders_cleaned++;
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // 3. Очистка старой истории резервирований в товарах (старше 30 дней)
    await Product.updateMany(
      {},
      {
        $pull: {
          reservation_history: {
            $or: [
              { reserved_at: { $lt: new Date(now - 30 * 24 * 60 * 60 * 1000) } },
              { returned_at: { $lt: new Date(now - 30 * 24 * 60 * 60 * 1000) } }
            ]
          }
        }
      }
    );

    results.end_time = new Date();
    results.duration_ms = results.end_time - results.start_time;

    console.log('✅ CLEANUP COMPLETED:', results);
    return results;

  } catch (error) {
    console.error('🚨 CLEANUP ERROR:', error);
    throw error;
  }
};

/**
 * 🔍 ВАЛИДАЦИЯ ТОВАРОВ В КОНКРЕТНОМ ЗАКАЗЕ
 */
export const validateOrderItems = async (orderId) => {
  try {
    console.log('🔍 VALIDATE ORDER ITEMS:', { orderId });

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Выполняем валидацию через метод модели
    const validationResult = await order.validateItemsAvailability();

    return {
      order_id: orderId,
      order_number: order.order_number,
      validation_status: order.availability_validation.validation_status,
      unavailable_items: order.availability_validation.unavailable_items,
      validated_at: order.availability_validation.validated_at,
      is_valid: order.availability_validation.validation_status === 'valid'
    };

  } catch (error) {
    console.error('🚨 VALIDATE ORDER ITEMS ERROR:', error);
    throw error;
  }
};

/**
 * 📊 ПОЛУЧИТЬ СТАТИСТИКУ ЗАКАЗОВ
 */
export const getOrdersStatistics = async (filters = {}) => {
  try {
    const { partnerId, courierId, customerId, period = 30 } = filters;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    let matchQuery = {
      createdAt: { $gte: startDate }
    };

    if (partnerId) matchQuery.partner_id = new mongoose.Types.ObjectId(partnerId);
    if (courierId) matchQuery.courier_id = new mongoose.Types.ObjectId(courierId);
    if (customerId) matchQuery.customer_id = new mongoose.Types.ObjectId(customerId);

    const stats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total_amount: { $sum: '$total_price' },
          avg_amount: { $avg: '$total_price' },
          avg_delivery_time: { $avg: '$actual_delivery_time' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments(matchQuery);
    const totalRevenue = await Order.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: '$total_price' } } }
    ]);

    return {
      period_days: period,
      total_orders: totalOrders,
      total_revenue: totalRevenue[0]?.total || 0,
      by_status: stats,
      generated_at: new Date()
    };

  } catch (error) {
    console.error('🚨 GET ORDERS STATISTICS ERROR:', error);
    throw error;
  }
};

/**
 * 🔄 МАССОВОЕ ОБНОВЛЕНИЕ СТАТУСОВ ЗАКАЗОВ (для админки)
 */
export const bulkUpdateOrderStatus = async (orderIds, newStatus, adminId, reason = '') => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    console.log('🔄 BULK UPDATE ORDER STATUS:', { orderIds, newStatus, adminId });

    const orders = await Order.find({
      _id: { $in: orderIds }
    }).session(session);

    const results = [];

    for (const order of orders) {
      try {
        // Если отменяем заказ - возвращаем товары на склад
        if (newStatus === 'cancelled') {
          await returnProductsToStock(order.items, session);
        }

        await order.addStatusHistory(newStatus, adminId, 'admin', reason || `Массовое обновление статуса`);
        
        results.push({
          order_id: order._id,
          order_number: order.order_number,
          old_status: order.status,
          new_status: newStatus,
          success: true
        });

      } catch (error) {
        results.push({
          order_id: order._id,
          order_number: order.order_number,
          success: false,
          error: error.message
        });
      }
    }

    await session.commitTransaction();

    console.log('✅ BULK UPDATE COMPLETED:', {
      total_processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return {
      results,
      summary: {
        total_processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('🚨 BULK UPDATE ERROR:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// ================ ЭКСПОРТ ВСЕХ ФУНКЦИЙ ================

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
  
  // Общие сервисы
  trackOrderStatus,
  getOrderStatusOnly,
  
  // ✅ НОВЫЕ УТИЛИТАРНЫЕ ФУНКЦИИ
  validateOrderItems,
  cleanupExpiredData,
  getOrdersStatistics,
  bulkUpdateOrderStatus,
  
  // Утилитарные функции для тестирования
  calculateEstimatedDeliveryTime,
  processPayment,
  processRefund,
  checkOrderAccess,
  calculateCourierEarnings,
  getOrderProgress,
  getStatusDescription,
  getNextStep,
  
  // ✅ НОВЫЕ ФУНКЦИИ ВАЛИДАЦИИ И РЕЗЕРВИРОВАНИЯ
  validateProductsAvailability,
  reserveProductsStock,
  returnProductsToStock
};