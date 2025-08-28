// middleware/courierAuth.middleware.js - ИСПРАВЛЕНО
import { verifyJWTToken } from '../services/token.service.js'; 
import { User, CourierProfile, CourierApplication } from '../models/index.js';
import { decryptString } from '../utils/crypto.js';

/**
 * БАЗОВАЯ ПРОВЕРКА ТОКЕНА КУРЬЕРА
 * Проверяет токен и загружает данные пользователя
 */
const checkCourierToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        result: false,
        message: "Токен авторизации отсутствует"
      });
    }

    // Верификация токена
    const decoded = verifyJWTToken(token); // 🔧 ИСПОЛЬЗУЕМ verifyJWTToken

    if (!decoded || decoded.role !== 'courier') {
      return res.status(401).json({
        result: false,
        message: "Недействительный токен курьера"
      });
    }

    // Получаем пользователя
    const user = await User.findById(decoded.user_id);

    if (!user || !user.is_active || user.role !== 'courier') {
      return res.status(401).json({
        result: false,
        message: "Пользователь-курьер не найден или неактивен"
      });
    }

    // Расшифровываем email для удобства
    try {
      user.email = decryptString(user.email);
    } catch (error) {
      console.warn('Не удалось расшифровать email курьера:', error);
    }

    // Добавляем пользователя в req
    req.user = user;
    next();

  } catch (error) {
    console.error('COURIER TOKEN CHECK - Error:', error);
    res.status(401).json({
      result: false,
      message: "Ошибка проверки токена"
    });
  }
};

/**
 * ПРОВЕРКА СТАТУСА ЗАЯВКИ КУРЬЕРА
 * Проверяет что курьер имеет определенный статус заявки
 */
const checkCourierApplicationStatus = (allowedStatuses = []) => {
  return async (req, res, next) => {
    try {
      const { user } = req;

      const application = await CourierApplication.findOne({ user_id: user._id });

      if (!application) {
        return res.status(404).json({
          result: false,
          message: "Заявка курьера не найдена"
        });
      }

      if (!allowedStatuses.includes(application.status)) {
        return res.status(403).json({
          result: false,
          message: `Действие недоступно для статуса заявки: ${application.status}`,
          required_statuses: allowedStatuses,
          current_status: application.status
        });
      }

      req.courierApplication = application;
      next();

    } catch (error) {
      console.error('COURIER STATUS CHECK - Error:', error);
      res.status(500).json({
        result: false,
        message: "Ошибка проверки статуса заявки"
      });
    }
  };
};

/**
 * ПРОВЕРКА ОДОБРЕННОГО КУРЬЕРА
 * Проверяет что у курьера есть одобренный профиль
 */
const requireApprovedCourier = async (req, res, next) => {
  try {
    const { user } = req;

    const courierProfile = await CourierProfile.findOne({ user_id: user._id });

    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    if (!courierProfile.is_approved) {
      return res.status(403).json({
        result: false,
        message: "Курьер не одобрен для работы",
        application_status: courierProfile.application_status
      });
    }

    if (courierProfile.is_blocked) {
      return res.status(403).json({
        result: false,
        message: "Курьер заблокирован",
        blocked_reason: courierProfile.blocked_reason,
        blocked_until: courierProfile.blocked_until
      });
    }

    req.courierProfile = courierProfile;
    next();

  } catch (error) {
    console.error('APPROVED COURIER CHECK - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка проверки статуса курьера"
    });
  }
};

/**
 * ВАЛИДАЦИЯ ДАННЫХ РЕГИСТРАЦИИ КУРЬЕРА
 * Проверяет корректность данных при регистрации
 */
const validateCourierRegistration = (req, res, next) => {
  try {
    const {
      first_name, last_name, email, phone, date_of_birth,
      street, city, postal_code, vehicle_type,
      id_card_url, bank_rib_url,
      terms_accepted, privacy_policy_accepted,
      data_processing_accepted, background_check_accepted
    } = req.body;

    // Валидация обязательных полей
    const missingFields = [];
    const required = {
      first_name, last_name, email, phone, date_of_birth,
      street, city, postal_code, vehicle_type,
      id_card_url, bank_rib_url
    };

    Object.entries(required).forEach(([key, value]) => {
      if (!value || (typeof value === 'string' && !value.trim())) {
        missingFields.push(key);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: "Отсутствуют обязательные поля",
        missing_fields: missingFields
      });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        result: false,
        message: "Некорректный формат email"
      });
    }

    // Валидация французского телефона
    const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
    const cleanPhone = phone.replace(/\s/g, '');
    if (!frenchPhoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        result: false,
        message: "Телефон должен быть французским",
        example: "+33 1 42 34 56 78 или 01 42 34 56 78"
      });
    }

    // Валидация возраста
    const birthDate = new Date(date_of_birth);
    const age = (Date.now() - birthDate) / (1000 * 60 * 60 * 24 * 365);
    if (age < 18 || age > 70) {
      return res.status(400).json({
        result: false,
        message: "Возраст должен быть от 18 до 70 лет"
      });
    }

    // Валидация французского почтового индекса
    if (!/^\d{5}$/.test(postal_code)) {
      return res.status(400).json({
        result: false,
        message: "Почтовый индекс должен содержать 5 цифр"
      });
    }

    // Валидация типа транспорта
    if (!['bike', 'motorbike', 'car'].includes(vehicle_type)) {
      return res.status(400).json({
        result: false,
        message: "Некорректный тип транспорта",
        allowed_values: ['bike', 'motorbike', 'car']
      });
    }

    // Валидация документов для мотоцикла/авто
    if (['motorbike', 'car'].includes(vehicle_type)) {
      if (!req.body.driver_license_url || !req.body.insurance_url) {
        return res.status(400).json({
          result: false,
          message: "Для мотоцикла/авто требуются водительские права и страховка"
        });
      }
    }

    if (vehicle_type === 'car' && !req.body.vehicle_registration_url) {
      return res.status(400).json({
        result: false,
        message: "Для автомобиля требуется регистрация ТС"
      });
    }

    // Валидация согласий
    const consents = {
      terms_accepted,
      privacy_policy_accepted,
      data_processing_accepted,
      background_check_accepted
    };

    const notAccepted = Object.entries(consents)
      .filter(([key, value]) => value !== true)
      .map(([key]) => key);

    if (notAccepted.length > 0) {
      return res.status(400).json({
        result: false,
        message: "Необходимо принять все соглашения",
        not_accepted: notAccepted
      });
    }

    next();

  } catch (error) {
    console.error('VALIDATE COURIER REGISTRATION - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка валидации данных регистрации"
    });
  }
};

/**
 * ПРОВЕРКА ДОСТУПА К ПРОФИЛЮ КУРЬЕРА
 * Позволяет курьеру редактировать только свой профиль
 */
const checkCourierProfileAccess = async (req, res, next) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Если передан ID, проверяем что это профиль текущего курьера
    if (id) {
      const courierProfile = await CourierProfile.findById(id);

      if (!courierProfile) {
        return res.status(404).json({
          result: false,
          message: "Профиль курьера не найден"
        });
      }

      if (courierProfile.user_id.toString() !== user._id.toString()) {
        return res.status(403).json({
          result: false,
          message: "Нет доступа к данному профилю"
        });
      }

      req.courierProfile = courierProfile;
    }

    next();

  } catch (error) {
    console.error('COURIER PROFILE ACCESS CHECK - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка проверки доступа к профилю"
    });
  }
};

export { 
  checkCourierToken,
  checkCourierApplicationStatus,
  requireApprovedCourier,
  validateCourierRegistration,
  checkCourierProfileAccess 
};