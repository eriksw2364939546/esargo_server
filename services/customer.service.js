// services/customer.service.js - Очищенный от старых функций управления адресами
import { CustomerProfile, User } from '../models/index.js';
import { hashString, validateEmail, validatePhone, encryptString, decryptString } from '../utils/index.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

// ================ ВАЛИДАЦИОННЫЕ ФУНКЦИИ ================

/**
 * Валидация данных для обновления профиля
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Результат валидации
 */
const validateProfileUpdate = (updateData) => {
  const errors = [];

  // Валидация имени
  if (updateData.first_name !== undefined) {
    if (!updateData.first_name || updateData.first_name.trim().length === 0) {
      errors.push('Имя не может быть пустым');
    } else if (updateData.first_name.trim().length < 2) {
      errors.push('Имя должно содержать минимум 2 символа');
    }
  }

  // Валидация фамилии
  if (updateData.last_name !== undefined) {
    if (!updateData.last_name || updateData.last_name.trim().length === 0) {
      errors.push('Фамилия не может быть пустой');
    } else if (updateData.last_name.trim().length < 2) {
      errors.push('Фамилия должна содержать минимум 2 символа');
    }
  }

  // Валидация телефона
  if (updateData.phone !== undefined) {
    if (!validatePhone(updateData.phone)) {
      errors.push('Некорректный номер телефона');
    }
  }

  // Валидация языка
  if (updateData.language !== undefined) {
    const allowedLanguages = ['ru', 'fr', 'en'];
    if (!allowedLanguages.includes(updateData.language)) {
      errors.push('Неподдерживаемый язык. Доступны: ru, fr, en');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ================ ОСНОВНЫЕ ФУНКЦИИ СЕРВИСА ================

/**
 * Получение профиля клиента
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

    // 🔐 РАСШИФРОВЫВАЕМ email для отображения
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
        _id: user._id,
        email: displayEmail,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
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

    // ВАЛИДАЦИЯ входных данных
    const validation = validateProfileUpdate(updateData);
    if (!validation.isValid) {
      const error = new Error('Ошибки валидации');
      error.validationErrors = validation.errors;
      throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Подготовка данных для обновления
    const userUpdateData = {};
    const profileUpdateData = {};

    // БИЗНЕС-ЛОГИКА: Обработка смены пароля
    if (updateData.current_password && updateData.new_password) {
      const isCurrentPasswordValid = await bcrypt.compare(updateData.current_password, user.password_hash);
      if (!isCurrentPasswordValid) {
        const error = new Error('Текущий пароль неверен');
        error.validationErrors = ['Текущий пароль неверен'];
        throw error;
      }

      if (updateData.new_password.length < 6) {
        const error = new Error('Новый пароль должен содержать минимум 6 символов');
        error.validationErrors = ['Новый пароль должен содержать минимум 6 символов'];
        throw error;
      }

      userUpdateData.password_hash = await hashString(updateData.new_password);
    }

    // БИЗНЕС-ЛОГИКА: Обработка обычных полей профиля
    if (updateData.first_name !== undefined) {
      profileUpdateData.first_name = updateData.first_name.trim();
    }

    if (updateData.last_name !== undefined) {
      profileUpdateData.last_name = updateData.last_name.trim();
    }

    if (updateData.phone !== undefined) {
      profileUpdateData.phone = encryptString(updateData.phone);
    }

    if (updateData.avatar_url !== undefined) {
      profileUpdateData.avatar_url = updateData.avatar_url;
    }

    // БИЗНЕС-ЛОГИКА: Обновление настроек
    if (updateData.language !== undefined) {
      if (!profileUpdateData.preferences) {
        const currentProfile = await CustomerProfile.findOne({ user_id: userId });
        profileUpdateData.preferences = currentProfile.preferences || {};
      }
      profileUpdateData['preferences.language'] = updateData.language;
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
 * Удаление профиля клиента
 * @param {string} userId - ID пользователя
 * @returns {boolean} - Результат удаления
 */
export const deleteCustomerProfile = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    if (user.role !== 'customer') {
      throw new Error('Можно удалять только профили клиентов');
    }

    // БИЗНЕС-ЛОГИКА: Проверяем наличие активных заказов
    // TODO: Добавить проверку активных заказов когда будет готов Order сервис
    
    // Удаляем профиль клиента
    const deletedProfile = await CustomerProfile.findOneAndDelete({ user_id: userId });
    if (!deletedProfile) {
      throw new Error('Профиль клиента не найден');
    }

    // Деактивируем пользователя (не удаляем полностью для истории)
    await User.findByIdAndUpdate(userId, { 
      is_active: false,
      email: encryptString(`deleted_${Date.now()}_${user.email}`)
    });

    console.log('✅ Customer profile deleted:', { userId });
    return true;

  } catch (error) {
    console.error('Delete customer profile error:', error);
    throw error;
  }
};

/**
 * Проверка существования профиля клиента
 * @param {string} userId - ID пользователя
 * @returns {boolean} - Существует ли профиль
 */
export const customerProfileExists = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    return !!profile;

  } catch (error) {
    console.error('Check customer profile exists error:', error);
    return false;
  }
};

/**
 * Получение статистики профиля клиента
 * @param {string} userId - ID пользователя
 * @returns {object} - Статистика профиля
 */
export const getCustomerStats = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    return {
      // ✅ СТАТИСТИКА ПО АДРЕСАМ (новая структура)
      addresses: {
        total_count: profile.saved_addresses?.length || 0,
        has_default: profile.saved_addresses?.some(addr => addr.is_default) || false,
        zones_used: [...new Set(profile.saved_addresses?.map(addr => addr.delivery_info?.zone).filter(Boolean))] || [],
        most_used_zone: profile.saved_addresses?.reduce((acc, addr) => {
          const zone = addr.delivery_info?.zone;
          if (zone) acc[zone] = (acc[zone] || 0) + (addr.delivery_info?.order_count || 0);
          return acc;
        }, {})
      },
      
      // ✅ СТАТИСТИКА ПО ЗАКАЗАМ
      orders: profile.order_stats || {
        total_orders: 0,
        total_spent: 0,
        avg_rating_given: 0
      },
      
      // ✅ АКТИВНОСТЬ ПРОФИЛЯ
      profile_activity: {
        is_active: profile.is_active,
        created_at: profile.created_at,
        last_updated: profile.updated_at,
        days_since_registration: Math.floor((Date.now() - profile.created_at) / (1000 * 60 * 60 * 24))
      }
    };

  } catch (error) {
    console.error('Get customer stats error:', error);
    throw error;
  }
};

// ================ ЭКСПОРТ ================

export default {
  getCustomerProfile,
  updateCustomerProfile,
  deleteCustomerProfile,
  customerProfileExists,
  getCustomerStats
};

// ✅ УДАЛЕНЫ СТАРЫЕ ФУНКЦИИ: addDeliveryAddress и связанные с delivery_addresses
// Теперь все управление адресами в services/Address/address.service.js