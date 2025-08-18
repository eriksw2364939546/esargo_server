// services/partner.service.js (ИСПРАВЛЕННАЯ ЛОГИКА)
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

/**
 * ✅ ИСПРАВЛЕНО: Создание PartnerProfile ТОЛЬКО после одобрения юр.данных
 * @param {object} partnerData - Данные партнера из InitialRequest + LegalInfo
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
      legal_info_id // 🆕 ДОБАВЛЕНО: ссылка на юридические данные
    } = partnerData;

    // ✅ ИСПРАВЛЕНО: Проверяем что профиль не существует
    const existingProfile = await PartnerProfile.findOne({ user_id });
    if (existingProfile) {
      throw new Error('Профиль партнера уже создан');
    }

    // Получаем пользователя
    const user = await User.findById(user_id);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // ✅ ИСПРАВЛЕНО: Создаем PartnerProfile с правильными статусами
    const newPartnerProfile = new PartnerProfile({
      user_id: user._id,
      business_name,
      brand_name: brand_name || business_name,
      category,
      description,
      
      // 🔐 ВСЕ АДРЕСА И КОНТАКТЫ УЖЕ ЗАШИФРОВАНЫ В InitialRequest
      address, // Уже зашифровано
      location,
      phone, // Уже зашифровано
      email, // Уже зашифровано
      
      owner_name,
      owner_surname,
      floor_unit, // Уже зашифровано
      cover_image_url,
      
      // 🆕 НОВОЕ: Правильные статусы для нового процесса
      is_approved: false, // Еще не одобрен полностью
      is_active: false,   // Еще не активен
      approval_status: 'awaiting_content', // 🎯 ЖДЕТ НАПОЛНЕНИЯ КОНТЕНТОМ
      content_status: 'awaiting_content',  // 🎯 ЖДЕТ КОНТЕНТА
      is_public: false,   // НЕ ПУБЛИЧНЫЙ (финальный этап)
      
      // Ссылка на юридические данные
      legal_info: legal_info_id,
      
      // Базовый график работы (можно изменить в кабинете)
      working_hours: {
        monday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        tuesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        wednesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        thursday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        friday: { is_open: true, open_time: '09:00', close_time: '21:00' },
        saturday: { is_open: true, open_time: '10:00', close_time: '22:00' },
        sunday: { is_open: false, open_time: null, close_time: null }
      }
    });

    await newPartnerProfile.save();

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
 * ✅ ИСПРАВЛЕНО: Авторизация партнера (работает с новой логикой)
 */
export const loginPartner = async (email, password) => {
  try {
    // 🆕 ИСПРАВЛЕНО: Получаем Meta через новый метод  
    const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'partner');

    if (!metaInfo || !metaInfo.partner) {
      const error = new Error('Партнер не найден');
      error.statusCode = 404;
      throw error;
    }

    const user = metaInfo.partner; // Уже пользователь из populate

    // Проверяем блокировку аккаунта
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

    // ✅ ИСПРАВЛЕНО: Профиль партнера может отсутствовать (на ранних этапах)
    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    
    // 🎯 НОВОЕ: Партнер может войти даже без профиля (для личного кабинета)
    // Профиль создается только после одобрения юр.данных

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

    // Генерируем токен
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
        profile: partnerProfile // Может быть null на ранних этапах
      }
    };

  } catch (error) {
    console.error('Login partner error:', error);
    throw error;
  }
};

/**
 * 🆕 ДОБАВЛЕНО: Получение партнера по ID (для middleware)
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
 * ✅ ИСПРАВЛЕНО: Финальное одобрение партнера 
 * Создает PartnerProfile ТОЛЬКО ЗДЕСЬ после одобрения юр.данных
 */
export const finalApprovePartner = async (legalInfoId, adminId) => {
  const session = await mongoose.startSession();
  
  try {
    const result = await session.withTransaction(async () => {
      // Получаем юридическую информацию с заявкой
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

      const initialRequest = legalInfo.partner_request_id;
      if (!initialRequest) {
        throw new Error('Первичная заявка не найдена');
      }

      // 1️⃣ Обновляем статус юридической информации
      legalInfo.verification_status = 'verified';
      legalInfo.verified_at = new Date();
      legalInfo.verified_by = adminId;
      await legalInfo.save({ session });

      // 2️⃣ Обновляем статус первичной заявки
      initialRequest.status = 'legal_approved'; // 🆕 НОВЫЙ СТАТУС!
      await initialRequest.save({ session });

      // 3️⃣ СОЗДАЕМ PartnerProfile (единственное место создания!)
      const partnerProfileData = {
        user_id: legalInfo.user_id._id,
        business_name: initialRequest.business_data.business_name,
        brand_name: initialRequest.business_data.brand_name,
        category: initialRequest.business_data.category,
        description: initialRequest.business_data.description,
        
        // 🔐 Берем уже зашифрованные данные из заявки
        address: initialRequest.business_data.address,
        location: initialRequest.business_data.location,
        phone: initialRequest.business_data.phone,
        email: initialRequest.business_data.email,
        floor_unit: initialRequest.business_data.floor_unit,
        
        owner_name: initialRequest.business_data.owner_name,
        owner_surname: initialRequest.business_data.owner_surname,
        cover_image_url: initialRequest.business_data.cover_image_url,
        legal_info_id: legalInfo._id
      };

      const newPartner = await createPartnerAccount(partnerProfileData);

      return {
        success: true,
        partner: newPartner.partner,
        legalInfo: legalInfo,
        initialRequest: initialRequest
      };
    });

    return result;

  } catch (error) {
    console.error('Final approve partner error:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * 🆕 ДОБАВЛЕНО: Управление контентом партнера
 */
export const updatePartnerContentStatus = async (profileId, newStatus, adminId = null) => {
  try {
    const profile = await PartnerProfile.findById(profileId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Обновляем статус контента
    profile.content_status = newStatus;

    // Если контент одобрен - делаем партнера публичным
    if (newStatus === 'approved') {
      profile.is_approved = true;
      profile.is_active = true;
      profile.is_public = true;
      profile.published_at = new Date();
      
      if (adminId) {
        profile.approved_by = adminId;
        profile.approved_at = new Date();
      }

      // Обновляем статус в первичной заявке
      await InitialPartnerRequest.findOneAndUpdate(
        { user_id: profile.user_id },
        { status: 'completed' }
      );
    }

    await profile.save();

    return {
      success: true,
      profile: profile,
      message: `Статус контента обновлен на "${newStatus}"`
    };

  } catch (error) {
    console.error('Update partner content status error:', error);
    throw error;
  }
};

/**
 * 🆕 ДОБАВЛЕНО: Отправка контента на модерацию
 */
export const submitContentForReview = async (userId) => {
  try {
    const profile = await PartnerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    if (profile.content_status !== 'awaiting_content' && profile.content_status !== 'content_added') {
      throw new Error('Контент уже на модерации или одобрен');
    }

    // Обновляем статус контента и заявки
    profile.content_status = 'pending_review';
    await profile.save();

    await InitialPartnerRequest.findOneAndUpdate(
      { user_id: userId },
      { status: 'content_review' }
    );

    return {
      success: true,
      message: 'Контент отправлен на модерацию',
      profile: profile
    };

  } catch (error) {
    console.error('Submit content for review error:', error);
    throw error;
  }
};