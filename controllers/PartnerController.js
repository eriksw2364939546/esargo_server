// controllers/PartnerController.js - ИСПРАВЛЕННЫЙ
import { 
  registerPartnerWithInitialRequest,
  getPartnerDashboardStatus,
  checkPartnerAccess
} from '../services/partner.correct.service.js';
import {
  approveInitialPartnerRequest,
  rejectInitialPartnerRequest,
  approveLegalInfoAndCreatePartner
} from '../services/admin.partner.service.js';
import { InitialPartnerRequest, PartnerLegalInfo, PartnerProfile } from '../models/index.js';
import mongoose from 'mongoose';

// ================ ПУБЛИЧНЫЕ МЕТОДЫ ================

/**
 * ✅ ИСПРАВЛЕНО: Регистрация партнера (данные с изображения 1)
 * Создает User + InitialPartnerRequest, партнер может войти в кабинет
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
      
      // Данные бизнеса (как на изображении 1)
      business_name,
      brand_name,
      category, // restaurant/store
      address,
      location, // {lat, lng}
      floor_unit, // этаж/люкс (как на изображении)
      whatsapp_consent
    } = req.body;

    // Валидация
    const requiredFields = {
      first_name,
      last_name,
      email,
      password,
      confirm_password,
      phone,
      business_name,
      category,
      address,
      location
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

    if (password !== confirm_password) {
      return res.status(400).json({
        result: false,
        message: "Пароли не совпадают"
      });
    }

    if (!['restaurant', 'store'].includes(category)) {
      return res.status(400).json({
        result: false,
        message: "Тип бизнеса должен быть 'restaurant' или 'store'"
      });
    }

    // Регистрируем
    const result = await registerPartnerWithInitialRequest({
      first_name,
      last_name,
      email,
      password,
      phone,
      business_name,
      brand_name,
      category,
      address,
      location,
      floor_unit,
      whatsapp_consent,
      registration_ip: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.status(201).json({
      result: true,
      message: "Регистрация успешна! Войдите в личный кабинет",
      user: result.user,
      request: result.request,
      token: result.token,
      dashboard_access: result.dashboard_access,
      next_steps: {
        "1": "Войдите в личный кабинет с полученным токеном",
        "2": "Дождитесь одобрения заявки администратором", 
        "3": "После одобрения заполните юридические данные",
        "4": "Получите полный доступ после проверки документов"
      }
    });

  } catch (error) {
    console.error('Partner registration error:', error);
    
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка регистрации",
      error: error.message
    });
  }
};

/**
 * ✅ Авторизация партнера  
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

    const loginResult = await loginPartner({ email, password });

    res.status(200).json({
      result: true,
      message: "Вход выполнен успешно",
      user: loginResult.user,
      token: loginResult.token
    });

  } catch (error) {
    console.error('Partner login error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка входа",
      error: error.message
    });
  }
};

// ================ ЗАЩИЩЕННЫЕ МЕТОДЫ (ЛИЧНЫЙ КАБИНЕТ) ================

/**
 * ✅ НОВОЕ: Получение статуса для личного кабинета
 * Показывает что доступно партнеру в зависимости от статуса заявки
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

    const dashboardStatus = await getPartnerDashboardStatus(user._id);

    res.status(200).json({
      result: true,
      message: "Статус личного кабинета получен",
      dashboard: dashboardStatus,
      available_actions: {
        can_view_profile: true,
        can_edit_profile: dashboardStatus.can_access_features,
        can_manage_menu: dashboardStatus.can_access_features,
        can_view_orders: dashboardStatus.can_access_features,
        can_view_analytics: dashboardStatus.can_access_features,
        can_submit_legal_info: dashboardStatus.show_legal_form
      }
    });

  } catch (error) {
    console.error('Get dashboard status error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статуса кабинета"
    });
  }
};

/**
 * ✅ ИСПРАВЛЕНО: Получение статуса заявки (старый метод)
 */
export const getRequestStatus = async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(401).json({
        result: false,
        message: "Пользователь не аутентифицирован"
      });
    }

    const status = await getPartnerDashboardStatus(user._id);

    res.status(200).json({
      result: true,
      message: "Статус заявки получен",
      status
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
 * ✅ НОВОЕ: Проверка доступа к функции
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

/**
 * ✅ Предоставление юридических данных (данные с изображения 2)
 * ТОЛЬКО ПОСЛЕ ОДОБРЕНИЯ первичной заявки администратором
 */
export const submitPartnerLegalInfo = async (req, res) => {
  try {
    const { request_id } = req.params;
    const {
      // Данные с изображения 2
      legal_name, // Название юридического лица
      siret_number, // SIRET номер (14 цифр)
      legal_form, // SASU, SARL, etc.
      tva_number, // TVA номер
      legal_address, // Юридический адрес  
      director_name, // Имя директора
      iban, // IBAN
      bic, // BIC
      legal_email, // Email юр.лица
      legal_phone // Телефон юр.лица
    } = req.body;

    const user = req.user;
    if (!user) {
      return res.status(401).json({
        result: false,
        message: "Пользователь не аутентифицирован"
      });
    }

    // Проверяем что все обязательные поля заполнены
    const requiredFields = {
      legal_name,
      siret_number,
      legal_form,
      tva_number,
      legal_address,
      director_name,
      iban,
      bic,
      legal_email,
      legal_phone
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: `Обязательные поля юридических данных: ${missingFields.join(', ')}`
      });
    }

    // Проверяем заявку партнера
    const request = await InitialPartnerRequest.findOne({
      _id: request_id,
      user_id: user._id
    });

    if (!request) {
      return res.status(404).json({
        result: false,
        message: "Заявка не найдена"
      });
    }

    // ✅ ВАЖНО: Заявка должна быть одобрена для подачи юр.данных
    if (request.status !== 'approved' && request.status !== 'awaiting_legal_info') {
      return res.status(400).json({
        result: false,
        message: "Сначала дождитесь одобрения первичной заявки администратором",
        current_status: request.status,
        required_status: ['approved', 'awaiting_legal_info']
      });
    }

    // Проверяем не поданы ли уже юридические данные
    const existingLegalInfo = await PartnerLegalInfo.findOne({
      partner_request_id: request_id
    });

    if (existingLegalInfo) {
      return res.status(400).json({
        result: false,
        message: "Юридические данные уже предоставлены",
        legal_info_status: existingLegalInfo.verification_status
      });
    }

    // Создаем юридическую информацию
    const legalInfo = new PartnerLegalInfo({
      partner_request_id: request_id,
      user_id: user._id,
      verification_status: 'pending',
      legal_data: {
        legal_name,
        siret_number,
        legal_form,
        tva_number,
        legal_address,
        director_name,
        iban: iban.replace(/\s/g, ''), // убираем пробелы
        bic,
        legal_email: legal_email.toLowerCase(),
        legal_phone
      }
    });

    await legalInfo.save();

    // Обновляем статус заявки
    request.status = 'under_review';
    await request.save();

    res.status(201).json({
      result: true,
      message: "Юридические данные успешно предоставлены! Ожидайте проверки документов.",
      legal_info_id: legalInfo._id,
      request_status: request.status,
      next_step: "Администратор проверит документы и одобрит создание полного профиля партнера"
    });

  } catch (error) {
    console.error('Error in submitPartnerLegalInfo:', error);
    
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      let message = "Данная информация уже используется";
      if (duplicateField.includes('siret_number')) {
        message = "SIRET номер уже зарегистрирован в системе";
      }
      return res.status(400).json({ result: false, message });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка при предоставлении юридических данных",
      error: error.message
    });
  }
};

/**
 * ✅ УСТАРЕЛО: Создание первичной заявки
 * Заменено на registerPartner, оставлено для совместимости
 */
export const createInitialPartnerRequest = async (req, res) => {
  return res.status(400).json({
    result: false,
    message: "Этот метод устарел. Используйте POST /api/partners/register для полной регистрации.",
    new_endpoint: "POST /api/partners/register"
  });
};

/**
 * Получение профиля партнера (работает только после полного одобрения)
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

// ================ АДМИНСКИЕ МЕТОДЫ ================
// (оставляем без изменений, они работают правильно)

export const getPartnerRequests = async (req, res) => {
  // ... существующий код админских методов
};

export const updatePartnerRequestStatus = async (req, res) => {
  // ... существующий код
};

export const approveLegalInfoAndCreate = async (req, res) => {
  // ... существующий код  
};

export const rejectLegalInfoData = async (req, res) => {
  // ... существующий код
};

export const getRequestDetails = async (req, res) => {
  // ... существующий код
};

// ================ ЭКСПОРТ ================
export default {
  // ✅ ПРАВИЛЬНЫЙ ПОТОК
  registerPartner, // Создает User + InitialPartnerRequest 
  loginPartnerUser, // Авторизация партнера
  
  // Личный кабинет
  getDashboardStatus, // 🆕 Статус личного кабинета
  getRequestStatus, // Статус заявки (старый метод)
  checkFeatureAccess, // 🆕 Проверка доступа к функциям
  
  // Этапы регистрации
  submitPartnerLegalInfo, // Юридические данные (после одобрения)
  getPartnerProfileData, // Профиль (после полного одобрения)
  
  // Устаревшие
  createInitialPartnerRequest, // DEPRECATED
  
  // Админские
  getPartnerRequests,
  updatePartnerRequestStatus,
  approveLegalInfoAndCreate,
  rejectLegalInfoData,
  getRequestDetails
};