// controllers/OrderController.js - ОБНОВЛЕННЫЙ контроллер системы заказов для Марселя
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

import { PartnerProfile, CourierProfile, CustomerProfile } from '../models/index.js';
import { getCustomerAddressById } from '../services/Address/address.service.js'; // ✅ НОВАЯ ИНТЕГРАЦИЯ

// ================ КОНСТАНТЫ ДЛЯ МАРСЕЛЯ ================

const MARSEILLE_BOUNDS = {
  lat: { min: 43.200, max: 43.350 },
  lng: { min: 5.200, max: 5.600 }
};

const MARSEILLE_CENTER = {
  lat: 43.2951, // Vieux Port
  lng: 5.3739
};

// ================ КЛИЕНТСКИЕ КОНТРОЛЛЕРЫ ================

/**
 * 📦 СОЗДАТЬ ЗАКАЗ ИЗ КОРЗИНЫ - ОБНОВЛЕНО ДЛЯ МАРСЕЛЯ
 * POST /api/orders
 */
const createOrder = async (req, res) => {
  try {
    const { user } = req;
    const {
      delivery_address,
      saved_address_id, // ✅ НОВОЕ: ID сохраненного адреса
      customer_contact,
      payment_method = 'card',
      special_requests = ''
    } = req.body;

    console.log('📦 CREATE ORDER (MARSEILLE):', {
      customer_id: user._id,
      payment_method,
      has_delivery_address: !!delivery_address,
      has_saved_address_id: !!saved_address_id
    });

    // ✅ НОВАЯ ЛОГИКА: Использование сохраненного адреса или нового
    let finalDeliveryAddress = null;

    if (saved_address_id) {
      // Используем сохраненный адрес из новой системы
      try {
        const savedAddressResult = await getCustomerAddressById(user._id, saved_address_id);
        const savedAddress = savedAddressResult.address;
        
        finalDeliveryAddress = {
          address: savedAddress.address,
          lat: savedAddress.lat,
          lng: savedAddress.lng,
          apartment: savedAddress.details?.apartment || '',
          entrance: savedAddress.details?.entrance || '',
          intercom: savedAddress.details?.intercom || '',
          floor: savedAddress.details?.floor || '',
          delivery_notes: savedAddress.details?.delivery_notes || '',
          // ✅ МЕТА-ИНФОРМАЦИЯ
          address_source: 'saved_address',
          address_id: saved_address_id,
          address_name: savedAddress.name
        };
        
        console.log('📍 Using saved address:', { 
          address_id: saved_address_id, 
          address_name: savedAddress.name,
          zone: savedAddress.delivery_info?.zone 
        });
        
      } catch (addressError) {
        return res.status(400).json({
          result: false,
          message: `Ошибка получения сохраненного адреса: ${addressError.message}`
        });
      }
    } else if (delivery_address) {
      // Используем переданный адрес
      finalDeliveryAddress = {
        ...delivery_address,
        address_source: 'manual_input'
      };
    } else {
      return res.status(400).json({
        result: false,
        message: 'Необходимо указать адрес доставки или ID сохраненного адреса'
      });
    }

    // ✅ ОБНОВЛЕННАЯ ВАЛИДАЦИЯ ДЛЯ МАРСЕЛЯ
    const errors = [];

    // Проверка адреса доставки
    if (!finalDeliveryAddress.address || finalDeliveryAddress.address.trim().length === 0) {
      errors.push('Текстовый адрес доставки обязателен');
    }
    
    if (!finalDeliveryAddress.lat || typeof finalDeliveryAddress.lat !== 'number') {
      errors.push('Широта адреса (lat) обязательна и должна быть числом');
    }
    
    if (!finalDeliveryAddress.lng || typeof finalDeliveryAddress.lng !== 'number') {
      errors.push('Долгота адреса (lng) обязательна и должна быть числом');
    }

    // ✅ ИСПРАВЛЕНО: Проверка координат МАРСЕЛЯ (вместо Парижа)
    if (finalDeliveryAddress.lat && 
        (finalDeliveryAddress.lat < MARSEILLE_BOUNDS.lat.min || 
         finalDeliveryAddress.lat > MARSEILLE_BOUNDS.lat.max)) {
      errors.push(`Координаты должны быть в пределах Марселя (широта: ${MARSEILLE_BOUNDS.lat.min}-${MARSEILLE_BOUNDS.lat.max})`);
    }
    
    if (finalDeliveryAddress.lng && 
        (finalDeliveryAddress.lng < MARSEILLE_BOUNDS.lng.min || 
         finalDeliveryAddress.lng > MARSEILLE_BOUNDS.lng.max)) {
      errors.push(`Координаты должны быть в пределах Марселя (долгота: ${MARSEILLE_BOUNDS.lng.min}-${MARSEILLE_BOUNDS.lng.max})`);
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
        // ✅ ИСПРАВЛЕНО: Проверка французского формата телефона (вместо российского)
        const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/;
        if (!phoneRegex.test(customer_contact.phone.replace(/\s/g, ''))) {
          errors.push('Некорректный французский номер телефона');
        }
      }
    }

    // Проверка метода оплаты
    if (!['card', 'cash'].includes(payment_method)) {
      errors.push('Метод оплаты должен быть card или cash');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        result: false,
        message: 'Ошибки валидации данных заказа',
        errors: errors
      });
    }

    // ✅ СОЗДАНИЕ ЗАКАЗА с обновленными данными
const orderData = {
  delivery_address: finalDeliveryAddress,
  customer_contact,
  payment_method,
  special_requests: special_requests.trim()
};

const result = await createOrderFromCart(user._id, orderData);

    // ✅ НОВОЕ: Обновляем статистику использования адреса (если сохраненный)
    if (saved_address_id && result.success) {
      try {
        const customerProfile = await CustomerProfile.findOne({ user_id: user._id });
        if (customerProfile) {
          customerProfile.updateAddressStats(saved_address_id, {
            delivery_zone: result.order.delivery_zone,
            delivery_distance_km: result.order.delivery_distance_km
          });
          await customerProfile.save();
        }
      } catch (statsError) {
        console.warn('⚠️ Failed to update address stats:', statsError.message);
        // Не прерываем процесс создания заказа
      }
    }

    res.status(201).json({
      result: true,
      message: "Заказ успешно создан",
      order: {
        id: result.order._id,
        order_number: result.order.order_number,
        status: result.order.status,
        total_price: result.order.total_price,
        delivery_zone: result.order.delivery_zone, // ✅ НОВОЕ ПОЛЕ
        delivery_distance_km: result.order.delivery_distance_km, // ✅ НОВОЕ ПОЛЕ
        estimated_delivery_time: result.order.estimated_delivery_time,
        payment_method: result.order.payment_method,
        // ✅ ИНФОРМАЦИЯ ОБ АДРЕСЕ
        delivery_address: {
          address: finalDeliveryAddress.address,
          source: finalDeliveryAddress.address_source,
          address_name: finalDeliveryAddress.address_name || null
        }
      },
      // ✅ НОВАЯ ИНФОРМАЦИЯ О ДОСТАВКЕ
      delivery_info: {
        zone: result.order.delivery_zone,
        distance_km: result.order.delivery_distance_km,
        estimated_time: result.order.estimated_delivery_time,
        delivery_fee: result.order.delivery_fee,
        is_within_delivery_bounds: true
      }
    });

  } catch (error) {
    console.error('🚨 CREATE ORDER Error:', error);

    // Обработка специфических ошибок
    const statusCode = error.message.includes('корзина') ? 404 :
                      error.message.includes('недоступна') ? 422 :
                      error.message.includes('координаты') ? 400 :
                      error.message.includes('зон доставки') ? 422 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка создания заказа",
      // ✅ ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ДЛЯ ОТЛАДКИ
      debug_info: {
        marseille_bounds: MARSEILLE_BOUNDS,
        center_coordinates: MARSEILLE_CENTER
      }
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
      offset = 0,
      include_delivery_info = false // ✅ НОВЫЙ ПАРАМЕТР
    } = req.query;

    console.log('📋 GET MY ORDERS:', { 
      customer_id: user._id, 
      status, 
      limit,
      include_delivery_info 
    });

    const result = await getCustomerOrders(user._id, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // ✅ ДОПОЛНЯЕМ ИНФОРМАЦИЕЙ О ДОСТАВКЕ ESARGO
    const enhancedOrders = result.orders.map(order => ({
      ...order,
      // ✅ КРАТКАЯ ИНФОРМАЦИЯ О ДОСТАВКЕ
      delivery_summary: {
        zone: order.delivery_zone,
        distance_km: order.delivery_distance_km,
        address_preview: order.delivery_address?.address?.substring(0, 50) + '...'
      },
      // ✅ ДЕТАЛЬНАЯ ИНФОРМАЦИЯ (по запросу)
      ...(include_delivery_info === 'true' && {
        full_delivery_info: {
          delivery_zone: order.delivery_zone,
          delivery_distance_km: order.delivery_distance_km,
          delivery_fee: order.delivery_fee,
          platform_commission: order.platform_commission
        }
      })
    }));

    res.status(200).json({
      result: true,
      message: "Заказы получены успешно",
      orders: enhancedOrders,
      pagination: {
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: result.total > (parseInt(offset) + parseInt(limit))
      },
      // ✅ СТАТИСТИКА ПО ЗОНАМ ДОСТАВКИ
      delivery_zones_stats: {
        zone_1_orders: enhancedOrders.filter(o => o.delivery_zone === 1).length,
        zone_2_orders: enhancedOrders.filter(o => o.delivery_zone === 2).length,
        avg_distance: enhancedOrders.reduce((sum, o) => sum + (o.delivery_distance_km || 0), 0) / enhancedOrders.length || 0
      }
    });

  } catch (error) {
    console.error('🚨 GET MY ORDERS Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
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

    console.log('🔍 GET ORDER BY ID:', { order_id: id, customer_id: user._id });

    const result = await getOrderDetails(id, user._id);

    // ✅ ДОПОЛНЯЕМ ДАННЫМИ СИСТЕМЫ ESARGO
    const enhancedOrder = {
      ...result.order,
      // ✅ ИНФОРМАЦИЯ О СИСТЕМЕ ДОСТАВКИ ESARGO
      esargo_delivery_info: {
        delivery_zone: result.order.delivery_zone,
        zone_description: result.order.delivery_zone === 1 ? 'Центр Марселя (0-5км)' : 'Большой Марсель (5-10км)',
        delivery_distance_km: result.order.delivery_distance_km,
        delivery_fee: result.order.delivery_fee,
        platform_commission: result.order.platform_commission,
        courier_earnings: result.order.courier_earnings,
        peak_hour_surcharge: result.order.peak_hour_surcharge || 0
      },
      // ✅ ИНФОРМАЦИЯ ОБ АДРЕСЕ ДОСТАВКИ
      delivery_address_details: {
        ...result.order.delivery_address,
        coordinates: {
          lat: result.order.delivery_address.lat,
          lng: result.order.delivery_address.lng
        },
        distance_from_center: calculateDistanceFromCenter(
          result.order.delivery_address.lat, 
          result.order.delivery_address.lng
        )
      }
    };

    res.status(200).json({
      result: true,
      message: "Детали заказа получены",
      order: enhancedOrder
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

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * Расчет расстояния от центра Марселя
 */
function calculateDistanceFromCenter(lat, lng) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat - MARSEILLE_CENTER.lat) * Math.PI / 180;
  const dLng = (lng - MARSEILLE_CENTER.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(MARSEILLE_CENTER.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100;
}

// ================ ОСТАЛЬНЫЕ КОНТРОЛЛЕРЫ (БЕЗ ИЗМЕНЕНИЙ) ================

/**
 * ❌ ОТМЕНИТЬ ЗАКАЗ
 * PATCH /api/orders/:id/cancel
 */
const cancelOrder = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { cancel_reason = 'customer_request' } = req.body;

    console.log('❌ CANCEL ORDER:', { order_id: id, customer_id: user._id, reason: cancel_reason });

    const result = await cancelCustomerOrder(id, user._id, cancel_reason);

    res.status(200).json({
      result: true,
      message: "Заказ отменен",
      order: result.order,
      refund_info: result.refund_info || null
    });

  } catch (error) {
    console.error('🚨 CANCEL ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('нельзя отменить') ? 400 :
                      error.message.includes('доступ') ? 403 : 500;

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
    const { rating, comment = '', delivery_rating = null } = req.body; // ✅ НОВОЕ: отдельная оценка доставки

    console.log('⭐ RATE ORDER:', { order_id: id, customer_id: user._id, rating, delivery_rating });

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        result: false,
        message: "Рейтинг должен быть от 1 до 5"
      });
    }

    // ✅ ВАЛИДАЦИЯ РЕЙТИНГА ДОСТАВКИ
    if (delivery_rating && (delivery_rating < 1 || delivery_rating > 5)) {
      return res.status(400).json({
        result: false,
        message: "Рейтинг доставки должен быть от 1 до 5"
      });
    }

    const ratingData = {
      rating: parseInt(rating),
      comment: comment.trim(),
      delivery_rating: delivery_rating ? parseInt(delivery_rating) : null
    };

    const result = await rateCompletedOrder(id, user._id, ratingData);

    res.status(200).json({
      result: true,
      message: "Оценка добавлена",
      rating: result.rating,
      order_status: result.order.status
    });

  } catch (error) {
    console.error('🚨 RATE ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('уже оценен') ? 400 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка добавления оценки"
    });
  }
};

// ================ ОСТАЛЬНЫЕ КОНТРОЛЛЕРЫ (ПАРТНЕРЫ, КУРЬЕРЫ, ОБЩИЕ) ================
// Эти контроллеры остаются без изменений, так как логика не связана с адресами

const getPartnerOrders = async (req, res) => {
  try {
    const { user } = req;
    const { status, limit = 20, offset = 0 } = req.query;

    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    if (!partnerProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const result = await getRestaurantOrders(partnerProfile._id, { status, limit: parseInt(limit), offset: parseInt(offset) });

    res.status(200).json({
      result: true,
      message: "Заказы ресторана получены",
      orders: result.orders,
      total: result.total
    });

  } catch (error) {
    console.error('🚨 GET PARTNER ORDERS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения заказов ресторана"
    });
  }
};

const acceptOrder = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { estimated_preparation_time = 20 } = req.body;

    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    if (!partnerProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const result = await acceptRestaurantOrder(id, partnerProfile._id, estimated_preparation_time);

    res.status(200).json({
      result: true,
      message: "Заказ принят",
      order: result.order
    });

  } catch (error) {
    console.error('🚨 ACCEPT ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('нельзя принять') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка принятия заказа"
    });
  }
};

const rejectOrder = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { reject_reason = 'restaurant_busy' } = req.body;

    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    if (!partnerProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const result = await rejectRestaurantOrder(id, partnerProfile._id, reject_reason);

    res.status(200).json({
      result: true,
      message: "Заказ отклонен",
      order: result.order
    });

  } catch (error) {
    console.error('🚨 REJECT ORDER Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('нельзя отклонить') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отклонения заказа"
    });
  }
};

const markOrderReady = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

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
      message: "Заказ готов к выдаче",
      order: result.order
    });

  } catch (error) {
    console.error('🚨 MARK ORDER READY Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('нельзя пометить') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отметки готовности заказа"
    });
  }
};

const getAvailableOrders = async (req, res) => {
  try {
    const { user } = req;
    const { delivery_zone, limit = 10 } = req.query;

    const courierProfile = await CourierProfile.findOne({ user_id: user._id });
    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    const result = await getAvailableOrdersForCourier(courierProfile._id, {
      delivery_zone: delivery_zone ? parseInt(delivery_zone) : null,
      limit: parseInt(limit)
    });

    res.status(200).json({
      result: true,
      message: "Доступные заказы получены",
      available_orders: result.available_orders,
      total: result.total
    });

  } catch (error) {
    console.error('🚨 GET AVAILABLE ORDERS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения доступных заказов"
    });
  }
};

const acceptDelivery = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

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
      message: "Заказ принят к доставке",
      order: result.order
    });

  } catch (error) {
    console.error('🚨 ACCEPT DELIVERY Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('нельзя принять') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка принятия заказа к доставке"
    });
  }
};

const markOrderPickedUp = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

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
      message: "Заказ забран из ресторана",
      order: result.order
    });

  } catch (error) {
    console.error('🚨 MARK ORDER PICKED UP Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('нельзя пометить') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка отметки забора заказа"
    });
  }
};

const markOrderDelivered = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { delivery_notes = '', delivery_photo_url = '' } = req.body;

    const courierProfile = await CourierProfile.findOne({ user_id: user._id });
    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    const result = await markOrderDeliveredByCourier(id, courierProfile._id, {
      delivery_notes: delivery_notes.trim(),
      delivery_photo_url: delivery_photo_url.trim()
    });

    res.status(200).json({
      result: true,
      message: "Заказ доставлен",
      order: result.order
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

const getCourierOrders = async (req, res) => {
  try {
    const { user } = req;

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

const trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user?._id || null;

    console.log('🔍 TRACK ORDER:', { orderNumber, userId });

    const result = await trackOrderStatus(orderNumber, userId);

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
        created_at: result.created_at,
        // ✅ НОВАЯ ИНФОРМАЦИЯ О ДОСТАВКЕ ESARGO
        delivery_info: {
          zone: result.delivery_zone,
          distance_km: result.delivery_distance_km,
          delivery_fee: result.delivery_fee
        }
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
        actual_delivery_time: result.actual_delivery_time,
        // ✅ НОВАЯ ИНФОРМАЦИЯ О ДОСТАВКЕ
        delivery_zone: result.delivery_zone,
        delivery_distance_km: result.delivery_distance_km
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