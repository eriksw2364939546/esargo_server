// services/Cart/cart.service.js - Сервисы корзины покупок
import { Cart, Product, PartnerProfile } from '../../models/index.js';
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
      // Создать новую корзину
      cart = new Cart({
        customer_id: customerId,
        session_id: sessionId,
        restaurant_id: restaurant._id,
        restaurant_info: {
          name: restaurant.business_name,
          category: restaurant.category,
          delivery_fee: 3.50, // Стандартная стоимость доставки
          min_order_amount: 15.00 // Минимальная сумма заказа
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

    // 6. Добавить товар в корзину
    const addResult = await cart.addItem({
      product_id: product._id,
      product_snapshot,
      quantity,
      selected_options: validatedOptions,
      special_requests
    });

    console.log('✅ Item added to cart:', {
      cart_id: cart._id,
      total_items: cart.total_items,
      subtotal: cart.pricing.subtotal
    });

    return {
      cart,
      addedItem: cart.items[cart.items.length - 1],
      isNewItem: true
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
    console.log('✏️ UPDATE CART ITEM:', { customerId, itemId, updateData });

    // Найти корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    // Найти товар в корзине
    const item = cart.items.id(itemId);
    if (!item) {
      throw new Error('Товар не найден в корзине');
    }

    // Обновить товар
    await cart.updateItem(itemId, updateData);

    console.log('✅ Cart item updated:', {
      item_id: itemId,
      new_quantity: item.quantity,
      new_total: item.total_item_price
    });

    return {
      cart,
      updatedItem: item
    };

  } catch (error) {
    console.error('🚨 UPDATE CART ITEM Error:', error);
    throw error;
  }
};

/**
 * ❌ УДАЛИТЬ ТОВАР ИЗ КОРЗИНЫ
 */
export const removeItemFromCart = async (customerId, sessionId, itemId) => {
  try {
    console.log('❌ REMOVE ITEM FROM CART:', { customerId, itemId });

    // Найти корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    // Найти товар
    const item = cart.items.id(itemId);
    if (!item) {
      throw new Error('Товар не найден в корзине');
    }

    const removedItem = { ...item.toObject() };

    // Удалить товар
    await cart.removeItem(itemId);

    console.log('✅ Item removed from cart:', {
      item_id: itemId,
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
 * 🚚 РАССЧИТАТЬ ДОСТАВКУ
 */
export const calculateDeliveryForCart = async (customerId, sessionId, deliveryAddress) => {
  try {
    const { lat, lng, address } = deliveryAddress;

    console.log('🚚 CALCULATE DELIVERY:', { customerId, lat, lng });

    // Найти корзину
    const cart = await Cart.findActiveCart(customerId, sessionId);
    if (!cart) {
      throw new Error('Активная корзина не найдена');
    }

    if (cart.items.length === 0) {
      throw new Error('Корзина пуста');
    }

    // Найти ресторан
    const restaurant = await PartnerProfile.findById(cart.restaurant_id);
    if (!restaurant) {
      throw new Error('Ресторан не найден');
    }

    // Рассчитать расстояние (упрощенно)
    const restaurantLat = restaurant.location?.coordinates?.[1] || 48.8566;
    const restaurantLng = restaurant.location?.coordinates?.[0] || 2.3522;

    const distance = calculateDistance(restaurantLat, restaurantLng, lat, lng);

    // Рассчитать стоимость и время доставки
    let deliveryFee = 3.50; // Базовая стоимость
    let estimatedTime = 30; // Базовое время в минутах

    if (distance > 5) {
      deliveryFee += (distance - 5) * 0.50; // +0.50€ за каждый км свыше 5км
      estimatedTime += Math.round(distance * 2); // +2 мин за км
    }

    // Минимальная доставка 2€, максимальная 8€
    deliveryFee = Math.max(2.00, Math.min(8.00, deliveryFee));
    deliveryFee = Math.round(deliveryFee * 100) / 100; // Округление до центов

    // Установить информацию о доставке
    await cart.setDeliveryInfo({
      address,
      lat,
      lng,
      distance_km: Math.round(distance * 100) / 100,
      estimated_delivery_time: estimatedTime,
      delivery_fee: deliveryFee
    });

    console.log('✅ Delivery calculated:', {
      distance: `${distance.toFixed(1)}km`,
      fee: `${deliveryFee}€`,
      time: `${estimatedTime} мин`
    });

    return {
      cart,
      distance,
      deliveryFee,
      estimatedTime
    };

  } catch (error) {
    console.error('🚨 CALCULATE DELIVERY Error:', error);
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

    // Проверить что все товары еще доступны
    for (const item of cart.items) {
      const product = await Product.findById(item.product_id);
      if (!product || !product.is_available) {
        throw new Error(`Товар "${item.product_snapshot.title}" больше недоступен`);
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

// ================ УТИЛИТЫ ================

/**
 * Рассчитать расстояние между двумя точками (формула Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в километрах
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Расстояние в км
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}