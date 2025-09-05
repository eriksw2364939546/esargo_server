// services/Cart/cart.service.js - ОБНОВЛЕННЫЙ сервис корзины с интеграцией ESARGO доставки
import { Cart, Product, PartnerProfile } from '../../models/index.js';
import { updateCartDeliveryInfo } from '../Delivery/delivery.service.js'; // ✅ НОВАЯ ИНТЕГРАЦИЯ
import mongoose from 'mongoose';

/**
 * 🔍 НАЙТИ ИЛИ СОЗДАТЬ КОРЗИНУ
 */
export const findOrCreateCart = async (customerId, sessionId) => {
  try {
    console.log('🔍 FIND OR CREATE CART:', { customerId, sessionId });

    // Ищем активную корзину пользователя
    let cart = await Cart.findActiveCart(customerId, sessionId);

    if (!cart) {
      console.log('📝 No active cart found');
      return { cart: null };
    }

    // Обновляем активность корзины
    await cart.updateActivity();

    console.log('✅ Active cart found:', {
      cart_id: cart._id,
      items_count: cart.items.length,
      total_price: cart.pricing.total_price
    });

    return { cart };

  } catch (error) {
    console.error('🚨 FIND OR CREATE CART Error:', error);
    throw new Error('Ошибка получения корзины');
  }
};

/**
 * ➕ ДОБАВИТЬ ТОВАР В КОРЗИНУ
 */
export const addItemToCart = async (customerId, sessionId, itemData) => {
  try {
    const { product_id, quantity, selected_options, special_requests } = itemData;

    console.log('➕ ADD ITEM TO CART:', {
      customerId,
      product_id,
      quantity,
      options_count: selected_options.length
    });

    // 1. Найти и проверить продукт
    const product = await Product.findById(product_id);
    if (!product) {
      throw new Error('Товар не найден');
    }

    if (!product.is_active || !product.is_available) {
      throw new Error('Товар недоступен для заказа');
    }

    // 2. Найти ресторан
    const restaurant = await PartnerProfile.findById(product.partner_id);
    if (!restaurant) {
      throw new Error('Ресторан не найден');
    }

    if (!restaurant.is_active || !restaurant.is_approved) {
      throw new Error('Ресторан временно недоступен');
    }

    // 3. Найти существующую корзину или создать новую
    let cart = await Cart.findActiveCart(customerId, sessionId);

    if (cart) {
      // Проверка: можно добавлять товары только из одного ресторана
      if (cart.restaurant_id.toString() !== restaurant._id.toString()) {
        throw new Error('Нельзя добавлять товары из разных ресторанов в одну корзину. Очистите корзину или завершите текущий заказ.');
      }
    } else {
      // ✅ ОБНОВЛЕНО: Создать новую корзину с правильными зонами доставки
      const activeZones = restaurant.getActiveDeliveryZones();
      const minOrderAmount = activeZones.length > 0 ? activeZones[0].min_order_amount : 30;
      
      cart = new Cart({
        customer_id: customerId,
        session_id: sessionId,
        restaurant_id: restaurant._id,
        restaurant_info: {
          name: restaurant.business_name,
          category: restaurant.category,
          delivery_fee: 0, // ✅ БУДЕТ РАССЧИТАНА ДИНАМИЧЕСКИ
          min_order_amount: minOrderAmount // ✅ ИЗ НАСТРОЕК РЕСТОРАНА
        }
      });
    }

    // 4. Валидация выбранных опций для ресторанов
    let validatedOptions = [];
    if (restaurant.category === 'restaurant' && selected_options.length > 0) {
      // Проверить что опции существуют в продукте
      validatedOptions = selected_options.filter(option => {
        return product.options_groups?.some(group => 
          group.options.some(opt => 
            opt.name === option.option_name && 
            group.name === option.group_name
          )
        );
      });
    }

    // 5. Создать snapshot продукта
    const product_snapshot = {
      title: product.title,
      price: product.price,
      image_url: product.image_url || '',
      category: product.category
    };

    // 6. Рассчитать стоимость позиции
    const basePrice = product.price;
    const optionsPrice = validatedOptions.reduce((sum, opt) => sum + (opt.option_price || 0), 0);
    const itemTotal = (basePrice + optionsPrice) * quantity;

    // 7. Добавить товар в корзину
    const cartItem = {
      product_id,
      product_snapshot,
      title: product.title,
      price: basePrice,
      quantity,
      selected_options: validatedOptions,
      special_requests: special_requests || '',
      item_total: itemTotal
    };

    const isNewItem = await cart.addItem(cartItem);

    console.log('✅ Item added to cart:', {
      is_new_item: isNewItem,
      item_total: itemTotal,
      cart_total: cart.pricing.total_price
    });

    return {
      cart,
      addedItem: cartItem,
      isNewItem
    };

  } catch (error) {
    console.error('🚨 ADD ITEM TO CART Error:', error);
    throw error;
  }
};

/**
 * ✏️ ОБНОВИТЬ ТОВАР В КОРЗИНЕ
 */
export const updateCartItemService = async (customerId, sessionId, itemId, updateData) => {
  try {
    const { quantity, selected_options, special_requests } = updateData;

    console.log('✏️ UPDATE CART ITEM:', { customerId, itemId, quantity });

    // Найти корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    const updatedItem = await cart.updateItem(itemId, {
      quantity: parseInt(quantity),
      selected_options: selected_options || [],
      special_requests: special_requests || ''
    });

    console.log('✅ Cart item updated:', {
      item_id: itemId,
      new_quantity: quantity,
      new_total: updatedItem.item_total
    });

    return {
      cart,
      updatedItem
    };

  } catch (error) {
    console.error('🚨 UPDATE CART ITEM Error:', error);
    throw error;
  }
};

/**
 * 🗑️ УДАЛИТЬ ТОВАР ИЗ КОРЗИНЫ
 */
export const removeItemFromCart = async (customerId, sessionId, itemId) => {
  try {
    console.log('🗑️ REMOVE ITEM FROM CART:', { customerId, itemId });

    // Найти корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    const removedItem = await cart.removeItem(itemId);

    console.log('✅ Item removed from cart:', {
      removed_item: removedItem.title,
      remaining_items: cart.items.length
    });

    return {
      cart: cart.items.length > 0 ? cart : null,
      removedItem
    };

  } catch (error) {
    console.error('🚨 REMOVE ITEM FROM CART Error:', error);
    throw error;
  }
};

/**
 * 🗑️ ОЧИСТИТЬ КОРЗИНУ
 */
export const clearUserCart = async (customerId, sessionId) => {
  try {
    console.log('🗑️ CLEAR USER CART:', { customerId });

    // Найти корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    const clearedItemsCount = cart.items.length;
    const savedAmount = cart.pricing.total_price;

    // Очистить корзину
    await cart.clear();

    console.log('✅ Cart cleared:', {
      cleared_items: clearedItemsCount,
      saved_amount: savedAmount
    });

    return {
      clearedItemsCount,
      savedAmount
    };

  } catch (error) {
    console.error('🚨 CLEAR USER CART Error:', error);
    throw error;
  }
};

/**
 * ✅ ОБНОВЛЕНО: РАССЧИТАТЬ ДОСТАВКУ с интеграцией Delivery Service
 */
export const calculateDeliveryForCart = async (customerId, sessionId, deliveryAddress) => {
  try {
    const { lat, lng, address } = deliveryAddress;

    console.log('🚚 CALCULATE DELIVERY (NEW ESARGO SYSTEM):', { customerId, lat, lng });

    // Найти корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    if (cart.items.length === 0) {
      throw new Error('Корзина пуста');
    }

    // ✅ ИСПОЛЬЗУЕМ НОВЫЙ DELIVERY SERVICE
    const deliveryCoords = { lat, lng };
    const result = await updateCartDeliveryInfo(cart, deliveryCoords);

    if (!result.delivery_info.available) {
      throw new Error('Доставка по данному адресу недоступна');
    }

    // ✅ ОБНОВЛЯЕМ ИНФОРМАЦИЮ О ДОСТАВКЕ В КОРЗИНЕ
    await cart.setDeliveryInfo({
      address,
      lat,
      lng,
      distance_km: result.delivery_info.distance_km,
      estimated_delivery_time: result.delivery_info.estimated_minutes,
      delivery_fee: result.delivery_info.delivery_fee,
      delivery_zone: result.delivery_info.delivery_zone // ✅ НОВОЕ ПОЛЕ
    });

    console.log('✅ Delivery calculated (ESARGO SYSTEM):', {
      zone: result.delivery_info.delivery_zone,
      distance: `${result.delivery_info.distance_km}km`,
      fee: `${result.delivery_info.delivery_fee}€`,
      time: `${result.delivery_info.estimated_minutes} мин`,
      large_order: result.delivery_info.is_large_order
    });

    return {
      cart: result.cart,
      distance: result.delivery_info.distance_km,
      deliveryFee: result.delivery_info.delivery_fee,
      estimatedTime: result.delivery_info.estimated_minutes,
      // ✅ НОВЫЕ ПОЛЯ ESARGO
      deliveryZone: result.delivery_info.delivery_zone,
      isLargeOrder: result.delivery_info.is_large_order,
      deliverySystem: 'ESARGO_ZONES'
    };

  } catch (error) {
    console.error('🚨 CALCULATE DELIVERY Error:', error);
    throw error;
  }
};

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Проверка зон доставки ресторана
 */
export const checkRestaurantDeliveryZones = async (restaurantId) => {
  try {
    const restaurant = await PartnerProfile.findById(restaurantId);
    if (!restaurant) {
      throw new Error('Ресторан не найден');
    }

    const activeZones = restaurant.getActiveDeliveryZones();
    
    return {
      restaurant_id: restaurantId,
      restaurant_name: restaurant.business_name,
      delivery_zones: activeZones,
      can_deliver: activeZones.length > 0
    };

  } catch (error) {
    console.error('🚨 CHECK DELIVERY ZONES Error:', error);
    throw error;
  }
};

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Валидация корзины перед заказом
 */
export const validateCartForOrder = async (customerId, sessionId, deliveryAddress) => {
  try {
    console.log('✅ VALIDATE CART FOR ORDER:', { customerId });

    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Корзина не найдена');
    }

    const validationResults = {
      valid: true,
      issues: [],
      cart_summary: {
        items_count: cart.items.length,
        subtotal: cart.pricing.subtotal,
        total_price: cart.pricing.total_price
      }
    };

    // 1. Проверка пустоты
    if (cart.items.length === 0) {
      validationResults.valid = false;
      validationResults.issues.push({
        type: 'empty_cart',
        message: 'Корзина пуста'
      });
      return validationResults;
    }

    // 2. Проверка минимальной суммы
    if (!cart.meets_minimum_order) {
      validationResults.valid = false;
      validationResults.issues.push({
        type: 'minimum_order',
        message: `Минимальная сумма заказа: ${cart.restaurant_info.min_order_amount}€`,
        required_amount: cart.restaurant_info.min_order_amount,
        current_amount: cart.pricing.subtotal
      });
    }

    // 3. Проверка доступности доставки
    if (deliveryAddress) {
      try {
        const deliveryResult = await calculateDeliveryForCart(customerId, sessionId, deliveryAddress);
        validationResults.delivery_info = {
          available: true,
          zone: deliveryResult.deliveryZone,
          fee: deliveryResult.deliveryFee,
          distance: deliveryResult.distance
        };
      } catch (deliveryError) {
        validationResults.valid = false;
        validationResults.issues.push({
          type: 'delivery_unavailable',
          message: deliveryError.message
        });
      }
    }

    // 4. ✅ ПРОВЕРКА ДОСТУПНОСТИ ТОВАРОВ (базовая)
    for (const item of cart.items) {
      const product = await Product.findById(item.product_id);
      if (!product || !product.is_active || !product.is_available) {
        validationResults.valid = false;
        validationResults.issues.push({
          type: 'product_unavailable',
          message: `Товар "${item.title}" больше недоступен`,
          product_id: item.product_id
        });
      }
    }

    return validationResults;

  } catch (error) {
    console.error('🚨 VALIDATE CART Error:', error);
    throw error;
  }
};

/**
 * 🔄 КОНВЕРТИРОВАТЬ КОРЗИНУ В ЗАКАЗ
 */
export const convertCartToOrder = async (customerId, sessionId) => {
  try {
    console.log('🔄 CONVERT CART TO ORDER:', { customerId });

    // Найти активную корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    if (cart.items.length === 0) {
      throw new Error('Корзина пуста');
    }

    // Проверить минимальную сумму заказа
    if (!cart.meets_minimum_order) {
      throw new Error(`Минимальная сумма заказа ${cart.restaurant_info.min_order_amount}€`);
    }

    // ✅ ПРОВЕРКА ДОСТУПНОСТИ ТОВАРОВ перед конвертацией
    for (const item of cart.items) {
      const product = await Product.findById(item.product_id);
      if (!product || !product.is_available) {
        throw new Error(`Товар "${item.title}" больше недоступен`);
      }
    }

    // Конвертировать корзину в статус "converted_to_order"
    await cart.convertToOrder();

    console.log('✅ Cart converted to order');

    return { cart };

  } catch (error) {
    console.error('🚨 CONVERT CART TO ORDER Error:', error);
    throw error;
  }
};

// ============================================
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ (СОХРАНЯЕМ СОВМЕСТИМОСТЬ)
// ============================================

export default {
  // Основные функции (совместимость)
  findOrCreateCart,
  addItemToCart,
  updateCartItemService,
  removeItemFromCart,
  clearUserCart,
  calculateDeliveryForCart, // ✅ ОБНОВЛЕНА
  convertCartToOrder,
  
  // ✅ НОВЫЕ ФУНКЦИИ
  checkRestaurantDeliveryZones,
  validateCartForOrder
};
