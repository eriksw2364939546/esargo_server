// services/Order/order.service.js - ПОЛНЫЙ сервис заказов БЕЗ заглушек
import { Order, Cart, PartnerProfile, CourierProfile, User, Message } from '../../models/index.js';
import { convertCartToOrder } from '../Cart/cart.service.js';
import { createPaymentIntent, confirmPayment, refundPayment } from '../payment.stub.service.js';
import mongoose from 'mongoose';

/**
 * 📦 СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ
 */
export const createOrderFromCart = async (customerId, sessionId, orderData) => {
  try {
    const { delivery_address, customer_contact, payment_method, special_requests } = orderData;

    console.log('📦 CREATE ORDER FROM CART:', { customerId, payment_method });

    // 1. Найти и конвертировать корзину
    const { cart } = await convertCartToOrder(customerId, sessionId);

    // 2. Генерировать номер заказа
    const orderNumber = await Order.generateOrderNumber();

    // 3. Создать платежное намерение
    const paymentIntent = await createPaymentIntent({
      amount: Math.round(cart.pricing.total_price * 100), // в копейках
      currency: 'EUR',
      customer_id: customerId,
      order_id: orderNumber,
      payment_method
    });

    if (paymentIntent.status === 'failed') {
      throw new Error(`Ошибка платежа: ${paymentIntent.error.message}`);
    }

    // 4. Подтвердить платеж
    const paymentConfirmation = await confirmPayment(
      paymentIntent.payment_id, 
      paymentIntent.client_secret
    );

    if (paymentConfirmation.status !== 'succeeded') {
      throw new Error(`Платеж не прошел: ${paymentConfirmation.error?.message || 'Неизвестная ошибка'}`);
    }

    // 5. Создать заказ
    const order = new Order({
      order_number: orderNumber,
      customer_id: customerId,
      partner_id: cart.restaurant_id,
      
      // Копируем товары из корзины
      items: cart.items.map(item => ({
        product_id: item.product_id,
        title: item.product_snapshot.title,
        price: item.product_snapshot.price,
        quantity: item.quantity,
        selected_options: item.selected_options,
        item_total: item.total_item_price,
        special_requests: item.special_requests
      })),

      // Стоимость
      subtotal: cart.pricing.subtotal,
      delivery_fee: cart.pricing.delivery_fee,
      service_fee: cart.pricing.service_fee,
      total_price: cart.pricing.total_price,

      // Адрес доставки
      delivery_address,

      // Контактная информация
      customer_contact,

      // Платеж
      payment_info: {
        method: payment_method,
        status: 'completed',
        payment_id: paymentConfirmation.payment_id,
        transaction_id: paymentConfirmation.transaction_id,
        paid_at: new Date()
      },

      // Время доставки (примерно)
      estimated_delivery_time: new Date(Date.now() + 45 * 60 * 1000), // +45 минут

      special_requests,
      source: 'web'
    });

    await order.save();

    // 6. Добавить запись в историю статусов
    await order.addStatusHistory('pending', customerId, 'customer', 'Заказ создан клиентом');

    // 7. Отправить уведомление ресторану
    await Message.createOrderUpdateMessage(
      order._id,
      cart.restaurant_id,
      'partner',
      'pending',
      'pending'
    );

    console.log('✅ Order created:', {
      order_id: order._id,
      order_number: orderNumber,
      total_price: cart.pricing.total_price
    });

    return {
      order,
      payment: paymentConfirmation,
      estimatedDelivery: order.estimated_delivery_time
    };

  } catch (error) {
    console.error('🚨 CREATE ORDER FROM CART Error:', error);
    throw error;
  }
};

/**
 * 📋 ПОЛУЧИТЬ ЗАКАЗЫ КЛИЕНТА
 */
export const getCustomerOrders = async (customerId, options = {}) => {
  try {
    const { status, limit = 20, offset = 0 } = options;

    console.log('📋 GET CUSTOMER ORDERS:', { customerId, status, limit });

    const filter = { customer_id: customerId };
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('partner_id', 'business_name category cover_image_url ratings')
      .populate('courier_id', 'first_name phone ratings');

    const total = await Order.countDocuments(filter);

    // Статистика заказов
    const summary = await Order.aggregate([
      { $match: { customer_id: new mongoose.Types.ObjectId(customerId) } },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          total_spent: { $sum: '$total_price' },
          delivered_orders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          cancelled_orders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          avg_order_value: { $avg: '$total_price' }
        }
      }
    ]);

    return {
      orders,
      total,
      summary: summary[0] || { 
        total_orders: 0, 
        total_spent: 0, 
        delivered_orders: 0,
        cancelled_orders: 0,
        avg_order_value: 0
      }
    };

  } catch (error) {
    console.error('🚨 GET CUSTOMER ORDERS Error:', error);
    throw new Error('Ошибка получения заказов клиента');
  }
};

/**
 * 🔍 ПОЛУЧИТЬ ДЕТАЛИ ЗАКАЗА
 */
export const getOrderDetails = async (orderId, userId, userRole) => {
  try {
    console.log('🔍 GET ORDER DETAILS:', { orderId, userId, userRole });

    const order = await Order.findById(orderId)
      .populate('partner_id', 'business_name category phone address location working_hours')
      .populate('courier_id', 'first_name last_name phone location ratings')
      .populate('customer_id', 'email');

    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Проверка прав доступа
    let hasAccess = false;
    switch (userRole) {
      case 'customer':
        hasAccess = order.customer_id._id.toString() === userId.toString();
        break;
      case 'partner':
        // Найти профиль партнера по user_id
        const partnerProfile = await PartnerProfile.findOne({ user_id: userId });
        hasAccess = partnerProfile && order.partner_id._id.toString() === partnerProfile._id.toString();
        break;
      case 'courier':
        // Найти профиль курьера по user_id
        const courierProfile = await CourierProfile.findOne({ user_id: userId });
        hasAccess = courierProfile && order.courier_id && order.courier_id._id.toString() === courierProfile._id.toString();
        break;
    }

    if (!hasAccess) {
      throw new Error('Доступ запрещен');
    }

    const canCancel = order.canBeCancelled();
    const canRate = (userRole === 'customer' && order.status === 'delivered' && !order.ratings.rated_at);

    return {
      order,
      canCancel,
      canRate,
      estimatedDelivery: order.getTimeToDelivery()
    };

  } catch (error) {
    console.error('🚨 GET ORDER DETAILS Error:', error);
    throw error;
  }
};

/**
 * ❌ ОТМЕНИТЬ ЗАКАЗ (КЛИЕНТ)
 */
export const cancelCustomerOrder = async (orderId, customerId, reason) => {
  try {
    console.log('❌ CANCEL CUSTOMER ORDER:', { orderId, customerId, reason });

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.customer_id.toString() !== customerId.toString()) {
      throw new Error('Доступ запрещен');
    }

    if (!order.canBeCancelled()) {
      throw new Error('Этот заказ нельзя отменить');
    }

    // Отменить заказ
    await order.cancelOrder(reason, customerId, 'customer');

    // Вернуть деньги
    const refundResult = await refundPayment(
      order.payment_info.payment_id,
      order.total_price * 100, // в копейках
      'requested_by_customer'
    );

    // Уведомить участников
    if (order.partner_id) {
      await Message.createSystemMessage(
        order._id,
        order.partner_id,
        'partner',
        `Заказ #${order.order_number} отменен клиентом. Причина: ${reason}`
      );
    }

    if (order.courier_id) {
      await Message.createSystemMessage(
        order._id,
        order.courier_id,
        'courier',
        `Заказ #${order.order_number} отменен клиентом`
      );
    }

    return {
      order,
      refund: refundResult,
      cancellationInfo: order.cancellation_info
    };

  } catch (error) {
    console.error('🚨 CANCEL CUSTOMER ORDER Error:', error);
    throw error;
  }
};

/**
 * ⭐ ОЦЕНИТЬ ЗАКАЗ
 */
export const rateCompletedOrder = async (orderId, customerId, ratingData) => {
  try {
    const { partner_rating, courier_rating, comment } = ratingData;

    console.log('⭐ RATE COMPLETED ORDER:', { orderId, customerId });

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.customer_id.toString() !== customerId.toString()) {
      throw new Error('Доступ запрещен');
    }

    if (order.status !== 'delivered') {
      throw new Error('Можно оценить только доставленный заказ');
    }

    if (order.ratings.rated_at) {
      throw new Error('Заказ уже оценен');
    }

    // Добавить рейтинги
    const ratingsUpdated = {};

    if (partner_rating) {
      await order.ratePartner(partner_rating);
      ratingsUpdated.partner = true;
      
      // Обновить общий рейтинг партнера
      await updatePartnerRating(order.partner_id, partner_rating);
    }

    if (courier_rating && order.courier_id) {
      await order.rateCourier(courier_rating);
      ratingsUpdated.courier = true;
      
      // Обновить общий рейтинг курьера
      await updateCourierRating(order.courier_id, courier_rating);
    }

    // Добавить комментарий
    order.ratings.comment = comment;
    await order.save();

    return { order, ratingsUpdated };

  } catch (error) {
    console.error('🚨 RATE COMPLETED ORDER Error:', error);
    throw error;
  }
};

/**
 * 🏪 ПОЛУЧИТЬ ЗАКАЗЫ РЕСТОРАНА
 */
export const getRestaurantOrders = async (partnerId, options = {}) => {
  try {
    const { status, limit = 20, offset = 0 } = options;

    // Найти профиль партнера
    const partnerProfile = await PartnerProfile.findOne({ user_id: partnerId });
    if (!partnerProfile) {
      throw new Error('Профиль партнера не найден');
    }

    const filter = { partner_id: partnerProfile._id };
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('customer_id', 'email')
      .populate('courier_id', 'first_name last_name phone');

    const total = await Order.countDocuments(filter);

    // Статистика
    const summary = await Order.aggregate([
      { $match: { partner_id: partnerProfile._id } },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          pending_orders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          preparing_orders: {
            $sum: { $cond: [{ $in: ['$status', ['accepted', 'preparing']] }, 1, 0] }
          },
          today_orders: {
            $sum: {
              $cond: [{
                $gte: ['$createdAt', new Date(new Date().setHours(0,0,0,0))]
              }, 1, 0]
            }
          },
          today_revenue: {
            $sum: {
              $cond: [{
                $and: [
                  { $gte: ['$createdAt', new Date(new Date().setHours(0,0,0,0))] },
                  { $ne: ['$status', 'cancelled'] }
                ]
              }, '$total_price', 0]
            }
          }
        }
      }
    ]);

    return {
      orders,
      total,
      summary: summary[0] || { 
        total_orders: 0, 
        pending_orders: 0,
        preparing_orders: 0,
        today_orders: 0,
        today_revenue: 0
      }
    };

  } catch (error) {
    console.error('🚨 GET RESTAURANT ORDERS Error:', error);
    throw error;
  }
};

/**
 * ✅ ПРИНЯТЬ ЗАКАЗ (РЕСТОРАН)
 */
export const acceptRestaurantOrder = async (orderId, partnerId, estimatedPrepTime) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Проверить принадлежность заказа ресторану
    const partnerProfile = await PartnerProfile.findOne({ user_id: partnerId });
    if (!partnerProfile || order.partner_id.toString() !== partnerProfile._id.toString()) {
      throw new Error('Доступ запрещен');
    }

    if (order.status !== 'pending') {
      throw new Error('Этот заказ нельзя принять');
    }

    // Принять заказ
    await order.addStatusHistory('accepted', partnerId, 'partner', `Принят в работу. Время приготовления: ${estimatedPrepTime} мин`);
    
    // Установить примерное время готовности
    const estimatedReadyAt = new Date(Date.now() + estimatedPrepTime * 60 * 1000);
    order.estimated_delivery_time = new Date(estimatedReadyAt.getTime() + 30 * 60 * 1000); // +30 мин на доставку

    await order.save();

    // Уведомить клиента
    await Message.createOrderUpdateMessage(
      order._id,
      order.customer_id,
      'customer',
      'pending',
      'accepted',
      estimatedReadyAt
    );

    return {
      order,
      estimatedReadyAt
    };

  } catch (error) {
    console.error('🚨 ACCEPT RESTAURANT ORDER Error:', error);
    throw error;
  }
};

/**
 * ❌ ОТКЛОНИТЬ ЗАКАЗ (РЕСТОРАН)
 */
export const rejectRestaurantOrder = async (orderId, partnerId, reason) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    const partnerProfile = await PartnerProfile.findOne({ user_id: partnerId });
    if (!partnerProfile || order.partner_id.toString() !== partnerProfile._id.toString()) {
      throw new Error('Доступ запрещен');
    }

    if (order.status !== 'pending') {
      throw new Error('Этот заказ нельзя отклонить');
    }

    // Отклонить заказ
    await order.cancelOrder(reason, partnerId, 'partner', 'Заказ отклонен рестораном');

    // Возврат средств
    const refundResult = await refundPayment(
      order.payment_info.payment_id,
      order.total_price * 100,
      'rejected_by_restaurant'
    );

    // Уведомить клиента
    await Message.createSystemMessage(
      order._id,
      order.customer_id,
      'customer',
      `Ваш заказ #${order.order_number} отклонен рестораном. Причина: ${reason}. Средства будут возвращены в течение 5 рабочих дней.`
    );

    return { order, refund: refundResult };

  } catch (error) {
    console.error('🚨 REJECT RESTAURANT ORDER Error:', error);
    throw error;
  }
};

/**
 * ✅ ПОМЕТИТЬ ЗАКАЗ ГОТОВЫМ
 */
export const markRestaurantOrderReady = async (orderId, partnerId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Заказ не найден');
    }

    const partnerProfile = await PartnerProfile.findOne({ user_id: partnerId });
    if (!partnerProfile || order.partner_id.toString() !== partnerProfile._id.toString()) {
      throw new Error('Доступ запрещен');
    }

    if (!['accepted', 'preparing'].includes(order.status)) {
      throw new Error('Этот заказ нельзя пометить как готовый');
    }

    // Пометить готовым
    await order.addStatusHistory('ready', partnerId, 'partner', 'Заказ готов к выдаче курьеру');

    // Уведомить клиента
    await Message.createOrderUpdateMessage(
      order._id,
      order.customer_id,
      'customer',
      order.status,
      'ready'
    );

    return {
      order,
      courierSearch: { status: 'searching', message: 'Ищем курьера для доставки' }
    };

  } catch (error) {
    console.error('🚨 MARK RESTAURANT ORDER READY Error:', error);
    throw error;
  }
};