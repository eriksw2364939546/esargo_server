// services/partner.register.service.js - БЕЗОПАСНЫЙ С ШИФРОВАНИЕМ 🔐
import { User, InitialPartnerRequest } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { cryptoString, decryptString } from '../utils/crypto.js'; // 🔐 ДОБАВИЛИ ШИФРОВАНИЕ
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

/**
 * ✅ БЕЗОПАСНАЯ РЕГИСТРАЦИЯ: Создание User + InitialPartnerRequest
 * 🔐 С правильным шифрованием персональных данных
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

      // 3️⃣ Создаем InitialPartnerRequest (заявка партнера) 🔐 С ШИФРОВАНИЕМ
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
        token
      };
    });

  } catch (error) {
    console.error('Register partner with initial request error:', error);
    throw error;
  }
};

/**
 * ✅ БЕЗОПАСНОЕ получение статуса личного кабинета партнера
 * 🔓 Расшифровывает данные только для владельца
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

    // Конфигурация статусов для личного кабинета
    const statusConfig = {
      'pending': {
        dashboard_state: 'awaiting_approval',
        message: 'Ваша заявка на рассмотрении у администратора',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: true
      },
      'approved': {
        dashboard_state: 'need_legal_info',
        message: 'Заявка одобрена! Заполните юридические данные',
        can_access_features: false,
        show_legal_form: true, // 🎯 ПОКАЗАТЬ ФОРМУ ИЗОБРАЖЕНИЯ 2
        admin_action_needed: false
      },
      'awaiting_legal_info': {
        dashboard_state: 'need_legal_info',
        message: 'Необходимо заполнить юридические данные',
        can_access_features: false,
        show_legal_form: true,
        admin_action_needed: false
      },
      'under_review': {
        dashboard_state: 'legal_review',
        message: 'Юридические данные на проверке',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: true
      },
      'completed': {
        dashboard_state: 'active_partner',
        message: 'Добро пожаловать! Все функции доступны',
        can_access_features: true, // 🎉 ВСЁ ДОСТУПНО
        show_legal_form: false,
        admin_action_needed: false
      },
      'rejected': {
        dashboard_state: 'rejected',
        message: 'Заявка отклонена',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: false,
        rejection_reason: request.review_info?.rejection_reason
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
      
      // 🔓 РАСШИФРОВЫВАЕМ только для владельца (в контроллере проверяем права)
      // phone будет расшифрован отдельной функцией при необходимости
      
      ...config
    };

  } catch (error) {
    console.error('Get partner dashboard status error:', error);
    throw error;
  }
};

/**
 * 🔓 БЕЗОПАСНАЯ расшифровка данных партнера (только для владельца/админа)
 * @param {string} userId - ID пользователя  
 * @param {string} requesterId - ID того, кто запрашивает данные
 * @param {string} requesterRole - Роль запрашивающего
 * @returns {object} - Расшифрованные данные или ошибка доступа
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
    
    // Список функций которые доступны только после полного одобрения
    const restrictedFeatures = [
      'menu_management',
      'order_management', 
      'analytics',
      'profile_editing',
      'financial_reports',
      'profile_viewing' // 🆕 ДОБАВИЛИ
    ];

    if (restrictedFeatures.includes(feature)) {
      return {
        has_access: status.can_access_features || false,
        reason: status.can_access_features 
          ? null 
          : 'Функция будет доступна после одобрения документов'
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
 * Используется при подаче документов (этап 2)
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

// 🔐 ЭКСПОРТ ФУНКЦИЙ БЕЗОПАСНОСТИ
export { encryptLegalData, getDecryptedPartnerData };