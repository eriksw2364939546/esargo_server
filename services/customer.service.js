// services/customer.service.js (обновленный с валидацией)
import { User, CustomerProfile } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashString, hashMeta } from '../utils/hash.js';
import mongoose from 'mongoose';

/**
 * ВАЛИДАЦИЯ ДАННЫХ КЛИЕНТА
 */

/**
 * Валидация данных профиля клиента
 * @param {object} profileData - Данные профиля
 * @param {boolean} isUpdate - Режим обновления (необязательные поля)
 * @returns {object} - Результат валидации
 */
const validateCustomerProfileData = (profileData, isUpdate = false) => {
  const { first_name, last_name, phone, preferred_language } = profileData;
  const errors = [];

  // Проверка имени
  if (!isUpdate || first_name !== undefined) {
    if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
      errors.push('Имя обязательно');
    } else if (first_name.trim().length < 2) {
      errors.push('Имя должно содержать минимум 2 символа');
    } else if (first_name.trim().length > 50) {
      errors.push('Имя не может быть длиннее 50 символов');
    }
  }

  // Проверка фамилии
  if (!isUpdate || last_name !== undefined) {
    if (!last_name || typeof last_name !== 'string' || last_name.trim().length === 0) {
      errors.push('Фамилия обязательна');
    } else if (last_name.trim().length < 2) {
      errors.push('Фамилия должна содержать минимум 2 символа');
    } else if (last_name.trim().length > 50) {
      errors.push('Фамилия не может быть длиннее 50 символов');
    }
  }

  // Проверка телефона (если предоставлен)
  if (phone !== undefined && phone !== null && phone !== '') {
    // Французский формат телефона: +33 или 0, затем 9 цифр
    const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/;
    const normalizedPhone = phone.replace(/[\s\-\.]/g, '');
    
    if (!phoneRegex.test(normalizedPhone)) {
      errors.push('Неверный формат телефона (ожидается французский формат: +33XXXXXXXXX или 0XXXXXXXXX)');
    }
  }

  // Проверка языка
  if (preferred_language !== undefined) {
    const allowedLanguages = ['ru', 'fr', 'en'];
    if (!allowedLanguages.includes(preferred_language)) {
      errors.push('Неподдерживаемый язык. Доступны: ru, fr, en');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Валидация адреса доставки
 * @param {object} addressData - Данные адреса
 * @returns {object} - Результат валидации
 */
const validateDeliveryAddress = (addressData) => {
  const { label, address, lat, lng } = addressData;
  const errors = [];

  // Проверка метки
  const allowedLabels = ['Дом', 'Работа', 'Другое'];
  if (!label || !allowedLabels.includes(label)) {
    errors.push('Метка адреса обязательна. Доступны: Дом, Работа, Другое');
  }

  // Проверка адреса
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    errors.push('Адрес обязателен');
  } else if (address.trim().length < 10) {
    errors.push('Адрес должен содержать минимум 10 символов');
  }

  // Проверка координат
  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    errors.push('Неверная широта (должна быть числом от -90 до 90)');
  }
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    errors.push('Неверная долгота (должна быть числом от -180 до 180)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * ОСНОВНЫЕ ФУНКЦИИ СЕРВИСА
 */

/**
 * Получение профиля клиента (ИСПРАВЛЕНО - скрываем email в сервисе)
 * @param {string} userId - ID пользователя
 * @returns {object} - Профиль клиента
 */
export const getCustomerProfile = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    const user = await User.findById(userId).select('-password_hash');
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    if (user.role !== 'customer') {
      throw new Error('Доступ разрешен только для клиентов');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    // 🔐 РАСШИФРОВЫВАЕМ email для отображения (как в партнерской системе)
    let displayEmail = '[EMAIL_PROTECTED]';
    try {
      displayEmail = decryptString(user.email);
    } catch (error) {
      console.warn('Could not decrypt email for profile display');
      displayEmail = '[EMAIL_DECRYPT_ERROR]';
    }
    
    // Расшифровываем чувствительные данные для отображения
    const decryptedProfile = {
      ...profile.toObject(),
      phone: profile.phone ? decryptString(profile.phone) : null
    };

    return {
      user: {
        id: user._id,
        email: displayEmail, // ✅ Email остается как есть в User модели
        role: user.role,
        is_email_verified: user.is_email_verified,
        is_active: user.is_active
      },
      profile: decryptedProfile
    };

  } catch (error) {
    console.error('Get customer profile error:', error);
    throw error;
  }
};

/**
 * Обновление профиля клиента
 * @param {string} userId - ID пользователя
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Обновленный профиль
 */
export const updateCustomerProfile = async (userId, updateData) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    if (user.role !== 'customer') {
      throw new Error('Доступ разрешен только для клиентов');
    }

    // ВАЛИДАЦИЯ данных профиля
    const validation = validateCustomerProfileData(updateData, true);
    if (!validation.isValid) {
      const error = new Error('Ошибки валидации данных');
      error.validationErrors = validation.errors;
      throw error;
    }

    // Подготавливаем данные для обновления User модели
    const userUpdateData = {};
    const profileUpdateData = {};

    // Обработка email (если изменяется)
    if (updateData.email && updateData.email !== user.email) {
      const normalizedEmail = updateData.email.toLowerCase().trim();
      
      // 🔐 ВАЛИДАЦИЯ email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        throw new Error('Неверный формат email');
      }
      
      // Проверяем, не занят ли новый email через Meta
      const hashedNewEmail = hashMeta(normalizedEmail);
      const existingMeta = await Meta.findOne({
        em: hashedNewEmail,
        role: 'customer',
        customer: { $ne: userId }
      });

      if (existingMeta) {
        throw new Error('Пользователь с таким email уже существует');
      }

      // 🔐 ЗАШИФРОВЫВАЕМ новый email (как в партнерской системе)
      userUpdateData.email = cryptoString(normalizedEmail);
      userUpdateData.is_email_verified = false;
      
      // Обновляем Meta запись с новым хешированным email
      await Meta.findOneAndUpdate(
        { customer: userId, role: 'customer' },
        { em: hashedNewEmail }
      );
    }

    // Обработка пароля
    if (updateData.password) {
      // ВАЛИДАЦИЯ пароля
      if (updateData.password.length < 6) {
        throw new Error('Пароль должен содержать минимум 6 символов');
      }
      if (updateData.password.length > 128) {
        throw new Error('Пароль не может быть длиннее 128 символов');
      }
      
      userUpdateData.password_hash = await hashString(updateData.password);
    }

    // Обработка данных профиля с НОРМАЛИЗАЦИЕЙ
    if (updateData.first_name !== undefined) {
      profileUpdateData.first_name = updateData.first_name.trim();
    }

    if (updateData.last_name !== undefined) {
      profileUpdateData.last_name = updateData.last_name.trim();
    }

    if (updateData.phone !== undefined) {
      if (updateData.phone) {
        // Нормализуем и шифруем телефон
        const normalizedPhone = updateData.phone.replace(/[\s\-\.]/g, '');
        profileUpdateData.phone = cryptoString(normalizedPhone);
      } else {
        profileUpdateData.phone = null;
      }
    }

    // Обработка настроек
    if (updateData.settings) {
      const currentProfile = await CustomerProfile.findOne({ user_id: userId });
      profileUpdateData.settings = {
        ...currentProfile?.settings?.toObject(),
        ...updateData.settings
      };
      
      // ВАЛИДАЦИЯ языка в настройках
      if (updateData.settings.preferred_language) {
        const allowedLanguages = ['ru', 'fr', 'en'];
        if (!allowedLanguages.includes(updateData.settings.preferred_language)) {
          throw new Error('Неподдерживаемый язык. Доступны: ru, fr, en');
        }
      }
    }

    // Обновляем пользователя
    if (Object.keys(userUpdateData).length > 0) {
      await User.findByIdAndUpdate(userId, userUpdateData);
    }

    // Обновляем профиль
    const updatedProfile = await CustomerProfile.findOneAndUpdate(
      { user_id: userId },
      profileUpdateData,
      { new: true, runValidators: false }
    );

    if (!updatedProfile) {
      throw new Error('Профиль не найден для обновления');
    }

    // Возвращаем обновленные данные
    return await getCustomerProfile(userId);

  } catch (error) {
    console.error('Update customer profile error:', error);
    throw error;
  }
};

/**
 * Добавление адреса доставки
 * @param {string} userId - ID пользователя
 * @param {object} addressData - Данные адреса
 * @returns {object} - Обновленный профиль
 */
export const addDeliveryAddress = async (userId, addressData) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    // ВАЛИДАЦИЯ адреса
    const validation = validateDeliveryAddress(addressData);
    if (!validation.isValid) {
      const error = new Error('Ошибки валидации адреса');
      error.validationErrors = validation.errors;
      throw error;
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    // БИЗНЕС-ЛОГИКА: Проверяем лимит адресов
    if (profile.delivery_addresses.length >= 5) {
      throw new Error('Максимальное количество адресов: 5');
    }

    // БИЗНЕС-ЛОГИКА: Если это первый адрес, делаем его основным
    const isFirstAddress = profile.delivery_addresses.length === 0;
    const newAddress = {
      label: addressData.label,
      address: addressData.address.trim(),
      lat: addressData.lat,
      lng: addressData.lng,
      is_default: isFirstAddress || addressData.is_default || false
    };

    // БИЗНЕС-ЛОГИКА: Если новый адрес основной, снимаем флаг с остальных
    if (newAddress.is_default) {
      profile.delivery_addresses.forEach(addr => {
        addr.is_default = false;
      });
    }

    profile.delivery_addresses.push(newAddress);
    await profile.save();

    return await getCustomerProfile(userId);

  } catch (error) {
    console.error('Add delivery address error:', error);
    throw error;
  }
};

/**
 * Удаление профиля клиента (ИСПРАВЛЕНО - полная очистка как у партнеров)
 * @param {string} userId - ID пользователя
 * @returns {object} - Результат удаления
 */
export const deleteCustomerProfile = async (userId) => {
  const session = await mongoose.startSession();
  
  try {
    console.log('🔍 DELETE CUSTOMER ACCOUNT:', { userId });
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    if (user.role !== 'customer') {
      throw new Error('Доступ разрешен только для клиентов');
    }

    let cleanupInfo = {
      user_deleted: false,
      meta_deleted: false,
      profile_deleted: false,
      orders_deleted: 0,
      reviews_deleted: 0,
      messages_deleted: 0
    };

    // 🔐 ИСПОЛЬЗУЕМ ТРАНЗАКЦИЮ для атомарного удаления (как у партнеров)
    await session.withTransaction(async () => {
      // 1. Удаляем заказы клиента (если есть модель Order)
      try {
        const { Order } = await import('../models/index.js');
        const deleteOrdersResult = await Order.deleteMany({ 
          customer_id: userId 
        }, { session });
        cleanupInfo.orders_deleted = deleteOrdersResult.deletedCount;
      } catch (error) {
        console.log('Order model not found or no orders to delete');
      }

      // 2. Удаляем отзывы клиента (если есть модель Review)
      try {
        const { Review } = await import('../models/index.js');
        const deleteReviewsResult = await Review.deleteMany({ 
          customer_id: userId 
        }, { session });
        cleanupInfo.reviews_deleted = deleteReviewsResult.deletedCount;
      } catch (error) {
        console.log('Review model not found or no reviews to delete');
      }

      // 3. Удаляем сообщения клиента (если есть модель Message)
      try {
        const { Message } = await import('../models/index.js');
        const deleteMessagesResult = await Message.deleteMany({ 
          customer_id: userId 
        }, { session });
        cleanupInfo.messages_deleted = deleteMessagesResult.deletedCount;
      } catch (error) {
        console.log('Message model not found or no messages to delete');
      }

      // 4. Удаляем профиль клиента
      const profileResult = await CustomerProfile.findOneAndDelete({ 
        user_id: userId 
      }, { session });
      cleanupInfo.profile_deleted = !!profileResult;

      // 5. Удаляем Meta запись (ВАЖНО!)
      const metaResult = await Meta.findOneAndDelete({ 
        customer: userId,
        role: 'customer'
      }, { session });
      cleanupInfo.meta_deleted = !!metaResult;

      // 6. Удаляем пользователя
      const userResult = await User.findByIdAndDelete(userId, { session });
      cleanupInfo.user_deleted = !!userResult;
    });

    console.log('✅ CUSTOMER ACCOUNT DELETED:', cleanupInfo);

    return {
      deleted_customer: {
        id: userId,
        deleted_at: new Date()
      },
      cleanup_info: cleanupInfo
    };

  } catch (error) {
    console.error('🚨 DELETE CUSTOMER ACCOUNT ERROR:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};