// controllers/CartController.js - ОБНОВЛЕННЫЙ контроллер корзины с интеграцией ESARGO
import { 
  findOrCreateCart,
  addItemToCart,
  updateCartItemService,
  removeItemFromCart,
  clearUserCart,
  calculateDeliveryForCart
} from '../services/Cart/cart.service.js';

import { getDeliveryZones } from '../services/Address/address.service.js'; // ✅ НОВАЯ ИНТЕГРАЦИЯ
import { getCustomerAddressById } from '../services/Address/address.service.js'; // ✅ НОВАЯ ИНТЕГРАЦИЯ

// ================ КОНСТАНТЫ ДЛЯ МАРСЕЛЯ ================

const MARSEILLE_BOUNDS = {
  lat: { min: 43.200, max: 43.350 },
  lng: { min: 5.200, max: 5.600 }
};

/**
 * 🛒 ПОЛУЧИТЬ СОДЕРЖИМОЕ КОРЗИНЫ - ОБНОВЛЕНО
 * GET /api/cart
 */
const getCart = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const { include_delivery_zones = false } = req.query; // ✅ НОВЫЙ ПАРАМЕТР

    console.log('🛒 GET CART:', { 
      customer_id: user._id, 
      session_id: sessionId,
      include_delivery_zones 
    });

    const result = await findOrCreateCart(user._id, sessionId);

    const response = {
      result: true,
      message: result.cart ? "Корзина получена" : "Корзина пуста",
      cart: result.cart,
      summary: {
        total_items: result.cart ? result.cart.total_items : 0,
        subtotal: result.cart ? result.cart.pricing.subtotal : 0,
        delivery_fee: result.cart ? result.cart.pricing.delivery_fee : 0,
        total_price: result.cart ? result.cart.pricing.total_price : 0,
        meets_minimum_order: result.cart ? result.cart.meets_minimum_order : false,
        // ✅ НОВАЯ ИНФОРМАЦИЯ О ДОСТАВКЕ
        delivery_zone: result.cart?.delivery_info?.zone || null,
        delivery_distance_km: result.cart?.delivery_info?.distance_km || null
      }
    };

    // ✅ ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ЗОНАХ ДОСТАВКИ (по запросу)
    if (include_delivery_zones === 'true') {
      response.delivery_zones_info = getDeliveryZones();
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('🚨 GET CART Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения корзины"
    });
  }
};

/**
 * ➕ ДОБАВИТЬ ТОВАР В КОРЗИНУ
 * POST /api/cart/items
 */
const addToCart = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const { 
      product_id, 
      quantity = 1, 
      selected_options = [], 
      special_requests = '' 
    } = req.body;

    console.log('➕ ADD TO CART:', {
      customer_id: user._id,
      product_id,
      quantity,
      options_count: selected_options.length
    });

    // Валидация входных данных
    if (!product_id) {
      return res.status(400).json({
        result: false,
        message: "ID товара обязателен"
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        result: false,
        message: "Количество должно быть больше 0"
      });
    }

    const result = await addItemToCart(user._id, sessionId, {
      product_id,
      quantity: parseInt(quantity),
      selected_options,
      special_requests: special_requests.trim()
    });

    res.status(201).json({
      result: true,
      message: result.isNewItem ? "Товар добавлен в корзину" : "Количество товара обновлено",
      cart: result.cart,
      added_item: result.addedItem,
      summary: {
        total_items: result.cart.total_items,
        subtotal: result.cart.pricing.subtotal,
        total_price: result.cart.pricing.total_price,
        meets_minimum_order: result.cart.meets_minimum_order,
        // ✅ ИНФОРМАЦИЯ О ТЕКУЩЕЙ ДОСТАВКЕ
        current_delivery_zone: result.cart.delivery_info?.zone || null,
        needs_delivery_calculation: !result.cart.delivery_info?.zone
      }
    });

  } catch (error) {
    console.error('🚨 ADD TO CART Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('недоступен') ? 422 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка добавления товара в корзину"
    });
  }
};

/**
 * ✏️ ОБНОВИТЬ ТОВАР В КОРЗИНЕ
 * PUT /api/cart/items/:item_id
 */
const updateCartItem = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const { item_id } = req.params;
    const { quantity, selected_options, special_requests } = req.body;

    console.log('✏️ UPDATE CART ITEM:', {
      customer_id: user._id,
      item_id,
      new_quantity: quantity
    });

    if (!item_id) {
      return res.status(400).json({
        result: false,
        message: "ID товара в корзине обязателен"
      });
    }

    if (quantity !== undefined && quantity < 1) {
      return res.status(400).json({
        result: false,
        message: "Количество должно быть больше 0"
      });
    }

    const result = await updateCartItemService(user._id, sessionId, item_id, {
      quantity: quantity ? parseInt(quantity) : undefined,
      selected_options,
      special_requests: special_requests?.trim()
    });

    res.status(200).json({
      result: true,
      message: "Товар обновлен",
      cart: result.cart,
      updated_item: result.updatedItem,
      summary: {
        total_items: result.cart.total_items,
        subtotal: result.cart.pricing.subtotal,
        total_price: result.cart.pricing.total_price
      }
    });

  } catch (error) {
    console.error('🚨 UPDATE CART ITEM Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка обновления товара в корзине"
    });
  }
};

/**
 * 🗑️ УДАЛИТЬ ТОВАР ИЗ КОРЗИНЫ
 * DELETE /api/cart/items/:item_id
 */
const removeFromCart = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const { item_id } = req.params;

    console.log('🗑️ REMOVE FROM CART:', { customer_id: user._id, item_id });

    if (!item_id) {
      return res.status(400).json({
        result: false,
        message: "ID товара в корзине обязателен"
      });
    }

    const result = await removeItemFromCart(user._id, sessionId, item_id);

    res.status(200).json({
      result: true,
      message: result.cart ? "Товар удален из корзины" : "Корзина очищена",
      cart: result.cart,
      removed_item: result.removedItem,
      summary: result.cart ? {
        total_items: result.cart.total_items,
        subtotal: result.cart.pricing.subtotal,
        total_price: result.cart.pricing.total_price
      } : null
    });

  } catch (error) {
    console.error('🚨 REMOVE FROM CART Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка удаления товара из корзины"
    });
  }
};

/**
 * 🗑️ ОЧИСТИТЬ КОРЗИНУ
 * DELETE /api/cart
 */
const clearCart = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;

    console.log('🗑️ CLEAR CART:', { customer_id: user._id });

    const result = await clearUserCart(user._id, sessionId);

    res.status(200).json({
      result: true,
      message: "Корзина очищена",
      cleared_items_count: result.clearedItemsCount,
      saved_amount: result.savedAmount
    });

  } catch (error) {
    console.error('🚨 CLEAR CART Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка очистки корзины"
    });
  }
};

/**
 * 🚚 РАССЧИТАТЬ ДОСТАВКУ - ОБНОВЛЕНО ДЛЯ ESARGO
 * POST /api/cart/calculate-delivery
 */
const calculateDelivery = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const { delivery_address, saved_address_id } = req.body; // ✅ НОВОЕ: поддержка сохраненных адресов

    console.log('🚚 CALCULATE DELIVERY (ESARGO):', {
      customer_id: user._id,
      has_address: !!delivery_address,
      has_saved_address_id: !!saved_address_id
    });

    // ✅ НОВАЯ ЛОГИКА: Использование сохраненного адреса или нового
    let finalDeliveryAddress = null;

    if (saved_address_id) {
      // Используем сохраненный адрес
      try {
        const savedAddressResult = await getCustomerAddressById(user._id, saved_address_id);
        const savedAddress = savedAddressResult.address;
        
        finalDeliveryAddress = {
          address: savedAddress.address,
          lat: savedAddress.lat,
          lng: savedAddress.lng,
          apartment: savedAddress.details?.apartment || '',
          entrance: savedAddress.details?.entrance || '',
          delivery_notes: savedAddress.details?.delivery_notes || '',
          // Мета-информация
          address_source: 'saved_address',
          address_id: saved_address_id,
          address_name: savedAddress.name
        };
        
        console.log('📍 Using saved address for delivery calculation:', {
          address_id: saved_address_id,
          name: savedAddress.name,
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
        message: "Необходимо указать адрес доставки или ID сохраненного адреса"
      });
    }

    // ✅ ВАЛИДАЦИЯ АДРЕСА ДЛЯ МАРСЕЛЯ
    if (!finalDeliveryAddress.lat || !finalDeliveryAddress.lng) {
      return res.status(400).json({
        result: false,
        message: "Координаты доставки (lat, lng) обязательны"
      });
    }

    if (!finalDeliveryAddress.address) {
      return res.status(400).json({
        result: false,
        message: "Адрес доставки обязателен"
      });
    }

    // Проверка границ Марселя
    if (finalDeliveryAddress.lat < MARSEILLE_BOUNDS.lat.min || 
        finalDeliveryAddress.lat > MARSEILLE_BOUNDS.lat.max ||
        finalDeliveryAddress.lng < MARSEILLE_BOUNDS.lng.min || 
        finalDeliveryAddress.lng > MARSEILLE_BOUNDS.lng.max) {
      return res.status(422).json({
        result: false,
        message: "Адрес должен быть в пределах Марселя",
        marseille_bounds: MARSEILLE_BOUNDS
      });
    }

    // ✅ РАСЧЕТ ДОСТАВКИ ЧЕРЕЗ ОБНОВЛЕННЫЙ СЕРВИС
    const result = await calculateDeliveryForCart(user._id, sessionId, finalDeliveryAddress);

    res.status(200).json({
      result: true,
      message: "Доставка рассчитана (система ESARGO)",
      cart: result.cart,
      delivery: {
        fee: result.deliveryFee,
        distance_km: result.distance,
        estimated_time_minutes: result.estimatedTime,
        delivery_zone: result.deliveryZone, // ✅ НОВОЕ ПОЛЕ
        is_large_order: result.isLargeOrder, // ✅ НОВОЕ ПОЛЕ
        address: finalDeliveryAddress.address,
        // ✅ ИНФОРМАЦИЯ ОБ ИСТОЧНИКЕ АДРЕСА
        address_info: {
          source: finalDeliveryAddress.address_source,
          address_name: finalDeliveryAddress.address_name || null,
          address_id: finalDeliveryAddress.address_id || null
        }
      },
      pricing: {
        subtotal: result.cart.pricing.subtotal,
        delivery_fee: result.cart.pricing.delivery_fee,
        service_fee: result.cart.pricing.service_fee,
        total_price: result.cart.pricing.total_price
      },
      // ✅ НОВАЯ ДЕТАЛИЗАЦИЯ РАСЧЕТА ESARGO
      esargo_calculation: {
        delivery_zone: result.deliveryZone,
        zone_description: result.deliveryZone === 1 ? 'Центр Марселя (0-5км)' : 'Большой Марсель (5-10км)',
        distance_km: result.distance,
        order_meets_discount: result.isLargeOrder,
        minimum_order_amount: 30,
        peak_hour_checked: true
      }
    });

  } catch (error) {
    console.error('🚨 CALCULATE DELIVERY Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('пуста') || 
               error.message.includes('координаты') ||
               error.message.includes('недоступна') ||
               error.message.includes('зон доставки')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка расчета доставки",
      // ✅ ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ДЛЯ ОТЛАДКИ
      debug_info: {
        marseille_bounds: MARSEILLE_BOUNDS,
        delivery_zones: getDeliveryZones()
      }
    });
  }
};

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: БЫСТРАЯ ПРОВЕРКА ДОСТАВКИ
 * POST /api/cart/check-delivery
 */
const checkDeliveryAvailability = async (req, res) => {
  try {
    const { user } = req;
    const { lat, lng, address } = req.body;

    console.log('🔍 CHECK DELIVERY AVAILABILITY:', { 
      customer_id: user._id, 
      lat, 
      lng 
    });

    // Базовая валидация
    if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        result: false,
        message: "Координаты (lat, lng) обязательны и должны быть числами"
      });
    }

    // Проверка границ Марселя
    const isInMarseille = (
      lat >= MARSEILLE_BOUNDS.lat.min && lat <= MARSEILLE_BOUNDS.lat.max &&
      lng >= MARSEILLE_BOUNDS.lng.min && lng <= MARSEILLE_BOUNDS.lng.max
    );

    if (!isInMarseille) {
      return res.status(200).json({
        result: true,
        delivery_available: false,
        reason: "Адрес находится за пределами Марселя",
        marseille_bounds: MARSEILLE_BOUNDS
      });
    }

    // Импортируем функцию проверки из Address Service
    const { determineDeliveryZone, calculateDistance } = await import('../services/Address/address.service.js');
    
    const zone = determineDeliveryZone(lat, lng);
    const distance = calculateDistance(43.2951, 5.3739, lat, lng); // От центра Марселя

    res.status(200).json({
      result: true,
      delivery_available: zone !== null,
      delivery_info: {
        zone: zone,
        zone_description: zone === 1 ? 'Центр Марселя (0-5км)' : zone === 2 ? 'Большой Марсель (5-10км)' : null,
        distance_km: Math.round(distance * 100) / 100,
        estimated_delivery_time: zone ? (zone === 1 ? '25-35 мин' : '35-45 мин') : null
      },
      address: address || 'Координаты переданы без адреса'
    });

  } catch (error) {
    console.error('🚨 CHECK DELIVERY AVAILABILITY Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка проверки доступности доставки"
    });
  }
};

// ================ ЭКСПОРТ КОНТРОЛЛЕРОВ ================

export { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart, 
  calculateDelivery,
  checkDeliveryAvailability // ✅ НОВЫЙ ЭКСПОРТ
};