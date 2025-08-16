// services/partner.service.js
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { cryptoString } from '../utils/crypto.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

/**
 * Создание аккаунта партнера (из User → PartnerProfile после одобрения)
 * @param {object} partnerData - Данные партнера
 * @returns {object} - Результат создания
 */
export const createPartnerAccount = async (partnerData) => {
  try {
    const {
      user_id,
      business_name,
      brand_name,
      category,
      description,
      address,
      location,
      phone,
      email,
      owner_name,
      owner_surname,
      floor_unit,
      cover_image_url,
      working_hours,
      legal_info
    } = partnerData;

    // Проверяем, есть ли уже партнер для этого пользователя
    const existingMeta = await Meta.findOne({
      partner: user_id,
      role: 'partner'
    });

    if (existingMeta) {
      return {
        isNewPartner: false,
        partner: existingMeta
      };
    }

    // Получаем пользователя
    const user = await User.findById(user_id);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Создаем PartnerProfile
    const newPartnerProfile = new PartnerProfile({
      user_id: user._id,
      business_name,
      brand_name,
      category,
      description,
      address: cryptoString(address), // Шифруем адрес
      location,
      phone: cryptoString(phone), // Шифруем телефон
      email: cryptoString(email), // Шифруем email
      owner_name,
      owner_surname,
      floor_unit,
      cover_image_url,
      working_hours: working_hours || {
        monday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        tuesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        wednesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        thursday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        friday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        saturday: { is_open: true, open_time: '10:00', close_time: '22:00' },
        sunday: { is_open: false, open_time: '', close_time: '' }
      },
      legal_info: legal_info || {},
      is_approved: true, // Уже одобрен админом на этом этапе
      is_active: true,
      approved_at: new Date()
    });

    await newPartnerProfile.save();

    // Создаем Meta запись
    const newMetaInfo = new Meta({
      partner: user._id,
      role: 'partner',
      em: hashMeta(email) // Хешируем email для безопасного поиска
    });

    await newMetaInfo.save();

    return {
      isNewPartner: true,
      partner: newPartnerProfile
    };

  } catch (error) {
    console.error('Create partner account error:', error);
    throw error;
  }
};

/**
 * Финальное одобрение партнера админом (создание PartnerProfile + Meta)
 * @param {string} legalInfoId - ID записи PartnerLegalInfo
 * @param {string} adminId - ID администратора
 * @returns {object} - Результат одобрения
 */
export const finalApprovePartner = async (legalInfoId, adminId) => {
  try {
    const session = await mongoose.startSession();
    
    try {
      const result = await session.withTransaction(async () => {
        // Получаем юридическую информацию
        const legalInfo = await PartnerLegalInfo.findById(legalInfoId)
          .populate('partner_request_id')
          .populate('user_id')
          .session(session);

        if (!legalInfo) {
          throw new Error('Юридическая информация не найдена');
        }

        if (legalInfo.verification_status === 'verified') {
          throw new Error('Партнер уже одобрен');
        }

        // Получаем первичную заявку
        const initialRequest = legalInfo.partner_request_id;
        if (!initialRequest) {
          throw new Error('Первичная заявка не найдена');
        }

        // Обновляем статус юридической информации
        legalInfo.verification_status = 'verified';
        legalInfo.verified_at = new Date();
        legalInfo.verified_by = adminId;
        await legalInfo.save({ session });

        // Создаем PartnerProfile
        const partnerProfileData = {
          user_id: legalInfo.user_id._id,
          business_name: initialRequest.business_data.business_name,
          brand_name: initialRequest.business_data.brand_name,
          category: initialRequest.business_data.category,
          description: initialRequest.business_data.description,
          address: initialRequest.business_data.address,
          location: initialRequest.business_data.location,
          phone: initialRequest.business_data.phone,
          email: initialRequest.business_data.email,
          owner_name: initialRequest.business_data.owner_name,
          owner_surname: initialRequest.business_data.owner_surname,
          floor_unit: initialRequest.business_data.floor_unit,
          cover_image_url: initialRequest.business_data.cover_image_url,
          legal_info: legalInfo.legal_data
        };

        const newPartner = await createPartnerAccount(partnerProfileData);

        return {
          success: true,
          partner: newPartner.partner,
          legalInfo: legalInfo
        };
      });

      await session.endSession();
      return result;

    } catch (transactionError) {
      await session.endSession();
      throw transactionError;
    }

  } catch (error) {
    console.error('Final approve partner error:', error);
    throw error;
  }
};

/**
 * Авторизация партнера (аналогично клиенту, но для роли partner)
 * @param {object} loginData - Данные для входа
 * @returns {object} - Результат авторизации
 */
export const loginPartner = async ({ email, password }) => {
  try {
    // Валидация входных данных
    if (!email || !password) {
      const error = new Error('Email и пароль обязательны');
      error.statusCode = 400;
      throw error;
    }

    // Нормализация email
    email = email.toLowerCase().trim();

    // Поиск Meta записи для партнера
    const metaInfo = await Meta.findOne({
      em: hashMeta(email),
      role: 'partner'
    }).populate('partner');

    if (!metaInfo || !metaInfo.partner) {
      const error = new Error('Партнер не найден');
      error.statusCode = 404;
      throw error;
    }

    // Получаем пользователя
    const user = await User.findById(metaInfo.partner.user_id);
    if (!user) {
      const error = new Error('Пользователь не найден');
      error.statusCode = 404;
      throw error;
    }

    // Проверяем, заблокирован ли аккаунт
    if (metaInfo.isAccountLocked()) {
      const error = new Error('Аккаунт временно заблокирован');
      error.statusCode = 423;
      throw error;
    }

    // Проверяем активность
    if (!user.is_active || !metaInfo.partner.is_active) {
      const error = new Error('Аккаунт деактивирован');
      error.statusCode = 403;
      throw error;
    }

    // Проверяем одобрение
    if (!metaInfo.partner.is_approved) {
      const error = new Error('Партнерство не одобрено');
      error.statusCode = 403;
      throw error;
    }

    // Проверяем пароль
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await metaInfo.incrementFailedAttempts();
      const error = new Error('Неверный пароль');
      error.statusCode = 401;
      throw error;
    }

    // Сбрасываем счетчик неудачных попыток
    await metaInfo.resetFailedAttempts();

    // Генерируем токен
    const token = generateCustomerToken({
      _id: user._id,
      email: user.email,
      role: 'partner'
    }, '30d');

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        role: 'partner',
        partner_profile: metaInfo.partner
      }
    };

  } catch (error) {
    console.error('Login partner error:', error);
    throw error;
  }
};

/**
 * Получение профиля партнера по user_id
 * @param {string} userId - ID пользователя
 * @returns {object} - Профиль партнера
 */
export const getPartnerProfile = async (userId) => {
  try {
    const metaInfo = await Meta.findOne({
      partner: userId,
      role: 'partner'
    }).populate('partner');

    if (!metaInfo || !metaInfo.partner) {
      throw new Error('Профиль партнера не найден');
    }

    return metaInfo.partner;

  } catch (error) {
    console.error('Get partner profile error:', error);
    throw error;
  }
};

/**
 * Проверка статуса заявки партнера
 * @param {string} userId - ID пользователя  
 * @returns {object} - Статус заявки
 */
export const getPartnerRequestStatus = async (userId) => {
  try {
    // Ищем первичную заявку
    const initialRequest = await InitialPartnerRequest.findOne({
      user_id: userId
    }).sort({ submitted_at: -1 });

    if (!initialRequest) {
      return {
        hasRequest: false,
        status: null,
        message: 'Заявка не найдена'
      };
    }

    // Ищем юридическую информацию
    let legalInfo = null;
    if (initialRequest.status === 'approved') {
      legalInfo = await PartnerLegalInfo.findOne({
        partner_request_id: initialRequest._id
      });
    }

    // Ищем профиль партнера
    const partnerProfile = await PartnerProfile.findOne({
      user_id: userId
    });

    return {
      hasRequest: true,
      initialRequest: {
        id: initialRequest._id,
        status: initialRequest.status,
        submitted_at: initialRequest.submitted_at,
        business_data: initialRequest.business_data
      },
      legalInfo: legalInfo ? {
        id: legalInfo._id,
        verification_status: legalInfo.verification_status,
        submitted_at: legalInfo.submitted_at
      } : null,
      partnerProfile: partnerProfile ? {
        id: partnerProfile._id,
        is_approved: partnerProfile.is_approved,
        is_active: partnerProfile.is_active
      } : null
    };

  } catch (error) {
    console.error('Get partner request status error:', error);
    throw error;
  }
};