// services/partner.register.service.js - ПОЛНЫЙ ИСПРАВЛЕННЫЙ ФАЙЛ 🎯
import { User, InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

// ================ 🎯 ЭТАП 1: РЕГИСТРАЦИЯ ================

/**
 * ✅ ЭТАП 1: ТОЛЬКО User + InitialPartnerRequest
 * ❌ НЕ создаем PartnerProfile (создается только после одобрения юр.данных)
 */
export const registerPartnerWithInitialRequest = async (registrationData) => {
  const session = await mongoose.startSession();
  
  try {
    return await session.withTransaction(async () => {
      const {
        // Данные пользователя
        first_name,
        last_name, 
        email,
        password,
        phone,
        
        // Данные бизнеса
        business_name,
        brand_name,
        category, // restaurant/store
        address,
        location,
        floor_unit,
        whatsapp_consent = false,
        
        // Метаданные
        registration_ip,
        user_agent
      } = registrationData;

      // Проверка существования
      const normalizedEmail = email.toLowerCase().trim();
      const hashedEmail = hashMeta(normalizedEmail);
      
      const existingMeta = await Meta.findByEmailHash(hashedEmail);
      if (existingMeta) {
        const error = new Error('Пользователь с таким email уже существует');
        error.statusCode = 400;
        throw error;
      }

      // ✅ Преобразуем location в GeoJSON формат
      let geoLocation;
      if (location && location.lat && location.lng) {
        geoLocation = {
          type: 'Point',
          coordinates: [location.lng, location.lat] // [longitude, latitude] - порядок важен!
        };
      } else {
        const error = new Error('Координаты локации обязательны (lat, lng)');
        error.statusCode = 400;
        throw error;
      }

      // 1️⃣ Создаем User с ролью 'partner'
      const newUser = new User({
        email: normalizedEmail, // ✅ ОТКРЫТО (нужно для авторизации)
        password_hash: await hashString(password),
        role: 'partner', // 🎯 СРАЗУ ПАРТНЕР (может войти в кабинет)
        is_active: true,
        is_email_verified: false,
        gdpr_consent: {
          data_processing: true,
          marketing: whatsapp_consent,
          analytics: true,
          consent_date: new Date()
        },
        registration_source: 'web',
        registration_ip,
        user_agent
      });

      await newUser.save({ session });

      // 2️⃣ Создаем Meta запись через правильный метод
      const newMetaInfo = await Meta.createForPartner(newUser._id, hashedEmail);

      // 3️⃣ Создаем ТОЛЬКО InitialPartnerRequest (заявка партнера)
      // ❌ НЕ СОЗДАЕМ PartnerProfile (создается только в ЭТАПЕ 3!)
      const newInitialRequest = new InitialPartnerRequest({
        user_id: newUser._id,
        personal_data: {
          first_name,
          last_name,
          phone: cryptoString(phone), // 🔐 Шифруем телефон
          email: normalizedEmail // ✅ Email открыто (копия из User)
        },
        business_data: {
          // ✅ ОТКРЫТЫЕ ДАННЫЕ (для каталога)
          business_name,
          brand_name: brand_name || business_name,
          category,
          description: `${category === 'restaurant' ? 'Ресторан' : 'Магазин'} ${business_name}`,
          
          // 🔐 ЗАШИФРОВАННЫЕ ДАННЫЕ (адреса и контакты)
          address: cryptoString(address),
          phone: cryptoString(phone),
          email: cryptoString(normalizedEmail),
          floor_unit: floor_unit ? cryptoString(floor_unit) : null,
          
          // ✅ ГЕОЛОКАЦИЯ (правильный GeoJSON формат)
          location: geoLocation,
          
          // ✅ ВЛАДЕЛЕЦ (имена не критичны)
          owner_name: first_name,
          owner_surname: last_name
        },
        registration_info: {
          registration_ip,
          user_agent,
          whatsapp_consent,
          consent_date: new Date()
        }
      });

      await newInitialRequest.save({ session });

      // 4️⃣ Генерируем токен для входа в личный кабинет
      const token = generateCustomerToken({
        user_id: newUser._id,
        _id: newUser._id,
        email: newUser.email,
        role: 'partner',
        is_admin: false
      }, '30d');

      return {
        success: true,
        user: {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
          is_email_verified: newUser.is_email_verified
        },
        request: {
          _id: newInitialRequest._id,
          status: newInitialRequest.status,
          business_name: newInitialRequest.business_data.business_name,
          category: newInitialRequest.business_data.category
        },
        token,
        next_steps: [
          'Дождитесь одобрения заявки администратором',
          'После одобрения вы сможете подать юридические данные',
          'Войдите в личный кабинет для отслеживания статуса'
        ]
      };
    });

  } catch (error) {
    console.error('Register partner with initial request error:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

// ================ 📊 DASHBOARD И СТАТУСЫ ================

/**
 * ✅ Получение полного статуса дашборда партнера
 */
export const getPartnerDashboardStatus = async (userId) => {
  try {
    // Получаем заявку партнера
    const request = await InitialPartnerRequest.findOne({ user_id: userId });
    if (!request) {
      throw new Error('Заявка партнера не найдена');
    }

    // Получаем юридическую информацию если есть
    let legalInfo = null;
    if (request.status !== 'pending') {
      legalInfo = await PartnerLegalInfo.findOne({
        partner_request_id: request._id
      });
    }

    // Получаем профиль если создан
    const PartnerProfile = (await import('../models/index.js')).PartnerProfile;
    const profile = await PartnerProfile.findOne({ user_id: userId });

    // 🎯 КОНФИГУРАЦИЯ СТАТУСОВ ПО ЭТАПАМ
    const statusConfig = {
      // ==================== ЭТАП 1: ОЖИДАНИЕ ОДОБРЕНИЯ ====================
      'pending': {
        dashboard_state: 'waiting_admin_approval',
        message: 'Ваша заявка отправлена администратору на рассмотрение',
        can_access_features: false,
        show_legal_form: false,
        show_content_management: false,
        admin_action_needed: true,
        has_profile: false,
        has_legal_info: false,
        current_step: 1,
        total_steps: 6,
        step_description: 'Администратор проверяет вашу первичную заявку',
        call_to_action: 'Дождаться одобрения администратора'
      },
      
      // ==================== ЭТАП 2: МОЖНО ПОДАВАТЬ ЮР.ДАННЫЕ ====================
      'approved': {
        dashboard_state: 'can_submit_legal',
        message: '🎉 Заявка одобрена! Теперь подайте юридические данные',
        can_access_features: false,
        show_legal_form: true, // ПОКАЗЫВАЕМ ФОРМУ ЮР.ДАННЫХ
        show_content_management: false,
        admin_action_needed: false,
        has_profile: false,
        has_legal_info: !!legalInfo,
        current_step: 2,
        total_steps: 6,
        step_description: 'Подача юридических данных для создания профиля',
        call_to_action: 'Заполнить юридические данные'
      },
      
      // ==================== ЭТАП 3: ЮР.ДАННЫЕ НА ПРОВЕРКЕ ====================
      'under_review': {
        dashboard_state: 'legal_under_review',
        message: 'Юридические данные поданы и проверяются администратором',
        can_access_features: false,
        show_legal_form: false,
        show_content_management: false,
        admin_action_needed: true,
        has_profile: false,
        has_legal_info: !!legalInfo,
        current_step: 3,
        total_steps: 6,
        step_description: 'Администратор проверяет ваши юридические данные',
        call_to_action: 'Дождаться одобрения документов'
      },
      
      // ==================== ЭТАП 4: ПРОФИЛЬ СОЗДАН - НАПОЛНЕНИЕ КОНТЕНТА ====================
      'legal_approved': {
        dashboard_state: 'profile_created',
        message: '🎉 Документы одобрены! Профиль создан. Наполните контент',
        can_access_features: true, // ДОСТУП К УПРАВЛЕНИЮ КОНТЕНТОМ
        show_legal_form: false,
        show_content_management: true, // ПОКАЗЫВАЕМ УПРАВЛЕНИЕ КОНТЕНТОМ
        admin_action_needed: false,
        has_profile: !!profile,
        has_legal_info: !!legalInfo,
        profile_status: profile?.content_status || 'awaiting_content',
        current_step: 4,
        total_steps: 6,
        step_description: 'Добавьте меню, фотографии и описание вашего бизнеса',
        call_to_action: 'Наполнить контент профиля'
      },
      
      // ==================== ЭТАП 5: КОНТЕНТ НА МОДЕРАЦИИ ====================
      'content_review': {
        dashboard_state: 'content_under_review',
        message: 'Контент отправлен на модерацию администратору',
        can_access_features: true,
        show_legal_form: false,
        show_content_management: true,
        admin_action_needed: true,
        has_profile: !!profile,
        has_legal_info: !!legalInfo,
        profile_status: profile?.content_status || 'pending_review',
        current_step: 5,
        total_steps: 6,
        step_description: 'Администратор проверяет ваш контент перед публикацией',
        call_to_action: 'Дождаться одобрения контента'
      },
      
      // ==================== ЭТАП 6: ВСЁ ОДОБРЕНО - ПУБЛИЧНЫЙ ДОСТУП! ====================
      'completed': {
        dashboard_state: 'public_active',
        message: '🎉 Поздравляем! Ваш бизнес доступен на публичном сайте',
        can_access_features: true, // ВСЁ ДОСТУПНО
        show_legal_form: false,
        show_content_management: true,
        admin_action_needed: false,
        has_profile: !!profile,
        has_legal_info: !!legalInfo,
        profile_status: profile?.content_status || 'approved',
        is_public: profile?.is_public || false,
        published_at: profile?.published_at,
        current_step: 6,
        total_steps: 6,
        step_description: 'Ваш бизнес успешно опубликован!',
        call_to_action: 'Управлять заказами и контентом',
        available_features: [
          'full_content_management',
          'order_management',
          'analytics',
          'customer_reviews',
          'financial_reports'
        ]
      },
      
      // ==================== ОТКЛОНЕНО ====================
      'rejected': {
        dashboard_state: 'rejected',
        message: 'Заявка отклонена администратором',
        can_access_features: false,
        show_legal_form: false,
        show_content_management: false,
        admin_action_needed: false,
        rejection_reason: request.review_info?.rejection_reason,
        has_profile: false,
        has_legal_info: !!legalInfo,
        current_step: 0,
        total_steps: 6,
        step_description: 'Заявка отклонена',
        call_to_action: 'Обратитесь в поддержку для уточнения причин'
      }
    };

    const config = statusConfig[request.status] || statusConfig['pending'];

    // 🆕 ДОБАВЛЯЕМ ДОПОЛНИТЕЛЬНУЮ ЛОГИКУ ДЛЯ ОСОБЫХ СЛУЧАЕВ
    
    // Если профиль существует, но статус заявки не соответствует
    if (profile && request.status === 'legal_approved') {
      config.profile_management_available = true;
      config.profile_id = profile._id;
    }

    return {
      ...config,
      request_id: request._id,
      request_status: request.status,
      business_info: {
        business_name: request.business_data.business_name,
        category: request.business_data.category,
        submitted_at: request.submitted_at
      }
    };

  } catch (error) {
    console.error('Get partner dashboard status error:', error);
    throw error;
  }
};

// ================ 🔓 РАСШИФРОВКА ДАННЫХ ================

/**
 * ✅ Получение расшифрованных персональных данных партнера
 */
export const getDecryptedPartnerData = async (userId, requesterId, requesterRole) => {
  try {
    // Проверяем права доступа
    if (requesterId !== userId && requesterRole !== 'admin') {
      throw new Error('Нет прав доступа к персональным данным');
    }

    const request = await InitialPartnerRequest.findOne({ user_id: userId });
    if (!request) {
      throw new Error('Заявка партнера не найдена');
    }

    // 🔓 Расшифровываем чувствительные данные
    const decryptedData = {
      personal_data: {
        first_name: request.personal_data.first_name,
        last_name: request.personal_data.last_name,
        phone: decryptString(request.personal_data.phone), // 🔓 РАСШИФРОВАЛИ
        email: request.personal_data.email // ✅ Уже открыто
      },
      business_data: {
        business_name: request.business_data.business_name,
        brand_name: request.business_data.brand_name,
        category: request.business_data.category,
        description: request.business_data.description,
        
        // 🔓 Расшифрованные данные
        address: decryptString(request.business_data.address), // 🔓 РАСШИФРОВАЛИ
        phone: decryptString(request.business_data.phone), // 🔓 РАСШИФРОВАЛИ
        email: decryptString(request.business_data.email), // 🔓 РАСШИФРОВАЛИ
        
        // ✅ Открытые данные
        location: request.business_data.location,
        owner_name: request.business_data.owner_name,
        owner_surname: request.business_data.owner_surname,
        cover_image_url: request.business_data.cover_image_url,
        
        // 🔓 Расшифровка опциональных данных
        floor_unit: request.business_data.floor_unit ? decryptString(request.business_data.floor_unit) : null // 🔓 РАСШИФРОВАЛИ
      }
    };

    return decryptedData;

  } catch (error) {
    console.error('Get decrypted partner data error:', error);
    throw error;
  }
};

// ================ 🔐 ФУНКЦИИ ПРОВЕРКИ ДОСТУПА ================

/**
 * ✅ Проверка может ли партнер получить доступ к функциям
 */
export const checkPartnerAccess = async (userId, feature) => {
  try {
    const status = await getPartnerDashboardStatus(userId);
    
    // Функции управления контентом доступны с этапа 4
    const contentManagementFeatures = [
      'menu_management',
      'photo_upload',
      'description_editing',
      'price_management',
      'content_editing'
    ];
    
    // Функции для активных партнеров (этап 6)
    const activePartnerFeatures = [
      'order_management', 
      'analytics',
      'financial_reports',
      'customer_reviews'
    ];
    
    // Функции просмотра профиля (этап 4+)
    const profileFeatures = [
      'profile_viewing',
      'profile_editing'
    ];

    if (contentManagementFeatures.includes(feature)) {
      return {
        has_access: status.show_content_management || false,
        reason: status.show_content_management 
          ? null 
          : 'Функция будет доступна после одобрения юридических данных'
      };
    }
    
    if (activePartnerFeatures.includes(feature)) {
      return {
        has_access: (status.dashboard_state === 'public_active'),
        reason: (status.dashboard_state === 'public_active')
          ? null 
          : 'Функция будет доступна после публикации на сайте'
      };
    }
    
    if (profileFeatures.includes(feature)) {
      return {
        has_access: status.has_profile || false,
        reason: status.has_profile 
          ? null 
          : 'Профиль будет доступен после одобрения документов'
      };
    }

    // Базовые функции доступны всегда
    return {
      has_access: true,
      reason: null
    };

  } catch (error) {
    console.error('Check partner access error:', error);
    return {
      has_access: false,
      reason: 'Ошибка проверки доступа'
    };
  }
};

// ================ 🔐 ШИФРОВАНИЕ ЮРИДИЧЕСКИХ ДАННЫХ ================

/**
 * 🔐 БЕЗОПАСНАЯ ФУНКЦИЯ: Шифрование юридических данных
 */
export const encryptLegalData = (legalData) => {
  return {
    // 🔐 ВСЕ ЮРИДИЧЕСКИЕ ДАННЫЕ ШИФРУЕМ
    legal_name: cryptoString(legalData.legal_name),
    siret_number: cryptoString(legalData.siret_number),
    legal_form: legalData.legal_form, // ✅ Форма собственности не критична
    business_address: cryptoString(legalData.business_address),
    contact_person: legalData.contact_person, // ✅ Имя не критично
    contact_phone: cryptoString(legalData.contact_phone),
    bank_details: legalData.bank_details ? cryptoString(legalData.bank_details) : null,
    tax_number: legalData.tax_number ? cryptoString(legalData.tax_number) : null,
    additional_info: legalData.additional_info || null
  };
};