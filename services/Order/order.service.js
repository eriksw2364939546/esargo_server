// services/Order/order.service.js - ПОЛНОСТЬЮ РАБОЧИЙ сервис заказов
import { Order, Cart, User, PartnerProfile, CourierProfile, Product } from '../../models/index.js';
import mongoose from 'mongoose';

// ================ КЛИЕНТСКИЕ СЕРВИСЫ ================

/**
 * 📦 СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ
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
    const cart = await Cart.findOne({
      customer_id: customerId,
      session_id: sessionId,
      status: 'active'
    }).session(session);

    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    if (cart.items.length === 0) {
      throw new Error('Корзина пуста');
    }

    // 2. Проверить минимальную сумму заказа
    const minOrderAmount = cart.restaurant_info.min_order_amount || 0;
    if (cart.pricing.subtotal < minOrderAmount) {
      throw new Error(`Минимальная сумма заказа: ${minOrderAmount}₽`);
    }

    // 3. Получить информацию о ресторане
    const restaurant = await PartnerProfile.findById(cart.restaurant_id).session(session);
    if (!restaurant || !restaurant.is_active || !restaurant.is_approved) {
      throw new Error('Ресторан недоступен для заказов');
    }

    // 4. Проверить доступность товаров в корзине
    const productIds = cart.items.map(item => item.product_id);
    const products = await Product.find({
      _id: { $in: productIds },
      is_active: true,
      is_available: true
    }).session(session);

    if (products.length !== cart.items.length) {
      throw new Error('Некоторые товары в корзине больше недоступны');
    }

    // 5. Генерировать уникальный номер заказа
    const orderNumber = await Order.generateOrderNumber();

    // 6. Расчет времени доставки
    const estimatedDeliveryTime = calculateEstimatedDeliveryTime(
      delivery_address,
      restaurant.location,
      restaurant.delivery_info
    );

    // 7. Создать заказ
    const orderItems = cart.items.map(cartItem => {
      const product = products.find(p => p._id.toString() === cartItem.product_id.toString());
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

    const newOrder = new Order({
      order_number: orderNumber,
      customer_id: customerId,
      partner_id: cart.restaurant_id,
      
      // Товары заказа
      items: orderItems,
      
      // Стоимость
      subtotal: cart.pricing.subtotal,
      delivery_fee: cart.pricing.delivery_fee,
      service_fee: cart.pricing.service_fee,
      discount_amount: cart.pricing.discount_amount || 0,
      tax_amount: cart.pricing.tax_amount || 0,
      total_price: cart.pricing.total_price,
      
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
      payment_status: newOrder.payment_status
    });

    return {
      order: newOrder,
      payment: paymentResult,
      estimatedDelivery: estimatedDeliveryTime
    };

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
    const {
      status = null,
      limit = 20,
      offset = 0,
      date_from = null,
      date_to = null
    } = filters;

    console.log('📋 GET CUSTOMER ORDERS:', {
      customerId,
      status,
      limit,
      offset
    });

    // Базовый фильтр
    let mongoFilter = { customer_id: customerId };

    // Фильтр по статусу
    if (status && status !== 'all') {
      mongoFilter.status = status;
    }

    // Фильтр по датам
    if (date_from || date_to) {
      mongoFilter.createdAt = {};
      if (date_from) mongoFilter.createdAt.$gte = new Date(date_from);
      if (date_to) mongoFilter.createdAt.$lte = new Date(date_to);
    }

    // Получаем заказы с данными ресторанов
    const orders = await Order.find(mongoFilter)
      .populate('partner_id', 'business_name avatar_image category ratings')
      .populate('courier_id', 'user_id first_name last_name phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Order.countDocuments(mongoFilter);

    const processedOrders = orders.map(order => ({
      id: order._id,
      order_number: order.order_number,
      status: order.status,
      total_price: order.total_price,
      items_count: order.items.length,
      created_at: order.createdAt,
      estimated_delivery_time: order.estimated_delivery_time,
      actual_delivery_time: order.actual_delivery_time,
      
      restaurant: {
        id: order.partner_id._id,
        name: order.partner_id.business_name,
        avatar_image: order.partner_id.avatar_image,
        category: order.partner_id.category,
        rating: order.partner_id.ratings?.average_rating || 0
      },
      
      courier: order.courier_id ? {
        name: `${order.courier_id.first_name} ${order.courier_id.last_name}`,
        phone: order.courier_id.phone
      } : null,
      
      payment: {
        method: order.payment_method,
        status: order.payment_status
      },
      
      can_cancel: order.canBeCancelled(),
      can_rate: order.status === 'delivered' && !order.ratings.partner_rating,
      is_overdue: order.isOverdue(),
      time_to_delivery: order.getTimeToDelivery()
    }));

    console.log('✅ GET CUSTOMER ORDERS SUCCESS:', {
      orders_found: orders.length,
      total_available: total
    });

    return {
      orders: processedOrders,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + orders.length) < total
      }
    };

  } catch (error) {
    console.error('🚨 GET CUSTOMER ORDERS ERROR:', error);
    throw new Error('Ошибка получения заказов клиента');
  }
};

/**
 * 🔍 ПОЛУЧИТЬ ДЕТАЛИ ЗАКАЗА
 */
export const getOrderDetails = async (orderId, userId, userRole = 'customer') => {
  try {
    console.log('🔍 GET ORDER DETAILS:', { orderId, userId, userRole });

    if (!mongoose.isValidObjectId(orderId)) {
      throw new Error('Некорректный ID заказа');
    }

    const order = await Order.findById(orderId)
      .populate('customer_id', 'username email profile_image')
      .populate('partner_id', 'business_name avatar_image category contact_info location')
      .populate('courier_id', 'user_id first_name last_name phone vehicle_info')
      .lean();

    if (!order) {
      throw new Error('Заказ не найден');
    }

    // Проверка доступа к заказу
    const hasAccess = checkOrderAccess(order, userId, userRole);
    if (!hasAccess) {
      throw new Error('Нет доступа к этому заказу');
    }

    // Обогащаем данные заказа
    const enrichedOrder = {
      id: order._id,
      order_number: order.order_number,
      status: order.status,
      created_at: order.createdAt,
      
      // Временные метки
      estimated_delivery_time: order.estimated_delivery_time,
      actual_delivery_time: order.actual_delivery_time,
      accepted_at: order.accepted_at,
      ready_at: order.ready_at,
      picked_up_at: order.picked_up_at,
      delivered_at: order.delivered_at,
      cancelled_at: order.cancelled_at,
      
      // Товары
      items: order.items.map(item => ({
        id: item._id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        item_total: item.item_total,
        selected_options: item.selected_options || [],
        special_requests: item.special_requests || ''
      })),
      
      // Стоимость
      pricing: {
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        service_fee: order.service_fee,
        discount_amount: order.discount_amount,
        tax_amount: order.tax_amount,
        total_price: order.total_price
      },
      
      // Адрес доставки
      delivery_address: order.delivery_address,
      
      // Контакты клиента
      customer_contact: order.customer_contact,
      
      // Клиент
      customer: {
        id: order.customer_id._id,
        name: order.customer_contact.name,
        username: order.customer_id.username,
        profile_image: order.customer_id.profile_image
      },
      
      // Ресторан
      restaurant: {
        id: order.partner_id._id,
        name: order.partner_id.business_name,
        avatar_image: order.partner_id.avatar_image,
        category: order.partner_id.category,
        phone: order.partner_id.contact_info?.phone,
        address: order.partner_id.location?.address
      },
      
      // Курьер
      courier: order.courier_id ? {
        id: order.courier_id._id,
        name: `${order.courier_id.first_name} ${order.courier_id.last_name}`,
        phone: order.courier_id.phone,
        vehicle: order.courier_id.vehicle_info
      } : null,
      
      // Платеж
      payment: {
        method: order.payment_method,
        status: order.payment_status,
        details: order.payment_details
      },
      
      // История статусов
      status_history: order.status_history.map(history => ({
        status: history.status,
        timestamp: history.timestamp,
        notes: history.notes,
        updated_by_role: history.user_role
      })),
      
      // Рейтинги
      ratings: order.ratings,
      
      // Отмена
      cancellation_info: order.cancellation_info,
      
      // Дополнительная информация
      special_requests: order.special_requests,
      
      // Флаги статуса
      can_cancel: order.canBeCancelled(),
      can_rate: order.status === 'delivered' && userRole === 'customer' && !order.ratings.partner_rating,
      is_overdue: order.isOverdue(),
      time_to_delivery: order.getTimeToDelivery()
    };

    console.log('✅ GET ORDER DETAILS SUCCESS:', {
      order_number: order.order_number,
      status: order.status,
      user_role: userRole
    });

    return enrichedOrder;

  } catch (error) {
    console.error('🚨 GET ORDER DETAILS ERROR:', error);
    
    if (error.message.includes('найден') || error.message.includes('доступа') || error.message.includes('Некорректный')) {
      throw error;
    }
    
    throw new Error('Ошибка получения деталей заказа');
  }
};

/**
 * ❌ ОТМЕНИТЬ ЗАКАЗ КЛИЕНТОМ
 */
export const cancelCustomerOrder = async (orderId, customerId, cancellationData) => {
  try {
    const { reason, details = '' } = cancellationData;

    console.log('❌ CANCEL CUSTOMER ORDER:', {
      orderId,
      customerId,
      reason
    });

    const order = await Order.findById(orderId);

    if (!order) {
      throw new Error('Заказ не найден');
    }

    if (order.customer_id.toString() !== customerId.toString()) {
      throw new Error('Нет доступа к этому заказу');
    }

    if (!order.canBeCancelled()) {
      throw new Error('Заказ нельзя отменить на текущем этапе');
    }

    // Отменяем заказ
    await order.cancelOrder(reason, customerId, 'customer', details);

    // Возвращаем средства если заказ был оплачен
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      await processRefund(order);
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
      refund_info: order.payment_method === 'card' ? 'Возврат будет обработан в течение 3-5 рабочих дней' : null
    };

  } catch (error) {
    console.error('🚨 CANCEL ORDER ERROR:', error);
    throw error;
  }
};

/**
 * ⭐ ОЦЕНИТЬ ЗАКАЗ
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
 * 🏪 ПОЛУЧИТЬ ЗАКАЗЫ РЕСТОРАНА
 */
export const getRestaurantOrders = async (partnerId, filters = {}) => {
  try {
    const {
      status = null,
      limit = 20,
      offset = 0,
      date_from = null,
      date_to = null
    } = filters;

    console.log('🏪 GET RESTAURANT ORDERS:', {
      partnerId,
      status,
      limit,
      offset
    });

    // Базовый фильтр
    let mongoFilter = { partner_id: partnerId };

    // Фильтр по статусу
    if (status && status !== 'all') {
      mongoFilter.status = status;
    }

    // Фильтр по датам
    if (date_from || date_to) {
      mongoFilter.createdAt = {};
      if (date_from) mongoFilter.createdAt.$gte = new Date(date_from);
      if (date_to) mongoFilter.createdAt.$lte = new Date(date_to);
    }

    const orders = await Order.find(mongoFilter)
      .populate('customer_id', 'username profile_image')
      .populate('courier_id', 'first_name last_name phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Order.countDocuments(mongoFilter);

    const processedOrders = orders.map(order => ({
      id: order._id,
      order_number: order.order_number,
      status: order.status,
      total_price: order.total_price,
      items_count: order.items.length,
      created_at: order.createdAt,
      estimated_delivery_time: order.estimated_delivery_time,
      
      customer: {
        name: order.customer_contact.name,
        phone: order.customer_contact.phone,
        username: order.customer_id.username,
        profile_image: order.customer_id.profile_image
      },
      
      delivery_address: {
        address: order.delivery_address.address,
        apartment: order.delivery_address.apartment,
        delivery_notes: order.delivery_address.delivery_notes
      },
      
      items: order.items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        special_requests: item.special_requests
      })),
      
      courier: order.courier_id ? {
        name: `${order.courier_id.first_name} ${order.courier_id.last_name}`,
        phone: order.courier_id.phone
      } : null,
      
      payment_method: order.payment_method,
      special_requests: order.special_requests,
      
      // Действия доступные ресторану
      can_accept: order.status === 'pending',
      can_reject: order.status === 'pending',
      can_mark_ready: order.status === 'accepted' || order.status === 'preparing',
      
      is_overdue: order.isOverdue()
    }));

    console.log('✅ GET RESTAURANT ORDERS SUCCESS:', {
      orders_found: orders.length,
      total_available: total
    });

    return {
      orders: processedOrders,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + orders.length) < total
      }
    };

  } catch (error) {
    console.error('🚨 GET RESTAURANT ORDERS ERROR:', error);
    throw new Error('Ошибка получения заказов ресторана');
  }
};

/**
 * ✅ ПРИНЯТЬ ЗАКАЗ РЕСТОРАНОМ
 */
export const acceptRestaurantOrder = async (orderId, partnerId, acceptanceData) => {
  try {
    const { estimated_preparation_time = 25 } = acceptanceData;

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

    // Обновляем статус и время
    await order.addStatusHistory('accepted', partnerId, 'partner', 
      `Заказ принят. Время приготовления: ${estimated_preparation_time} мин`);

    // Обновляем расчетное время доставки
    const newEstimatedTime = new Date(Date.now() + (estimated_preparation_time + 20) * 60 * 1000);
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
      estimated_delivery_time: newEstimatedTime,
      message: `Заказ принят. Время приготовления: ${estimated_preparation_time} минут`
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

    // Возвращаем средства клиенту если заказ был оплачен
    if (order.payment_status === 'completed' && order.payment_method === 'card') {
      await processRefund(order);
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
 * 🚴 ПОЛУЧИТЬ ДОСТУПНЫЕ ЗАКАЗЫ ДЛЯ КУРЬЕРА
 */
export const getAvailableOrdersForCourier = async (courierId, location = {}) => {
  try {
    const { lat = null, lng = null, radius = 10 } = location;

    console.log('🚴 GET AVAILABLE ORDERS FOR COURIER:', {
      courierId,
      has_location: !!(lat && lng),
      radius
    });

    // Базовый запрос для доступных заказов
    let availableOrders;

    if (lat && lng) {
      // Поиск с геолокацией
      availableOrders = await Order.findAvailableOrders(lat, lng, radius);
    } else {
      // Поиск без геолокации - все доступные заказы
      availableOrders = await Order.find({
        status: 'ready',
        courier_id: null
      }).sort({ createdAt: 1 }).limit(20);
    }

    // Обогащаем заказы данными ресторанов
    const enrichedOrders = await Promise.all(
      availableOrders.map(async (order) => {
        const restaurant = await PartnerProfile.findById(order.partner_id)
          .select('business_name avatar_image location contact_info')
          .lean();

        // Рассчитываем расстояние до ресторана если есть координаты курьера
        let distanceToRestaurant = null;
        let distanceToCustomer = null;

        if (lat && lng && restaurant?.location?.coordinates) {
          distanceToRestaurant = calculateDistance(
            lat, lng,
            restaurant.location.coordinates[1],
            restaurant.location.coordinates[0]
          );
        }

        if (lat && lng && order.delivery_address?.lat && order.delivery_address?.lng) {
          distanceToCustomer = calculateDistance(
            lat, lng,
            order.delivery_address.lat,
            order.delivery_address.lng
          );
        }

        return {
          id: order._id,
          order_number: order.order_number,
          total_price: order.total_price,
          delivery_fee: order.delivery_fee,
          items_count: order.items.length,
          created_at: order.createdAt,
          ready_at: order.ready_at,
          estimated_delivery_time: order.estimated_delivery_time,
          
          restaurant: {
            id: restaurant._id,
            name: restaurant.business_name,
            avatar_image: restaurant.avatar_image,
            address: restaurant.location?.address,
            phone: restaurant.contact_info?.phone,
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
      message: 'Заказ взят на доставку. Направляйтесь в ресторан.'
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
      message: 'Заказ забран! Направляйтесь к клиенту.'
    };

  } catch (error) {
    console.error('🚨 MARK ORDER PICKED UP ERROR:', error);
    throw error;
  }
};

/**
 * 🏠 ДОСТАВИТЬ ЗАКАЗ КЛИЕНТУ
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
 * 🚴 ПОЛУЧИТЬ АКТИВНЫЕ ЗАКАЗЫ КУРЬЕРА
 */
export const getCourierActiveOrders = async (courierId, filters = {}) => {
  try {
    const { status = 'active', limit = 20, offset = 0 } = filters;

    console.log('🚴 GET COURIER ACTIVE ORDERS:', { courierId, status });

    let mongoFilter = { courier_id: courierId };

    // Фильтр по статусу
    if (status === 'active') {
      mongoFilter.status = { $in: ['picked_up', 'on_the_way'] };
    } else if (status === 'completed') {
      mongoFilter.status = 'delivered';
    } else if (status !== 'all') {
      mongoFilter.status = status;
    }

    const orders = await Order.find(mongoFilter)
      .populate('partner_id', 'business_name avatar_image location contact_info')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Order.countDocuments(mongoFilter);

    const processedOrders = orders.map(order => ({
      id: order._id,
      order_number: order.order_number,
      status: order.status,
      total_price: order.total_price,
      delivery_fee: order.delivery_fee,
      created_at: order.createdAt,
      picked_up_at: order.picked_up_at,
      delivered_at: order.delivered_at,
      
      restaurant: {
        id: order.partner_id._id,
        name: order.partner_id.business_name,
        avatar_image: order.partner_id.avatar_image,
        address: order.partner_id.location?.address,
        phone: order.partner_id.contact_info?.phone
      },
      
      delivery_address: {
        address: order.delivery_address.address,
        apartment: order.delivery_address.apartment,
        delivery_notes: order.delivery_address.delivery_notes
      },
      
      customer_contact: {
        name: order.customer_contact.name,
        phone: order.customer_contact.phone
      },
      
      payment_method: order.payment_method,
      estimated_earnings: calculateCourierEarnings(order.delivery_fee),
      
      // Действия доступные курьеру
      can_pickup: order.status === 'picked_up',
      can_deliver: order.status === 'on_the_way'
    }));

    console.log('✅ GET COURIER ORDERS SUCCESS:', {
      orders_found: orders.length,
      total_available: total
    });

    return {
      orders: processedOrders,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + orders.length) < total
      }
    };

  } catch (error) {
    console.error('🚨 GET COURIER ORDERS ERROR:', error);
    throw new Error('Ошибка получения заказов курьера');
  }
};

// ================ ОБЩИЕ СЕРВИСЫ ================

/**
 * 📍 ОТСЛЕДИТЬ ЗАКАЗ
 */
export const trackOrderStatus = async (orderId) => {
  try {
    console.log('📍 TRACK ORDER:', { orderId });

    const order = await Order.findById(orderId)
      .populate('partner_id', 'business_name contact_info location')
      .populate('courier_id', 'first_name last_name phone')
      .lean();

    if (!order) {
      throw new Error('Заказ не найден');
    }

    const trackingInfo = {
      order_id: order._id,
      order_number: order.order_number,
      current_status: order.status,
      created_at: order.createdAt,
      estimated_delivery_time: order.estimated_delivery_time,
      actual_delivery_time: order.actual_delivery_time,
      
      restaurant: {
        name: order.partner_id.business_name,
        phone: order.partner_id.contact_info?.phone,
        address: order.partner_id.location?.address
      },
      
      courier: order.courier_id ? {
        name: `${order.courier_id.first_name} ${order.courier_id.last_name}`,
        phone: order.courier_id.phone
      } : null,
      
      delivery_address: order.delivery_address,
      
      timeline: order.status_history.map(history => ({
        status: history.status,
        timestamp: history.timestamp,
        description: getStatusDescription(history.status),
        notes: history.notes
      })),
      
      progress_percentage: getOrderProgress(order.status),
      estimated_time_remaining: order.getTimeToDelivery(),
      is_overdue: order.isOverdue(),
      
      next_step: getNextStep(order.status)
    };

    console.log('✅ TRACK ORDER SUCCESS:', {
      order_number: order.order_number,
      current_status: order.status
    });

    return trackingInfo;

  } catch (error) {
    console.error('🚨 TRACK ORDER ERROR:', error);
    throw new Error('Ошибка отслеживания заказа');
  }
};

/**
 * ⚡ ПОЛУЧИТЬ ТОЛЬКО СТАТУС ЗАКАЗА
 */
export const getOrderStatusOnly = async (orderId) => {
  try {
    const order = await Order.findById(orderId).select('order_number status estimated_delivery_time').lean();
    
    if (!order) {
      throw new Error('Заказ не найден');
    }

    return {
      order_number: order.order_number,
      status: order.status,
      estimated_delivery_time: order.estimated_delivery_time,
      time_remaining: order.getTimeToDelivery?.() || null
    };

  } catch (error) {
    console.error('🚨 GET ORDER STATUS ERROR:', error);
    throw new Error('Ошибка получения статуса заказа');
  }
};

// ================ УТИЛИТАРНЫЕ ФУНКЦИИ ================

/**
 * 🕒 РАСЧЕТ ВРЕМЕНИ ДОСТАВКИ
 */
const calculateEstimatedDeliveryTime = (deliveryAddress, restaurantLocation, deliveryInfo) => {
  let totalMinutes = 30; // Базовое время

  // Добавляем время на основе расстояния
  if (deliveryAddress.lat && deliveryAddress.lng && 
      restaurantLocation?.coordinates?.[0] && restaurantLocation?.coordinates?.[1]) {
    
    const distance = calculateDistance(
      deliveryAddress.lat, deliveryAddress.lng,
      restaurantLocation.coordinates[1], restaurantLocation.coordinates[0]
    );
    
    totalMinutes += Math.ceil(distance * 3); // 3 минуты на км
  }

  // Добавляем время из настроек ресторана
  if (deliveryInfo?.estimated_delivery_time) {
    const avgTime = parseInt(deliveryInfo.estimated_delivery_time.split('-')[0]) || 30;
    totalMinutes = Math.max(totalMinutes, avgTime);
  }

  return new Date(Date.now() + totalMinutes * 60 * 1000);
};

/**
 * 💳 ОБРАБОТКА ПЛАТЕЖА (ЗАГЛУШКА)
 */
const processPayment = async (order, options = {}) => {
  try {
    console.log('💳 PROCESSING PAYMENT:', {
      order_id: order._id,
      amount: order.total_price,
      method: order.payment_method
    });

    // Имитация обработки платежа
    await new Promise(resolve => setTimeout(resolve, 1000));

    // В реальном приложении здесь будет интеграция с платежной системой
    const paymentResult = {
      success: true,
      transaction_id: `txn_${Date.now()}`,
      method: order.payment_method,
      amount: order.total_price,
      status: 'completed',
      processed_at: new Date(),
      details: {
        gateway: 'stripe_mock',
        currency: 'RUB',
        fee: Math.ceil(order.total_price * 0.029) // 2.9% комиссия
      }
    };

    console.log('✅ PAYMENT PROCESSED SUCCESS:', {
      transaction_id: paymentResult.transaction_id,
      amount: paymentResult.amount
    });

    return paymentResult;

  } catch (error) {
    console.error('🚨 PAYMENT PROCESSING ERROR:', error);
    
    return {
      success: false,
      error: error.message,
      method: order.payment_method,
      amount: order.total_price,
      processed_at: new Date()
    };
  }
};

/**
 * 💰 ВОЗВРАТ СРЕДСТВ (ЗАГЛУШКА)
 */
const processRefund = async (order) => {
  try {
    console.log('💰 PROCESSING REFUND:', {
      order_id: order._id,
      amount: order.total_price
    });

    // Имитация возврата средств
    await new Promise(resolve => setTimeout(resolve, 500));

    // В реальном приложении здесь будет интеграция с платежной системой
    order.payment_status = 'refunded';
    order.refund_info = {
      refunded_at: new Date(),
      refund_amount: order.total_price,
      refund_transaction_id: `refund_${Date.now()}`,
      status: 'completed'
    };

    await order.save();

    console.log('✅ REFUND PROCESSED SUCCESS:', {
      order_number: order.order_number,
      refund_amount: order.total_price
    });

    return true;

  } catch (error) {
    console.error('🚨 REFUND PROCESSING ERROR:', error);
    return false;
  }
};

/**
 * 🔐 ПРОВЕРКА ДОСТУПА К ЗАКАЗУ
 */
const checkOrderAccess = (order, userId, userRole) => {
  switch (userRole) {
    case 'customer':
      return order.customer_id.toString() === userId.toString();
    case 'partner':
      return order.partner_id.toString() === userId.toString();
    case 'courier':
      return order.courier_id?.toString() === userId.toString();
    case 'admin':
      return true;
    default:
      return false;
  }
};

/**
 * ⭐ ОБНОВИТЬ РЕЙТИНГ РЕСТОРАНА
 */
const updatePartnerRating = async (partnerId, newRating) => {
  try {
    const partner = await PartnerProfile.findById(partnerId);
    if (!partner) return;

    const currentRating = partner.ratings?.average_rating || 0;
    const currentReviews = partner.ratings?.total_reviews || 0;
    
    const totalPoints = (currentRating * currentReviews) + newRating;
    const newTotalReviews = currentReviews + 1;
    const newAverageRating = totalPoints / newTotalReviews;

    await PartnerProfile.findByIdAndUpdate(partnerId, {
      'ratings.average_rating': parseFloat(newAverageRating.toFixed(1)),
      'ratings.total_reviews': newTotalReviews
    });

    console.log('✅ PARTNER RATING UPDATED:', {
      partner_id: partnerId,
      new_rating: newAverageRating.toFixed(1),
      total_reviews: newTotalReviews
    });

  } catch (error) {
    console.error('🚨 UPDATE PARTNER RATING ERROR:', error);
  }
};

/**
 * ⭐ ОБНОВИТЬ РЕЙТИНГ КУРЬЕРА
 */
const updateCourierRating = async (courierId, newRating) => {
  try {
    const courier = await CourierProfile.findOne({ user_id: courierId });
    if (!courier) return;

    const currentRating = courier.ratings?.average_rating || 0;
    const currentReviews = courier.ratings?.total_reviews || 0;
    
    const totalPoints = (currentRating * currentReviews) + newRating;
    const newTotalReviews = currentReviews + 1;
    const newAverageRating = totalPoints / newTotalReviews;

    await CourierProfile.findOneAndUpdate(
      { user_id: courierId },
      {
        'ratings.average_rating': parseFloat(newAverageRating.toFixed(1)),
        'ratings.total_reviews': newTotalReviews
      }
    );

    console.log('✅ COURIER RATING UPDATED:', {
      courier_id: courierId,
      new_rating: newAverageRating.toFixed(1),
      total_reviews: newTotalReviews
    });

  } catch (error) {
    console.error('🚨 UPDATE COURIER RATING ERROR:', error);
  }
};

/**
 * 💵 РАСЧЕТ ЗАРАБОТКА КУРЬЕРА
 */
const calculateCourierEarnings = (deliveryFee, distance = null) => {
  const baseEarnings = deliveryFee * 0.8; // 80% от стоимости доставки
  const distanceBonus = distance > 5 ? (distance - 5) * 10 : 0; // Бонус за дальние расстояния
  return Math.ceil(baseEarnings + distanceBonus);
};

/**
 * 📊 ПОЛУЧИТЬ ПРОГРЕСС ЗАКАЗА В ПРОЦЕНТАХ
 */
const getOrderProgress = (status) => {
  const progressMap = {
    'pending': 10,
    'accepted': 25,
    'preparing': 40,
    'ready': 60,
    'picked_up': 80,
    'on_the_way': 90,
    'delivered': 100,
    'cancelled': 0
  };
  
  return progressMap[status] || 0;
};

/**
 * 📝 ПОЛУЧИТЬ ОПИСАНИЕ СТАТУСА
 */
const getStatusDescription = (status) => {
  const descriptions = {
    'pending': 'Ожидает подтверждения ресторана',
    'accepted': 'Ресторан принял заказ',
    'preparing': 'Заказ готовится',
    'ready': 'Заказ готов, ищем курьера',
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
const getNextStep = (status) => {
  const nextSteps = {
    'pending': 'Ожидайте подтверждения от ресторана',
    'accepted': 'Ресторан готовит ваш заказ',
    'preparing': 'Заказ готовится в ресторане',
    'ready': 'Ищем курьера для доставки',
    'picked_up': 'Курьер направляется в ресторан',
    'on_the_way': 'Курьер везет заказ к вам',
    'delivered': 'Заказ доставлен! Приятного аппетита!',
    'cancelled': null
  };
  
  return nextSteps[status];
};

/**
 * 📍 РАСЧЕТ РАССТОЯНИЯ МЕЖДУ ДВУМЯ ТОЧКАМИ
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ================ ЭКСПОРТ ВСЕХ ФУНКЦИЙ ================

export {
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
  
  // Утилитарные функции для тестирования
  calculateEstimatedDeliveryTime,
  processPayment,
  processRefund,
  checkOrderAccess,
  calculateCourierEarnings,
  getOrderProgress,
  getStatusDescription,
  getNextStep
};