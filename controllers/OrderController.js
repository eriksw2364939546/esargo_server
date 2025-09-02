// controllers/OrderController.js - ИСПРАВЛЕННЫЙ контроллер системы заказов
import { 
  createOrderFromCart,
  getCustomerOrders,
  getOrderDetails,
  cancelCustomerOrder,
  rateCompletedOrder,
  getRestaurantOrders,
  acceptRestaurantOrder,
  rejectRestaurantOrder,
  markRestaurantOrderReady,
  getAvailableOrdersForCourier,
  acceptOrderForDelivery,
  markOrderPickedUpByCourier,
  markOrderDeliveredByCourier,
  getCourierActiveOrders,
  trackOrderStatus,
  getOrderStatusOnly
} from '../services/Order/order.service.js';

// ================ КЛИЕНТСКИЕ КОНТРОЛЛЕРЫ ================

/**
 * 📦 СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ - ИСПРАВЛЕНО
 * POST /api/orders
 */
const createOrder = async (req, res) => {
  try {
    const { user } = req;
    const {
      delivery_address,
      customer_contact,
      payment_method = 'cash',
      special_requests = ''
    } = req.body;

    console.log('📦 CREATE ORDER:', {
      customer_id: user._id,
      payment_method,
      has_delivery_address: !!delivery_address
    });

    // ✅ ИСПРАВЛЕННАЯ ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    const errors = [];

    // Проверка адреса доставки
    if (!delivery_address) {
      errors.push('Адрес доставки обязателен');
    } else {
      if (!delivery_address.address || delivery_address.address.trim().length === 0) {
        errors.push('Текстовый адрес доставки обязателен');
      }
      
      if (!delivery_address.lat || typeof delivery_address.lat !== 'number') {
        errors.push('Широта адреса (lat) обязательна и должна быть числом');
      }
      
      if (!delivery_address.lng || typeof delivery_address.lng !== 'number') {
        errors.push('Долгота адреса (lng) обязательна и должна быть числом');
      }

      // Проверка корректности координат Парижа
      if (delivery_address.lat && (delivery_address.lat < 48.8 || delivery_address.lat > 48.9)) {
        errors.push('Координаты должны быть в пределах Парижа');
      }
      
      if (delivery_address.lng && (delivery_address.lng < 2.2 || delivery_address.lng > 2.5)) {
        errors.push('Координаты должны быть в пределах Парижа');
      }
    }

    // Проверка контактной информации
    if (!customer_contact) {
      errors.push('Контактная информация обязательна');
    } else {
      if (!customer_contact.name || customer_contact.name.trim().length === 0) {
        errors.push('Имя контакта обязательно');
      }
      
      if (!customer_contact.phone || customer_contact.phone.trim().length === 0) {
        errors.push('Телефон контакта обязателен');
      } else {
        // Проверка французского формата телефона
        const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/;
        if (!phoneRegex.test(customer_contact.phone.replace(/\s/g, ''))) {
          errors.push('Неверный формат телефона (ожидается французский: +33XXXXXXXXX или 0XXXXXXXXX)');
        }
      }

      if (customer_contact.email && customer_contact.email.trim().length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer_contact.email)) {
          errors.push('Неверный формат email');
        }
      }
    }

    // Проверка метода оплаты
    if (!['cash', 'card'].includes(payment_method)) {
      errors.push('Метод оплаты должен быть "cash" или "card"');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        result: false,
        message: "Ошибки валидации данных",
        errors
      });
    }

    // ✅ ИСПРАВЛЕННЫЙ ВЫЗОВ СЕРВИСА (убрали sessionId)
    const result = await createOrderFromCart(user._id, {
      delivery_address: {
        address: delivery_address.address.trim(),
        lat: delivery_address.lat,
        lng: delivery_address.lng,
        apartment: delivery_address.apartment?.trim() || '',
        entrance: delivery_address.entrance?.trim() || '',
        intercom: delivery_address.intercom?.trim() || '',
        delivery_notes: delivery_address.delivery_notes?.trim() || ''
      },
      customer_contact: {
        name: customer_contact.name.trim(),
        phone: customer_contact.phone.replace(/\s/g, ''),
        email: customer_contact.email?.toLowerCase().trim() || ''
      },
      payment_method,
      special_requests: special_requests.trim()
    });

    // ✅ УЛУЧШЕННЫЙ ОТВЕТ С ОБРАБОТКОЙ ПРЕДУПРЕЖДЕНИЙ
    const response = {
      result: true,
      message: result.warnings ? 
        "Заказ создан с изменениями" : 
        "Заказ создан успешно",
      order: {
        id: result.order._id,
        order_number: result.order.order_number,
        status: result.order.status,
        total_price: result.order.total_price,
        estimated_delivery_time: result.estimatedDelivery,
        payment_status: result.order.payment_status
      },
      payment: result.payment,
      next_steps: [
        "Ресторан получит уведомление о заказе",
        "Ожидайте подтверждения в течение 10-15 минут",
        "Вы получите уведомления об изменении статуса"
      ]
    };

    // Добавляем информацию о предупреждениях если есть
    if (result.warnings) {
      response.warnings = result.warnings;
      response.next_steps.unshift("⚠️ Некоторые товары были исключены из заказа");
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('🚨 CREATE ORDER Error:', error);
    
    let statusCode = 500;
    
    // Детальная обработка ошибок
    if (error.message.includes('корзина пуста') || 
        error.message.includes('не найдена')) {
      statusCode = 400;
    } else if (error.message.includes('недоступен для заказов') ||
               error.message.includes('недоступны')) {
      statusCode = 400;
    } else if (error.message.includes('Минимальная сумма заказа')) {
      statusCode = 400;
    } else if (error.message.includes('платеж') || 
               error.message.includes('Карта отклонена')) {
      statusCode = 402; // Payment Required
    } else if (error.message.includes('Координаты') ||
               error.message.includes('обязательн')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка создания заказа",
      error_type: statusCode === 402 ? 'payment_error' : 
                  statusCode === 400 ? 'validation_error' : 'server_error'
    });
  }
};

/**
 * 📋 ПОЛУЧИТЬ МОИ ЗАКАЗЫ
 * GET /api/orders/my
 */
const getMyOrders = async (req, res) => {
  try {
    const { user } = req;
    const { 
      status, 
      limit = 20, 
      offset = 0 
    } = req.query;

    console.log('📋 GET MY ORDERS:', {
      customer_id: user._id,
      status,
      limit,
      offset
    });

    const result = await getCustomerOrders(user._id, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: "Заказы получены",
      orders: result.orders,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('🚨 GET MY ORDERS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения заказов"
    });
  }
};

/**
 * 🔍 ПОЛУЧИТЬ ДЕТАЛИ ЗАКАЗА
 * GET /api/orders/:id
 */
const getOrderById = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    console.log('🔍 GET ORDER BY ID:', {
      customer_id: user._id,
      order_id: id
    });

    const result = await getOrderDetails(id, user._id, 'customer');

    res.status(200).json({
      result: true,
      message: "Детали заказа получены",
      order: result.order,
      can_cancel: result.canCancel,
      can_rate: result.canRate,
      estimated_delivery: result.estimatedDelivery,
      availability_info: result.availability_info
    });

  } catch (error) {
    console.error('🚨 GET ORDER BY ID Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения деталей заказа"
    });
  }
};

/**
 * ❌ ОТМЕНИТЬ ЗАКАЗ
 * POST /api/orders/:id/cancel
 */
const cancelOrder = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { reason = 'Отмена клиентом', details = '' } = req.body;

    console.log('❌ CANCEL ORDER:', {
      customer_id: user._id,
      order_id: id,
      reason
    });

    const result = await cancelCustomerOrder(id, user._id, { reason, details });

    res.status(200).json({
      result: true,
      message: "Заказ отменен успешно",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        status: result.status,
        cancelled_at: result.cancelled_at
      },
      stock_return_info: result.stock_return_info,
      refund_info: result.refund_info
    });

  } catch (error) {
    console.error('🚨 CANCEL ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 
                      error.message.includes('нельзя отменить') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отмены заказа"
    });
  }
};

/**
 * ⭐ ОЦЕНИТЬ ЗАКАЗ
 * POST /api/orders/:id/rate
 */
const rateOrder = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { partner_rating, courier_rating, comment = '' } = req.body;

    console.log('⭐ RATE ORDER:', {
      customer_id: user._id,
      order_id: id,
      partner_rating,
      courier_rating
    });

    // Валидация рейтингов
    if (partner_rating && (partner_rating < 1 || partner_rating > 5)) {
      return res.status(400).json({
        result: false,
        message: "Рейтинг ресторана должен быть от 1 до 5"
      });
    }

    if (courier_rating && (courier_rating < 1 || courier_rating > 5)) {
      return res.status(400).json({
        result: false,
        message: "Рейтинг курьера должен быть от 1 до 5"
      });
    }

    const result = await rateCompletedOrder(id, user._id, {
      partner_rating,
      courier_rating,
      comment
    });

    res.status(200).json({
      result: true,
      message: "Спасибо за оценку!",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        ratings: result.ratings
      }
    });

  } catch (error) {
    console.error('🚨 RATE ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 
                      error.message.includes('оценен') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка оценки заказа"
    });
  }
};

// ================ ПАРТНЕРСКИЕ КОНТРОЛЛЕРЫ ================

/**
 * 📋 ПОЛУЧИТЬ ЗАКАЗЫ РЕСТОРАНА
 * GET /api/orders/partner
 */
const getPartnerOrders = async (req, res) => {
  try {
    const { user } = req;
    const { 
      status, 
      date,
      limit = 20, 
      offset = 0 
    } = req.query;

    console.log('📋 GET PARTNER ORDERS:', {
      partner_user_id: user._id,
      status,
      date
    });

    // Сначала находим профиль партнера
    const { PartnerProfile } = await import('../../models/index.js');
    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partnerProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const result = await getRestaurantOrders(partnerProfile._id, {
      status,
      date,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: "Заказы ресторана получены",
      orders: result.orders,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('🚨 GET PARTNER ORDERS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения заказов ресторана"
    });
  }
};

/**
 * ✅ ПРИНЯТЬ ЗАКАЗ
 * POST /api/orders/:id/accept
 */
const acceptOrder = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { estimated_preparation_time = 20 } = req.body;

    console.log('✅ ACCEPT ORDER:', {
      partner_user_id: user._id,
      order_id: id,
      estimated_preparation_time
    });

    // Находим профиль партнера
    const { PartnerProfile } = await import('../../models/index.js');
    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partnerProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const result = await acceptRestaurantOrder(id, partnerProfile._id, {
      estimated_preparation_time: parseInt(estimated_preparation_time)
    });

    res.status(200).json({
      result: true,
      message: "Заказ принят успешно",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        status: result.status,
        accepted_at: result.accepted_at
      },
      next_step: result.next_step
    });

  } catch (error) {
    console.error('🚨 ACCEPT ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 
                      error.message.includes('нельзя принять') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка принятия заказа"
    });
  }
};

/**
 * ❌ ОТКЛОНИТЬ ЗАКАЗ
 * POST /api/orders/:id/reject
 */
const rejectOrder = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { reason, details = '' } = req.body;

    console.log('❌ REJECT ORDER:', {
      partner_user_id: user._id,
      order_id: id,
      reason
    });

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        result: false,
        message: "Причина отклонения обязательна"
      });
    }

    // Находим профиль партнера
    const { PartnerProfile } = await import('../../models/index.js');
    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partnerProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const result = await rejectRestaurantOrder(id, partnerProfile._id, {
      reason: reason.trim(),
      details: details.trim()
    });

    res.status(200).json({
      result: true,
      message: "Заказ отклонен. Клиент получит уведомление.",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        status: result.status,
        cancelled_at: result.cancelled_at
      },
      stock_return_info: result.stock_return_info
    });

  } catch (error) {
    console.error('🚨 REJECT ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 
                      error.message.includes('нельзя отклонить') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отклонения заказа"
    });
  }
};

/**
 * 🍳 ЗАКАЗ ГОТОВ
 * POST /api/orders/:id/ready
 */
const markOrderReady = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    console.log('🍳 MARK ORDER READY:', {
      partner_user_id: user._id,
      order_id: id
    });

    // Находим профиль партнера
    const { PartnerProfile } = await import('../../models/index.js');
    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partnerProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const result = await markRestaurantOrderReady(id, partnerProfile._id);

    res.status(200).json({
      result: true,
      message: "Заказ готов! Ожидается курьер.",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        status: result.status,
        ready_at: result.ready_at
      },
      next_step: result.next_step
    });

  } catch (error) {
    console.error('🚨 MARK ORDER READY Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 
                      error.message.includes('нельзя пометить') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отметки готовности заказа"
    });
  }
};

// ================ КУРЬЕРСКИЕ КОНТРОЛЛЕРЫ ================

/**
 * 📋 ПОЛУЧИТЬ ДОСТУПНЫЕ ЗАКАЗЫ
 * GET /api/orders/available
 */
const getAvailableOrders = async (req, res) => {
  try {
    const { user } = req;
    const { 
      lat, 
      lng, 
      radius = 10 
    } = req.query;

    console.log('📋 GET AVAILABLE ORDERS:', {
      courier_user_id: user._id,
      lat,
      lng,
      radius
    });

    // Валидация координат
    if (!lat || !lng) {
      return res.status(400).json({
        result: false,
        message: "Координаты курьера (lat, lng) обязательны"
      });
    }

    // Находим профиль курьера
    const { CourierProfile } = await import('../../models/index.js');
    const courierProfile = await CourierProfile.findOne({ user_id: user._id });
    
    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    const result = await getAvailableOrdersForCourier(courierProfile._id, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: parseFloat(radius)
    });

    res.status(200).json({
      result: true,
      message: `Найдено ${result.available_orders.length} доступных заказов`,
      orders: result.available_orders,
      total: result.total,
      location_filter: result.location_filter
    });

  } catch (error) {
    console.error('🚨 GET AVAILABLE ORDERS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения доступных заказов"
    });
  }
};

/**
 * 📦 ВЗЯТЬ ЗАКАЗ НА ДОСТАВКУ
 * POST /api/orders/:id/take
 */
const acceptDelivery = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    console.log('📦 ACCEPT DELIVERY:', {
      courier_user_id: user._id,
      order_id: id
    });

    // Находим профиль курьера
    const { CourierProfile } = await import('../../models/index.js');
    const courierProfile = await CourierProfile.findOne({ user_id: user._id });
    
    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    const result = await acceptOrderForDelivery(id, courierProfile._id);

    res.status(200).json({
      result: true,
      message: "Заказ взят на доставку",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        status: result.status
      },
      partner_info: result.partner_info,
      next_steps: [
        "Направляйтесь к ресторану",
        "Заберите заказ у ресторана",
        "Отметьте 'Забрал заказ' в приложении"
      ]
    });

  } catch (error) {
    console.error('🚨 ACCEPT DELIVERY Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('уже взят') || 
                      error.message.includes('активный заказ') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка принятия заказа на доставку"
    });
  }
};

/**
 * 📍 ЗАБРАЛ ЗАКАЗ У РЕСТОРАНА
 * POST /api/orders/:id/pickup
 */
const markOrderPickedUp = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    console.log('📍 MARK ORDER PICKED UP:', {
      courier_user_id: user._id,
      order_id: id
    });

    // Находим профиль курьера
    const { CourierProfile } = await import('../../models/index.js');
    const courierProfile = await CourierProfile.findOne({ user_id: user._id });
    
    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    const result = await markOrderPickedUpByCourier(id, courierProfile._id);

    res.status(200).json({
      result: true,
      message: "Заказ забран у ресторана",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        status: result.status,
        picked_up_at: result.picked_up_at
      },
      customer_info: result.customer_info,
      next_steps: [
        "Направляйтесь к клиенту",
        "Доставьте заказ по указанному адресу",
        "Отметьте 'Доставлено' после передачи заказа"
      ]
    });

  } catch (error) {
    console.error('🚨 MARK ORDER PICKED UP Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 
                      error.message.includes('нельзя забрать') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отметки забора заказа"
    });
  }
};

/**
 * 🎯 ДОСТАВИЛ ЗАКАЗ КЛИЕНТУ
 * POST /api/orders/:id/deliver
 */
const markOrderDelivered = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { delivery_notes = '' } = req.body;

    console.log('🎯 MARK ORDER DELIVERED:', {
      courier_user_id: user._id,
      order_id: id,
      has_notes: !!delivery_notes
    });

    // Находим профиль курьера
    const { CourierProfile } = await import('../../models/index.js');
    const courierProfile = await CourierProfile.findOne({ user_id: user._id });
    
    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    const result = await markOrderDeliveredByCourier(id, courierProfile._id);

    res.status(200).json({
      result: true,
      message: "Заказ успешно доставлен!",
      order: {
        id: result.order_id,
        order_number: result.order_number,
        status: result.status,
        delivered_at: result.delivered_at,
        actual_delivery_time: result.actual_delivery_time
      },
      completion_message: "Отличная работа! Заказ доставлен."
    });

  } catch (error) {
    console.error('🚨 MARK ORDER DELIVERED Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 
                      error.message.includes('нельзя пометить') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отметки доставки заказа"
    });
  }
};

/**
 * 🚴 ПОЛУЧИТЬ АКТИВНЫЕ ЗАКАЗЫ КУРЬЕРА
 * GET /api/orders/courier/active
 */
const getCourierOrders = async (req, res) => {
  try {
    const { user } = req;

    console.log('🚴 GET COURIER ORDERS:', { courier_user_id: user._id });

    // Находим профиль курьера
    const { CourierProfile } = await import('../../models/index.js');
    const courierProfile = await CourierProfile.findOne({ user_id: user._id });
    
    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    const result = await getCourierActiveOrders(courierProfile._id);

    res.status(200).json({
      result: true,
      message: "Активные заказы курьера получены",
      active_orders: result.active_orders,
      total: result.total
    });

  } catch (error) {
    console.error('🚨 GET COURIER ORDERS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения активных заказов"
    });
  }
};

// ================ ОБЩИЕ КОНТРОЛЛЕРЫ ================

/**
 * 🔍 ОТСЛЕЖИВАНИЕ ЗАКАЗА (публичный доступ по номеру заказа)
 * GET /api/orders/track/:orderNumber
 */
const trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user?._id || null; // Опционально для авторизованных пользователей

    console.log('🔍 TRACK ORDER:', { orderNumber, userId });

    // Находим заказ по номеру
    const { Order } = await import('../../models/index.js');
    const order = await Order.findOne({ order_number: orderNumber });
    
    if (!order) {
      return res.status(404).json({
        result: false,
        message: "Заказ с таким номером не найден"
      });
    }

    const result = await trackOrderStatus(order._id, userId);

    res.status(200).json({
      result: true,
      message: "Информация о заказе получена",
      tracking: {
        order_number: result.order_number,
        status: result.status,
        status_description: result.status_description,
        progress: result.progress,
        next_step: result.next_step,
        estimated_delivery_time: result.estimated_delivery_time,
        created_at: result.created_at
      },
      partner_info: result.partner_info,
      courier_info: result.courier_info
    });

  } catch (error) {
    console.error('🚨 TRACK ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отслеживания заказа"
    });
  }
};

/**
 * ℹ️ ПОЛУЧИТЬ ТОЛЬКО СТАТУС ЗАКАЗА (быстрый метод)
 * GET /api/orders/:id/status
 */
const getOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('ℹ️ GET ORDER STATUS:', { order_id: id });

    const result = await getOrderStatusOnly(id);

    res.status(200).json({
      result: true,
      message: "Статус заказа получен",
      status: {
        order_id: result.order_id,
        order_number: result.order_number,
        status: result.status,
        status_description: result.status_description,
        progress: result.progress,
        estimated_delivery_time: result.estimated_delivery_time,
        actual_delivery_time: result.actual_delivery_time
      }
    });

  } catch (error) {
    console.error('🚨 GET ORDER STATUS Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения статуса заказа"
    });
  }
};

// ================ ЭКСПОРТ КОНТРОЛЛЕРОВ ================

export {
  // Клиентские контроллеры
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  rateOrder,
  
  // Партнерские контроллеры  
  getPartnerOrders,
  acceptOrder,
  rejectOrder,
  markOrderReady,
  
  // Курьерские контроллеры
  getAvailableOrders,
  acceptDelivery,
  markOrderPickedUp,
  markOrderDelivered,
  getCourierOrders,
  
  // Общие контроллеры
  trackOrder,
  getOrderStatus
};