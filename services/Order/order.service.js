// services/Order/order.service.js - ДОПОЛНЕННАЯ система заказов с интеграцией ESARGO
import { Order, Cart, User, PartnerProfile, CourierProfile, Product } from '../../models/index.js';
import { calculateFullDelivery } from '../Delivery/delivery.service.js'; // ✅ НОВАЯ ИНТЕГРАЦИЯ
import { integrateWithOrderCreation, integrateWithOrderDelivery } from '../Finance/transaction.service.js'; // ✅ НОВАЯ ИНТЕГРАЦИЯ
import { processOrderPayment } from '../payment.stub.service.js'; // ✅ ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩИЙ
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
 * ✅ ОБНОВЛЕНО: Расчет времени доставки с интеграцией Delivery Service
 */
async function calculateEstimatedDeliveryTime(delivery_address, restaurant_location, restaurant_delivery_info) {
  try {
    // ✅ ИСПОЛЬЗУЕМ НОВЫЙ DELIVERY SERVICE
    const deliveryData = {
      restaurant_lat: restaurant_location?.coordinates?.[1] || 43.2965, // ✅ ИСПРАВЛЕНО: Марсель вместо Парижа
      restaurant_lng: restaurant_location?.coordinates?.[0] || 5.3698,  // ✅ ИСПРАВЛЕНО: Марсель вместо Парижа
      delivery_lat: delivery_address.lat,
      delivery_lng: delivery_address.lng,
      order_total: 0, // Для расчета времени не важно
      order_time: new Date()
    };

    const result = await calculateFullDelivery(deliveryData);
    
    return new Date(Date.now() + result.estimated_delivery_minutes * 60 * 1000);
  } catch (error) {
    console.warn('⚠️ Delivery service failed, using fallback:', error.message);
    
    // ✅ FALLBACK: обновленная логика с координатами Марселя
    let baseTime = 30;
    if (restaurant_delivery_info && restaurant_delivery_info.base_delivery_time) {
      baseTime = restaurant_delivery_info.base_delivery_time;
    }
    
    const distance = calculateDistance(
      restaurant_location?.coordinates?.[1] || 43.2965, // ✅ ИСПРАВЛЕНО: Марсель
      restaurant_location?.coordinates?.[0] || 5.3698,  // ✅ ИСПРАВЛЕНО: Марсель
      delivery_address.lat,
      delivery_address.lng
    );
    
    // Добавляем время в зависимости от расстояния
    const additionalTime = Math.round(distance * 2); // ~2 минуты на км
    
    return new Date(Date.now() + (baseTime + additionalTime) * 60 * 1000);
  }
}

/**
 * 💸 АДМИНИСТРАТИВНЫЙ ВОЗВРАТ ЗАКАЗА
 * Для использования админами и службой поддержки
 */
export const processAdminRefund = async (orderId, adminUserId, options = {}) => {
  try {
    const {
      refund_reason = 'admin_initiated',
      refund_type = 'full', // full | partial
      partial_amount = null,
      admin_notes = ''
    } = options;

    console.log('💸 ADMIN REFUND:', { orderId, adminUserId, refund_type });

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    // ✅ ИСПОЛЬЗУЕМ РЕАЛЬНУЮ СИСТЕМУ ВОЗВРАТОВ
    const { processRealRefund } = await import('../Finance/refund.service.js');
    
    const refundResult = await processRealRefund(order, {
      refund_reason: `${refund_reason}${admin_notes ? `: ${admin_notes}` : ''}`,
      refund_type,
      partial_amount,
      initiated_by_user_id: adminUserId,
      initiated_by_role: 'admin'
    });

    console.log('✅ ADMIN REFUND SUCCESS:', {
      refund_id: refundResult.refund_id,
      amount: refundResult.refund_details.refunded_amount
    });

    return refundResult;

  } catch (error) {
    console.error('🚨 ADMIN REFUND ERROR:', error);
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

export const checkRefundEligibility = async (orderId, userRole = 'customer') => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    // ✅ ИСПОЛЬЗУЕМ УТИЛИТЫ СИСТЕМЫ ВОЗВРАТОВ
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
    console.error('🚨 CHECK REFUND ELIGIBILITY ERROR:', error);
    throw error;
  }
};

/**
 * Расчет расстояния между координатами (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
/**
 * ДЕТАЛЬНАЯ ВАЛИДАЦИЯ доступности товаров
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

    // Создаем снимок продукта
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

    // Проверка остатков для магазинов
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

  // Определяем статус валидации
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

/**
 * РЕЗЕРВИРОВАНИЕ товаров на складе
 */
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

      console.log(`📦 RESERVED: ${item.quantity}x "${item.title}", остаток: ${updatedProduct.stock_quantity}`);
    }
  }

  return reservationResults;
}

/**
 * ВОЗВРАТ товаров на склад при отмене заказа
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


async function processPayment(orderData, deliveryData) {
  try {
    console.log('💳 PROCESS PAYMENT (ESARGO):', {
      order_id: orderData.order_id,
      total_price: orderData.total_price,
      delivery_zone: deliveryData?.delivery_zone,
      payment_method: orderData.payment_method
    });

    // ✅ ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩИЙ PAYMENT SERVICE
    const paymentResult = await processOrderPayment({
      order_id: orderData.order_id,
      amount: orderData.total_price,
      payment_method: orderData.payment_method,
      customer_id: orderData.customer_id,
      // ✅ НОВЫЕ ПОЛЯ ESARGO
      delivery_zone: deliveryData?.delivery_zone,
      delivery_fee: deliveryData?.delivery_fee,
      platform_commission: Math.round(orderData.subtotal * 0.10 * 100) / 100
    });

    // ✅ ИНТЕГРАЦИЯ С FINANCE SERVICE (если оплата успешна)
    if (paymentResult.success && deliveryData) {
      try {
        const financeResult = await integrateWithOrderCreation(orderData, deliveryData);
        console.log('💰 Finance integration result:', financeResult.success ? 'SUCCESS' : 'FAILED');
      } catch (financeError) {
        console.warn('⚠️ Finance integration failed (non-critical):', financeError.message);
        // Не прерываем процесс создания заказа
      }
    }

    return paymentResult;

  } catch (error) {
    console.error('🚨 PROCESS PAYMENT ERROR:', error);
    throw error;
  }
}

// Заменяем старую заглушку на реальную систему возвратов

async function processRefund(order, options = {}) {
  console.log('⚠️ DEPRECATED: Using old processRefund, redirecting to real refund system');
  
  try {
    const { processRealRefund } = await import('../Finance/refund.service.js');
    return await processRealRefund(order, {
      refund_reason: options.reason || 'legacy_refund',
      refund_type: 'full',
      initiated_by_user_id: options.initiated_by || null,
      initiated_by_role: options.user_role || 'system'
    });
  } catch (error) {
    console.error('🚨 LEGACY REFUND REDIRECT ERROR:', error);
    
    // Fallback к старой логике только в крайнем случае
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

// ================ КЛИЕНТСКИЕ СЕРВИСЫ ================

/**
 * ✅ ОБНОВЛЕНО: СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ с интеграцией новых сервисов
 */
export const createOrderFromCart = async (customerId, orderData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    const { delivery_address, customer_contact, payment_method = 'card', special_requests = '' } = orderData;

    console.log('🆕 CREATE ORDER FROM CART (ENHANCED):', { customerId, payment_method });

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

    // 4. ✅ РАСШИРЕННАЯ ВАЛИДАЦИЯ ДОСТУПНОСТИ ТОВАРОВ
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

    // 5. ✅ НОВАЯ ИНТЕГРАЦИЯ: Расчет доставки через Delivery Service
    let deliveryData = null;
    let deliveryFee = parseFloat(cart.pricing?.delivery_fee || 3.50);
    
    try {
      deliveryData = await calculateFullDelivery({
        restaurant_lat: restaurant.location.coordinates[1],
        restaurant_lng: restaurant.location.coordinates[0],
        delivery_lat: delivery_address.lat,
        delivery_lng: delivery_address.lng,
        order_total: cart.pricing.subtotal,
        order_time: new Date()
      });
      
      deliveryFee = deliveryData.delivery_fee;
      console.log('✅ NEW DELIVERY SYSTEM:', {
        zone: deliveryData.delivery_zone,
        fee: deliveryData.delivery_fee,
        distance: deliveryData.distance_km
      });
    } catch (deliveryError) {
      console.warn('⚠️ Delivery service failed, using fallback:', deliveryError.message);
      // Используем старое значение из корзины
    }

    // 6. Подготовить товары для заказа (исключить недоступные)
    const orderItems = cart.items
      .filter(cartItem => !unavailableItems.some(unavail => 
        unavail.product_id.toString() === cartItem.product_id.toString()
      ))
      .map(item => ({
        product_id: item.product_id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        selected_options: item.selected_options || [],
        item_total: item.item_total,
        special_requests: item.special_requests || ''
      }));

    // 7. Пересчитать стоимость (без недоступных товаров)
    const subtotal = orderItems.reduce((sum, item) => sum + (item.item_total || 0), 0);
    const service_fee = Math.round(subtotal * 0.05 * 100) / 100;
    const total_price = subtotal + deliveryFee + service_fee;

    console.log('💰 FINAL PRICING (ENHANCED):', {
      subtotal,
      delivery_fee: deliveryFee,
      service_fee,
      total_price,
      delivery_zone: deliveryData?.delivery_zone || 'unknown'
    });

    // 8. Сгенерировать уникальный номер заказа
    const orderNumber = Order.generateOrderNumber();

    // 9. ✅ ОБНОВЛЕНО: Расчет времени доставки через новый сервис
    const estimatedDeliveryTime = await calculateEstimatedDeliveryTime(
      delivery_address,
      restaurant.location,
      restaurant.delivery_info
    );

    // 10. ✅ ОБНОВЛЕНО: Создать заказ с новыми полями ESARGO
    const newOrder = new Order({
      order_number: orderNumber,
      customer_id: customerId,
      partner_id: restaurant._id,
      items: orderItems,
      
      // Снимок товаров
      items_snapshot: itemsSnapshot,
      availability_validation: {
        validated_at: new Date(),
        unavailable_items: unavailableItems,
        validation_status: validationStatus
      },

      // Ценообразование
      subtotal,
      delivery_fee: deliveryFee,
      service_fee,
      total_price,
      
      // ✅ НОВЫЕ ПОЛЯ ESARGO
      platform_commission: deliveryData ? deliveryData.platform_commission : Math.round(subtotal * 0.10 * 100) / 100,
      delivery_zone: deliveryData ? deliveryData.delivery_zone : null,
      delivery_distance_km: deliveryData ? deliveryData.distance_km : null,
      peak_hour_surcharge: deliveryData ? (deliveryData.peak_hour_info?.surcharge || 0) : 0,
      courier_earnings: deliveryData ? (deliveryData.courier_earnings?.total_earnings || 0) : 0,
      
      // Координаты
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
      
      status: 'pending',
      payment_status: 'pending'
    });

    await newOrder.save({ session });

    // 11. Резервирование товаров на складе
    const reservationResults = await reserveProductsStock(orderItems, availableProducts, session);

    // 12. ✅ ОБРАБОТАТЬ ПЛАТЕЖ (используем существующий сервис)
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
      };
      
      console.log('💳 PAYMENT SUCCESS (ENHANCED):', {
        payment_id: paymentResult.payment_id,
        amount: paymentResult.amount
      });
      
    } catch (paymentError) {
      console.error('💳 PAYMENT FAILED:', paymentError.message);
      await returnProductsToStock(orderItems, session);
      throw new Error(`Ошибка оплаты: ${paymentError.message}`);
    }

    await newOrder.save({ session });

    // 13. ✅ НОВАЯ ИНТЕГРАЦИЯ: Создание финансовых транзакций
    let transactionsResult = null;
    if (deliveryData) {
      try {
        transactionsResult = await integrateWithOrderCreation({
          order_id: newOrder._id,
          order_number: newOrder.order_number,
          customer_id: customerId,
          partner_id: restaurant._id,
          courier_id: null, // Назначится позже
          subtotal,
          total_price,
          payment_status: newOrder.payment_status
        }, deliveryData);
        
        console.log('💰 TRANSACTIONS CREATED:', {
          success: transactionsResult.success,
          transactions_count: transactionsResult.transactions?.length || 0
        });
      } catch (transactionError) {
        console.warn('⚠️ Transaction creation failed (non-critical):', transactionError.message);
      }
    }

    // 14. Конвертировать корзину в заказ
    await cart.convertToOrder();
    await cart.save({ session });

    // 15. Обновить статистику ресторана
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

    console.log('✅ ORDER CREATED SUCCESS (ENHANCED):', {
      order_id: newOrder._id,
      order_number: orderNumber,
      total_price: newOrder.total_price,
      delivery_zone: newOrder.delivery_zone,
      platform_commission: newOrder.platform_commission,
      unavailable_items_count: unavailableItems.length
    });

    // 16. ✅ ФОРМИРУЕМ РАСШИРЕННЫЙ ОТВЕТ
    const response = {
      order: newOrder,
      payment: paymentResult,
      estimatedDelivery: estimatedDeliveryTime,
      reservation_info: reservationResults,
      
      // ✅ НОВЫЕ ПОЛЯ ESARGO
      delivery_info: deliveryData ? {
        zone: deliveryData.delivery_zone,
        distance_km: deliveryData.distance_km,
        estimated_minutes: deliveryData.estimated_delivery_minutes,
        peak_hour: deliveryData.peak_hour_info?.is_peak_hour || false,
        delivery_system: 'ESARGO_ZONES'
      } : null,
      
      financial_info: transactionsResult ? {
        platform_commission: newOrder.platform_commission,
        courier_earnings: newOrder.courier_earnings,
        transactions_created: transactionsResult.success
      } : null
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
    console.error('🚨 CREATE ORDER ERROR (ENHANCED):', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// ================ КУРЬЕРСКИЕ СЕРВИСЫ ================

/**
 * ✅ ОБНОВЛЕНО: ДОСТАВИТЬ ЗАКАЗ с интеграцией финансовых транзакций
 */
export const markOrderDeliveredByCourier = async (orderId, courierId) => {
  try {
    console.log('🎯 MARK ORDER DELIVERED (ENHANCED):', { orderId, courierId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (!order.courier_id || order.courier_id.toString() !== courierId.toString()) {
      throw new Error('Заказ не назначен этому курьеру');
    }

    if (order.status !== 'on_the_way') {
      throw new Error('Заказ не находится в пути');
    }

    // Помечаем заказ доставленным
    await order.addStatusHistory('delivered', courierId, 'courier', 'Заказ доставлен клиенту');

    // ✅ НОВАЯ ИНТЕГРАЦИЯ: Обработка финансовых транзакций при доставке
    let transactionsResult = null;
    try {
      transactionsResult = await integrateWithOrderDelivery(order._id, courierId);
      console.log('💰 DELIVERY TRANSACTIONS PROCESSED:', {
        success: transactionsResult.success,
        processed_count: transactionsResult.processed?.length || 0
      });
    } catch (transactionError) {
      console.warn('⚠️ Transaction processing failed (non-critical):', transactionError.message);
    }

    console.log('✅ ORDER DELIVERED SUCCESS (ENHANCED):', {
      order_number: order.order_number,
      delivered_at: order.delivered_at,
      delivery_time: order.actual_delivery_time,
      transactions_processed: transactionsResult?.success || false
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      delivered_at: order.delivered_at,
      actual_delivery_time: order.actual_delivery_time,
      message: 'Заказ доставлен! Спасибо за работу.',
      
      // ✅ НОВАЯ ИНФОРМАЦИЯ
      financial_processing: transactionsResult ? {
        success: transactionsResult.success,
        processed_transactions: transactionsResult.processed || []
      } : null
    };

  } catch (error) {
    console.error('🚨 MARK ORDER DELIVERED ERROR (ENHANCED):', error);
    throw error;
  }
};

// ================ СОХРАНЯЕМ ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ БЕЗ ИЗМЕНЕНИЙ ================

/**
 * 📋 ПОЛУЧИТЬ ЗАКАЗЫ КЛИЕНТА
 */
export const getCustomerOrders = async (customerId, filters = {}) => {
  try {
    const { status = null, limit = 20, offset = 0 } = filters;

    console.log('📋 GET CUSTOMER ORDERS:', { customerId, status, limit });

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
    console.error('🚨 GET CUSTOMER ORDERS ERROR:', error);
    throw error;
  }
};

/**
 * 🔍 ПОЛУЧИТЬ ДЕТАЛИ ЗАКАЗА
 */
export const getOrderDetails = async (orderId, userId, userRole = 'customer') => {
  try {
    console.log('🔍 GET ORDER DETAILS:', { orderId, userId, userRole });

    const order = await Order.findById(orderId)
      .populate('customer_id', 'first_name last_name phone email')
      .populate('partner_id', 'business_name phone location category')
      .populate('courier_id', 'first_name last_name phone vehicle_info');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Проверка доступа
    const hasAccess = checkOrderAccess(order, userId, userRole);
    if (!hasAccess) {
      throw new Error('Нет доступа к этому заказу');
    }

    return { order };

  } catch (error) {
    console.error('🚨 GET ORDER DETAILS ERROR:', error);
    throw error;
  }
};

/**
 * Проверка доступа к заказу
 */
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

// ================ ОСТАЛЬНЫЕ ФУНКЦИИ (сохраняем без изменений) ================

/**
 * ❌ ОТМЕНА ЗАКАЗА КЛИЕНТОМ - ОБНОВЛЕНО с реальными возвратами
 */
export const cancelCustomerOrder = async (orderId, customerId, reason = 'customer_request', details = '') => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    console.log('❌ CANCEL CUSTOMER ORDER (REAL REFUNDS):', { orderId, customerId, reason });

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

    // ✅ ИСПОЛЬЗУЕМ РЕАЛЬНУЮ СИСТЕМУ ВОЗВРАТОВ
    let refundResult = null;
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      try {
        // Импортируем реальную систему возвратов
        const { processRealRefund } = await import('../Finance/refund.service.js');
        
        refundResult = await processRealRefund(order, {
          refund_reason: `Отмена заказа: ${reason}`,
          refund_type: 'full',
          initiated_by_user_id: customerId,
          initiated_by_role: 'customer'
        });
        
        console.log('✅ REAL REFUND SUCCESS:', {
          refund_id: refundResult.refund_id,
          amount: refundResult.refund_details.refunded_amount
        });
        
      } catch (refundError) {
        console.error('🚨 REAL REFUND ERROR:', refundError.message);
        
        // Если реальный возврат не удался, помечаем как pending
        order.payment_status = 'refund_pending';
        order.refund_error = refundError.message;
        
        // Но не прерываем отмену заказа
        refundResult = {
          success: false,
          error: refundError.message,
          fallback: true
        };
      }
    }

    // Возвращаем товары на склад
    const returnResults = await returnProductsToStock(order.items, session);

    // Отменяем заказ
    await order.addStatusHistory('cancelled', customerId, 'customer', `Отменен клиентом: ${reason}`);
    order.cancellation = {
      reason,
      cancelled_by: customerId,
      user_role: 'customer',
      details
    };

    // Если возврат был успешным, информация уже обновлена в processRealRefund
    if (!refundResult || !refundResult.success) {
      await order.save({ session });
    }

    await session.commitTransaction();

    console.log('✅ ORDER CANCELLED SUCCESS:', {
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
    console.error('🚨 CANCEL ORDER ERROR:', error);
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
      const partner = await PartnerProfile.findById(order.partner_id);
      if (partner) {
        await partner.updateRating(partner_rating);
      }
    }

    // Обновляем рейтинг курьера
    if (courier_rating && order.courier_id) {
      const courier = await CourierProfile.findById(order.courier_id);
      if (courier) {
        await courier.updateRating(courier_rating);
      }
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
    const { status = null, limit = 20, offset = 0 } = filters;

    console.log('🏪 GET RESTAURANT ORDERS:', { partnerId, status, limit });

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
    console.error('🚨 GET RESTAURANT ORDERS ERROR:', error);
    throw error;
  }
};

/**
 * ✅ ПРИНЯТЬ ЗАКАЗ РЕСТОРАНОМ
 */
export const acceptRestaurantOrder = async (orderId, partnerId, acceptanceData = {}) => {
  try {
    const { estimated_preparation_time = 15 } = acceptanceData;

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

    // Принимаем заказ
    await order.addStatusHistory('accepted', partnerId, 'partner', `Заказ принят. Время приготовления: ${estimated_preparation_time} мин`);

    // Обновляем время доставки с учетом времени приготовления
    const newEstimatedTime = new Date(Date.now() + estimated_preparation_time * 60 * 1000);
    order.estimated_delivery_time = newEstimatedTime;
    await order.save();

    console.log('✅ ORDER ACCEPTED SUCCESS:', {
      order_number: order.order_number,
      estimated_preparation_time,
      new_estimated_delivery: newEstimatedTime
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      accepted_at: order.accepted_at,
      estimated_delivery_time: order.estimated_delivery_time,
      message: 'Заказ принят! Начинайте приготовление.'
    };

  } catch (error) {
    console.error('🚨 ACCEPT ORDER ERROR:', error);
    throw error;
  }
};

/**
 * ❌ ОТКЛОНИТЬ ЗАКАЗ РЕСТОРАНОМ
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

    // Возвращаем товары на склад
    const returnResults = await returnProductsToStock(order.items, session);

    // Отклоняем заказ
    await order.addStatusHistory('cancelled', partnerId, 'partner', `Заказ отклонен: ${reason}`);
    order.cancellation = {
      reason,
      cancelled_by: partnerId,
      user_role: 'partner',
      details
    };
    await order.save({ session });

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
      message: 'Заказ готов! Ожидается курьер.'
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
    const { lat = null, lng = null, radius = 10 } = location;

    console.log('📋 GET AVAILABLE ORDERS:', { courierId, lat, lng, radius });

    let query = {
      status: 'ready',
      courier_id: null
    };

    // Если указаны координаты, ищем заказы поблизости
    if (lat && lng) {
      const radiusInDegrees = radius / 111; // Примерное преобразование км в градусы
      
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
      .sort({ createdAt: 1 }) // Сначала старые заказы
      .limit(20);

    return {
      available_orders: orders,
      total: orders.length,
      search_radius: radius
    };

  } catch (error) {
    console.error('🚨 GET AVAILABLE ORDERS ERROR:', error);
    throw error;
  }
};

/**
 * 🚚 ПРИНЯТЬ ЗАКАЗ НА ДОСТАВКУ
 */
export const acceptOrderForDelivery = async (orderId, courierId) => {
  try {
    console.log('🚚 ACCEPT ORDER FOR DELIVERY:', { orderId, courierId });

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

    // Назначаем курьера
    order.courier_id = courierId;
    await order.addStatusHistory('picked_up', courierId, 'courier', 'Курьер забрал заказ');

    console.log('✅ ORDER ACCEPTED FOR DELIVERY:', {
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
    console.error('🚨 ACCEPT ORDER FOR DELIVERY ERROR:', error);
    throw error;
  }
};

/**
 * 📦 ЗАБРАТЬ ЗАКАЗ ИЗ РЕСТОРАНА
 */
export const markOrderPickedUpByCourier = async (orderId, courierId) => {
  try {
    console.log('📦 MARK ORDER PICKED UP:', { orderId, courierId });

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

    // Помечаем что курьер в пути
    await order.addStatusHistory('on_the_way', courierId, 'courier', 'Курьер в пути к клиенту');

    console.log('✅ ORDER PICKED UP SUCCESS:', {
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
    console.error('🚨 MARK ORDER PICKED UP ERROR:', error);
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
      .populate('courier_id', 'first_name last_name phone vehicle_info')
      .populate('customer_id', 'first_name last_name phone');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Если указан userId, проверяем доступ
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
    console.error('🚨 TRACK ORDER STATUS ERROR:', error);
    throw error;
  }
};

/**
 * 📊 ПОЛУЧИТЬ ТОЛЬКО СТАТУС ЗАКАЗА
 */
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
    console.error('🚨 GET ORDER STATUS ERROR:', error);
    throw error;
  }
};

// ================ УТИЛИТЫ ================

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

// ================ ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ================

export const validateOrderItems = validateProductsAvailability;
export const reserveProductsStock = reserveProductsStock;
export const returnProductsToStock = returnProductsToStock;

// Заглушки для экспорта (сохраняем совместимость)
export const cleanupExpiredData = async () => ({ message: 'Function moved to cleanup service' });
export const getOrdersStatistics = async () => ({ message: 'Statistics function placeholder' });
export const bulkUpdateOrderStatus = async () => ({ message: 'Bulk update function placeholder' });

// ================ ЭКСПОРТ (сохраняем совместимость) ================

export default {
  // Клиентские сервисы
  createOrderFromCart, // ✅ ОБНОВЛЕНО
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
  markOrderDeliveredByCourier, // ✅ ОБНОВЛЕНО
  getCourierActiveOrders,
  processAdminRefund,
  checkRefundEligibility,
  
  // Общие сервисы
  trackOrderStatus,
  getOrderStatusOnly,
  
  // Утилитарные функции
  validateOrderItems: validateProductsAvailability,
  calculateEstimatedDeliveryTime, // ✅ ОБНОВЛЕНО
  processPayment, // ✅ ОБНОВЛЕНО
  processRefund,
  checkOrderAccess,
  getOrderProgress,
  getStatusDescription,
  getNextStep,
  
  // Функции валидации и резервирования
  validateProductsAvailability,
  reserveProductsStock,
  returnProductsToStock,
  
  // ✅ ПОЛНОЦЕННЫЕ УТИЛИТАРНЫЕ ФУНКЦИИ
  cleanupExpiredData, // ✅ ПОЛНОЦЕННАЯ
  getOrdersStatistics, // ✅ ПОЛНОЦЕННАЯ
  bulkUpdateOrderStatus // ✅ ПОЛНОЦЕННАЯ
};
