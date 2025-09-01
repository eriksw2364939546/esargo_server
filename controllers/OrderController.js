// controllers/OrderController.js - Контроллеры системы заказов
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
 * 📦 СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ
 * POST /api/orders
 */
const createOrder = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const {
      delivery_address,
      customer_contact,
      payment_method = 'card',
      special_requests = ''
    } = req.body;

    console.log('📦 CREATE ORDER:', {
      customer_id: user._id,
      payment_method,
      has_delivery_address: !!delivery_address
    });

    // Валидация обязательных полей
    if (!delivery_address || !delivery_address.address || !delivery_address.lat || !delivery_address.lng) {
      return res.status(400).json({
        result: false,
        message: "Адрес доставки с координатами обязателен"
      });
    }

    if (!customer_contact || !customer_contact.name || !customer_contact.phone) {
      return res.status(400).json({
        result: false,
        message: "Контактная информация (имя и телефон) обязательна"
      });
    }

    const result = await createOrderFromCart(user._id, sessionId, {
      delivery_address,
      customer_contact,
      payment_method,
      special_requests: special_requests.trim()
    });

    res.status(201).json({
      result: true,
      message: "Заказ создан успешно",
      order: result.order,
      payment: result.payment,
      estimated_delivery: result.estimatedDelivery,
      next_steps: [
        "Ресторан получит уведомление о заказе",
        "Ожидайте подтверждения в течение 10-15 минут",
        "Вы получите уведомления об изменении статуса"
      ]
    });

  } catch (error) {
    console.error('🚨 CREATE ORDER Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('корзина пуста') || 
        error.message.includes('не найден') ||
        error.message.includes('не активен')) {
      statusCode = 400;
    } else if (error.message.includes('платеж')) {
      statusCode = 402; // Payment Required
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка создания заказа"
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
      total: result.total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: result.total > (parseInt(offset) + parseInt(limit))
      },
      summary: result.summary
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
      estimated_delivery: result.estimatedDelivery
    });

  } catch (error) {
    console.error('🚨 GET ORDER BY ID Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;

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
    const { reason } = req.body;

    console.log('❌ CANCEL ORDER:', {
      customer_id: user._id,
      order_id: id,
      reason
    });

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        result: false,
        message: "Причина отмены обязательна"
      });
    }

    const result = await cancelCustomerOrder(id, user._id, reason.trim());

    res.status(200).json({
      result: true,
      message: "Заказ отменен",
      order: result.order,
      refund: result.refund,
      cancellation_info: result.cancellationInfo
    });

  } catch (error) {
    console.error('🚨 CANCEL ORDER Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('нельзя отменить')) {
      statusCode = 400;
    }

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
    const { 
      partner_rating, 
      courier_rating, 
      comment = '' 
    } = req.body;

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
      comment: comment.trim()
    });

    res.status(200).json({
      result: true,
      message: "Спасибо за оценку!",
      order: result.order,
      ratings_updated: result.ratingsUpdated
    });

  } catch (error) {
    console.error('🚨 RATE ORDER Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('нельзя оценить') || 
               error.message.includes('уже оценен')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка оценки заказа"
    });
  }
};

// ================ ПАРТНЕРСКИЕ КОНТРОЛЛЕРЫ ================

/**
 * 🏪 ПОЛУЧИТЬ ЗАКАЗЫ РЕСТОРАНА
 * GET /api/orders/partner/list
 */
const getPartnerOrders = async (req, res) => {
  try {
    const { user } = req;
    const { 
      status, 
      limit = 20, 
      offset = 0 
    } = req.query;

    console.log('🏪 GET PARTNER ORDERS:', {
      partner_id: user._id,
      status,
      limit
    });

    const result = await getRestaurantOrders(user._id, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: "Заказы ресторана получены",
      orders: result.orders,
      total: result.total,
      summary: result.summary,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: result.total > (parseInt(offset) + parseInt(limit))
      }
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
      partner_id: user._id,
      order_id: id,
      prep_time: estimated_preparation_time
    });

    if (estimated_preparation_time < 5 || estimated_preparation_time > 120) {
      return res.status(400).json({
        result: false,
        message: "Время приготовления должно быть от 5 до 120 минут"
      });
    }

    const result = await acceptRestaurantOrder(id, user._id, estimated_preparation_time);

    res.status(200).json({
      result: true,
      message: "Заказ принят в работу",
      order: result.order,
      estimated_ready_at: result.estimatedReadyAt,
      next_steps: [
        "Начните приготовление заказа",
        "Отметьте заказ готовым когда будет готов",
        "Система найдет курьера для доставки"
      ]
    });

  } catch (error) {
    console.error('🚨 ACCEPT ORDER Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('нельзя принять')) {
      statusCode = 400;
    }

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
    const { reason } = req.body;

    console.log('❌ REJECT ORDER:', {
      partner_id: user._id,
      order_id: id,
      reason
    });

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        result: false,
        message: "Причина отклонения обязательна"
      });
    }

    const result = await rejectRestaurantOrder(id, user._id, reason.trim());

    res.status(200).json({
      result: true,
      message: "Заказ отклонен",
      order: result.order,
      refund: result.refund
    });

  } catch (error) {
    console.error('🚨 REJECT ORDER Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('нельзя отклонить')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отклонения заказа"
    });
  }
};

/**
 * ✅ ЗАКАЗ ГОТОВ
 * POST /api/orders/:id/ready
 */
const markOrderReady = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    console.log('✅ MARK ORDER READY:', {
      partner_id: user._id,
      order_id: id
    });

    const result = await markRestaurantOrderReady(id, user._id);

    res.status(200).json({
      result: true,
      message: "Заказ помечен как готовый",
      order: result.order,
      courier_search: result.courierSearch,
      next_steps: [
        "Система ищет доступного курьера",
        "Курьер получит уведомление о готовом заказе",
        "Ожидайте прибытия курьера"
      ]
    });

  } catch (error) {
    console.error('🚨 MARK ORDER READY Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('нельзя пометить')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отметки готовности заказа"
    });
  }
};

// ================ КУРЬЕРСКИЕ КОНТРОЛЛЕРЫ ================

/**
 * 🚚 ПОЛУЧИТЬ ДОСТУПНЫЕ ЗАКАЗЫ
 * GET /api/orders/courier/available
 */
const getAvailableOrders = async (req, res) => {
  try {
    const { user } = req;
    const { 
      lat, 
      lng, 
      radius = 10 
    } = req.query;

    console.log('🚚 GET AVAILABLE ORDERS:', {
      courier_id: user._id,
      lat,
      lng,
      radius
    });

    if (!lat || !lng) {
      return res.status(400).json({
        result: false,
        message: "Координаты курьера (lat, lng) обязательны"
      });
    }

    const result = await getAvailableOrdersForCourier(user._id, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: parseFloat(radius)
    });

    res.status(200).json({
      result: true,
      message: `Найдено ${result.orders.length} доступных заказов`,
      orders: result.orders,
      search_area: {
        center: { lat: parseFloat(lat), lng: parseFloat(lng) },
        radius_km: parseFloat(radius)
      }
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
      courier_id: user._id,
      order_id: id
    });

    const result = await acceptOrderForDelivery(id, user._id);

    res.status(200).json({
      result: true,
      message: "Заказ взят на доставку",
      order: result.order,
      restaurant: result.restaurant,
      route: result.route,
      next_steps: [
        "Направляйтесь к ресторану",
        "Заберите заказ у ресторана",
        "Отметьте 'Забрал заказ' в приложении"
      ]
    });

  } catch (error) {
    console.error('🚨 ACCEPT DELIVERY Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('уже взят') || 
               error.message.includes('нельзя взять')) {
      statusCode = 400;
    }

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
      courier_id: user._id,
      order_id: id
    });

    const result = await markOrderPickedUpByCourier(id, user._id);

    res.status(200).json({
      result: true,
      message: "Заказ забран у ресторана",
      order: result.order,
      customer: result.customer,
      route_to_customer: result.routeToCustomer,
      next_steps: [
        "Направляйтесь к клиенту",
        "Доставьте заказ по указанному адресу",
        "Отметьте 'Доставлено' после передачи заказа"
      ]
    });

  } catch (error) {
    console.error('🚨 MARK ORDER PICKED UP Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('нельзя забрать')) {
      statusCode = 400;
    }

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
      courier_id: user._id,
      order_id: id,
      has_notes: !!delivery_notes
    });

    const result = await markOrderDeliveredByCourier(id, user._id, delivery_notes.trim());

    res.status(200).json({
      result: true,
      message: "Заказ успешно доставлен!",
      order: result.order,
      delivery_summary: result.deliverySummary,
      earnings: result.earnings,
      completion_message: "Отличная работа! Заказ доставлен."
    });

  } catch (error) {
    console.error('🚨 MARK ORDER DELIVERED Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('нельзя пометить')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отметки доставки заказа"
    });
  }
};

/**
 * 📋 ПОЛУЧИТЬ МОИ ЗАКАЗЫ (КУРЬЕР)
 * GET /api/orders/courier/my
 */
const getCourierOrders = async (req, res) => {
  try {
    const { user } = req;
    const { 
      status, 
      limit = 20, 
      offset = 0 
    } = req.query;

    console.log('📋 GET COURIER ORDERS:', {
      courier_id: user._id,
      status,
      limit
    });

    const result = await getCourierActiveOrders(user._id, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: "Заказы курьера получены",
      orders: result.orders,
      total: result.total,
      summary: result.summary,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: result.total > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('🚨 GET COURIER ORDERS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения заказов курьера"
    });
  }
};

// ================ ОБЩИЕ КОНТРОЛЛЕРЫ ================

/**
 * 👀 ОТСЛЕДИТЬ ЗАКАЗ
 * GET /api/orders/:id/track
 */
const trackOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('👀 TRACK ORDER:', { order_id: id });

    const result = await trackOrderStatus(id);

    res.status(200).json({
      result: true,
      message: "Отслеживание заказа",
      order: result.order,
      timeline: result.timeline,
      current_status: result.currentStatus,
      estimated_delivery: result.estimatedDelivery,
      can_track: true
    });

  } catch (error) {
    console.error('🚨 TRACK ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отслеживания заказа"
    });
  }
};

/**
 * ℹ️ ПОЛУЧИТЬ СТАТУС ЗАКАЗА
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
      status: result.status,
      status_description: result.statusDescription,
      estimated_delivery: result.estimatedDelivery,
      last_update: result.lastUpdate
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


export {
        createOrder,
        getMyOrders,
        getOrderById,    // КЛИЕНТСКИЕ КОНТРОЛЛЕРЫ
        cancelOrder,
        rateOrder,

        getPartnerOrders,
        acceptOrder,
        rejectOrder,    // ПАРТНЕРСКИЕ КОНТРОЛЛЕРЫ
        markOrderReady,

        getAvailableOrders,
        acceptDelivery,
        markOrderPickedUp,  // КУРЬЕРСКИЕ КОНТРОЛЛЕРЫ
        markOrderDelivered,
        getCourierOrders,

        trackOrder,      // ОБЩИЕ КОНТРОЛЛЕРЫ
        getOrderStatus


}