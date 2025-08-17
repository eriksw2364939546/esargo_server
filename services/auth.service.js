// services/auth.service.js (исправленный)
import { User, CustomerProfile } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import generatePassword from '../utils/generatePassword.js';
import { cryptoString } from '../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';

/**
 * Создание аккаунта клиента
 * @param {object} customerData - Данные клиента
 * @returns {object} - Результат создания аккаунта
 */
export const createCustomerAccount = async (customerData) => {
  try {
    let { first_name, last_name, email, phone, password } = customerData;

    // Проверка обязательных полей
    if (!first_name || !last_name || !email || !phone) {
      throw new Error('Отсутствуют обязательные поля');
    }

    // Нормализация email
    email = email.toLowerCase().trim();

    // 🆕 ИСПРАВЛЕНО: Используем новый метод поиска
    const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'customer');

    if (metaInfo) {
      return { 
        isNewCustomer: false, 
        customer: metaInfo.customer 
      };
    }

    // Генерируем пароль если не предоставлен
    if (!password) {
      password = generatePassword();
    }

    // Хешируем пароль
    const hashedPassword = await hashString(password);

    // Создаем пользователя
    const newUser = new User({
      email: email,
      password_hash: hashedPassword,
      role: 'customer',
      is_active: true,
      is_email_verified: false,
      gdpr_consent: {
        data_processing: true,
        marketing: false,
        analytics: false,
        consent_date: new Date()
      },
      registration_source: 'web'
    });

    await newUser.save();

    // Создаем профиль клиента
    const customerProfile = new CustomerProfile({
      user_id: newUser._id,
      first_name,
      last_name,
      phone: cryptoString(phone), // Шифруем телефон
      settings: {
        notifications_enabled: true,
        preferred_language: 'fr',
        marketing_emails: false
      }
    });

    await customerProfile.save();

    // 🆕 ИСПРАВЛЕНО: Используем новый метод создания Meta
    const newMetaInfo = await Meta.createForCustomer(newUser._id, hashMeta(email));

    // Возвращаем пользователя с профилем
    const userWithProfile = {
      ...newUser.toObject(),
      profile: customerProfile
    };

    return { 
      isNewCustomer: true, 
      customer: userWithProfile,
      generatedPassword: password // Только если пароль был сгенерирован
    };

  } catch (error) {
    console.error('Create customer account error:', error);
    throw error;
  }
};

/**
 * Авторизация клиента
 * @param {object} loginData - Данные для входа
 * @returns {object} - Результат авторизации
 */
export const loginCustomer = async ({ email, password }) => {
  try {
    // Валидация входных данных
    if (!email || !password) {
      const error = new Error('Email и пароль обязательны');
      error.statusCode = 400;
      throw error;
    }

    // Нормализация email
    email = email.toLowerCase().trim();

    // 🆕 ИСПРАВЛЕНО: Используем новый метод поиска
    const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'customer');

    if (!metaInfo || !metaInfo.customer) {
      const error = new Error('Пользователь не найден');
      error.statusCode = 404;
      throw error;
    }

    // Проверяем, заблокирован ли аккаунт
    if (metaInfo.isAccountLocked()) {
      const error = new Error('Аккаунт временно заблокирован из-за множественных неудачных попыток входа');
      error.statusCode = 423;
      throw error;
    }

    // Проверяем активность пользователя
    if (!metaInfo.customer.is_active) {
      const error = new Error('Аккаунт деактивирован');
      error.statusCode = 403;
      throw error;
    }

    // Проверяем пароль
    const isPasswordValid = await comparePassword(password, metaInfo.customer.password_hash);
    
    if (!isPasswordValid) {
      // Увеличиваем счетчик неудачных попыток
      await metaInfo.incrementFailedAttempts();
      
      const error = new Error('Неверный пароль');
      error.statusCode = 401;
      throw error;
    }

    // Сбрасываем счетчик неудачных попыток при успешном входе
    await metaInfo.resetFailedAttempts();

    // Получаем профиль клиента
    const customerProfile = await CustomerProfile.findOne({ 
      user_id: metaInfo.customer._id 
    });

    // 🆕 ИСПРАВЛЕНО: Генерируем токен с правильными данными
    const token = generateCustomerToken({
      user_id: metaInfo.customer._id,
      _id: metaInfo.customer._id,
      email: metaInfo.customer.email,
      role: metaInfo.customer.role,
      is_admin: false
    }, '30d');

    return { 
      token,
      user: {
        id: metaInfo.customer._id,
        email: metaInfo.customer.email,
        role: metaInfo.customer.role,
        is_email_verified: metaInfo.customer.is_email_verified,
        profile: customerProfile
      }
    };

  } catch (error) {
    console.error('Login customer error:', error);
    throw error;
  }
};

/**
 * Проверка существования пользователя по email
 * @param {string} email - Email для проверки
 * @returns {boolean} - Существует ли пользователь
 */
export const checkUserExists = async (email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const metaInfo = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), 'customer');
    
    return !!metaInfo;
  } catch (error) {
    console.error('Check user exists error:', error);
    return false;
  }
};

/**
 * Получение пользователя по ID (для middleware)
 * @param {string} userId - ID пользователя
 * @returns {object} - Пользователь с профилем
 */
export const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password_hash');
    if (!user) return null;

    let profile = null;
    if (user.role === 'customer') {
      profile = await CustomerProfile.findOne({ user_id: userId });
    } else if (user.role === 'partner') {
      // 🆕 ДОБАВЛЕНО: Поддержка партнеров
      const { PartnerProfile } = await import('../models/index.js');
      profile = await PartnerProfile.findOne({ user_id: userId });
    }
    // 🆕 ДОБАВЛЕНО: Поддержка других ролей можно добавить позже
    // else if (user.role === 'courier') {
    //   profile = await CourierProfile.findOne({ user_id: userId });
    // }

    return {
      ...user.toObject(),
      profile
    };
  } catch (error) {
    console.error('Get user by ID error:', error);
    return null;
  }
};