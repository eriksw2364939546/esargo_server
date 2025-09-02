d.toString())
      )
      .map(cartItem => {
        const product = availableProducts.find(p => p._id.toString() === cartItem.product_id.toString());
        return {
          product_id: cartItem.product_id,
          title: product.title,
          price: cartItem.product_snapshot.price,
          quantity: cartItem.quantity,
          selected_options: cartItem.selected_options || [],
          item_total: cartItem.quantity * cartItem.product_snapshot.price,
          special_requests: cartItem.special_requests || ''
        };
      });

    // НОВОЕ: Пересчет стоимости если товары были исключены
    let adjustedSubtotal = cart.pricing.subtotal;
    let adjustedServiceFee = cart.pricing.service_fee;
    let adjustedTotalPrice = cart.pricing.total_price;

    if (unavailableItems.length > 0) {
      adjustedSubtotal = orderItems.reduce((sum, item) => sum + item.item_total, 0);
      adjustedServiceFee = Math.round(adjustedSubtotal * 0.02 * 100) / 100;
      adjustedTotalPrice = adjustedSubtotal + cart.pricing.delivery_fee + adjustedServiceFee;
    }

    const newOrder = new Order({
      order_number: orderNumber,
      customer_id: customerId,
      partner_id: cart.restaurant_id,
      
      // Товары заказа
      items: orderItems,
      
      // НОВЫЕ ПОЛЯ: Снимки и валидация
      items_snapshot: itemsSnapshot,
      availability_validation: {
        validated_at: new Date(),
        unavailable_items: unavailableItems,
        validation_status: unavailableItems.length === 0 ? 'valid' : 'has_issues'
      },
      
      // Стоимость (пересчитанная при необходимости)
      subtotal: adjustedSubtotal,
      delivery_fee: cart.pricing.delivery_fee,
      service_fee: adjustedServiceFee,
      discount_amount: cart.pricing.discount_amount || 0,
      tax_amount: cart.pricing.tax_amount || 0,
      total_price: adjustedTotalPrice,
      
      // Адрес и контакты
      delivery_address,
      customer_contact,
      
      // Статус и время
      status: 'pending',
      estimated_delivery_time: estimatedDeliveryTime,
      
      // Платеж
      payment_method,
      payment_status: payment_method === 'cash' ? 'pending' : 'processing',
      
      // Дополнительная информация
      special_requests,
      source: 'web',
      user_agent: 'ESARGO Web App',
      
      // История статусов
      status_history: [{
        status: 'pending',
        timestamp: new Date(),
        updated_by: customerId,
        user_role: 'customer',
        notes: 'Заказ создан клиентом'
      }]
    });

    await newOrder.save({ session });

    // 8. Обработать платеж
    let paymentResult;
    if (payment_method === 'card') {
      paymentResult = await processPayment(newOrder, { session });
      newOrder.payment_status = paymentResult.success ? 'completed' : 'failed';
      newOrder.payment_details = paymentResult.details;
      await newOrder.save({ session });
    } else {
      paymentResult = {
        success: true,
        method: 'cash',
        message: 'Оплата при получении'
      };
    }

    // НОВОЕ: Резервируем товары на складе для магазинов
    for (const product of availableProducts) {
      if (product.category === 'store' && product.stock_quantity !== undefined) {
        const orderItem = orderItems.find(item => item.product_id.toString() === product._id.toString());
        if (orderItem) {
          await Product.findByIdAndUpdate(
            product._id,
            { $inc: { stock_quantity: -orderItem.quantity } },
            { session }
          );
        }
      }
    }

    // 9. Конвертировать корзину в заказ
    await cart.convertToOrder();
    await cart.save({ session });

    // 10. Обновить статистику ресторана
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
      unavailable_items_count: unavailableItems.length
    });

    // НОВОЕ: Формируем ответ с предупреждениями о недоступных товарах
    const response = {
      order: newOrder,
      payment: paymentResult,
      estimatedDelivery: estimatedDeliveryTime
    };

    if (unavailableItems.length > 0) {
      response.warnings = {
        message: `${unavailableItems.length} товар(ов) были исключены из заказа`,
        unavailable_items: unavailableItems.map(item => ({
          title: item.title,
          reason: getReasonText(item.reason)
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
 * ПОЛУЧИТЬ ЗАКАЗЫ КЛИЕНТА
 */
export const getCustomerOrders = async (customerId, filters = {}) => {
  try {
    const {
      status,
      limit = 20,
      offset = 0
    } = filters;

    console.log('📋 GET CUSTOMER ORDERS:', {
      customerId,
      status,
      limit,
      offset
    });

    const query = { customer_id: customerId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('partner_id', 'business_name brand_name category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Order.countDocuments(query);

    // Статистика по статусам
    const statusStats = await Order.aggregate([
      { $match: { customer_id: new mongoose.Types.ObjectId(customerId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = {
      total_orders: total,
      by_status: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };

    return {
      orders,
      total,
      summary
    };

  } catch (error) {
    console.error('🚨 GET CUSTOMER ORDERS ERROR:', error);
    throw error;
  }
};

/**
 * ПОЛУЧИТЬ ДЕТАЛИ ЗАКАЗА
 */
export const getOrderDetails = async (orderId, userId, userRole) => {
  try {
    console.log('🔍 GET ORDER DETAILS:', { orderId, userId, userRole });

    const order = await Order.findById(orderId)
      .populate('customer_id', 'email')
      .populate('partner_id', 'business_name brand_name phone email')
      .populate('courier_id', 'user_id');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Проверка прав доступа
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

    // НОВОЕ: Проверяем актуальность товаров если заказ еще не принят
    if (order.status === 'pending') {
      await order.validateItemsAvailability();
    }

    const canCancel = ['pending', 'accepted'].includes(order.status);
    const canRate = order.status === 'delivered' && !order.ratings?.partner_rating;

    return {
      order,
      canCancel,
      canRate,
      estimatedDelivery: order.estimated_delivery_time
    };

  } catch (error) {
    console.error('🚨 GET ORDER DETAILS ERROR:', error);
    throw error;
  }
};

/**
 * ОТМЕНИТЬ ЗАКАЗ КЛИЕНТОМ
 */
export const cancelCustomerOrder = async (orderId, customerId, cancellationData) => {
  try {
    const { reason = 'Отмена клиентом', details = '' } = cancellationData;

    console.log('❌ CANCEL CUSTOMER ORDER:', { orderId, customerId, reason });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.customer_id.toString() !== customerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (!['pending', 'accepted'].includes(order.status)) {
      throw new Error('Заказ нельзя отменить - он уже готовится или доставляется');
    }

    // Отменяем заказ
    await order.cancelOrder(reason, customerId, 'customer', details);

    // НОВОЕ: Возвращаем товары на склад при отмене
    for (const item of order.items) {
      const product = await Product.findById(item.product_id);
      if (product && product.category === 'store' && product.stock_quantity !== undefined) {
        await Product.findByIdAndUpdate(
          item.product_id,
          { $inc: { stock_quantity: item.quantity } }
        );
      }
    }

    // Возвращаем средства если заказ был оплачен
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      order.payment_status = 'refunded';
      await order.save();
    }

    console.log('✅ ORDER CANCELLED SUCCESS:', {
      order_number: order.order_number,
      reason
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      cancelled_at: order.cancelled_at,
      message: 'Заказ отменен успешно',
      refund_info: order.payment_method === 'card' ? 
        'Возврат будет обработан в течение 3-5 рабочих дней' : null
    };

  } catch (error) {
    console.error('🚨 CANCEL ORDER ERROR:', error);
    throw error;
  }
};

/**
 * ОЦЕНИТЬ ЗАКАЗ
 */
export const rateCompletedOrder = async (orderId, customerId, ratingData) => {
  try {
    const {
      partner_rating,
      courier_rating,
      comment = ''
    } = ratingData;

    console.log('⭐ RATE ORDER:', {
      orderId,
      customerId,
      partner_rating,
      courier_rating
    });

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

    if (order.ratings.partner_rating) {
      throw new Error('Заказ уже был оценен');
    }

    // Валидация рейтингов
    if (partner_rating && (partner_rating < 1 || partner_rating > 5)) {
      throw new Error('Рейтинг ресторана должен быть от 1 до 5');
    }

    if (courier_rating && (courier_rating < 1 || courier_rating > 5)) {
      throw new Error('Рейтинг курьера должен быть от 1 до 5');
    }

    // Обновляем рейтинги в заказе
    order.ratings = {
      partner_rating: partner_rating || null,
      courier_rating: courier_rating || null,
      comment: comment.trim(),
      rated_at: new Date()
    };

    await order.save();

    // Обновляем рейтинг ресторана
    if (partner_rating) {
      await updatePartnerRating(order.partner_id, partner_rating);
    }

    // Обновляем рейтинг курьера
    if (courier_rating && order.courier_id) {
      await updateCourierRating(order.courier_id, courier_rating);
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
      message: 'Спасибо за оценку! Ваше мнение поможет нам стать лучше.'
    };

  } catch (error) {
    console.error('🚨 RATE ORDER ERROR:', error);
    throw error;
  }
};

// ================ ПАРТНЕРСКИЕ СЕРВИСЫ ================

/**
 * ПОЛУЧИТЬ ЗАКАЗЫ РЕСТОРАНА
 */
export const getRestaurantOrders = async (partnerId, filters = {}) => {
  try {
    const {
      status,
      limit = 20,
      offset = 0
    } = filters;

    console.log('🏪 GET RESTAURANT ORDERS:', {
      partnerId,
      status,
      limit,
      offset
    });

    const query = { partner_id: partnerId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('customer_id', 'email')
      .populate('courier_id', 'user_id')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Order.countDocuments(query);

    return {
      orders,
      total
    };

  } catch (error) {
    console.error('🚨 GET RESTAURANT ORDERS ERROR:', error);
    throw error;
  }
};

/**
 * ПРИНЯТЬ ЗАКАЗ РЕСТОРАНОМ
 */
export const acceptRestaurantOrder = async (orderId, partnerId, acceptanceData) => {
  try {
    const { estimated_preparation_time = 30 } = acceptanceData;

    console.log('✅ ACCEPT RESTAURANT ORDER:', {
      orderId,
      partnerId,
      estimated_preparation_time
    });

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
    await order.addStatusHistory('accepted', partnerId, 'partner', 
      `Заказ принят. Время приготовления: ${estimated_preparation_time} минут`);

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
 * ОТКЛОНИТЬ ЗАКАЗ РЕСТОРАНОМ
 */
export const rejectRestaurantOrder = async (orderId, partnerId, rejectionData) => {
  try {
    const { reason, details = '' } = rejectionData;

    console.log('❌ REJECT RESTAURANT ORDER:', {
      orderId,
      partnerId,
      reason
    });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.partner_id.toString() !== partnerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'pending') {
      throw new Error('Заказ нельзя отклонить - неверный статус');
    }

    // Отклоняем заказ
    await order.cancelOrder(reason, partnerId, 'partner', details);

    // НОВОЕ: Возвращаем товары на склад
    for (const item of order.items) {
      const product = await Product.findById(item.product_id);
      if (product && product.category === 'store' && product.stock_quantity !== undefined) {
        await Product.findByIdAndUpdate(
          item.product_id,
          { $inc: { stock_quantity: item.quantity } }
        );
      }
    }

    // Возвращаем средства клиенту если заказ был оплачен
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      order.payment_status = 'refunded';
      await order.save();
    }

    console.log('✅ ORDER REJECTED SUCCESS:', {
      order_number: order.order_number,
      reason
    });

    return {
      order_id: order._id,
      order_number: order.order_number,
      status: order.status,
      cancelled_at: order.cancelled_at,
      message: 'Заказ отклонен. Клиент получит уведомление.'
    };

  } catch (error) {
    console.error('🚨 REJECT ORDER ERROR:', error);
    throw error;
  }
};

/**
 * ЗАКАЗ ГОТОВ К ВЫДАЧЕ
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

    if (!['accepted', 'preparing'].includes(order.status)) {
      throw new Error('Заказ нельзя пометить готовым - неверный статус');
    }

    // Обновляем статус на готов
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
      message: 'Заказ готов! Ищем курьера для доставки.'
    };

  } catch (error) {
    console.error('🚨 MARK ORDER READY ERROR:', error);
    throw error;
  }
};

// ================ КУРЬЕРСКИЕ СЕРВИСЫ ================

/**
 * ПОЛУЧИТЬ ДОСТУПНЫЕ ЗАКАЗЫ ДЛЯ КУРЬЕРА
 */
export const getAvailableOrdersForCourier = async (courierId, location = {}) => {
  try {
    const { lat = null, lng = null, radius = 10 } = location;

    console.log('🚴 GET AVAILABLE ORDERS FOR COURIER:', {
      courierId,
      has_location: !!(lat && lng),
      radius
    });

    let orders;
    if (lat && lng) {
      orders = await Order.findAvailableOrders(lat, lng, radius);
    } else {
      orders = await Order.find({
        status: 'ready',
        courier_id: null
      }).sort({ createdAt: 1 }).limit(50);
    }

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const restaurant = await PartnerProfile.findById(order.partner_id).select('business_name location');
        
        let distanceToRestaurant = null;
        let distanceToCustomer = null;
        
        if (lat && lng) {
          if (restaurant.location?.coordinates) {
            distanceToRestaurant = calculateDistance(
              lat, lng,
              restaurant.location.coordinates[1],
              restaurant.location.coordinates[0]
            );
          }
          
          distanceToCustomer = calculateDistance(
            lat, lng,
            order.delivery_address.lat,
            order.delivery_address.lng
          );
        }

        return {
          order_id: order._id,
          order_number: order.order_number,
          total_price: order.total_price,
          created_at: order.createdAt,
          estimated_delivery_time: order.estimated_delivery_time,
          
          restaurant: {
            name: restaurant.business_name,
            distance: distanceToRestaurant ? `${distanceToRestaurant.toFixed(1)} км` : null
          },
          
          delivery_address: {
            address: order.delivery_address.address,
            apartment: order.delivery_address.apartment,
            distance: distanceToCustomer ? `${distanceToCustomer.toFixed(1)} км` : null
          },
          
          customer_contact: {
            name: order.customer_contact.name,
            phone: order.customer_contact.phone
          },
          
          payment_method: order.payment_method,
          special_requests: order.special_requests,
          
          // Приблизительный доход курьера
          estimated_earnings: calculateCourierEarnings(order.delivery_fee, distanceToCustomer)
        };
      })
    );

    console.log('✅ GET AVAILABLE ORDERS SUCCESS:', {
      orders_found: enrichedOrders.length,
      with_geolocation: !!(lat && lng)
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
 * ВЗЯТЬ ЗАКАЗ НА ДОСТАВКУ
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
      message: 'Заказ взят на доставку. Направляйтесь в ресторан.'
    };

  } catch (error) {
    console.error('🚨 ACCEPT ORDER FOR DELIVERY ERROR:', error);
    throw error;
  }
};

/**
 * ЗАБРАТЬ ЗАКАЗ У РЕСТОРАНА
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
      message: 'Заказ забран! Направляйтесь к клиенту.'
    };

  } catch (error) {
    console.error('🚨 MARK ORDER PICKED UP ERROR:', error);
    throw error;
  }
};

/**
 * ДОСТАВИТЬ ЗАКАЗ КЛИЕНТУ
 */
export const markOrderDeliveredByCourier = async (orderId, courierId, deliveryData) => {
  try {
    const { delivery_notes = '' } = deliveryData;

    console.log('🏠 MARK ORDER DELIVERED:', { orderId, courierId });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.courier_id.toString() !== courierId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (order.status !== 'on_the_way') {
      throw new Error('Заказ нельзя доставить - неверный статус');
    }

    // Отмечаем как доставленный
    await order.addStatusHistory('delivered', courierId, 'courier', 
      delivery_notes ? `Заказ доставлен. Примечания: ${delivery_notes}` : 'Заказ доставлен');

    // Обновляем статистику курьера
    await CourierProfile.findOneAndUpdate(
      { user_id: courierId },
      { 
        $inc: { 
          'delivery_stats.completed_deliveries': 1,
          'delivery_stats.total_earnings': calculateCourierEarnings(order.delivery_fee)
        }
      }
    );

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
      message: 'Заказ успешно доставлен! Спасибо за работу.'
    };

  } catch (error) {
    console.error('🚨 MARK ORDER DELIVERED ERROR:', error);
    throw error;
  }
};

/**
 * ПОЛУЧИТЬ АКТИВНЫЕ ЗАКАЗЫ КУРЬЕРА
 */
export const getCourierActiveOrders = async (courierId) => {
  try {
    console.log('🚴 GET COURIER ACTIVE ORDERS:', { courierId });

    const orders = await Order.find({
      courier_id: courierId,
      status: { $in: ['picked_up', 'on_the_way'] }
    })
    .populate('partner_id', 'business_name phone')
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
 * ОТСЛЕЖИВАНИЕ ЗАКАЗА
 */
export const trackOrderStatus = async (orderId, userId = null)// services/Order/order.service.js - ПОЛНЫЙ сервис заказов с добавлением валидации доступности товаров
import { Order, Cart, User, PartnerProfile, CourierProfile, Product } from '../../models/index.js';
import mongoose from 'mongoose';

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * НОВАЯ ФУНКЦИЯ: Получение текстового описания причины недоступности
 */
function getReasonText(reason) {
  const reasons = {
    'product_deactivated': 'товар снят с продажи',
    'out_of_stock': 'закончился на складе',
    'time_restricted': 'недоступен в данное время',
    'partner_unavailable': 'ресторан недоступен'
  };
  return reasons[reason] || 'неизвестная причина';
}

function calculateEstimatedDeliveryTime(delivery_address, restaurant_location, restaurant_delivery_info) {
  // Базовое время доставки
  let baseTime = 30; // минут
  
  if (restaurant_delivery_info && restaurant_delivery_info.base_delivery_time) {
    baseTime = restaurant_delivery_info.base_delivery_time;
  }
  
  // Добавляем время в зависимости от расстояния (примерно)
  const distance = calculateDistance(
    restaurant_location?.coordinates?.[1] || 48.8566,
    restaurant_location?.coordinates?.[0] || 2.3522,
    delivery_address.lat,
    delivery_address.lng
  );
  
  const additionalTime = Math.round(distance * 2); // 2 минуты на км
  const totalTime = baseTime + additionalTime;
  
  return new Date(Date.now() + totalTime * 60 * 1000);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

function processPayment(order, options = {}) {
  // Заглушка для обработки платежа
  return {
    success: true,
    details: {
      transaction_id: `tx_${Date.now()}`,
      payment_processor: 'stripe',
      gateway_response: { status: 'approved' }
    }
  };
}

function calculateCourierEarnings(deliveryFee, distance) {
  // Примерный расчет заработка курьера
  const basePay = deliveryFee * 0.8; // 80% от стоимости доставки
  const distanceBonus = distance > 5 ? (distance - 5) * 0.5 : 0;
  return Math.round((basePay + distanceBonus) * 100) / 100;
}

// ================ КЛИЕНТСКИЕ СЕРВИСЫ ================

/**
 * СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ - ОБНОВЛЕННАЯ ФУНКЦИЯ с валидацией доступности
 */
export const createOrderFromCart = async (customerId, sessionId, orderData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const {
      delivery_address,
      customer_contact,
      payment_method,
      special_requests
    } = orderData;

    console.log('📦 CREATE ORDER FROM CART:', {
      customerId,
      sessionId,
      payment_method,
      has_address: !!delivery_address
    });

    // 1. Найти активную корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);

    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    if (cart.items.length === 0) {
      throw new Error('Корзина пуста');
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

    // 4. НОВАЯ РАСШИРЕННАЯ ПРОВЕРКА ДОСТУПНОСТИ ТОВАРОВ
    const productIds = cart.items.map(item => item.product_id);
    const products = await Product.find({
      _id: { $in: productIds }
    }).session(session);

    const unavailableItems = [];
    const availableProducts = [];
    const itemsSnapshot = []; // НОВОЕ: снимок товаров на момент заказа

    for (const cartItem of cart.items) {
      const product = products.find(p => p._id.toString() === cartItem.product_id.toString());
      
      if (!product) {
        unavailableItems.push({
          product_id: cartItem.product_id,
          title: cartItem.product_snapshot.title,
          reason: 'product_deactivated'
        });
        continue;
      }

      // НОВОЕ: Создаем снимок состояния товара
      itemsSnapshot.push({
        product_id: product._id,
        availability_at_order: {
          is_active: product.is_active,
          is_available: product.is_available,
          stock_quantity: product.stock_quantity,
          availability_schedule: product.availability_schedule
        }
      });

      // Проверка базовой доступности
      if (!product.is_active || !product.is_available) {
        unavailableItems.push({
          product_id: product._id,
          title: product.title,
          reason: 'product_deactivated'
        });
        continue;
      }

      // НОВОЕ: Проверка складских остатков для магазинов
      if (product.category === 'store' && product.stock_quantity !== undefined) {
        if (product.stock_quantity < cartItem.quantity) {
          unavailableItems.push({
            product_id: product._id,
            title: product.title,
            reason: 'out_of_stock'
          });
          continue;
        }
      }

      // НОВОЕ: Проверка временной доступности
      if (product.isAvailableNow && !product.isAvailableNow()) {
        unavailableItems.push({
          product_id: product._id,
          title: product.title,
          reason: 'time_restricted'
        });
        continue;
      }

      availableProducts.push(product);
    }

    // НОВАЯ ЛОГИКА: Обработка недоступных товаров
    if (unavailableItems.length > 0) {
      const criticalIssues = unavailableItems.length === cart.items.length;
      
      if (criticalIssues) {
        // Все товары недоступны - отменяем создание заказа
        throw new Error(
          `Все товары в корзине недоступны:\n${unavailableItems.map(item => 
            `• "${item.title}" - ${getReasonText(item.reason)}`
          ).join('\n')}`
        );
      } else {
        // Частично недоступны - продолжаем с доступными товарами
        console.warn('⚠️ PARTIAL AVAILABILITY ISSUES:', unavailableItems);
      }
    }

    // 5. Генерировать уникальный номер заказа
    const orderNumber = await Order.generateOrderNumber();

    // 6. Расчет времени доставки
    const estimatedDeliveryTime = calculateEstimatedDeliveryTime(
      delivery_address,
      restaurant.location,
      restaurant.delivery_info
    );

    // 7. Создать заказ только с доступными товарами
    const orderItems = cart.items
      .filter(cartItem => 
        availableProducts.some(p => p._id.toString() === cartItem.product_i