// controllers/CartController.js - Контроллеры корзины покупок
import { 
  findOrCreateCart,
  addItemToCart,
  updateCartItemService,
  removeItemFromCart,
  clearUserCart,
  calculateDeliveryForCart
} from '../services/Cart/cart.service.js';

/**
 * 🛒 ПОЛУЧИТЬ СОДЕРЖИМОЕ КОРЗИНЫ
 * GET /api/cart
 */
const getCart = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;

    console.log('🛒 GET CART:', { 
      customer_id: user._id, 
      session_id: sessionId 
    });

    const result = await findOrCreateCart(user._id, sessionId);

    res.status(200).json({
      result: true,
      message: result.cart ? "Корзина получена" : "Корзина пуста",
      cart: result.cart,
      summary: {
        total_items: result.cart ? result.cart.total_items : 0,
        subtotal: result.cart ? result.cart.pricing.subtotal : 0,
        total_price: result.cart ? result.cart.pricing.total_price : 0,
        meets_minimum_order: result.cart ? result.cart.meets_minimum_order : false
      }
    });

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
      message: result.isNewItem ? "Товар добавлен в корзину" : "Количество товара увеличено",
      cart: result.cart,
      added_item: result.addedItem,
      summary: {
        total_items: result.cart.total_items,
        subtotal: result.cart.pricing.subtotal,
        total_price: result.cart.pricing.total_price
      }
    });

  } catch (error) {
    console.error('🚨 ADD TO CART Error:', error);
    
    // Определение статуса ошибки
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('разных ресторанов') || 
               error.message.includes('не активен')) {
      statusCode = 400;
    }

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
    const updateData = req.body;

    console.log('✏️ UPDATE CART ITEM:', {
      customer_id: user._id,
      item_id,
      updates: Object.keys(updateData)
    });

    // Валидация
    if (updateData.quantity && updateData.quantity < 1) {
      return res.status(400).json({
        result: false,
        message: "Количество должно быть больше 0"
      });
    }

    const result = await updateCartItemService(user._id, sessionId, item_id, updateData);

    res.status(200).json({
      result: true,
      message: "Товар в корзине обновлен",
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
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('больше 0')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка обновления товара в корзине"
    });
  }
};

/**
 * ❌ УДАЛИТЬ ТОВАР ИЗ КОРЗИНЫ
 * DELETE /api/cart/items/:item_id
 */
const removeFromCart = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const { item_id } = req.params;

    console.log('❌ REMOVE FROM CART:', {
      customer_id: user._id,
      item_id
    });

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
 * 🚚 РАССЧИТАТЬ ДОСТАВКУ
 * POST /api/cart/calculate-delivery
 */
const calculateDelivery = async (req, res) => {
  try {
    const { user } = req;
    const sessionId = req.sessionID;
    const { delivery_address } = req.body;

    console.log('🚚 CALCULATE DELIVERY:', {
      customer_id: user._id,
      has_address: !!delivery_address
    });

    // Валидация адреса доставки
    if (!delivery_address || !delivery_address.lat || !delivery_address.lng) {
      return res.status(400).json({
        result: false,
        message: "Координаты доставки (lat, lng) обязательны"
      });
    }

    if (!delivery_address.address) {
      return res.status(400).json({
        result: false,
        message: "Адрес доставки обязателен"
      });
    }

    const result = await calculateDeliveryForCart(user._id, sessionId, delivery_address);

    res.status(200).json({
      result: true,
      message: "Доставка рассчитана",
      cart: result.cart,
      delivery: {
        fee: result.deliveryFee,
        distance_km: result.distance,
        estimated_time_minutes: result.estimatedTime,
        address: delivery_address.address
      },
      pricing: {
        subtotal: result.cart.pricing.subtotal,
        delivery_fee: result.cart.pricing.delivery_fee,
        service_fee: result.cart.pricing.service_fee,
        total_price: result.cart.pricing.total_price
      }
    });

  } catch (error) {
    console.error('🚨 CALCULATE DELIVERY Error:', error);
    
    let statusCode = 500;
    if (error.message.includes('не найден')) {
      statusCode = 404;
    } else if (error.message.includes('пуста') || 
               error.message.includes('координаты')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка расчета доставки"
    });
  }
};

export { getCart, addToCart, updateCartItem, removeFromCart, clearCart, calculateDelivery }