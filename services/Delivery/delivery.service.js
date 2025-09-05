// services/Delivery/delivery.service.js - СЕРВИС РАСЧЕТА ДОСТАВКИ ESARGO
import { PartnerProfile } from '../../models/index.js';

// ============================================
// MOCK ДАННЫЕ ДЛЯ ТЕСТИРОВАНИЯ (без Google API)
// ============================================

// Mock координаты центра города (для расчета зон)
const CITY_CENTER = {
  lat: 43.2965,  // Примерные координаты Марселя
  lng: 5.3698
};

// Тарифы доставки ESARGO по зонам
const DELIVERY_RATES = {
  zone_1: {
    distance_range: [0, 5],        // 0-5км
    delivery_fee_large: 6,         // Заказ ≥30€
    delivery_fee_small: 9          // Заказ <30€
  },
  zone_2: {
    distance_range: [5, 10],       // 5-10км  
    delivery_fee_large: 10,        // Заказ ≥30€
    delivery_fee_small: 13         // Заказ <30€
  }
};

// Часы пик с доплатами
const PEAK_HOURS = [
  { start: '11:30', end: '14:00', surcharge: 1.50 }, // Обеденный час пик
  { start: '18:00', end: '21:00', surcharge: 2.00 }  // Вечерний час пик
];

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ РАСЧЕТА ДОСТАВКИ
// ============================================

/**
 * ✅ ГЛАВНАЯ ФУНКЦИЯ: Полный расчет доставки
 * @param {Object} deliveryData - Данные для расчета
 * @param {number} deliveryData.restaurant_lat - Широта ресторана
 * @param {number} deliveryData.restaurant_lng - Долгота ресторана
 * @param {number} deliveryData.delivery_lat - Широта доставки
 * @param {number} deliveryData.delivery_lng - Долгота доставки
 * @param {number} deliveryData.order_total - Сумма заказа
 * @param {Date} deliveryData.order_time - Время заказа (для часов пик)
 * @returns {Object} Полная информация о доставке
 */
export const calculateFullDelivery = async (deliveryData) => {
  try {
    const {
      restaurant_lat,
      restaurant_lng,
      delivery_lat,
      delivery_lng,
      order_total = 0,
      order_time = new Date()
    } = deliveryData;

    console.log('🚚 CALCULATE FULL DELIVERY:', {
      restaurant_coords: `${restaurant_lat}, ${restaurant_lng}`,
      delivery_coords: `${delivery_lat}, ${delivery_lng}`,
      order_total,
      order_time: order_time.toISOString().slice(11, 16) // HH:MM
    });

    // 1. Валидация координат
    validateCoordinates(restaurant_lat, restaurant_lng, delivery_lat, delivery_lng);

    // 2. Расчет расстояния (mock)
    const distance = calculateMockDistance(
      restaurant_lat, restaurant_lng,
      delivery_lat, delivery_lng
    );

    // 3. Определение зоны доставки
    const zone = determineDeliveryZone(distance);
    if (!zone) {
      throw new Error('Доставка недоступна: расстояние более 10км');
    }

    // 4. Проверка часов пик
    const peakInfo = checkPeakHours(order_time);

    // 5. Расчет стоимости доставки
    const deliveryFee = calculateDeliveryFee(zone, order_total);

    // 6. Расчет заработка курьера
    const courierEarnings = calculateCourierEarnings(zone, deliveryFee, peakInfo.surcharge);

    // 7. Расчет времени доставки
    const estimatedTime = calculateEstimatedDeliveryTime(distance, zone);

    // 8. Формирование полного ответа
    const result = {
      // Основная информация
      distance_km: Math.round(distance * 100) / 100,
      delivery_zone: zone,
      delivery_fee: deliveryFee,
      estimated_delivery_minutes: estimatedTime,
      
      // Финансовая информация
      peak_hour_info: peakInfo,
      courier_earnings: courierEarnings,
      platform_commission: Math.round(order_total * 0.10 * 100) / 100, // 10%
      
      // Детализация тарифов
      rate_info: {
        zone_rates: DELIVERY_RATES[`zone_${zone}`],
        is_large_order: order_total >= 30,
        base_fee: deliveryFee - (peakInfo.surcharge || 0),
        peak_surcharge: peakInfo.surcharge || 0
      },
      
      // Мета информация
      calculation_method: 'mock_data',
      calculated_at: new Date().toISOString()
    };

    console.log('✅ DELIVERY CALCULATION SUCCESS:', {
      distance: result.distance_km,
      zone: result.delivery_zone,
      fee: result.delivery_fee,
      courier_earnings: result.courier_earnings
    });

    return result;

  } catch (error) {
    console.error('🚨 CALCULATE FULL DELIVERY ERROR:', error);
    throw error;
  }
};

/**
 * ✅ БЫСТРЫЙ РАСЧЕТ: Только стоимость доставки
 * Для использования в корзине перед оформлением заказа
 */
export const calculateDeliveryFeeOnly = async (restaurant_coords, delivery_coords, order_total = 0) => {
  try {
    const distance = calculateMockDistance(
      restaurant_coords.lat, restaurant_coords.lng,
      delivery_coords.lat, delivery_coords.lng
    );

    const zone = determineDeliveryZone(distance);
    if (!zone) {
      return {
        available: false,
        reason: 'Доставка недоступна: расстояние более 10км',
        max_distance: 10
      };
    }

    const delivery_fee = calculateDeliveryFee(zone, order_total);
    const estimated_time = calculateEstimatedDeliveryTime(distance, zone);

    return {
      available: true,
      distance_km: Math.round(distance * 100) / 100,
      delivery_zone: zone,
      delivery_fee,
      estimated_minutes: estimated_time,
      is_large_order: order_total >= 30
    };

  } catch (error) {
    console.error('🚨 CALCULATE DELIVERY FEE ERROR:', error);
    throw error;
  }
};

/**
 * ✅ ПРОВЕРКА ЗОНЫ: Можем ли доставить по адресу
 */
export const checkDeliveryAvailability = async (restaurant_coords, delivery_coords) => {
  try {
    const distance = calculateMockDistance(
      restaurant_coords.lat, restaurant_coords.lng,
      delivery_coords.lat, delivery_coords.lng
    );

    const zone = determineDeliveryZone(distance);

    return {
      available: !!zone,
      distance_km: Math.round(distance * 100) / 100,
      delivery_zone: zone,
      max_distance: 10,
      reason: zone ? 'Доставка доступна' : 'Превышено максимальное расстояние доставки'
    };

  } catch (error) {
    console.error('🚨 CHECK DELIVERY AVAILABILITY ERROR:', error);
    return {
      available: false,
      reason: 'Ошибка проверки доступности доставки'
    };
  }
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Mock расчет расстояния (формула Haversine)
 * В будущем заменится на Google Distance Matrix API
 */
function calculateMockDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Радиус Земли в км
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(value) {
  return value * Math.PI / 180;
}

/**
 * Определение зоны доставки по расстоянию
 */
function determineDeliveryZone(distance) {
  if (distance <= 5) return 1;      // Зона 1: 0-5км
  if (distance <= 10) return 2;     // Зона 2: 5-10км
  return null;                      // Доставка недоступна
}

/**
 * Расчет стоимости доставки по зоне и сумме заказа
 */
function calculateDeliveryFee(zone, orderTotal) {
  const rates = DELIVERY_RATES[`zone_${zone}`];
  if (!rates) return 0;

  const isLargeOrder = orderTotal >= 30;
  return isLargeOrder ? rates.delivery_fee_large : rates.delivery_fee_small;
}

/**
 * Проверка часов пик
 */
function checkPeakHours(orderTime) {
  const currentTime = orderTime.toTimeString().slice(0, 5); // HH:MM
  
  for (const peak of PEAK_HOURS) {
    if (currentTime >= peak.start && currentTime <= peak.end) {
      return {
        is_peak_hour: true,
        surcharge: peak.surcharge,
        period: `${peak.start}-${peak.end}`,
        reason: 'Час пик'
      };
    }
  }
  
  return {
    is_peak_hour: false,
    surcharge: 0,
    period: null,
    reason: 'Обычное время'
  };
}

/**
 * Расчет заработка курьера
 */
function calculateCourierEarnings(zone, deliveryFee, peakSurcharge = 0) {
  const baseEarnings = deliveryFee; // Курьер получает всю стоимость доставки
  const peakBonus = peakSurcharge || 0;
  
  return {
    base_earnings: baseEarnings,
    peak_bonus: peakBonus,
    total_earnings: baseEarnings + peakBonus,
    zone: zone
  };
}

/**
 * Расчет времени доставки
 */
function calculateEstimatedDeliveryTime(distance, zone) {
  // Базовое время: 15 минут подготовки + время в пути
  const preparationTime = 15;
  const travelTime = Math.round(distance * 3); // ~3 минуты на км
  
  // Добавляем время на поиск курьера в зависимости от зоны
  const courierSearchTime = zone === 1 ? 5 : 10;
  
  return preparationTime + travelTime + courierSearchTime;
}

/**
 * Валидация координат
 */
function validateCoordinates(lat1, lng1, lat2, lng2) {
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    throw new Error('Некорректные координаты');
  }
}

function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' && 
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

// ============================================
// УТИЛИТЫ ДЛЯ ИНТЕГРАЦИИ
// ============================================

/**
 * ✅ ОБНОВЛЕНИЕ КОРЗИНЫ с новой стоимостью доставки
 * Интегрируется с существующим Cart Service
 */
export const updateCartDeliveryInfo = async (cart, delivery_coords) => {
  try {
    // Получаем координаты ресторана
    const restaurant = await PartnerProfile.findById(cart.restaurant_id);
    if (!restaurant) {
      throw new Error('Ресторан не найден');
    }

    const restaurant_coords = {
      lat: restaurant.location.coordinates[1], // MongoDB хранит [lng, lat]
      lng: restaurant.location.coordinates[0]
    };

    // Рассчитываем доставку
    const deliveryInfo = await calculateDeliveryFeeOnly(
      restaurant_coords,
      delivery_coords,
      cart.pricing.subtotal
    );

    if (!deliveryInfo.available) {
      throw new Error(deliveryInfo.reason);
    }

    // Обновляем корзину (НЕ сохраняем, только обновляем объект)
    cart.pricing.delivery_fee = deliveryInfo.delivery_fee;
    cart.pricing.total_price = cart.pricing.subtotal + deliveryInfo.delivery_fee + (cart.pricing.service_fee || 0);
    
    // Добавляем информацию о доставке
    cart.delivery_info = {
      zone: deliveryInfo.delivery_zone,
      distance_km: deliveryInfo.distance_km,
      estimated_minutes: deliveryInfo.estimated_minutes,
      updated_at: new Date()
    };

    return {
      cart,
      delivery_info: deliveryInfo
    };

  } catch (error) {
    console.error('🚨 UPDATE CART DELIVERY ERROR:', error);
    throw error;
  }
};

/**
 * ✅ ПОЛУЧЕНИЕ ТАРИФОВ для отображения клиенту
 */
export const getDeliveryRates = () => {
  return {
    zones: [
      {
        zone: 1,
        distance: '0-5 км',
        rates: {
          large_order: `${DELIVERY_RATES.zone_1.delivery_fee_large}€ (заказ ≥30€)`,
          small_order: `${DELIVERY_RATES.zone_1.delivery_fee_small}€ (заказ <30€)`
        }
      },
      {
        zone: 2,
        distance: '5-10 км',
        rates: {
          large_order: `${DELIVERY_RATES.zone_2.delivery_fee_large}€ (заказ ≥30€)`,
          small_order: `${DELIVERY_RATES.zone_2.delivery_fee_small}€ (заказ <30€)`
        }
      }
    ],
    peak_hours: PEAK_HOURS.map(peak => ({
      period: `${peak.start}-${peak.end}`,
      surcharge: `+${peak.surcharge}€`
    })),
    max_distance: 10,
    min_order_discount: 30
  };
};

/**
 * ✅ СТАТИСТИКА по зонам доставки
 */
export const getDeliveryZoneStats = async (dateFrom, dateTo) => {
  try {
    // Здесь будет интеграция с Order model для получения статистики
    // Пока возвращаем mock данные
    return {
      zone_1: {
        total_orders: 150,
        avg_delivery_time: 25,
        total_earnings: 900,
        avg_distance: 3.2
      },
      zone_2: {
        total_orders: 85,
        avg_delivery_time: 35,
        total_earnings: 850,
        avg_distance: 7.1
      },
      peak_hours_impact: {
        orders_during_peak: 45,
        additional_earnings: 67.50
      }
    };
  } catch (error) {
    console.error('🚨 GET DELIVERY STATS ERROR:', error);
    throw error;
  }
};

// ============================================
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ
// ============================================

export default {
  // Основные функции
  calculateFullDelivery,
  calculateDeliveryFeeOnly,
  checkDeliveryAvailability,
  
  // Интеграция
  updateCartDeliveryInfo,
  
  // Утилиты
  getDeliveryRates,
  getDeliveryZoneStats,
  
  // Внутренние функции (для тестирования)
  determineDeliveryZone,
  calculateMockDistance,
  checkPeakHours,
  calculateCourierEarnings
};