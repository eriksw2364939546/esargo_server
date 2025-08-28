// controllers/CourierController.js
import {
  createCourierApplication,
  loginCourier,
  getCourierApplicationStatus,
  getCourierProfile,
  toggleCourierAvailability,
  updateCourierLocation
} from '../services/Courier/courier.service.js';
import { generateCourierToken } from '../services/token.service.js';

/**
 * ЭТАП 1: РЕГИСТРАЦИЯ КУРЬЕРА
 * POST /api/couriers/register
 */
const registerCourier = async (req, res) => {
  try {
    const applicationData = {
      ...req.body,
      // Добавляем метаданные
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent') || 'Unknown',
      source: req.body.source || 'web'
    };

    console.log('📋 REGISTER COURIER - Start:', {
      email: req.body.email,
      vehicle_type: req.body.vehicle_type,
      has_documents: {
        id_card: !!req.body.id_card_url,
        bank_rib: !!req.body.bank_rib_url,
        driver_license: !!req.body.driver_license_url
      }
    });

    // Создаем заявку через сервис
    const result = await createCourierApplication(applicationData);

    // Генерируем токен для нового курьера
    const token = generateCourierToken({
      user_id: result.user.id,
      _id: result.user.id,
      email: result.user.email,
      role: result.user.role
    }, '30d');

    res.status(201).json({
      result: true,
      message: "Заявка курьера подана успешно",
      user: result.user,
      application: result.application,
      token,
      workflow_info: {
        current_stage: "document_review",
        status: "pending",
        description: "Ваша заявка отправлена на рассмотрение. Проверка документов обычно занимает 24 часа."
      },
      next_step: {
        action: "wait_for_approval",
        expected_time: "24 часа",
        description: "Вы получите уведомление о результате рассмотрения заявки."
      }
    });

  } catch (error) {
    console.error('🚨 REGISTER COURIER - Error:', error);
    
    // Обработка специфических ошибок
    if (error.message.includes('уже зарегистрирован') || error.message.includes('уже подана')) {
      return res.status(409).json({
        result: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Отсутствуют обязательные поля')) {
      return res.status(400).json({
        result: false,
        message: error.message
      });
    }

    res.status(500).json({
      result: false,
      message: "Ошибка при регистрации курьера",
      error: error.message
    });
  }
};

/**
 * АВТОРИЗАЦИЯ КУРЬЕРА
 * POST /api/couriers/login
 */
const loginCourierController = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        result: false,
        message: "Email и пароль обязательны"
      });
    }

    console.log('🔐 LOGIN COURIER - Start:', { email });

    const result = await loginCourier({ email, password });

    // Генерируем токен
    const token = generateCourierToken({
      user_id: result.user.id,
      _id: result.user.id,
      email: result.user.email,
      role: result.user.role
    }, '7d');

    res.status(200).json({
      result: true,
      message: "Авторизация успешна",
      user: result.user,
      courier: result.courier,
      token
    });

  } catch (error) {
    console.error('🚨 LOGIN COURIER - Error:', error);
    const statusCode = error.message.includes('не найден') ? 404 : 
                      error.message.includes('заблокирован') ? 423 :
                      error.message.includes('неактивен') ? 403 : 401;

    res.status(statusCode).json({
      result: false,
      message: error.message
    });
  }
};

/**
 * ВЕРИФИКАЦИЯ ТОКЕНА КУРЬЕРА
 * GET /api/couriers/verify
 */
const verifyCourier = async (req, res) => {
  try {
    const { user } = req; // Из middleware

    res.status(200).json({
      result: true,
      message: "Токен валиден",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      }
    });

  } catch (error) {
    console.error('🚨 VERIFY COURIER - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка верификации токена"
    });
  }
};

/**
 * ПОЛУЧЕНИЕ СТАТУСА ЗАЯВКИ
 * GET /api/couriers/application-status
 */
const getApplicationStatus = async (req, res) => {
  try {
    const { user } = req;

    console.log('📋 GET APPLICATION STATUS:', { user_id: user._id });

    const statusInfo = await getCourierApplicationStatus(user._id);

    res.status(200).json({
      result: true,
      message: "Статус заявки получен",
      ...statusInfo
    });

  } catch (error) {
    console.error('🚨 GET APPLICATION STATUS - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статуса заявки",
      error: error.message
    });
  }
};

/**
 * ПОЛУЧЕНИЕ ПРОФИЛЯ КУРЬЕРА
 * GET /api/couriers/profile
 */
const getProfile = async (req, res) => {
  try {
    const { user } = req;

    const result = await getCourierProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль курьера получен",
      profile: result.profile
    });

  } catch (error) {
    console.error('🚨 GET COURIER PROFILE - Error:', error);
    const statusCode = error.message.includes('не найден') ? 404 : 500;
    
    res.status(statusCode).json({
      result: false,
      message: error.message
    });
  }
};

/**
 * ПЕРЕКЛЮЧЕНИЕ СТАТУСА ДОСТУПНОСТИ (On-e/Off-e)
 * PATCH /api/couriers/availability
 */
const toggleAvailability = async (req, res) => {
  try {
    const { user } = req;

    console.log('🔄 TOGGLE AVAILABILITY:', { user_id: user._id });

    const result = await toggleCourierAvailability(user._id);

    res.status(200).json({
      result: true,
      message: `Статус доступности ${result.is_available ? 'включен' : 'отключен'}`,
      availability: {
        is_available: result.is_available,
        is_online: result.is_online
      }
    });

  } catch (error) {
    console.error('🚨 TOGGLE AVAILABILITY - Error:', error);
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('не одобрен') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message
    });
  }
};

/**
 * ОБНОВЛЕНИЕ ГЕОЛОКАЦИИ
 * PATCH /api/couriers/location
 */
const updateLocation = async (req, res) => {
  try {
    const { user } = req;
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        result: false,
        message: "Некорректные координаты"
      });
    }

    console.log('📍 UPDATE LOCATION:', { 
      user_id: user._id, 
      lat: latitude, 
      lng: longitude 
    });

    const result = await updateCourierLocation(user._id, { latitude, longitude });

    res.status(200).json({
      result: true,
      message: "Геолокация обновлена",
      location: result.location
    });

  } catch (error) {
    console.error('🚨 UPDATE LOCATION - Error:', error);
    const statusCode = error.message.includes('не найден') ? 404 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message
    });
  }
};

/**
 * ОБНОВЛЕНИЕ ПРОФИЛЯ КУРЬЕРА
 * PUT /api/couriers/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { user } = req;
    const { first_name, last_name, phone, avatar_url, work_radius } = req.body;

    // Здесь будет логика обновления профиля
    // Пока заглушка, так как основная функциональность в toggleAvailability и updateLocation

    res.status(200).json({
      result: true,
      message: "Профиль обновлен (заглушка)",
      updates: { first_name, last_name, phone, avatar_url, work_radius }
    });

  } catch (error) {
    console.error('🚨 UPDATE PROFILE - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка обновления профиля"
    });
  }
};

/**
 * ПОЛУЧЕНИЕ СТАТИСТИКИ ЗАРАБОТКА
 * GET /api/couriers/earnings
 */
const getEarnings = async (req, res) => {
  try {
    const { user } = req;
    
    const courierProfile = await getCourierProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Статистика заработка получена",
      earnings: courierProfile.profile.earnings,
      work_stats: courierProfile.profile.work_stats,
      ratings: courierProfile.profile.ratings
    });

  } catch (error) {
    console.error('🚨 GET EARNINGS - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статистики"
    });
  }
};


export { registerCourier,
         loginCourierController,
         verifyCourier,
         getApplicationStatus,
         getProfile,
         toggleAvailability,
         updateLocation,
         updateProfile,
         getEarnings 
        }