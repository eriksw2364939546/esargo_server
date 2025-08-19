// controllers/PartnerController.js - ИСПРАВЛЕН ДЛЯ ВОЗВРАТА ТОКЕНА 🎯
import { 
  registerPartnerWithInitialRequest,
  getPartnerDashboardStatus,
  checkPartnerAccess,
  getDecryptedPartnerData,
  encryptLegalData
} from '../services/partner.register.service.js';
import { loginPartner, getPartnerById } from '../services/partner.service.js';
import { InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import { cryptoString } from '../utils/crypto.js';
import mongoose from 'mongoose';

// ================ 1️⃣ ЭТАП: РЕГИСТРАЦИЯ ================

/**
 * ✅ ЭТАП 1: РЕГИСТРАЦИЯ ПАРТНЕРА
 * 🔐 Создает: User + Meta + InitialPartnerRequest
 * ❌ НЕ создает: PartnerProfile (создается только в ЭТАПЕ 3!)
 */
export const registerPartner = async (req, res) => {
  try {
    const {
      // Данные пользователя
      first_name,
      last_name,
      email,
      password,
      confirm_password,
      phone,
      
      // Данные бизнеса
      business_name,
      brand_name,
      category, // restaurant/store
      address,
      location, // {lat, lng}
      floor_unit,
      whatsapp_consent
    } = req.body;

    // Валидация обязательных полей
    const requiredFields = {
      first_name, last_name, email, password, confirm_password,
      phone, business_name, category, address, location
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: `Обязательные поля: ${missingFields.join(', ')}`
      });
    }

    // Валидация пароля
    if (password !== confirm_password) {
      return res.status(400).json({
        result: false,
        message: "Пароли не совпадают"
      });
    }

    // Валидация категории
    if (!['restaurant', 'store'].includes(category)) {
      return res.status(400).json({
        result: false,
        message: "Тип бизнеса должен быть 'restaurant' или 'store'"
      });
    }

    // 🎯 ЭТАП 1: Создаем ТОЛЬКО User + InitialPartnerRequest
    const result = await registerPartnerWithInitialRequest({
      first_name, last_name, email, password, phone,
      business_name, brand_name, category, address, location, floor_unit,
      whatsapp_consent, registration_ip: req.ip, user_agent: req.get('User-Agent')
    });

    // 🔥 ИСПРАВЛЕНО: Правильная проверка и возврат токена
    console.log('🔍 REGISTRATION RESULT:', {
      success: result.success,
      has_token: !!result.token,
      token_length: result.token ? result.token.length : 0,
      user_id: result.user ? result.user.id : null
    });

    if (!result.token) {
      console.error('🚨 ОШИБКА: Токен не создался в registerPartnerWithInitialRequest!');
      return res.status(500).json({
        result: false,
        message: "Ошибка создания токена авторизации"
      });
    }

    // ✅ ВОЗВРАЩАЕМ ПОЛНЫЙ ОТВЕТ С ТОКЕНОМ
    res.status(201).json({
      result: true,
      message: "🎯 ЭТАП 1 ЗАВЕРШЕН: Регистрация успешна!",
      user: result.user,
      request: result.request,
      token: result.token, // 🔥 ВОТ ОН ТОКЕН!
      workflow: {
        current_step: 1,
        step_name: "Ожидание одобрения заявки",
        next_steps: result.next_steps
      }
    });

  } catch (error) {
    console.error('Register partner error:', error);
    
    // Выводим полную информацию об ошибке для отладки
    console.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack
    });
    
    if (error.statusCode === 400) {
      return res.status(400).json({
        result: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка при регистрации партнера",
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ✅ АВТОРИЗАЦИЯ ПАРТНЕРА
 * Может войти сразу после регистрации (для личного кабинета)
 */
export const loginPartnerUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        result: false,
        message: "Email и пароль обязательны"
      });
    }

    const result = await loginPartner(email, password);

    res.status(200).json({
      result: true,
      message: "Авторизация успешна",
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('Login partner error:', error);
    
    if (error.statusCode === 401 || error.statusCode === 404) {
      return res.status(401).json({
        result: false,
        message: "Неверный email или пароль"
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка авторизации"
    });
  }
};

// ================ ЛИЧНЫЙ КАБИНЕТ ================

/**
 * ✅ СТАТУС ЛИЧНОГО КАБИНЕТА
 * Показывает на каком этапе находится партнер
 */
export const getDashboardStatus = async (req, res) => {
  try {
    const { user } = req;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const dashboardData = await getPartnerDashboardStatus(user._id);

    res.status(200).json({
      result: true,
      message: "Статус личного кабинета получен",
      dashboard: dashboardData
    });

  } catch (error) {
    console.error('Get dashboard status error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статуса"
    });
  }
};

/**
 * ✅ ПОЛУЧЕНИЕ ПЕРСОНАЛЬНЫХ ДАННЫХ
 * Возвращает расшифрованные данные партнера
 */
export const getPartnerPersonalData = async (req, res) => {
  try {
    const { user } = req;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const personalData = await getDecryptedPartnerData(user._id);

    res.status(200).json({
      result: true,
      message: "Персональные данные получены",
      data: personalData
    });

  } catch (error) {
    console.error('Get partner personal data error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения персональных данных"
    });
  }
};

/**
 * ✅ ПРОВЕРКА ДОСТУПА К ФУНКЦИИ
 * Проверяет доступ партнера к определенной функции
 */
export const checkFeatureAccess = async (req, res) => {
  try {
    const { user } = req;
    const { feature } = req.params;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const access = await checkPartnerAccess(user._id, feature);

    res.status(200).json({
      result: true,
      feature,
      access
    });

  } catch (error) {
    console.error('Check feature access error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка проверки доступа"
    });
  }
};

// ================ 2️⃣ ЭТАП: ЮРИДИЧЕСКИЕ ДАННЫЕ ================

/**
 * ✅ ЭТАП 2: ПОДАЧА ЮРИДИЧЕСКИХ ДАННЫХ
 * 🔐 Создает: PartnerLegalInfo (зашифрованные документы)
 * 📋 Статус: InitialPartnerRequest.status = "under_review"
 */
export const submitPartnerLegalInfo = async (req, res) => {
  try {
    const { request_id } = req.params;
    const { user } = req;
    const {
      legal_name,
      siret_number,
      legal_form,
      business_address,
      contact_person,
      contact_phone,
      bank_details,
      tax_number,
      additional_info
    } = req.body;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    // Валидация обязательных полей
    const requiredFields = { legal_name, siret_number, legal_form, business_address, contact_person, contact_phone };
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: `Обязательные поля: ${missingFields.join(', ')}`
      });
    }

    // Проверяем существование заявки
    const request = await InitialPartnerRequest.findOne({
      _id: request_id,
      user_id: user._id
    });

    if (!request) {
      return res.status(404).json({
        result: false,
        message: "Заявка не найдена или нет доступа"
      });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({
        result: false,
        message: "Сначала дождитесь одобрения заявки"
      });
    }

    // Создаем юридическую информацию
    const legalData = await encryptLegalData({
      user_id: user._id,
      partner_request_id: request_id,
      legal_name,
      siret_number,
      legal_form,
      business_address,
      contact_person,
      contact_phone,
      bank_details,
      tax_number,
      additional_info,
      submitted_ip: req.ip,
      user_agent: req.get('User-Agent')
    });

    // ✅ ИСПРАВЛЕНО: Обновляем статус заявки напрямую
    request.status = 'under_review'; // Юр.данные поданы, ожидают проверки
    await request.save();

    console.log('✅ LEGAL INFO SUBMITTED:', {
      request_id: request._id,
      legal_info_id: legalData._id,
      new_status: request.status
    });

    res.status(201).json({
      result: true,
      message: "🎯 ЭТАП 2 ЗАВЕРШЕН: Юридические данные поданы!",
      legal_info_id: legalData._id,
      workflow: {
        current_step: 3,
        step_name: "Проверка юридических данных",
        next_steps: [
          "Ожидайте проверки юридических данных администратором",
          "После одобрения будет создан профиль партнера"
        ]
      }
    });

  } catch (error) {
    console.error('Submit legal info error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при подаче юридических данных",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ================ 4️⃣+ ЭТАПЫ: ПРОФИЛЬ И КОНТЕНТ ================

/**
 * ✅ ПОЛУЧЕНИЕ ПРОФИЛЯ ПАРТНЕРА
 * Доступно только после создания PartnerProfile (ЭТАП 3)
 */
export const getPartnerProfileData = async (req, res) => {
  try {
    const { user } = req;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    // Проверяем доступ к профилю
    const access = await checkPartnerAccess(user._id, 'profile_viewing');
    
    if (!access.has_access) {
      return res.status(403).json({
        result: false,
        message: access.reason || "Профиль будет доступен после одобрения документов"
      });
    }

    const partnerData = await getPartnerById(user._id);

    if (!partnerData || !partnerData.profile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не создан"
      });
    }

    res.status(200).json({
      result: true,
      message: "Профиль партнера получен",
      user: {
        id: partnerData._id,
        email: partnerData.email,
        role: partnerData.role,
        is_email_verified: partnerData.is_email_verified
      },
      partner: partnerData.profile
    });

  } catch (error) {
    console.error('Get partner profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения профиля"
    });
  }
};

// ================ LEGACY/DEPRECATED ================

/**
 * ❌ УСТАРЕВШИЙ: Старый метод получения статуса
 */
export const getRequestStatus = async (req, res) => {
  try {
    const { user } = req;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Пользователь не аутентифицирован"
      });
    }

    const status = await getPartnerDashboardStatus(user._id);

    res.status(200).json({
      result: true,
      message: "Статус заявки получен (используйте /dashboard)",
      status,
      deprecated: true,
      use_instead: "GET /api/partners/dashboard"
    });

  } catch (error) {
    console.error('Get request status error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статуса"
    });
  }
};

/**
 * ❌ УСТАРЕВШИЙ: Создание первичной заявки
 */
export const createInitialPartnerRequest = async (req, res) => {
  return res.status(400).json({
    result: false,
    message: "Этот метод устарел. Используйте POST /api/partners/register для полной регистрации.",
    new_endpoint: "POST /api/partners/register",
    deprecated: true
  });
};

// ================ ЭКСПОРТ ================
export default {
  // ✅ ОСНОВНОЙ WORKFLOW ПАРТНЕРОВ
  
  // 1️⃣ ЭТАП: РЕГИСТРАЦИЯ
  registerPartner,          // Создает User + InitialPartnerRequest
  loginPartnerUser,         // Авторизация партнера
  
  // ЛИЧНЫЙ КАБИНЕТ
  getDashboardStatus,       // Статус кабинета (что делать дальше)
  getPartnerPersonalData,   // Персональные данные (расшифрованные)
  checkFeatureAccess,       // Проверка доступа к функциям
  
  // 2️⃣ ЭТАП: ЮРИДИЧЕСКИЕ ДАННЫЕ
  submitPartnerLegalInfo,   // Подача юр.данных (ЭТАП 2)
  
  // 4️⃣+ ЭТАПЫ: ПРОФИЛЬ И КОНТЕНТ
  getPartnerProfileData,    // Профиль (доступен после ЭТАПА 3)
  
  // DEPRECATED
  getRequestStatus,         // Устаревший (используйте getDashboardStatus)
  createInitialPartnerRequest // Устаревший (используйте registerPartner)
};