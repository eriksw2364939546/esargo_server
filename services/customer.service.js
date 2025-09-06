// services/customer.service.js - ИСПРАВЛЕННЫЙ сервис без дублирования
import { CustomerProfile, User } from '../models/index.js';
import { hashString, validateEmail, validatePhone, cryptoString, decryptString } from '../utils/index.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// ВАЛИДАЦИОННЫЕ ФУНКЦИИ
const validateProfileUpdate = (updateData) => {
  const errors = [];

  if (updateData.first_name !== undefined) {
    if (!updateData.first_name || updateData.first_name.trim().length === 0) {
      errors.push('Имя не может быть пустым');
    } else if (updateData.first_name.trim().length < 2) {
      errors.push('Имя должно содержать минимум 2 символа');
    }
  }

  if (updateData.last_name !== undefined) {
    if (!updateData.last_name || updateData.last_name.trim().length === 0) {
      errors.push('Фамилия не может быть пустой');
    } else if (updateData.last_name.trim().length < 2) {
      errors.push('Фамилия должна содержать минимум 2 символа');
    }
  }

  if (updateData.phone !== undefined) {
    if (!validatePhone(updateData.phone)) {
      errors.push('Некорректный номер телефона');
    }
  }

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

// ОСНОВНЫЕ ФУНКЦИИ СЕРВИСА

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

    // Расшифровываем email для отображения
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
      phone: profile.phone ? (() => {
        try {
          return decryptString(profile.phone);
        } catch (error) {
          console.warn('Could not decrypt phone for profile display');
          return '[PHONE_DECRYPT_ERROR]';
        }
      })() : null
    };

    return {
      user: {
        ...user.toObject(),
        email: displayEmail
      },
      profile: decryptedProfile
    };

  } catch (error) {
    console.error('Get customer profile error:', error);
    throw error;
  }
};

export const updateCustomerProfile = async (userId, updateData) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    // Валидация данных
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

    if (user.role !== 'customer') {
      throw new Error('Доступ разрешен только для клиентов');
    }

    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    // Обработка смены пароля
    if (updateData.current_password && updateData.new_password) {
      const isValidPassword = await bcrypt.compare(updateData.current_password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Неверный текущий пароль');
      }

      if (updateData.new_password.length < 6) {
        throw new Error('Новый пароль должен содержать минимум 6 символов');
      }

      const hashedNewPassword = await hashString(updateData.new_password);
      user.password_hash = hashedNewPassword;
      await user.save();
    }

    // Обновление данных профиля
    const allowedFields = ['first_name', 'last_name', 'phone', 'avatar_url', 'language'];
    const profileUpdates = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'phone' && updateData[field]) {
          // Шифруем телефон перед сохранением
          profileUpdates[field] = cryptoString(updateData[field].replace(/\s/g, ''));
        } else if (field === 'language') {
          profileUpdates['preferences.language'] = updateData[field];
        } else {
          profileUpdates[field] = updateData[field];
        }
      }
    });

    if (Object.keys(profileUpdates).length > 0) {
      await CustomerProfile.findOneAndUpdate(
        { user_id: userId },
        { $set: profileUpdates },
        { new: true, runValidators: true }
      );
    }

    // Получаем обновленный профиль
    return await getCustomerProfile(userId);

  } catch (error) {
    console.error('Update customer profile error:', error);
    throw error;
  }
};

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
      throw new Error('Доступ разрешен только для клиентов');
    }

    // Деактивируем профиль вместо полного удаления
    await CustomerProfile.findOneAndUpdate(
      { user_id: userId },
      { 
        $set: { 
          is_active: false,
          deleted_at: new Date()
        }
      }
    );

    // Деактивируем пользователя
    user.is_active = false;
    await user.save();

    console.log(`Customer profile deactivated: ${userId}`);
    
    return {
      success: true,
      message: 'Профиль клиента деактивирован'
    };

  } catch (error) {
    console.error('Delete customer profile error:', error);
    throw error;
  }
};

export const customerProfileExists = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }

    const profile = await CustomerProfile.findOne({ 
      user_id: userId,
      is_active: true 
    });

    return !!profile;

  } catch (error) {
    console.error('Check customer profile exists error:', error);
    return false;
  }
};

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
      orders: profile.order_stats || {
        total_orders: 0,
        total_spent: 0,
        avg_rating_given: 0
      },
      profile_activity: {
        is_active: profile.is_active,
        created_at: profile.createdAt,
        last_updated: profile.updatedAt,
        days_since_registration: Math.floor((Date.now() - profile.createdAt) / (1000 * 60 * 60 * 24))
      }
    };

  } catch (error) {
    console.error('Get customer stats error:', error);
    throw error;
  }
};

export default {
  getCustomerProfile,
  updateCustomerProfile,
  deleteCustomerProfile,
  customerProfileExists,
  getCustomerStats
};