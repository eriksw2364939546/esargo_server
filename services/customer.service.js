// services/customer.service.js
import { User, CustomerProfile } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashString, hashMeta } from '../utils/hash.js';
import mongoose from 'mongoose';

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

    // Расшифровываем чувствительные данные для отображения
    const decryptedProfile = {
      ...profile.toObject(),
      phone: profile.phone ? decryptString(profile.phone) : null
    };

    return {
      user: {
        id: user._id,
        email: user.email,
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

    // Подготавливаем данные для обновления User модели
    const userUpdateData = {};
    const profileUpdateData = {};

    // Обработка email (если изменяется)
    if (updateData.email && updateData.email !== user.email) {
      const normalizedEmail = updateData.email.toLowerCase().trim();
      
      // Проверяем, не занят ли новый email
      const existingMeta = await Meta.findOne({
        em: hashMeta(normalizedEmail),
        role: 'customer',
        customer: { $ne: userId } // Исключаем текущего пользователя
      });

      if (existingMeta) {
        throw new Error('Пользователь с таким email уже существует');
      }

      userUpdateData.email = normalizedEmail;
      userUpdateData.is_email_verified = false; // Сбрасываем верификацию
    }

    // Обработка пароля
    if (updateData.password) {
      if (updateData.password.length < 6) {
        throw new Error('Пароль должен содержать минимум 6 символов');
      }
      userUpdateData.password_hash = await hashString(updateData.password);
    }

    // Обработка данных профиля
    if (updateData.first_name) {
      profileUpdateData.first_name = updateData.first_name.trim();
    }

    if (updateData.last_name) {
      profileUpdateData.last_name = updateData.last_name.trim();
    }

    if (updateData.phone !== undefined) {
      // Шифруем телефон если он предоставлен
      profileUpdateData.phone = updateData.phone ? cryptoString(updateData.phone) : null;
    }

    if (updateData.avatar_url !== undefined) {
      profileUpdateData.avatar_url = updateData.avatar_url;
    }

    // Обновление настроек
    if (updateData.settings) {
      const profile = await CustomerProfile.findOne({ user_id: userId });
      if (profile) {
        profileUpdateData.settings = {
          ...profile.settings.toObject(),
          ...updateData.settings
        };
      }
    }

    // Выполняем обновления
    let updatedUser = user;
    let updatedProfile = null;

    // Обновляем User если есть изменения
    if (Object.keys(userUpdateData).length > 0) {
      updatedUser = await User.findByIdAndUpdate(
        userId, 
        userUpdateData, 
        { new: true, select: '-password_hash' }
      );

      // Если изменился email, обновляем Meta запись
      if (userUpdateData.email) {
        await Meta.findOneAndUpdate(
          { customer: userId, role: 'customer' },
          { em: hashMeta(userUpdateData.email) }
        );
      }
    }

    // Обновляем CustomerProfile если есть изменения
    if (Object.keys(profileUpdateData).length > 0) {
      updatedProfile = await CustomerProfile.findOneAndUpdate(
        { user_id: userId },
        profileUpdateData,
        { new: true }
      );
    } else {
      updatedProfile = await CustomerProfile.findOne({ user_id: userId });
    }

    if (!updatedProfile) {
      throw new Error('Профиль клиента не найден');
    }

    // Расшифровываем данные для ответа
    const decryptedProfile = {
      ...updatedProfile.toObject(),
      phone: updatedProfile.phone ? decryptString(updatedProfile.phone) : null
    };

    return {
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        role: updatedUser.role,
        is_email_verified: updatedUser.is_email_verified,
        is_active: updatedUser.is_active
      },
      profile: decryptedProfile
    };

  } catch (error) {
    console.error('Update customer profile error:', error);
    throw error;
  }
};

/**
 * Удаление клиента
 * @param {string} userId - ID пользователя
 * @returns {object} - Результат удаления
 */
export const deleteCustomer = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Некорректный ID пользователя');
    }

    // Используем транзакцию для атомарного удаления
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Удаляем профиль клиента
        await CustomerProfile.findOneAndDelete({ user_id: userId }, { session });
        
        // Удаляем пользователя
        await User.findByIdAndDelete(userId, { session });
        
        // Удаляем Meta запись
        await Meta.findOneAndDelete({ customer: userId, role: 'customer' }, { session });
      });

      await session.endSession();

      return {
        success: true,
        message: 'Клиент успешно удален',
        deletedUserId: userId
      };

    } catch (transactionError) {
      await session.endSession();
      throw transactionError;
    }

  } catch (error) {
    console.error('Delete customer error:', error);
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
    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    // Валидация данных адреса
    const { label, address, lat, lng, is_default } = addressData;
    
    if (!label || !address || lat === undefined || lng === undefined) {
      throw new Error('Все поля адреса обязательны');
    }

    // Проверяем допустимые значения label
    const allowedLabels = ['Дом', 'Работа', 'Другое'];
    if (!allowedLabels.includes(label)) {
      throw new Error('Некорректный тип адреса');
    }

    await profile.addDeliveryAddress({
      label,
      address: address.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      is_default: Boolean(is_default)
    });

    return profile;

  } catch (error) {
    console.error('Add delivery address error:', error);
    throw error;
  }
};

/**
 * Обновление адреса доставки
 * @param {string} userId - ID пользователя
 * @param {string} addressId - ID адреса
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Обновленный профиль
 */
export const updateDeliveryAddress = async (userId, addressId, updateData) => {
  try {
    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    const address = profile.delivery_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }

    // Обновляем поля адреса
    if (updateData.label !== undefined) {
      const allowedLabels = ['Дом', 'Работа', 'Другое'];
      if (!allowedLabels.includes(updateData.label)) {
        throw new Error('Некорректный тип адреса');
      }
      address.label = updateData.label;
    }

    if (updateData.address !== undefined) {
      address.address = updateData.address.trim();
    }

    if (updateData.lat !== undefined) {
      address.lat = parseFloat(updateData.lat);
    }

    if (updateData.lng !== undefined) {
      address.lng = parseFloat(updateData.lng);
    }

    if (updateData.is_default !== undefined && updateData.is_default) {
      // Убираем флаг default с других адресов
      profile.delivery_addresses.forEach(addr => {
        if (!addr._id.equals(addressId)) {
          addr.is_default = false;
        }
      });
      address.is_default = true;
    }

    await profile.save();
    return profile;

  } catch (error) {
    console.error('Update delivery address error:', error);
    throw error;
  }
};

/**
 * Удаление адреса доставки
 * @param {string} userId - ID пользователя
 * @param {string} addressId - ID адреса
 * @returns {object} - Обновленный профиль
 */
export const removeDeliveryAddress = async (userId, addressId) => {
  try {
    const profile = await CustomerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль клиента не найден');
    }

    const address = profile.delivery_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }

    // Удаляем адрес
    profile.delivery_addresses.pull(addressId);
    
    // Если удаленный адрес был основным и остались другие адреса
    if (address.is_default && profile.delivery_addresses.length > 0) {
      profile.delivery_addresses[0].is_default = true;
    }

    await profile.save();
    return profile;

  } catch (error) {
    console.error('Remove delivery address error:', error);
    throw error;
  }
};