// services/partner.register.service.js - ИСПРАВЛЕН ДЛЯ ВОЗВРАТА ТОКЕНА 🎯
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
    console.log('🔍 STARTING PARTNER REGISTRATION:', {
      email: registrationData.email,
      business_name: registrationData.business_name
    });

    const result = await session.withTransaction(async () => {
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
      
      console.log('🔍 CHECKING EXISTING USER:', {
        normalized_email: normalizedEmail,
        hashed_email: hashedEmail
      });
      
      const existingMeta = await Meta.findByEmailHash(hashedEmail);
      if (existingMeta) {
        console.log('🚨 USER EXISTS:', existingMeta._id);
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

      console.log('🔍 CREATING USER...');

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
      
      console.log('✅ USER CREATED:', {
        user_id: newUser._id,
        email: newUser.email,
        role: newUser.role
      });

      // 2️⃣ Создаем Meta запись через правильный метод
      const newMetaInfo = await Meta.createForPartner(newUser._id, hashedEmail);
      
      console.log('✅ META CREATED:', {
        meta_id: newMetaInfo._id,
        user_id: newMetaInfo.user_id
      });

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
      
      console.log('✅ INITIAL REQUEST CREATED:', {
        request_id: newInitialRequest._id,
        status: newInitialRequest.status
      });

      // 4️⃣ Генерируем токен для входа в личный кабинет
      console.log('🔍 GENERATING TOKEN...');
      
      const tokenPayload = {
        user_id: newUser._id,
        _id: newUser._id,
        email: newUser.email,
        role: 'partner',
        is_admin: false
      };
      
      console.log('🔍 TOKEN PAYLOAD:', tokenPayload);
      
      const token = generateCustomerToken(tokenPayload, '30d');
      
      console.log('🔍 TOKEN GENERATION RESULT:', {
        token_created: !!token,
        token_length: token ? token.length : 0,
        token_preview: token ? token.substring(0, 20) + '...' : 'NO_TOKEN'
      });

      if (!token) {
        console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА: Токен не создался!');
        throw new Error('Ошибка создания токена');
      }

      const responseData = {
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
      
      console.log('✅ REGISTRATION COMPLETE:', {
        success: responseData.success,
        user_id: responseData.user.id,
        has_token: !!responseData.token,
        token_length: responseData.token ? responseData.token.length : 0
      });

      return responseData;
    });

    console.log('✅ TRANSACTION COMPLETE:', {
      success: result.success,
      has_token: !!result.token
    });

    return result;

  } catch (error) {
    console.error('🚨 REGISTER PARTNER ERROR:', {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack
    });
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

    // Определяем текущий этап и что делать дальше
    let currentStep = 1;
    let stepName = "Ожидание одобрения заявки";
    let nextSteps = [];
    let canAccess = {};

    switch (request.status) {
      case 'pending':
        currentStep = 1;
        stepName = "Ожидание одобрения заявки";
        nextSteps = [
          "Ожидайте рассмотрения заявки администратором",
          "Проверьте правильность указанных данных",
          "В случае вопросов обратитесь в поддержку"
        ];
        canAccess = {
          dashboard: true,
          personal_data: true,
          legal_forms: false,
          profile_editing: false,
          menu_management: false
        };
        break;

      case 'approved':
        currentStep = 2;
        stepName = "Подача юридических данных";
        nextSteps = [
          "Подайте юридические документы через форму",
          "Подготовьте SIRET, документы о регистрации бизнеса",
          "После подачи документов ожидайте проверки"
        ];
        canAccess = {
          dashboard: true,
          personal_data: true,
          legal_forms: true,
          profile_editing: false,
          menu_management: false
        };
        break;

      case 'legal_submitted':
        currentStep = 3;
        stepName = "Проверка юридических данных";
        nextSteps = [
          "Ожидайте проверки юридических документов",
          "Проверка может занять до 3 рабочих дней",
          "При необходимости мы свяжемся с вами"
        ];
        canAccess = {
          dashboard: true,
          personal_data: true,
          legal_forms: false,
          profile_editing: false,
          menu_management: false
        };
        break;

      case 'legal_approved':
        currentStep = 4;
        stepName = "Настройка профиля и контента";
        nextSteps = [
          "Заполните профиль ресторана/магазина",
          "Добавьте фотографии и описание",
          "Настройте меню и цены",
          "Активируйте профиль для клиентов"
        ];
        canAccess = {
          dashboard: true,
          personal_data: true,
          legal_forms: false,
          profile_editing: true,
          menu_management: true
        };
        break;

      default:
        currentStep = 1;
        stepName = "Статус неизвестен";
        nextSteps = ["Обратитесь в поддержку"];
        canAccess = {
          dashboard: true,
          personal_data: false,
          legal_forms: false,
          profile_editing: false,
          menu_management: false
        };
    }

    return {
      workflow: {
        current_step: currentStep,
        step_name: stepName,
        next_steps: nextSteps
      },
      request: {
        id: request._id,
        status: request.status,
        business_name: request.business_data.business_name,
        category: request.business_data.category,
        created_at: request.createdAt
      },
      legal_info: legalInfo ? {
        id: legalInfo._id,
        status: legalInfo.verification_status,
        submitted_at: legalInfo.createdAt
      } : null,
      access_permissions: canAccess
    };

  } catch (error) {
    console.error('Get partner dashboard status error:', error);
    throw error;
  }
};

/**
 * ✅ Проверка доступа партнера к функции
 */
export const checkPartnerAccess = async (userId, feature) => {
  try {
    const dashboardData = await getPartnerDashboardStatus(userId);
    const permissions = dashboardData.access_permissions;

    const hasAccess = permissions[feature] || false;
    
    let reason = null;
    if (!hasAccess) {
      switch (feature) {
        case 'legal_forms':
          reason = "Доступ к юридическим формам откроется после одобрения заявки";
          break;
        case 'profile_editing':
          reason = "Редактирование профиля станет доступно после одобрения юридических данных";
          break;
        case 'menu_management':
          reason = "Управление меню станет доступно после создания профиля";
          break;
        default:
          reason = "Функция недоступна на текущем этапе";
      }
    }

    return {
      has_access: hasAccess,
      reason,
      current_step: dashboardData.workflow.current_step,
      required_step: feature === 'legal_forms' ? 2 : feature === 'profile_editing' ? 4 : 1
    };

  } catch (error) {
    console.error('Check partner access error:', error);
    throw error;
  }
};

/**
 * ✅ Получение расшифрованных данных партнера
 */
export const getDecryptedPartnerData = async (userId) => {
  try {
    const request = await InitialPartnerRequest.findOne({ user_id: userId });
    if (!request) {
      throw new Error('Заявка партнера не найдена');
    }

    const user = await User.findById(userId).select('-password_hash');
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Расшифровываем личные данные
    const personalData = {
      first_name: request.personal_data.first_name,
      last_name: request.personal_data.last_name,
      email: request.personal_data.email,
      phone: decryptString(request.personal_data.phone)
    };

    // Расшифровываем бизнес данные
    const businessData = {
      business_name: request.business_data.business_name,
      brand_name: request.business_data.brand_name,
      category: request.business_data.category,
      description: request.business_data.description,
      address: decryptString(request.business_data.address),
      phone: decryptString(request.business_data.phone),
      email: decryptString(request.business_data.email),
      floor_unit: request.business_data.floor_unit ? decryptString(request.business_data.floor_unit) : null,
      location: request.business_data.location,
      owner_name: request.business_data.owner_name,
      owner_surname: request.business_data.owner_surname
    };

    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        is_email_verified: user.is_email_verified,
        created_at: user.createdAt
      },
      personal_data: personalData,
      business_data: businessData,
      registration_info: request.registration_info,
      request_status: request.status,
      created_at: request.createdAt
    };

  } catch (error) {
    console.error('Get decrypted partner data error:', error);
    throw error;
  }
};

/**
 * ✅ Шифрование и сохранение юридических данных
 */
export const encryptLegalData = async (legalData) => {
  try {
    const {
      user_id,
      partner_request_id,
      legal_name,
      siret_number,
      legal_form,
      business_address,
      contact_person,
      contact_phone,
      bank_details,
      tax_number,
      additional_info,
      submitted_ip,
      user_agent
    } = legalData;

    const newLegalInfo = new PartnerLegalInfo({
      user_id,
      partner_request_id,
      
      // Зашифрованные юридические данные
      legal_data: {
        legal_name: cryptoString(legal_name),
        siret_number: cryptoString(siret_number),
        legal_form: cryptoString(legal_form),
        business_address: cryptoString(business_address),
        contact_person: cryptoString(contact_person),
        contact_phone: cryptoString(contact_phone),
        bank_details: bank_details ? cryptoString(JSON.stringify(bank_details)) : null,
        tax_number: tax_number ? cryptoString(tax_number) : null,
        additional_info: additional_info ? cryptoString(additional_info) : null
      },
      
      submission_info: {
        submitted_at: new Date(),
        submitted_ip,
        user_agent
      },
      
      verification_status: 'pending'
    });

    await newLegalInfo.save();
    
    console.log('✅ LEGAL DATA ENCRYPTED AND SAVED:', {
      legal_info_id: newLegalInfo._id,
      user_id,
      partner_request_id
    });

    return newLegalInfo;

  } catch (error) {
    console.error('Encrypt legal data error:', error);
    throw error;
  }
};