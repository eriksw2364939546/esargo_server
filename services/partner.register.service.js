// services/partner.register.service.js - ИСПРАВЛЕННЫЙ
import { User, InitialPartnerRequest } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

/**
 * ✅ ПРАВИЛЬНО: Создание User + InitialPartnerRequest (как на изображении 1)
 * Партнер сразу получает роль 'partner' и может войти в личный кабинет
 * НО в личном кабинете почти ничего не работает до одобрения
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
        email: normalizedEmail,
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

      // 3️⃣ Создаем InitialPartnerRequest (заявка партнера)
      const newPartnerRequest = new InitialPartnerRequest({
        user_id: newUser._id,
        personal_data: {
          first_name,
          last_name,
          phone,
          email: normalizedEmail
        },
        business_data: {
          business_name,
          brand_name: brand_name || business_name,
          category,
          description: `${category === 'restaurant' ? 'Ресторан' : 'Магазин'} ${business_name}`,
          address,
          location,
          floor_unit,
          phone,
          email: normalizedEmail,
          owner_name: first_name,
          owner_surname: last_name
        },
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

      return {
        success: true,
        user: {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
          is_active: newUser.is_active,
          is_email_verified: newUser.is_email_verified
        },
        request: {
          id: newPartnerRequest._id,
          business_name: newPartnerRequest.business_data.business_name,
          category: newPartnerRequest.business_data.category,
          status: newPartnerRequest.status,
          submitted_at: newPartnerRequest.submitted_at
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
 * ✅ Получение статуса личного кабинета партнера
 * Показывает что нужно сделать дальше
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
      business_name: request.business_data.business_name,
      category: request.business_data.category,
      submitted_at: request.submitted_at,
      ...config
    };

  } catch (error) {
    console.error('Get partner dashboard status error:', error);
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
      'financial_reports'
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