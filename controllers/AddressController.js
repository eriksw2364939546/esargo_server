// controllers/AddressController.js - ИСПРАВЛЕННЫЙ контроллер управления адресами
import {
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  getCustomerAddressById,
  setDefaultAddress as setDefaultAddressService, // ✅ ПЕРЕИМЕНОВАНО во избежание конфликта
  getDeliveryZones,
  generateMockAddresses
} from '../services/Address/address.service.js';

// ================ CRUD ОПЕРАЦИИ ================

/**
 * 📍 ДОБАВЛЕНИЕ НОВОГО АДРЕСА
 * POST /api/customers/addresses
 */
export const addAddress = async (req, res) => {
  try {
    const { user } = req;
    const addressData = req.body;

    console.log('📍 ADD ADDRESS Controller:', { 
      userId: user._id, 
      address: addressData.address 
    });

    // Базовая валидация обязательных полей
    if (!addressData.address || addressData.address.trim().length === 0) {
      return res.status(400).json({
        result: false,
        message: 'Адрес обязателен для заполнения'
      });
    }

    if (!addressData.name) {
      addressData.name = 'Дом'; // Значение по умолчанию
    }

    const result = await addCustomerAddress(user._id, addressData);

    res.status(201).json({
      result: true,
      message: 'Адрес успешно добавлен',
      address: result.address,
      total_addresses: result.profile.saved_addresses.length
    });

  } catch (error) {
    console.error('🚨 ADD ADDRESS Controller Error:', error);

    // Обработка ошибок валидации
    if (error.validationErrors) {
      return res.status(400).json({
        result: false,
        message: 'Ошибки валидации',
        errors: error.validationErrors
      });
    }

    // Определение статус кода
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('Максимальное количество') ? 422 :
                      error.message.includes('за пределами зон') ? 422 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || 'Ошибка при добавлении адреса'
    });
  }
};

/**
 * 📋 ПОЛУЧЕНИЕ ВСЕХ АДРЕСОВ ПОЛЬЗОВАТЕЛЯ
 * GET /api/customers/addresses
 */
export const getAddresses = async (req, res) => {
  try {
    const { user } = req;

    console.log('📋 GET ADDRESSES Controller:', { userId: user._id });

    const result = await getCustomerAddresses(user._id);

    res.status(200).json({
      result: true,
      message: 'Адреса получены успешно',
      addresses: result.addresses,
      total_count: result.total_count,
      delivery_zones_info: getDeliveryZones()
    });

  } catch (error) {
    console.error('🚨 GET ADDRESSES Controller Error:', error);

    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || 'Ошибка при получении адресов'
    });
  }
};

/**
 * 🎯 ПОЛУЧЕНИЕ КОНКРЕТНОГО АДРЕСА
 * GET /api/customers/addresses/:addressId
 */
export const getAddressById = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;

    console.log('🎯 GET ADDRESS BY ID Controller:', { 
      userId: user._id, 
      addressId 
    });

    if (!addressId) {
      return res.status(400).json({
        result: false,
        message: 'ID адреса обязателен'
      });
    }

    const result = await getCustomerAddressById(user._id, addressId);

    res.status(200).json({
      result: true,
      message: 'Адрес найден',
      address: result.address
    });

  } catch (error) {
    console.error('🚨 GET ADDRESS BY ID Controller Error:', error);

    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('Некорректные ID') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || 'Ошибка при получении адреса'
    });
  }
};

/**
 * ✏️ ОБНОВЛЕНИЕ АДРЕСА
 * PUT /api/customers/addresses/:addressId
 */
export const updateAddress = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;
    const updateData = req.body;

    console.log('✏️ UPDATE ADDRESS Controller:', { 
      userId: user._id, 
      addressId,
      updateFields: Object.keys(updateData)
    });

    if (!addressId) {
      return res.status(400).json({
        result: false,
        message: 'ID адреса обязателен'
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        result: false,
        message: 'Нет данных для обновления'
      });
    }

    const result = await updateCustomerAddress(user._id, addressId, updateData);

    res.status(200).json({
      result: true,
      message: 'Адрес успешно обновлен',
      address: result.address
    });

  } catch (error) {
    console.error('🚨 UPDATE ADDRESS Controller Error:', error);

    // Обработка ошибок валидации
    if (error.validationErrors) {
      return res.status(400).json({
        result: false,
        message: 'Ошибки валидации',
        errors: error.validationErrors
      });
    }

    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('Некорректные ID') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || 'Ошибка при обновлении адреса'
    });
  }
};

/**
 * 🗑️ УДАЛЕНИЕ АДРЕСА
 * DELETE /api/customers/addresses/:addressId
 */
export const removeAddress = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;

    console.log('🗑️ DELETE ADDRESS Controller:', { 
      userId: user._id, 
      addressId 
    });

    if (!addressId) {
      return res.status(400).json({
        result: false,
        message: 'ID адреса обязателен'
      });
    }

    const result = await deleteCustomerAddress(user._id, addressId);

    res.status(200).json({
      result: true,
      message: result.message,
      remaining_addresses: result.profile.saved_addresses.length
    });

  } catch (error) {
    console.error('🚨 DELETE ADDRESS Controller Error:', error);

    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('Некорректные ID') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || 'Ошибка при удалении адреса'
    });
  }
};

/**
 * 🏠 УСТАНОВКА ОСНОВНОГО АДРЕСА
 * PATCH /api/customers/addresses/:addressId/default
 */
export const setDefaultAddressController = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;

    console.log('🏠 SET DEFAULT ADDRESS Controller:', { 
      userId: user._id, 
      addressId 
    });

    if (!addressId) {
      return res.status(400).json({
        result: false,
        message: 'ID адреса обязателен'
      });
    }

    const result = await setDefaultAddressService(user._id, addressId);

    res.status(200).json({
      result: true,
      message: result.message,
      default_address: result.address
    });

  } catch (error) {
    console.error('🚨 SET DEFAULT ADDRESS Controller Error:', error);

    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('Некорректные ID') ? 400 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || 'Ошибка при установке основного адреса'
    });
  }
};

// ================ УТИЛИТАРНЫЕ ЭНДПОИНТЫ ================

/**
 * 🗺️ ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ЗОНАХ ДОСТАВКИ
 * GET /api/customers/addresses/delivery-zones
 */
export const getDeliveryZonesInfo = async (req, res) => {
  try {
    console.log('🗺️ GET DELIVERY ZONES INFO Controller');

    const zonesInfo = getDeliveryZones();

    res.status(200).json({
      result: true,
      message: 'Информация о зонах доставки',
      delivery_zones: zonesInfo
    });

  } catch (error) {
    console.error('🚨 GET DELIVERY ZONES Controller Error:', error);
    res.status(500).json({
      result: false,
      message: 'Ошибка при получении информации о зонах доставки'
    });
  }
};

/**
 * 🧪 ГЕНЕРАЦИЯ ТЕСТОВЫХ АДРЕСОВ (только для разработки)
 * GET /api/customers/addresses/mock-data
 */
export const getMockAddresses = async (req, res) => {
  try {
    console.log('🧪 GET MOCK ADDRESSES Controller');

    // Проверяем, что это режим разработки
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        result: false,
        message: 'Эндпоинт доступен только в режиме разработки'
      });
    }

    const mockAddresses = generateMockAddresses();

    res.status(200).json({
      result: true,
      message: 'Тестовые адреса для разработки',
      mock_addresses: mockAddresses,
      note: 'Эти данные только для тестирования'
    });

  } catch (error) {
    console.error('🚨 GET MOCK ADDRESSES Controller Error:', error);
    res.status(500).json({
      result: false,
      message: 'Ошибка при генерации тестовых данных'
    });
  }
};

/**
 * 🔍 ВАЛИДАЦИЯ АДРЕСА БЕЗ СОХРАНЕНИЯ
 * POST /api/customers/addresses/validate
 */
export const validateAddress = async (req, res) => {
  try {
    const { address, lat, lng } = req.body;

    console.log('🔍 VALIDATE ADDRESS Controller:', { address });

    if (!address || address.trim().length < 5) {
      return res.status(400).json({
        result: false,
        message: 'Адрес должен содержать минимум 5 символов'
      });
    }

    // Импортируем функции из сервиса
    const { mockGeocodeAddress, determineDeliveryZone } = await import('../services/Address/address.service.js');

    let validationResult;

    if (lat && lng) {
      // Если координаты переданы, проверяем их
      const zone = determineDeliveryZone(lat, lng);
      validationResult = {
        success: true,
        coordinates: { lat, lng },
        zone: zone,
        is_deliverable: zone !== null,
        formatted_address: address
      };
    } else {
      // Используем mock геокодирование
      validationResult = mockGeocodeAddress(address);
      validationResult.is_deliverable = validationResult.zone !== null;
    }

    res.status(200).json({
      result: true,
      message: validationResult.is_deliverable ? 'Адрес в зоне доставки' : 'Адрес за пределами зон доставки',
      validation: validationResult
    });

  } catch (error) {
    console.error('🚨 VALIDATE ADDRESS Controller Error:', error);
    res.status(500).json({
      result: false,
      message: 'Ошибка при валидации адреса'
    });
  }
};

// ================ ЭКСПОРТ КОНТРОЛЛЕРОВ ================



// Экспорт по умолчанию для совместимости
export default {
  addAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  removeAddress,
  setDefaultAddress: setDefaultAddressController, // ✅ ИСПОЛЬЗОВАНИЕ ПРАВИЛЬНОГО ИМЕНИ
  getDeliveryZonesInfo,
  getMockAddresses,
  validateAddress
};