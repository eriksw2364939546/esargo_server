// services/partner.register.service.js - ПРАВИЛЬНАЯ ЛОГИКА 🎯
import { User, InitialPartnerRequest } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

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
        
        // Данные бизнеса (изображение 1)
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
      // ❌ НЕ СОЗДАЕМ PartnerProfile! (будет создан позже при одобрении юр.данных)
      const newPartnerRequest = new InitialPartnerRequest({
        user_id: newUser._id,
        
        // 🔐 ПЕРСОНАЛЬНЫЕ ДАННЫЕ - шифруем чувствительное
        personal_data: {
          first_name, // ✅ Имена можно открыто
          last_name,  // ✅ Имена можно открыто
          phone: cryptoString(phone), // 🔐 ШИФРУЕМ ТЕЛЕФОН
          email: normalizedEmail // ✅ Копия из User (открыто)
        },
        
        // 🔐 БИЗНЕС ДАННЫЕ - микс открытого и зашифрованного
        business_data: {
          business_name, // ✅ ОТКРЫТО (нужно для каталога)
          brand_name: brand_name || business_name, // ✅ ОТКРЫТО
          category, // ✅ ОТКРЫТО (нужно для фильтров)
          description: `${category === 'restaurant' ? 'Ресторан' : 'Магазин'} ${business_name}`, // ✅ ОТКРЫТО
          
          // 🔐 ШИФРУЕМ АДРЕСА И КОНТАКТЫ
          address: cryptoString(address), // 🔐 АДРЕС ЗАШИФРОВАН
          location, // ✅ Координаты можно открыто (неточные)
          floor_unit: floor_unit ? cryptoString(floor_unit) : null, // 🔐 ЭТАЖ ЗАШИФРОВАН
          
          // 🔐 КОНТАКТНЫЕ ДАННЫЕ ЗАШИФРОВАНЫ
          phone: cryptoString(phone), // 🔐 ТЕЛЕФОН ЗАШИФРОВАН
          email: cryptoString(normalizedEmail), // 🔐 EMAIL ЗАШИФРОВАН (копия для безопасности)
          
          // Владелец (для админов)
          owner_name: first_name, // ✅ ОТКРЫТО (имена не критичны)
          owner_surname: last_name // ✅ ОТКРЫТО
        },
        
        // Метаданные регистрации
        registration_info: {
          registration_ip,
          user_agent,
          whatsapp_consent,
          consent_date: new Date()
        },
        
        status: 'pending', // Ждет одобрения админом
        submitted_at: new Date()
      });

      await newPartnerRequest.save({ session });

      // 4️⃣ Генерируем JWT токен 
      const token = generateCustomerToken({
        user_id: newUser._id,
        email: newUser.email,
        role: newUser.role
      });

      // 🔐 ВАЖНО: В ответе возвращаем ТОЛЬКО безопасные данные
      return {
        success: true,
        user: {
          id: newUser._id,
          email: newUser.email, // ✅ Email открыт (нужен для интерфейса)
          role: newUser.role,
          is_active: newUser.is_active,
          is_email_verified: newUser.is_email_verified
        },
        request: {
          id: newPartnerRequest._id,
          business_name: newPartnerRequest.business_data.business_name, // ✅ Открыто
          category: newPartnerRequest.business_data.category, // ✅ Открыто
          status: newPartnerRequest.status,
          submitted_at: newPartnerRequest.submitted_at
          // 🚫 НЕ ВОЗВРАЩАЕМ зашифрованные данные в ответе
        },
        // ❌ НЕ ВОЗВРАЩАЕМ profile - его еще НЕТ!
        token,
        next_steps: [
          "Дождитесь одобрения заявки администратором",
          "После одобрения заполните юридические данные", 
          "После одобрения документов получите доступ к управлению контентом",
          "После модерации контента ваш бизнес появится на публичном сайте"
        ]
      };
    });

  } catch (error) {
    console.error('Register partner with initial request error:', error);
    throw error;
  }
};

/**
 * ✅ ПРАВИЛЬНОЕ получение статуса личного кабинета партнера
 * 🎯 Учитывает новую логику: юр.данные → контент → публикация
 */
export const getPartnerDashboardStatus = async (userId) => {
  try {
    // Получаем первичную заявку партнера
    const request = await InitialPartnerRequest.findOne({ user_id: userId });
    
    if (!request) {
      return {
        hasRequest: false,
        dashboard_state: 'no_request',
        message: 'Заявка на партнерство не найдена',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: false
      };
    }

    // 🔍 Проверяем есть ли PartnerProfile (создается только после одобрения юр.данных)
    const { PartnerProfile } = await import('../models/index.js');
    const profile = await PartnerProfile.findOne({ user_id: userId });

    // 🔍 Проверяем есть ли юридические данные
    const { PartnerLegalInfo } = await import('../models/index.js');
    const legalInfo = await PartnerLegalInfo.findOne({ user_id: userId });

    // 🎯 НОВАЯ КОНФИГУРАЦИЯ СТАТУСОВ (5 ЭТАПОВ)
    const statusConfig = {
      // ЭТАП 1: Ждем одобрения заявки
      'pending': {
        dashboard_state: 'awaiting_initial_approval',
        message: 'Ваша заявка на рассмотрении у администратора',
        can_access_features: false,
        show_legal_form: false,
        show_content_management: false,
        admin_action_needed: true,
        has_profile: false,
        has_legal_info: !!legalInfo
      },
      
      // ЭТАП 2: Заявка одобрена, нужны юр.данные
      'approved': {
        dashboard_state: 'need_legal_info',
        message: 'Заявка одобрена! Заполните юридические данные',
        can_access_features: false,
        show_legal_form: true, // 🎯 ПОКАЗАТЬ ФОРМУ ЮРИДИЧЕСКИХ ДАННЫХ
        show_content_management: false,
        admin_action_needed: false,
        has_profile: false,
        has_legal_info: !!legalInfo
      },
      
      // ЭТАП 3: Юр.данные на проверке
      'under_review': {
        dashboard_state: 'legal_review',
        message: 'Юридические данные на проверке у администратора',
        can_access_features: false,
        show_legal_form: false,
        show_content_management: false,
        admin_action_needed: true,
        has_profile: false,
        has_legal_info: !!legalInfo
      },
      
      // ЭТАП 4: Юр.данные одобрены, можно добавлять контент
      'legal_approved': {
        dashboard_state: 'content_management',
        message: 'Документы одобрены! Добавьте меню, фото и описания',
        can_access_features: true, // 🎉 УПРАВЛЕНИЕ КОНТЕНТОМ ДОСТУПНО
        show_legal_form: false,
        show_content_management: true, // 🎯 ПОКАЗАТЬ УПРАВЛЕНИЕ КОНТЕНТОМ
        admin_action_needed: false,
        has_profile: !!profile,
        profile_status: profile?.content_status || 'awaiting_content'
      },
      
      // ЭТАП 5: Контент на модерации
      'content_review': {
        dashboard_state: 'content_moderation',
        message: 'Ваш контент на модерации у администратора',
        can_access_features: true, // Можно редактировать контент
        show_legal_form: false,
        show_content_management: true,
        admin_action_needed: true,
        has_profile: !!profile,
        profile_status: profile?.content_status || 'pending_review'
      },
      
      // ЭТАП 6: ВСЁ ОДОБРЕНО - ПУБЛИЧНЫЙ ДОСТУП!
      'completed': {
        dashboard_state: 'public_active',
        message: '🎉 Поздравляем! Ваш бизнес доступен на публичном сайте',
        can_access_features: true, // ВСЁ ДОСТУПНО
        show_legal_form: false,
        show_content_management: true,
        admin_action_needed: false,
        has_profile: !!profile,
        profile_status: profile?.content_status || 'approved',
        is_public: profile?.is_public || false
      },
      
      // ОТКЛОНЕНО
      'rejected': {
        dashboard_state: 'rejected',
        message: 'Заявка отклонена',
        can_access_features: false,
        show_legal_form: false,
        show_content_management: false,
        admin_action_needed: false,
        rejection_reason: request.review_info?.rejection_reason,
        has_profile: false
      }
    };

    const config = statusConfig[request.status] || statusConfig['pending'];

    return {
      hasRequest: true,
      request_id: request._id,
      status: request.status,
      
      // ✅ БЕЗОПАСНО: показываем только открытые данные
      business_name: request.business_data.business_name,
      category: request.business_data.category,
      submitted_at: request.submitted_at,
      
      // 🆕 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ТЕКУЩЕМ ЭТАПЕ
      profile_id: profile?._id,
      legal_info_id: legalInfo?._id,
      
      ...config
    };

  } catch (error) {
    console.error('Get partner dashboard status error:', error);
    throw error;
  }
};

/**
 * 🔓 БЕЗОПАСНАЯ расшифровка данных партнера (только для владельца/админа)
 */
export const getDecryptedPartnerData = async (userId, requesterId, requesterRole) => {
  try {
    // Проверяем права доступа
    const hasAccess = (
      requesterRole === 'admin' || // Админ может все
      userId === requesterId // Владелец может свои данные
    );

    if (!hasAccess) {
      throw new Error('Нет прав для просмотра персональных данных');
    }

    const request = await InitialPartnerRequest.findOne({ user_id: userId });
    if (!request) {
      throw new Error('Заявка не найдена');
    }

    // 🔓 РАСШИФРОВЫВАЕМ чувствительные данные
    const decryptedData = {
      personal_data: {
        first_name: request.personal_data.first_name,
        last_name: request.personal_data.last_name,
        phone: decryptString(request.personal_data.phone), // 🔓 РАСШИФРОВАЛИ
        email: request.personal_data.email
      },
      business_data: {
        ...request.business_data.toObject(),
        address: decryptString(request.business_data.address), // 🔓 РАСШИФРОВАЛИ
        phone: decryptString(request.business_data.phone), // 🔓 РАСШИФРОВАЛИ
        email: decryptString(request.business_data.email), // 🔓 РАСШИФРОВАЛИ
        floor_unit: request.business_data.floor_unit ? 
          decryptString(request.business_data.floor_unit) : null // 🔓 РАСШИФРОВАЛИ
      }
    };

    return decryptedData;

  } catch (error) {
    console.error('Get decrypted partner data error:', error);
    throw error;
  }
};

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