// services/partner.service.js (исправленный)
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { cryptoString } from '../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
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

    // 🆕 ИСПРАВЛЕНО: Проверяем существование партнера через новый метод
    const existingMeta = await Meta.findByUserId(user_id, 'partner');

    if (existingMeta && existingMeta.length > 0) {
      return {
        isNewPartner: false,
        partner: existingMeta[0]
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
        sunday: { is_open: false, open_time: null, close_time: null }
      },
      legal_info,
      is_approved: true, // Партнер создается уже одобренным (после всех проверок)
      is_active: true
    });

    await newPartnerProfile.save();

    // 🆕 ИСПРАВЛЕНО: Обновляем роль пользователя
    user.role = 'partner';
    await user.save();

    // 🆕 ИСПРАВЛЕНО: Создаем Meta запись через новый метод
    const newMetaInfo = await Meta.createForPartner(user._id, hashMeta(user.email));

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
 * 🆕 ИСПРАВЛЕНО: Авторизация партнера (аналогично клиенту, но для роли partner)
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

    // 🆕 ИСПРАВЛЕНО: Поиск Meta записи для партнера через новый метод
    const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'partner');

    if (!metaInfo || !metaInfo.partner) {
      const error = new Error('Партнер не найден');
      error.statusCode = 404;
      throw error;
    }

    // 🆕 ИСПРАВЛЕНО: Получаем пользователя правильно
    const user = metaInfo.partner; // Это уже пользователь из populate

    // Проверяем, заблокирован ли аккаунт
    if (metaInfo.isAccountLocked()) {
      const error = new Error('Аккаунт временно заблокирован');
      error.statusCode = 423;
      throw error;
    }

    // Проверяем активность пользователя
    if (!user.is_active) {
      const error = new Error('Аккаунт деактивирован');
      error.statusCode = 403;
      throw error;
    }

    // 🆕 ИСПРАВЛЕНО: Получаем профиль партнера
    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partnerProfile) {
      const error = new Error('Профиль партнера не найден');
      error.statusCode = 404;
      throw error;
    }

    // Проверяем одобрение партнера
    if (!partnerProfile.is_approved) {
      const error = new Error('Партнерство не одобрено');
      error.statusCode = 403;
      throw error;
    }

    // Проверяем пароль
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      await metaInfo.incrementFailedAttempts();
      const error = new Error('Неверный пароль');
      error.statusCode = 401;
      throw error;
    }

    // Сбрасываем счетчик неудачных попыток
    await metaInfo.resetFailedAttempts();

    // 🆕 ИСПРАВЛЕНО: Генерируем токен с правильными данными
    const token = generateCustomerToken({
      user_id: user._id,
      _id: user._id,
      email: user.email,
      role: 'partner',
      is_admin: false
    }, '30d');

    return { 
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        is_email_verified: user.is_email_verified,
        profile: partnerProfile
      }
    };

  } catch (error) {
    console.error('Login partner error:', error);
    throw error;
  }
};

/**
 * 🆕 ДОБАВЛЕНО: Получение партнера по ID (для middleware)
 * @param {string} userId - ID пользователя
 * @returns {object} - Партнер с профилем
 */
export const getPartnerById = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password_hash');
    if (!user || user.role !== 'partner') return null;

    const profile = await PartnerProfile.findOne({ user_id: userId });

    return {
      ...user.toObject(),
      profile
    };
  } catch (error) {
    console.error('Get partner by ID error:', error);
    return null;
  }
};

/**
 * Финальное одобрение партнера (создание PartnerProfile после одобрения юридических данных)
 * @param {string} legalInfoId - ID юридической информации
 * @param {string} adminId - ID администратора
 * @returns {object} - Результат создания партнера
 */
export const finalApprovePartner = async (legalInfoId, adminId) => {
  try {
    const session = await mongoose.startSession();
    
    try {
      const result = await session.withTransaction(async () => {
        // Получаем юридическую информацию с первичной заявкой
        const legalInfo = await PartnerLegalInfo.findById(legalInfoId)
          .populate('user_id')
          .populate('partner_request_id')
          .session(session);

        if (!legalInfo) {
          throw new Error('Юридическая информация не найдена');
        }

        if (legalInfo.verification_status !== 'pending') {
          throw new Error('Юридические данные уже обработаны');
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