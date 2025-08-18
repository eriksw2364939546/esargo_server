// services/partner.service.js - ПОЛНЫЙ ИСПРАВЛЕННЫЙ ФАЙЛ 🎯
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

// ================ АВТОРИЗАЦИЯ ================

/**
 * ✅ АВТОРИЗАЦИЯ ПАРТНЕРА (работает с новой логикой)
 * Партнер может войти сразу после регистрации (даже без профиля)
 */
const loginPartner = async (email, password) => {
  try {
    // Получаем Meta через правильный метод  
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

    // ✅ ПРАВИЛЬНО: Профиль партнера может отсутствовать (на ранних этапах)
    const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
    
    // 🎯 КЛЮЧЕВОЕ: Партнер может войти даже без профиля для личного кабинета
    // PartnerProfile создается только после одобрения юр.данных (ЭТАП 3)

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
        profile: partnerProfile // Может быть null на ранних этапах (НОРМАЛЬНО!)
      }
    };

  } catch (error) {
    console.error('Login partner error:', error);
    throw error;
  }
};

/**
 * ✅ Получение партнера по ID (для middleware)
 */
const getPartnerById = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password_hash');
    if (!user || user.role !== 'partner') return null;

    const profile = await PartnerProfile.findOne({ user_id: userId });

    return {
      ...user.toObject(),
      profile // Может быть null - это нормально
    };
  } catch (error) {
    console.error('Get partner by ID error:', error);
    return null;
  }
};

// ================ ЭТАП 3: СОЗДАНИЕ PARTNERPROFILE ================

/**
 * ✅ ЭТАП 3: Создание PartnerProfile ТОЛЬКО после одобрения юр.данных
 * Это единственное место где создается PartnerProfile!
 */
const createPartnerAccount = async (partnerData) => {
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
      legal_info_id
    } = partnerData;

    // ✅ ПРОВЕРЯЕМ: профиль не должен уже существовать
    const existingProfile = await PartnerProfile.findOne({ user_id });
    if (existingProfile) {
      throw new Error('Профиль партнера уже создан');
    }

    // Получаем пользователя
    const user = await User.findById(user_id);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // ✅ СОЗДАЕМ PartnerProfile с правильными статусами
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
      floor_unit, // Уже зашифровано
      
      owner_name,
      owner_surname,
      cover_image_url,
      
      // 🎯 ПРАВИЛЬНЫЕ СТАТУСЫ ДЛЯ ЭТАПА 4
      content_status: 'awaiting_content', // Партнер должен наполнить контент
      is_approved: false, // Будет true после одобрения контента
      is_active: false, // Будет true после одобрения контента  
      is_public: false, // Будет true после финальной публикации
      
      legal_info_id // Ссылка на юридические данные
    });

    await newPartnerProfile.save();

    return {
      success: true,
      partner: newPartnerProfile,
      message: 'Профиль партнера создан. Теперь можно наполнять контент.'
    };

  } catch (error) {
    console.error('Create partner account error:', error);
    throw error;
  }
};

/**
 * ✅ ЭТАП 3: ФИНАЛЬНОЕ ОДОБРЕНИЕ ПАРТНЕРА (создание PartnerProfile)
 * Вызывается админом после одобрения юридических данных
 */
const finalApprovePartner = async (legalInfoId, adminId) => {
  const session = await mongoose.startSession();
  
  try {
    return await session.withTransaction(async () => {
      // 1️⃣ ПОЛУЧАЕМ юридическую информацию
      const legalInfo = await PartnerLegalInfo.findById(legalInfoId)
        .populate('user_id')
        .session(session);
      
      if (!legalInfo) {
        throw new Error('Юридическая информация не найдена');
      }

      if (legalInfo.verification_status !== 'pending') {
        throw new Error('Юридическая информация уже обработана');
      }

      // 2️⃣ ОДОБРЯЕМ юридические данные
      await legalInfo.verify(adminId, 'Юридические данные одобрены администратором');

      // Получаем первичную заявку
      const initialRequest = await InitialPartnerRequest.findOne({
        user_id: legalInfo.user_id._id
      }).session(session);

      if (!initialRequest) {
        throw new Error('Первичная заявка не найдена');
      }

      // Обновляем статус заявки
      await initialRequest.approveLegal(adminId, 'Юридические данные одобрены');

      // 3️⃣ СОЗДАЕМ PartnerProfile (ЕДИНСТВЕННОЕ МЕСТО СОЗДАНИЯ!)
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

  } catch (error) {
    console.error('Final approve partner error:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

// ================ ЭТАП 4-5: УПРАВЛЕНИЕ КОНТЕНТОМ ================

/**
 * ✅ ЭТАП 4: Отправка контента на модерацию
 */
const submitContentForReview = async (userId) => {
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

/**
 * ✅ ЭТАП 5: Управление контентом партнера (для админов)
 */
const updatePartnerContentStatus = async (profileId, newStatus, adminId = null) => {
  try {
    const profile = await PartnerProfile.findById(profileId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Обновляем статус контента
    profile.content_status = newStatus;

    // ЭТАП 6: Если контент одобрен - делаем партнера публичным!
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

// ================ ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * ✅ Получение публичных партнеров (для сайта)
 */
const getPublicPartners = async (filters = {}) => {
  try {
    const { category, lat, lng, radius = 5 } = filters;
    
    let query = {
      is_public: true,
      is_active: true,
      is_approved: true
    };

    if (category) {
      query.category = category;
    }

    // Поиск по геолокации
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: radius * 1000 // км в метры
        }
      };
    }

    const partners = await PartnerProfile.find(query)
      .select('business_name brand_name category description location ratings working_hours cover_image_url')
      .sort({ 'ratings.avg_rating': -1 })
      .limit(50);

    return {
      success: true,
      partners: partners,
      count: partners.length
    };

  } catch (error) {
    console.error('Get public partners error:', error);
    throw error;
  }
};

/**
 * ✅ Получение статистики партнера
 */
const getPartnerStats = async (userId) => {
  try {
    const profile = await PartnerProfile.findOne({ user_id: userId });
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    return {
      success: true,
      stats: profile.stats,
      ratings: profile.ratings,
      status: {
        is_public: profile.is_public,
        is_active: profile.is_active,
        content_status: profile.content_status,
        published_at: profile.published_at
      }
    };

  } catch (error) {
    console.error('Get partner stats error:', error);
    throw error;
  }
};

// ================ ЕДИНЫЙ ЭКСПОРТ ================
export {
  // АВТОРИЗАЦИЯ
  loginPartner,
  getPartnerById,
  
  // ЭТАП 3: СОЗДАНИЕ ПРОФИЛЯ (ТОЛЬКО ЗДЕСЬ!)
  createPartnerAccount,
  finalApprovePartner,
  
  // ЭТАП 4-5: КОНТЕНТ
  submitContentForReview,
  updatePartnerContentStatus,
  
  // ДОПОЛНИТЕЛЬНО
  getPublicPartners,
  getPartnerStats
};