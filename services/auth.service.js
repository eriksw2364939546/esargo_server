// services/auth.service.js - ИСПРАВЛЕННЫЙ без дублирования
import { User, CustomerProfile } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import generatePassword from '../utils/generatePassword.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';

export const createCustomerAccount = async (customerData) => {
  try {
    let { first_name, last_name, email, phone, password } = customerData;

    if (!first_name || !last_name || !email || !phone) {
      throw new Error('Отсутствуют обязательные поля');
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Проверяем существование через Meta
    const hashedEmail = hashMeta(normalizedEmail);
    const existingMeta = await Meta.findByEmailAndRole(hashedEmail, 'customer');

    if (existingMeta) {
      return { 
        isNewCustomer: false, 
        customer: existingMeta.customer 
      };
    }

    if (!password) {
      password = generatePassword();
    }

    const hashedPassword = await hashString(password);

    // Создаем пользователя с зашифрованным email
    const newUser = new User({
      email: cryptoString(normalizedEmail),
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
      phone: phone ? cryptoString(phone.replace(/\s/g, '')) : null,
      is_active: true
    });

    await customerProfile.save();

    // Создаем Meta запись
    const metaInfo = new Meta({
      em: hashedEmail,
      role: 'customer',
      customer: newUser._id,
      created_at: new Date()
    });

    await metaInfo.save();

    console.log('Customer account created:', {
      user_id: newUser._id,
      email: normalizedEmail,
      has_profile: true
    });

    return {
      isNewCustomer: true,
      customer: {
        _id: newUser._id,
        email: normalizedEmail,
        role: newUser.role,
        profile: {
          first_name: customerProfile.first_name,
          last_name: customerProfile.last_name,
          full_name: customerProfile.full_name,
          phone: phone,
          avatar_url: customerProfile.avatar_url
        }
      },
      generatedPassword: !customerData.password ? password : null
    };

  } catch (error) {
    console.error('Create customer account error:', error);
    throw error;
  }
};

export const authenticateCustomer = async (email, password) => {
  try {
    if (!email || !password) {
      throw new Error('Email и пароль обязательны');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedEmail = hashMeta(normalizedEmail);
    
    // Ищем через Meta
    const metaRecord = await Meta.findByEmailAndRole(hashedEmail, 'customer');
    if (!metaRecord) {
      throw new Error('Клиент не найден');
    }

    const user = await User.findById(metaRecord.customer);
    if (!user || !user.is_active) {
      throw new Error('Аккаунт неактивен');
    }

    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Неверный пароль');
    }

    // Получаем профиль
    const profile = await CustomerProfile.findOne({ user_id: user._id });
    if (!profile || !profile.is_active) {
      throw new Error('Профиль клиента не найден или неактивен');
    }

    // Расшифровываем данные для отображения
    let displayPhone = null;
    try {
      displayPhone = profile.phone ? decryptString(profile.phone) : null;
    } catch (error) {
      console.warn('Could not decrypt phone for authentication');
    }

    // Обновляем активность
    user.last_login_at = new Date();
    user.last_activity_at = new Date();
    await user.resetLoginAttempts();

    return {
      customer: {
        _id: user._id,
        email: normalizedEmail,
        role: user.role,
        profile: {
          first_name: profile.first_name,
          last_name: profile.last_name,
          full_name: profile.full_name,
          phone: displayPhone,
          avatar_url: profile.avatar_url
        }
      }
    };

  } catch (error) {
    console.error('Authenticate customer error:', error);
    throw error;
  }
};

export const findCustomerByEmail = async (email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const hashedEmail = hashMeta(normalizedEmail);
    
    const metaRecord = await Meta.findByEmailAndRole(hashedEmail, 'customer');
    if (!metaRecord) {
      return null;
    }

    const user = await User.findById(metaRecord.customer);
    if (!user) {
      return null;
    }

    const profile = await CustomerProfile.findOne({ user_id: user._id });
    
    return {
      user,
      profile,
      email: normalizedEmail
    };

  } catch (error) {
    console.error('Find customer by email error:', error);
    throw error;
  }
};

export default {
  createCustomerAccount,
  authenticateCustomer,
  findCustomerByEmail
};