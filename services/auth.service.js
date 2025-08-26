// services/auth.service.js (ИСПРАВЛЕНО - НЕ трогаем модель User)
import { User, CustomerProfile } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import generatePassword from '../utils/generatePassword.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';

/**
 * Создание аккаунта клиента (ИСПРАВЛЕНО - оставляем User модель как есть)
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
    const normalizedEmail = email.toLowerCase().trim();
    
    // 🔐 ПРОВЕРЯЕМ существование через Meta (по хешу)
    const hashedEmail = hashMeta(normalizedEmail);
    const existingMeta = await Meta.findByEmailAndRole(hashedEmail, 'customer');

    if (existingMeta) {
      return { 
        isNewCustomer: false, 
        customer: existingMeta.customer 
      };
    }

    // Генерируем пароль если не предоставлен
    if (!password) {
      password = generatePassword();
    }

    // Хешируем пароль
    const hashedPassword = await hashString(password);

    // ✅ СОЗДАЕМ пользователя с ЗАШИФРОВАННЫМ email (как в партнерской системе)
    const newUser = new User({
      email: cryptoString(normalizedEmail), // 🔐 ЗАШИФРОВАННЫЙ EMAIL как у партнеров!
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
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone ? cryptoString(phone.replace(/\s/g, '')) : null, // Шифруем телефон
      is_active: true
    });

    await customerProfile.save();

    // 🔐 Создаем Meta запись с ХЕШИРОВАННЫМ email для поиска
    const metaInfo = new Meta({
      em: hashedEmail, // 🔐 ХЕШИРОВАННЫЙ EMAIL для безопасного поиска!
      role: 'customer',
      customer: newUser._id,
      is_active: true
    });

    await metaInfo.save();

    console.log('✅ Customer account created with Meta security');

    // Возвращаем данные для ответа
    return {
      isNewCustomer: true,
      customer: {
        _id: newUser._id,
        email: normalizedEmail, // Обычный email для ответа
        role: newUser.role,
        is_email_verified: newUser.is_email_verified,
        is_active: newUser.is_active,
        profile: {
          first_name: customerProfile.first_name,
          last_name: customerProfile.last_name,
          full_name: `${customerProfile.first_name} ${customerProfile.last_name}`,
          phone: phone ? phone : null // Обычный телефон для ответа
        }
      }
    };

  } catch (error) {
    console.error('Create customer account error:', error);
    throw error;
  }
};

/**
 * Авторизация клиента (ИСПРАВЛЕНО - поиск через Meta)
 * @param {object} loginData - Данные для входа
 * @returns {object} - Результат авторизации
 */
export const loginCustomer = async (loginData) => {
  try {
    const { email, password } = loginData;

    if (!email || !password) {
      throw new Error('Email и пароль обязательны');
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // 🔐 ИЩЕМ через Meta по хешу email
    const hashedEmail = hashMeta(normalizedEmail);
    const metaInfo = await Meta.findByEmailAndRoleWithUser(hashedEmail, 'customer');

    if (!metaInfo || !metaInfo.customer) {
      const error = new Error('Пользователь не найден');
      error.statusCode = 404;
      throw error;
    }

    // Проверяем блокировку аккаунта
    if (metaInfo.isAccountLocked && metaInfo.isAccountLocked()) {
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

    // Генерируем токен БЕЗ EMAIL (как в партнерской системе)
    const token = generateCustomerToken({
      user_id: metaInfo.customer._id,
      _id: metaInfo.customer._id,
      role: metaInfo.customer.role,
      // 🔐 НЕ включаем email в токен для безопасности (как у партнеров)
      is_admin: false
    }, '30d');

    return { 
      token,
      user: {
        id: metaInfo.customer._id,
        email: normalizedEmail, // ✅ Возвращаем обычный email для пользователя
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
 * Проверка существования пользователя по email (ИСПРАВЛЕНО)
 * @param {string} email - Email для проверки
 * @returns {boolean} - Существует ли пользователь
 */
export const checkUserExists = async (email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const hashedEmail = hashMeta(normalizedEmail);
    const metaInfo = await Meta.findByEmailAndRole(hashedEmail, 'customer');
    
    return !!metaInfo;
  } catch (error) {
    console.error('Check user exists error:', error);
    return false;
  }
};

/**
 * Получение пользователя по ID (для middleware) - БЕЗ ИЗМЕНЕНИЙ
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
      const { PartnerProfile } = await import('../models/index.js');
      profile = await PartnerProfile.findOne({ user_id: userId });
    }

    return {
      ...user.toObject(),
      profile
    };
  } catch (error) {
    console.error('Get user by ID error:', error);
    return null;
  }
};