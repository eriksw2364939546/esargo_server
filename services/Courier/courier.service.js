// services/courier.service.js
import { User, CourierApplication, CourierProfile, Meta } from '../models/index.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import generatePassword from '../utils/generatePassword.js';
import mongoose from 'mongoose';

/**
 * ЭТАП 1: СОЗДАНИЕ ЗАЯВКИ КУРЬЕРА
 * Регистрация курьера с подачей документов
 */
const createCourierApplication = async (applicationData) => {
  try {
    const {
      // Личные данные
      first_name, last_name, email, phone, password, date_of_birth,
      street, city, postal_code,
      // Транспорт
      vehicle_type, vehicle_brand, vehicle_model, license_plate,
      insurance_company, insurance_policy_number,
      // Документы URLs
      id_card_url, driver_license_url, insurance_url, 
      vehicle_registration_url, bank_rib_url,
      // Согласия
      terms_accepted, privacy_policy_accepted, 
      data_processing_accepted, background_check_accepted,
      // Дополнительно
      referral_code, source = 'web'
    } = applicationData;

    // ================ ВАЛИДАЦИЯ ================

    // Обязательные поля
    const requiredFields = {
      first_name, last_name, email, phone, date_of_birth,
      street, city, postal_code, vehicle_type,
      id_card_url, bank_rib_url,
      terms_accepted, privacy_policy_accepted, 
      data_processing_accepted, background_check_accepted
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
    }

    // Проверка согласий
    if (!terms_accepted || !privacy_policy_accepted || !data_processing_accepted || !background_check_accepted) {
      throw new Error('Необходимо принять все соглашения');
    }

    // Валидация транспорта и документов
    if (['motorbike', 'car'].includes(vehicle_type)) {
      if (!driver_license_url || !insurance_url) {
        throw new Error('Для мотоцикла/авто требуются права и страховка');
      }
      if (vehicle_type === 'car' && !vehicle_registration_url) {
        throw new Error('Для автомобиля требуется регистрация ТС');
      }
    }

    // ================ ПРОВЕРКА ДУБЛИКАТОВ ================

    const normalizedEmail = email.toLowerCase().trim();
    const cleanPhone = phone.replace(/\s/g, '');

    // Проверяем существующих пользователей через Meta
    const hashedEmail = hashMeta(normalizedEmail);
    const existingMeta = await Meta.findOne({ em: hashedEmail });

    if (existingMeta) {
      throw new Error('Пользователь с таким email уже зарегистрирован');
    }

    // Проверяем существующие заявки курьеров
    const existingApplication = await CourierApplication.findOne({
      $or: [
        { 'personal_data.phone': cleanPhone },
        { 'personal_data.email': normalizedEmail }
      ],
      status: { $in: ['pending', 'approved'] }
    });

    if (existingApplication) {
      throw new Error('Заявка курьера с такими данными уже подана');
    }

    // ================ СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ ================

    // Генерируем пароль если не указан
    const finalPassword = password || generatePassword();
    const hashedPassword = await hashString(finalPassword);

    // Создаем User (с зашифрованным email как у партнеров)
    const newUser = new User({
      email: cryptoString(normalizedEmail), // 🔐 Зашифрованный email
      password_hash: hashedPassword,
      role: 'courier',
      is_active: true,
      is_email_verified: false,
      gdpr_consent: {
        data_processing: data_processing_accepted,
        marketing: false,
        analytics: false,
        consent_date: new Date()
      },
      registration_source: source || 'web'
    });

    await newUser.save();

    // Создаем Meta для поиска
    const metaInfo = new Meta({
      em: hashedEmail, // 🔐 Хешированный email для поиска
      ui: newUser._id,
      ro: 'courier'
    });

    await metaInfo.save();

    // ================ СОЗДАНИЕ ЗАЯВКИ КУРЬЕРА ================

    const courierApplication = new CourierApplication({
      user_id: newUser._id,
      
      // Личные данные
      personal_data: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: normalizedEmail, // В заявке храним открыто для админа
        phone: cleanPhone,
        date_of_birth: new Date(date_of_birth),
        address: {
          street: street.trim(),
          city: city.trim(),
          postal_code: postal_code.trim(),
          country: 'France'
        }
      },

      // Информация о транспорте
      vehicle_info: {
        vehicle_type,
        vehicle_brand: vehicle_brand?.trim(),
        vehicle_model: vehicle_model?.trim(),
        license_plate: license_plate?.trim()?.toUpperCase(),
        insurance_company: insurance_company?.trim(),
        insurance_policy_number: insurance_policy_number?.trim()
      },

      // Документы
      documents: {
        id_card_url, // Всегда обязательно
        driver_license_url: ['motorbike', 'car'].includes(vehicle_type) ? driver_license_url : undefined,
        insurance_url: ['motorbike', 'car'].includes(vehicle_type) ? insurance_url : undefined,
        vehicle_registration_url: vehicle_type === 'car' ? vehicle_registration_url : undefined,
        bank_rib_url // Обязательно для выплат
      },

      // Согласия
      consents: {
        terms_accepted,
        privacy_policy_accepted,
        data_processing_accepted,
        background_check_accepted
      },

      // Статус и процесс рассмотрения
      status: 'pending',
      submitted_at: new Date(),
      review_info: {
        review_stage: 'documents',
        priority_level: 'normal'
      },

      // Дополнительные данные
      source,
      referral_code: referral_code?.trim(),
      ip_address: applicationData.ip_address,
      user_agent: applicationData.user_agent
    });

    await courierApplication.save();

    // Проверяем дубликаты
    await courierApplication.checkForDuplicates();

    console.log('✅ COURIER APPLICATION CREATED:', {
      application_id: courierApplication._id,
      user_id: newUser._id,
      email: normalizedEmail,
      status: 'pending'
    });

    return {
      success: true,
      user: {
        id: newUser._id,
        email: normalizedEmail,
        role: 'courier',
        is_active: true
      },
      application: {
        id: courierApplication._id,
        status: courierApplication.status,
        submitted_at: courierApplication.submitted_at,
        vehicle_type: courierApplication.vehicle_info.vehicle_type
      },
      credentials: {
        email: normalizedEmail,
        password: finalPassword // Возвращаем пароль только при создании
      }
    };

  } catch (error) {
    console.error('🚨 CREATE COURIER APPLICATION - Error:', error);
    throw error;
  }
};

/**
 * АВТОРИЗАЦИЯ КУРЬЕРА
 */
const loginCourier = async ({ email, password }) => {
  try {
    if (!email || !password) {
      throw new Error('Email и пароль обязательны');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedEmail = hashMeta(normalizedEmail);

    // Поиск через Meta
    const metaRecord = await Meta.findByEmailAndRole(hashedEmail, 'courier');
    if (!metaRecord) {
      throw new Error('Курьер с таким email не найден');
    }

    // Получаем пользователя
    const user = await User.findById(metaRecord.ui);
    if (!user || !user.is_active) {
      throw new Error('Аккаунт курьера неактивен');
    }

    // Проверяем блокировку аккаунта
    if (user.isAccountLocked()) {
      throw new Error('Аккаунт временно заблокирован из-за превышения попыток входа');
    }

    // Проверяем пароль
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new Error('Неверный пароль');
    }

    // Успешный вход
    await user.resetLoginAttempts();

    // Получаем профиль курьера (если есть)
    const courierProfile = await CourierProfile.findOne({ user_id: user._id });

    return {
      success: true,
      user: {
        id: user._id,
        email: normalizedEmail,
        role: user.role,
        is_active: user.is_active,
        last_login_at: user.last_login_at
      },
      courier: courierProfile ? {
        id: courierProfile._id,
        first_name: courierProfile.first_name,
        last_name: courierProfile.last_name,
        is_approved: courierProfile.is_approved,
        is_available: courierProfile.is_available,
        application_status: courierProfile.application_status
      } : null
    };

  } catch (error) {
    console.error('🚨 LOGIN COURIER - Error:', error);
    throw error;
  }
};

/**
 * ПОЛУЧЕНИЕ СТАТУСА ЗАЯВКИ КУРЬЕРА
 */
const getCourierApplicationStatus = async (userId) => {
  try {
    const application = await CourierApplication.findOne({ user_id: userId });
    
    if (!application) {
      return {
        has_application: false,
        status: null
      };
    }

    return {
      has_application: true,
      application: {
        id: application._id,
        status: application.status,
        submitted_at: application.submitted_at,
        vehicle_type: application.vehicle_info.vehicle_type,
        verification_status: application.verification.overall_verification_status,
        review_notes: application.review_info.admin_notes
      }
    };

  } catch (error) {
    console.error('🚨 GET APPLICATION STATUS - Error:', error);
    throw error;
  }
};

/**
 * ПОЛУЧЕНИЕ ПРОФИЛЯ КУРЬЕРА
 */
const getCourierProfile = async (userId) => {
  try {
    const courierProfile = await CourierProfile.findOne({ user_id: userId });
    
    if (!courierProfile) {
      throw new Error('Профиль курьера не найден');
    }

    return {
      success: true,
      profile: courierProfile
    };

  } catch (error) {
    console.error('🚨 GET COURIER PROFILE - Error:', error);
    throw error;
  }
};

/**
 * ОБНОВЛЕНИЕ СТАТУСА ДОСТУПНОСТИ (On-e/Off-e)
 */
const toggleCourierAvailability = async (userId) => {
  try {
    const courierProfile = await CourierProfile.findOne({ user_id: userId });
    
    if (!courierProfile) {
      throw new Error('Профиль курьера не найден');
    }

    if (!courierProfile.is_approved) {
      throw new Error('Курьер не одобрен для работы');
    }

    await courierProfile.toggleAvailability();

    return {
      success: true,
      is_available: courierProfile.is_available,
      is_online: courierProfile.is_online
    };

  } catch (error) {
    console.error('🚨 TOGGLE AVAILABILITY - Error:', error);
    throw error;
  }
};

/**
 * ОБНОВЛЕНИЕ ГЕОЛОКАЦИИ КУРЬЕРА
 */
const updateCourierLocation = async (userId, { latitude, longitude }) => {
  try {
    const courierProfile = await CourierProfile.findOne({ user_id: userId });
    
    if (!courierProfile) {
      throw new Error('Профиль курьера не найден');
    }

    await courierProfile.updateLocation(latitude, longitude);

    return {
      success: true,
      location: courierProfile.location
    };

  } catch (error) {
    console.error('🚨 UPDATE LOCATION - Error:', error);
    throw error;
  }
};

export {
       createCourierApplication,
       loginCourier,
       getCourierApplicationStatus,
       getCourierProfile,
       toggleCourierAvailability,
       updateCourierLocation
      }