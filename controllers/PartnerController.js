// controllers/PartnerController.js - БЕЗОПАСНЫЙ С КОНТРОЛЕМ ДОСТУПА 🔐
import { 
  registerPartnerWithInitialRequest,
  getPartnerDashboardStatus,
  checkPartnerAccess,
  getDecryptedPartnerData,
  encryptLegalData
} from '../services/partner.register.service.js';
import { InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import { cryptoString } from '../utils/crypto.js'; // 🔐 ДОБАВИЛИ
import mongoose from 'mongoose';

// ================ ПУБЛИЧНЫЕ МЕТОДЫ ================

/**
 * ✅ БЕЗОПАСНАЯ РЕГИСТРАЦИЯ ПАРТНЕРА (данные с изображения 1)
 * 🔐 Автоматическое шифрование персональных данных
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

    // 🔐 РЕГИСТРИРУЕМ с автоматическим шифрованием
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
      message: "Регистрация успешна! Вы можете войти в личный кабинет.",
      user: result.user,
      request: result.request, // ✅ Только безопасные данные
      token: result.token,
      next_steps: [
        "Дождитесь одобрения первичной заявки администратором",
        "После одобрения заполните юридические данные",
        "После проверки документов получите полный доступ к функциям партнера"
      ]
    });

  } catch (error) {
    console.error('Register partner error:', error);
    
    if (error.statusCode === 400) {
      return res.status(400).json({
        result: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка при регистрации партнера"
    });
  }
};

/**
 * ✅ Авторизация партнера (может войти сразу после регистрации)
 */
export const loginPartnerUser = async (req, res) => {
  try {
    // Импортируем функцию авторизации
    const { loginPartner } = await import('../services/partner.service.js');
    
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
    
    if (error.message.includes('не найден') || error.message.includes('Неверный пароль')) {
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

/**
 * 🆕 БЕЗОПАСНЫЙ СТАТУС ЛИЧНОГО КАБИНЕТА
 * ✅ Показывает только безопасные данные
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

    const status = await getPartnerDashboardStatus(user._id);

    res.status(200).json({
      result: true,
      message: "Статус личного кабинета получен",
      dashboard: status // ✅ Только открытые данные
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
 * 🔓 БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ПЕРСОНАЛЬНЫХ ДАННЫХ
 * Только для владельца аккаунта или админа
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

    // 🔓 РАСШИФРОВЫВАЕМ данные (только для владельца)
    const decryptedData = await getDecryptedPartnerData(
      user._id, 
      user._id, 
      user.role
    );

    res.status(200).json({
      result: true,
      message: "Персональные данные получены",
      data: decryptedData
    });

  } catch (error) {
    console.error('Get partner personal data error:', error);
    
    if (error.message.includes('Нет прав')) {
      return res.status(403).json({
        result: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка получения персональных данных"
    });
  }
};

/**
 * ✅ Получение статуса заявки (старый метод для совместимости)
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
 * 🔐 БЕЗОПАСНАЯ ПОДАЧА ЮРИДИЧЕСКИХ ДАННЫХ (данные с изображения 2)
 * Автоматическое шифрование всех чувствительных данных
 */
export const submitPartnerLegalInfo = async (req, res) => {
  try {
    const { request_id } = req.params;
    const {
      // Данные с изображения 2
      legal_name, // Название юридического лица
      siret_number, // SIRET номер (14 цифр)
      legal_form, // SASU, SARL, etc.
      business_address, // Юридический адрес
      contact_person, // Контактное лицо
      contact_phone, // Телефон для связи
      bank_details, // Банковские реквизиты
      tax_number, // Налоговый номер
      additional_info // Дополнительная информация
    } = req.body;

    // Валидация обязательных полей
    const requiredFields = {
      legal_name,
      siret_number,
      legal_form,
      business_address,
      contact_person,
      contact_phone
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

    // Проверяем что заявка существует и одобрена
    const request = await InitialPartnerRequest.findById(request_id);
    
    if (!request) {
      return res.status(404).json({
        result: false,
        message: "Заявка не найдена"
      });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({
        result: false,
        message: "Сначала дождитесь одобрения первичной заявки"
      });
    }

    // Проверяем что юридические данные еще не поданы
    const existingLegalInfo = await PartnerLegalInfo.findOne({ 
      partner_request_id: request_id 
    });

    if (existingLegalInfo) {
      return res.status(400).json({
        result: false,
        message: "Юридические данные уже поданы для этой заявки"
      });
    }

    // 🔐 ШИФРУЕМ ВСЕ ЮРИДИЧЕСКИЕ ДАННЫЕ
    const encryptedLegalData = encryptLegalData({
      legal_name,
      siret_number,
      legal_form,
      business_address,
      contact_person,
      contact_phone,
      bank_details,
      tax_number,
      additional_info
    });

    // Создаем юридическую информацию
    const legalInfo = new PartnerLegalInfo({
      user_id: request.user_id,
      partner_request_id: request_id,
      
      // 🔐 СОХРАНЯЕМ ЗАШИФРОВАННЫЕ ДАННЫЕ
      legal_data: encryptedLegalData,
      
      verification_status: 'pending',
      submitted_at: new Date()
    });

    await legalInfo.save();

    // Обновляем статус заявки
    request.status = 'under_review';
    await request.save();

    res.status(201).json({
      result: true,
      message: "Юридические данные успешно поданы и зашифрованы. Ожидайте проверки документов.",
      legal_info_id: legalInfo._id,
      request_status: request.status,
      next_step: "Администратор проверит документы и одобрит создание полного профиля партнера",
      security_note: "Все данные зашифрованы и защищены" // 🔐 УВЕДОМЛЯЕМ О БЕЗОПАСНОСТИ
    });

  } catch (error) {
    console.error('Error in submitPartnerLegalInfo:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        result: false, 
        message: "Данная информация уже используется в системе"
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка при предоставлении юридических данных"
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
 * 🔓 БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ПРОФИЛЯ ПАРТНЕРА (работает только после полного одобрения)
 * Расшифровывает данные только для владельца/админа
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

    // Импортируем функцию для получения партнера
    const { getPartnerById } = await import('../services/partner.service.js');
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
      partner: partnerData.profile // 🔓 Уже расшифрован в partner.service.js
    });

  } catch (error) {
    console.error('Get partner profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения профиля"
    });
  }
};

// ================ ЭКСПОРТ ================
export default {
  // ✅ ОСНОВНЫЕ ФУНКЦИИ ПАРТНЕРОВ (пошагово)
  
  // 1️⃣ РЕГИСТРАЦИЯ И АВТОРИЗАЦИЯ
  registerPartner, // 🔐 Создает User + зашифрованный InitialPartnerRequest 
  loginPartnerUser, // Авторизация партнера
  
  // 2️⃣ ЛИЧНЫЙ КАБИНЕТ (БЕЗОПАСНЫЙ)
  getDashboardStatus, // ✅ Статус кабинета (только открытые данные)
  getPartnerPersonalData, // 🔓 Персональные данные (только для владельца)
  getRequestStatus, // Старый метод (для совместимости)
  checkFeatureAccess, // Проверка доступа к функциям
  
  // 3️⃣ ЭТАПЫ РЕГИСТРАЦИИ
  submitPartnerLegalInfo, // 🔐 Юридические данные (автошифрование)
  getPartnerProfileData, // 🔓 Профиль (после полного одобрения)
  
  // 4️⃣ УСТАРЕВШИЕ
  createInitialPartnerRequest // DEPRECATED
  
  // 🔄 АДМИНСКИЕ МЕТОДЫ ДОБАВИМ ПОЗЖЕ
};