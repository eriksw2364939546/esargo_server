// services/Courier/courier.service.js - ПОЛНЫЙ ФАЙЛ с шифрованием данных
import { User, CourierApplication, CourierProfile, Meta } from '../../models/index.js';
import Product from '../../models/Product.model.js';
import { cryptoString, decryptString } from '../../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../../utils/hash.js';
import generatePassword from '../../utils/generatePassword.js';


/**
 * ЭТАП 1: СОЗДАНИЕ ЗАЯВКИ КУРЬЕРА С ШИФРОВАНИЕМ
 * Регистрация курьера с подачей документов (как у партнеров)
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

    // 🔐 ПРОВЕРЯЕМ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ ЧЕРЕЗ META (как у партнеров)
    const hashedEmail = hashMeta(normalizedEmail);
    const existingMeta = await Meta.findOne({ 
      em: hashedEmail,
      role: 'courier' 
    });

    if (existingMeta) {
      throw new Error('Пользователь с таким email уже зарегистрирован');
    }

    // Проверяем существующие заявки курьеров через search_data (открытые поля)
    const existingApplication = await CourierApplication.findOne({
      $or: [
        { 
          'search_data.first_name': first_name.trim(),
          'search_data.last_name': last_name.trim(),
          'search_data.city': city.trim()
        }
      ],
      status: { $in: ['pending', 'approved'] }
    });

    if (existingApplication) {
      throw new Error('Заявка курьера с похожими данными уже подана');
    }

    // ================ СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ ================

    // Генерируем пароль если не указан
    const finalPassword = password || generatePassword();
    const hashedPassword = await hashString(finalPassword);

    // 🔐 СОЗДАЕМ USER С ЗАШИФРОВАННЫМ EMAIL (как у партнеров)
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

    // 🔧 ИСПРАВЛЕНО: Создаем Meta для поиска (правильная структура)
    const metaInfo = new Meta({
      em: hashedEmail,           // 🔐 Хешированный email для поиска
      role: 'courier',          // ✅ ИСПРАВЛЕНО: правильное поле role
      courier: newUser._id,     // ✅ ИСПРАВЛЕНО: специфичное поле для курьера
      is_active: true          // ✅ ДОБАВЛЕНО: активность записи
    });

    await metaInfo.save();

    // ================ СОЗДАНИЕ ЗАЯВКИ КУРЬЕРА С ШИФРОВАНИЕМ ================

    const courierApplication = new CourierApplication({
      user_id: newUser._id,
      
      // 🔐 ЛИЧНЫЕ ДАННЫЕ - ЗАШИФРОВАНЫ (как у партнеров)
      personal_data: {
        first_name: cryptoString(first_name.trim()),      // 🔐 ЗАШИФРОВАНО
        last_name: cryptoString(last_name.trim()),        // 🔐 ЗАШИФРОВАНО
        email: cryptoString(normalizedEmail),             // 🔐 ЗАШИФРОВАНО
        phone: cryptoString(cleanPhone),                  // 🔐 ЗАШИФРОВАНО
        date_of_birth: new Date(date_of_birth),           // ✅ Дата может быть открыта
        address: {
          street: cryptoString(street.trim()),            // 🔐 ЗАШИФРОВАНО
          city: cryptoString(city.trim()),                // 🔐 ЗАШИФРОВАНО
          postal_code: cryptoString(postal_code.trim()),  // 🔐 ЗАШИФРОВАНО
          country: 'France'                               // ✅ Открыто
        }
      },

      // ✅ ПОИСКОВЫЕ ПОЛЯ - ОТКРЫТО (только имя и фамилия для админа)
      search_data: {
        first_name: first_name.trim(),                    // ✅ ОТКРЫТО для поиска
        last_name: last_name.trim(),                      // ✅ ОТКРЫТО для поиска
        city: city.trim()                                 // ✅ ОТКРЫТО для поиска
      },

      // Информация о транспорте
      vehicle_info: {
        vehicle_type,
        vehicle_brand: vehicle_brand?.trim(),
        vehicle_model: vehicle_model?.trim(),
        license_plate: license_plate ? 
          cryptoString(license_plate.trim().toUpperCase()) : undefined,  // 🔐 ЗАШИФРОВАНО
        insurance_company: insurance_company?.trim(),
        insurance_policy_number: insurance_policy_number ? 
          cryptoString(insurance_policy_number.trim()) : undefined       // 🔐 ЗАШИФРОВАНО
      },

      // 🔐 ДОКУМЕНТЫ - URLs зашифрованы (могут содержать персональную информацию)
      documents: {
        id_card_url: cryptoString(id_card_url),           // 🔐 ЗАШИФРОВАНО
        driver_license_url: ['motorbike', 'car'].includes(vehicle_type) ? 
          cryptoString(driver_license_url) : undefined,   // 🔐 ЗАШИФРОВАНО
        insurance_url: ['motorbike', 'car'].includes(vehicle_type) ? 
          cryptoString(insurance_url) : undefined,        // 🔐 ЗАШИФРОВАНО
        vehicle_registration_url: vehicle_type === 'car' ? 
          cryptoString(vehicle_registration_url) : undefined,  // 🔐 ЗАШИФРОВАНО
        bank_rib_url: cryptoString(bank_rib_url)          // 🔐 ЗАШИФРОВАНО
      },

      // Согласия (могут быть открыты)
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

    // Проверяем дубликаты (обновленная логика)
    await courierApplication.checkForDuplicates();

    console.log('✅ COURIER APPLICATION CREATED WITH ENCRYPTION:', {
      application_id: courierApplication._id,
      user_id: newUser._id,
      email: normalizedEmail,
      status: 'pending',
      encrypted: true
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
 * АВТОРИЗАЦИЯ КУРЬЕРА (обновленная с правильными полями Meta)
 */
const loginCourier = async ({ email, password }) => {
  try {
    if (!email || !password) {
      throw new Error('Email и пароль обязательны');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedEmail = hashMeta(normalizedEmail);

    // 🔧 ИСПРАВЛЕНО: Поиск через Meta с правильными полями
    const metaRecord = await Meta.findOne({ 
      em: hashedEmail, 
      role: 'courier' 
    }).populate('courier'); // Получаем связанного пользователя

    if (!metaRecord || !metaRecord.courier) {
      throw new Error('Курьер с таким email не найден');
    }

    // 🔧 ИСПРАВЛЕНО: Используем правильное поле courier вместо ui
    const user = metaRecord.courier;
    if (!user || !user.is_active) {
      throw new Error('Аккаунт курьера неактивен');
    }

    // Проверяем блокировку аккаунта
    if (user.isAccountLocked && user.isAccountLocked()) {
      throw new Error('Аккаунт временно заблокирован из-за превышения попыток входа');
    }

    // Проверяем пароль
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      if (user.incrementLoginAttempts) {
        await user.incrementLoginAttempts();
      }
      throw new Error('Неверный пароль');
    }

    // Успешный вход
    if (user.resetLoginAttempts) {
      await user.resetLoginAttempts();
    }

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
 * ПОЛУЧЕНИЕ СТАТУСА ЗАЯВКИ КУРЬЕРА (обновленная)
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
 * ПОЛУЧЕНИЕ ПРОФИЛЯ КУРЬЕРА (без изменений)
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
};