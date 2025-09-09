// services/Address/address.service.js - Сервис управления адресами ESARGO
import { CustomerProfile } from '../../models/index.js';
import mongoose from 'mongoose';

// ================ КОНСТАНТЫ ДЛЯ МАРСЕЛЯ ================

const MARSEILLE_BOUNDS = {
  lat: { min: 43.200, max: 43.350 },
  lng: { min: 5.200, max: 5.600 }
};

const DELIVERY_ZONES = {
  1: { max_distance: 5, name: 'Центр Марселя' },
  2: { max_distance: 10, name: 'Большой Марсель' }
};

// ================ MOCK ГЕОКОДИРОВАНИЕ ================

/**
 * 🗺️ Mock геокодирование адреса (замена Google Maps API)
 * Возвращает координаты для тестовых адресов Марселя
 */
const mockGeocodeAddress = (address) => {
  const addressLower = address.toLowerCase();
  
  // Тестовые адреса для разработки
  const mockAddresses = {
    'vieux port marseille': { lat: 43.2951, lng: 5.3739, zone: 1 },
    'notre dame de la garde': { lat: 43.2842, lng: 5.3714, zone: 1 },
    'canebière marseille': { lat: 43.2946, lng: 5.3758, zone: 1 },
    'château d\'if': { lat: 43.2799, lng: 5.3256, zone: 2 },
    'calanques marseille': { lat: 43.2109, lng: 5.4414, zone: 2 },
    'aéroport marseille': { lat: 43.4393, lng: 5.2214, zone: 2 },
    'la joliette': { lat: 43.3067, lng: 5.3647, zone: 1 },
    'cours julien': { lat: 43.2929, lng: 5.3832, zone: 1 },
    'prado marseille': { lat: 43.2580, lng: 5.3927, zone: 1 },
    'castellane': { lat: 43.2884, lng: 5.3984, zone: 1 }
  };

  // Ищем точное совпадение
  for (const [mockAddr, coords] of Object.entries(mockAddresses)) {
    if (addressLower.includes(mockAddr) || mockAddr.includes(addressLower)) {
      return {
        success: true,
        coordinates: coords,
        formatted_address: address,
        zone: coords.zone
      };
    }
  }

  // Если адрес не найден в mock данных, возвращаем случайные координаты центра Марселя
  const randomLat = 43.295 + (Math.random() - 0.5) * 0.02;
  const randomLng = 5.375 + (Math.random() - 0.5) * 0.02;
  
  return {
    success: true,
    coordinates: { lat: randomLat, lng: randomLng, zone: 1 },
    formatted_address: address,
    zone: 1,
    mock_warning: 'Использованы случайные координаты для тестирования'
  };
};

/**
 * 📏 Расчет расстояния между координатами (Haversine formula)
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * 🎯 Определение зоны доставки по расстоянию от центра Марселя
 */
const determineDeliveryZone = (lat, lng) => {
  const centerMarseille = { lat: 43.2951, lng: 5.3739 }; // Vieux Port
  const distance = calculateDistance(centerMarseille.lat, centerMarseille.lng, lat, lng);
  
  if (distance <= DELIVERY_ZONES[1].max_distance) return 1;
  if (distance <= DELIVERY_ZONES[2].max_distance) return 2;
  return null; // За пределами зон доставки
};

// ================ ВАЛИДАЦИЯ ================

/**
 * ✅ Валидация данных адреса
 */
const validateAddressData = (addressData) => {
  const errors = [];

  // Проверка обязательных полей
  if (!addressData.address || addressData.address.trim().length < 5) {
    errors.push('Адрес должен содержать минимум 5 символов');
  }

  if (!addressData.name || !['Дом', 'Работа', 'Родители', 'Друзья', 'Другое'].includes(addressData.name)) {
    errors.push('Название адреса должно быть: Дом, Работа, Родители, Друзья или Другое');
  }

  // ✅ ИЗМЕНЕНИЕ: Валидация координат ТОЛЬКО если они переданы
  if (addressData.lat !== undefined || addressData.lng !== undefined) {
    // Если одна координата есть, должна быть и вторая
    if (addressData.lat === undefined || addressData.lng === undefined) {
      errors.push('Если указаны координаты, должны быть указаны и lat, и lng');
    } else {
      // Проверяем что это числа
      if (typeof addressData.lat !== 'number' || typeof addressData.lng !== 'number') {
        errors.push('Координаты должны быть числами');
      } else {
        // Проверка границ Марселя
        if (addressData.lat < MARSEILLE_BOUNDS.lat.min || addressData.lat > MARSEILLE_BOUNDS.lat.max) {
          errors.push('Координаты должны быть в пределах Марселя (широта)');
        }
        
        if (addressData.lng < MARSEILLE_BOUNDS.lng.min || addressData.lng > MARSEILLE_BOUNDS.lng.max) {
          errors.push('Координаты должны быть в пределах Марселя (долгота)');
        }
      }
    }
  }

  // Валидация деталей адреса
  if (addressData.details) {
    if (addressData.details.apartment && addressData.details.apartment.length > 20) {
      errors.push('Номер квартиры не должен превышать 20 символов');
    }
    
    if (addressData.details.delivery_notes && addressData.details.delivery_notes.length > 200) {
      errors.push('Заметки для курьера не должны превышать 200 символов');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ================ ОСНОВНЫЕ ФУНКЦИИ СЕРВИСА ================

/**
 * 📍 ДОБАВЛЕНИЕ НОВОГО АДРЕСА
 */
export const addCustomerAddress = async (userId, addressData) => {
  try {
    console.log('📍 ADD ADDRESS:', { userId, address: addressData.address });

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    // ✅ СНАЧАЛА делаем mock геокодирование если координаты не переданы
    let coordinates = { lat: addressData.lat, lng: addressData.lng };
    let zone = null;
    
    if (!addressData.lat || !addressData.lng) {
      const geocodeResult = mockGeocodeAddress(addressData.address);
      coordinates = geocodeResult.coordinates;
      zone = geocodeResult.zone;
      
      console.log('🗺️ MOCK GEOCODING:', {
        address: addressData.address,
        coordinates,
        zone
      });
    } else {
      zone = determineDeliveryZone(addressData.lat, addressData.lng);
    }

    // ✅ ТЕПЕРЬ валидируем данные С координатами
    const dataToValidate = {
      ...addressData,
      lat: coordinates.lat,
      lng: coordinates.lng
    };
    
    const validation = validateAddressData(dataToValidate);
    if (!validation.isValid) {
      const error = new Error('Ошибки валидации адреса');
      error.validationErrors = validation.errors;
      throw error;
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    // Проверка лимита адресов
    if (profile.saved_addresses.length >= 5) {
      throw new Error('Максимальное количество адресов: 5');
    }

    // Проверяем, что адрес в зоне доставки
    if (!zone) {
      throw new Error('Адрес находится за пределами зон доставки Марселя');
    }

    // Определяем, будет ли адрес основным
    const isFirstAddress = profile.saved_addresses.length === 0;
    const isDefault = isFirstAddress || addressData.is_default || false;

    // Если новый адрес основной, снимаем флаг с остальных
    if (isDefault) {
      profile.saved_addresses.forEach(addr => {
        addr.is_default = false;
      });
    }

    // Создаем новый адрес
    const newAddress = {
      address: addressData.address.trim(),
      lat: coordinates.lat,
      lng: coordinates.lng,
      name: addressData.name || 'Дом',
      is_default: isDefault,
      details: {
        apartment: addressData.details?.apartment || '',
        entrance: addressData.details?.entrance || '',
        intercom: addressData.details?.intercom || '',
        floor: addressData.details?.floor || '',
        delivery_notes: addressData.details?.delivery_notes || ''
      },
      delivery_info: {
        zone: zone,
        estimated_distance_km: calculateDistance(43.2951, 5.3739, coordinates.lat, coordinates.lng),
        order_count: 0,
        last_used_at: null
      },
      validation: {
        is_validated: true,
        validated_at: new Date(),
        validation_method: 'mock'
      }
    };

    profile.saved_addresses.push(newAddress);
    await profile.save();

    console.log('✅ ADDRESS ADDED:', { addressId: newAddress._id, zone });

    return {
      success: true,
      address: newAddress,
      profile: profile
    };

  } catch (error) {
    console.error('🚨 ADD ADDRESS Error:', error);
    throw error;
  }
};

/**
 * ✏️ ОБНОВЛЕНИЕ АДРЕСА
 */
export const updateCustomerAddress = async (userId, addressId, updateData) => {
  try {
    console.log('✏️ UPDATE ADDRESS:', { userId, addressId });

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(addressId)) {
      throw new Error('Некорректные ID');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    const address = profile.saved_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }

    // Валидация обновляемых данных
    const dataToValidate = { ...address.toObject(), ...updateData };
    const validation = validateAddressData(dataToValidate);
    if (!validation.isValid) {
      const error = new Error('Ошибки валидации адреса');
      error.validationErrors = validation.errors;
      throw error;
    }

    // Обновляем поля адреса
    if (updateData.address) {
      address.address = updateData.address.trim();
      
      // Если изменился адрес, делаем повторное геокодирование
      const geocodeResult = mockGeocodeAddress(updateData.address);
      address.lat = geocodeResult.coordinates.lat;
      address.lng = geocodeResult.coordinates.lng;
      address.delivery_info.zone = geocodeResult.zone;
      address.delivery_info.estimated_distance_km = calculateDistance(
        43.2951, 5.3739, geocodeResult.coordinates.lat, geocodeResult.coordinates.lng
      );
      address.validation.validated_at = new Date();
    }

    if (updateData.name) address.name = updateData.name;
    if (updateData.details) {
      address.details = { ...address.details, ...updateData.details };
    }

    // Обработка флага is_default
    if (updateData.is_default !== undefined) {
      if (updateData.is_default) {
        // Снимаем флаг с остальных адресов
        profile.saved_addresses.forEach(addr => {
          if (!addr._id.equals(addressId)) {
            addr.is_default = false;
          }
        });
      }
      address.is_default = updateData.is_default;
    }

    await profile.save();

    console.log('✅ ADDRESS UPDATED:', { addressId });

    return {
      success: true,
      address: address,
      profile: profile
    };

  } catch (error) {
    console.error('🚨 UPDATE ADDRESS Error:', error);
    throw error;
  }
};

/**
 * 🗑️ УДАЛЕНИЕ АДРЕСА
 */
export const deleteCustomerAddress = async (userId, addressId) => {
  try {
    console.log('🗑️ DELETE ADDRESS:', { userId, addressId });

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(addressId)) {
      throw new Error('Некорректные ID');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    const address = profile.saved_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }

    const wasDefault = address.is_default;
    
    // Удаляем адрес
    profile.saved_addresses.pull(addressId);

    // Если удаленный адрес был основным, назначаем основным первый оставшийся
    if (wasDefault && profile.saved_addresses.length > 0) {
      profile.saved_addresses[0].is_default = true;
    }

    await profile.save();

    console.log('✅ ADDRESS DELETED:', { addressId, wasDefault });

    return {
      success: true,
      message: 'Адрес успешно удален',
      profile: profile
    };

  } catch (error) {
    console.error('🚨 DELETE ADDRESS Error:', error);
    throw error;
  }
};

/**
 * 📋 ПОЛУЧЕНИЕ ВСЕХ АДРЕСОВ ПОЛЬЗОВАТЕЛЯ
 */
export const getCustomerAddresses = async (userId) => {
  try {
    console.log('📋 GET ADDRESSES:', { userId });

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    return {
      success: true,
      addresses: profile.saved_addresses,
      total_count: profile.saved_addresses.length
    };

  } catch (error) {
    console.error('🚨 GET ADDRESSES Error:', error);
    throw error;
  }
};

/**
 * 🎯 ПОЛУЧЕНИЕ АДРЕСА ПО ID
 */
export const getCustomerAddressById = async (userId, addressId) => {
  try {
    console.log('🎯 GET ADDRESS BY ID:', { userId, addressId });

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(addressId)) {
      throw new Error('Некорректные ID');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    const address = profile.saved_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }

    return {
      success: true,
      address: address
    };

  } catch (error) {
    console.error('🚨 GET ADDRESS BY ID Error:', error);
    throw error;
  }
};

/**
 * 🏠 УСТАНОВКА ОСНОВНОГО АДРЕСА
 */
export const setDefaultAddress = async (userId, addressId) => {
  try {
    console.log('🏠 SET DEFAULT ADDRESS:', { userId, addressId });

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(addressId)) {
      throw new Error('Некорректные ID');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    const address = profile.saved_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }

    // Снимаем флаг основного со всех адресов
    profile.saved_addresses.forEach(addr => {
      addr.is_default = false;
    });

    // Устанавливаем выбранный адрес как основной
    address.is_default = true;

    await profile.save();

    console.log('✅ DEFAULT ADDRESS SET:', { addressId });

    return {
      success: true,
      message: 'Основной адрес обновлен',
      address: address
    };

  } catch (error) {
    console.error('🚨 SET DEFAULT ADDRESS Error:', error);
    throw error;
  }
};

// ================ УТИЛИТАРНЫЕ ФУНКЦИИ ================

/**
 * 🧪 Получение доступных зон доставки
 */
export const getDeliveryZones = () => {
  return {
    zones: DELIVERY_ZONES,
    city: 'Марсель',
    bounds: MARSEILLE_BOUNDS
  };
};

/**
 * 🎲 Генерация тестовых адресов для разработки
 */
export const generateMockAddresses = () => {
  return [
    {
      address: 'Vieux Port, Marseille',
      lat: 43.2951,
      lng: 5.3739,
      name: 'Дом',
      details: { apartment: '12A', floor: '3' }
    },
    {
      address: 'Canebière, Marseille',
      lat: 43.2946,
      lng: 5.3758,
      name: 'Работа',
      details: { entrance: 'B', intercom: '142' }
    }
  ];
};

// ================ ЭКСПОРТ ================

export default {
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  getCustomerAddressById,
  setDefaultAddress,
  getDeliveryZones,
  generateMockAddresses,
  
  // Утилитарные функции
  mockGeocodeAddress,
  determineDeliveryZone,
  calculateDistance
};