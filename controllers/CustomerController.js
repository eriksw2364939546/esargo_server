// controllers/AuthController.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, CustomerProfile } = require('../models');

// ===== РЕГИСТРАЦИЯ КЛИЕНТА =====
const registerCustomer = async (req, res) => {
  try {
    const {
      first_name,    // Имя
      last_name,     // Фамилия  
      email,         // E-mail
      phone,         // Телефон
      password,      // Пароль
      confirm_password, // Подтвердите пароль
      gdpr_consent = true // Согласие с условиями
    } = req.body;

    // Валидация обязательных полей
    if (!first_name || !last_name || !email || !phone || !password || !confirm_password) {
      return res.status(400).json({
        result: false,
        message: "Все поля обязательны для заполнения"
      });
    }

    // Проверка подтверждения пароля
    if (password !== confirm_password) {
      return res.status(400).json({
        result: false,
        message: "Пароли не совпадают"
      });
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        result: false,
        message: "Некорректный формат email"
      });
    }

    // Проверка длины пароля
    if (password.length < 6) {
      return res.status(400).json({
        result: false,
        message: "Пароль должен содержать минимум 6 символов"
      });
    }

    // Проверка формата телефона (французский формат)
    const phoneRegex = /^(\+33|0)[1-9](\d{8})$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        result: false,
        message: "Некорректный формат телефона. Используйте французский формат."
      });
    }

    // Проверка согласия с условиями
    if (!gdpr_consent) {
      return res.status(400).json({
        result: false,
        message: "Необходимо согласие с условиями использования и политикой конфиденциальности"
      });
    }

    // Проверка на существующего пользователя
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        result: false,
        message: "Пользователь с таким email уже существует"
      });
    }

    // Создание пользователя (БЕЗ хэширования - это делает User.model.js)
    const newUser = new User({
      email: email.toLowerCase(),
      password_hash: password, // ← Передаем обычный пароль, хэширование в pre('save')
      role: 'customer',
      is_active: true,
      is_email_verified: false,
      gdpr_consent: {
        data_processing: true,
        marketing: false,
        analytics: false,
        consent_date: new Date()
      },
      registration_source: 'web',
      registration_ip: req.ip || 'unknown',
      user_agent: req.get('User-Agent') || 'unknown'
    });

    await newUser.save();

    // Создание профиля клиента
    const customerProfile = new CustomerProfile({
      user_id: newUser._id,
      first_name,
      last_name,
      phone,
      settings: {
        notifications_enabled: true,
        preferred_language: 'fr',
        marketing_emails: false
      }
    });

    await customerProfile.save();

    // Создание JWT токена
    const token = jwt.sign(
      { 
        user_id: newUser._id, 
        email: newUser.email, 
        role: newUser.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      result: true,
      message: "Регистрация прошла успешно!",
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        profile: {
          first_name: customerProfile.first_name,
          last_name: customerProfile.last_name,
          full_name: customerProfile.full_name
        }
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при регистрации",
      error: error.message
    });
  }
};

// ===== АВТОРИЗАЦИЯ =====
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Валидация полей
    if (!email || !password) {
      return res.status(400).json({
        result: false,
        message: "Email и пароль обязательны"
      });
    }

    // Поиск пользователя
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      is_active: true 
    });

    if (!user) {
      return res.status(401).json({
        result: false,
        message: "Неверный email или пароль"
      });
    }

    // Проверка заблокирован ли аккаунт
    if (user.login_attempts.blocked_until && user.login_attempts.blocked_until > new Date()) {
      const blockedUntil = user.login_attempts.blocked_until;
      return res.status(423).json({
        result: false,
        message: "Аккаунт временно заблокирован",
        blocked_until: blockedUntil
      });
    }

    // Проверка пароля (используем метод из модели)
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Увеличиваем счетчик неудачных попыток
      await user.incrementLoginAttempts();
      
      return res.status(401).json({
        result: false,
        message: "Неверный email или пароль"
      });
    }

    // Сброс счетчика попыток при успешном входе (БЕЗ параметра ip)
    await user.resetLoginAttempts();

    // Получение профиля пользователя
    let profile = null;
    if (user.role === 'customer') {
      profile = await CustomerProfile.findOne({ user_id: user._id });
    }

    // Создание JWT токена
    const token = jwt.sign(
      { 
        user_id: user._id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      result: true,
      message: "Вход выполнен успешно",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: profile ? {
          first_name: profile.first_name,
          last_name: profile.last_name,
          full_name: profile.full_name,
          phone: profile.phone
        } : null
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при входе",
      error: error.message
    });
  }
};

// ===== ПОЛУЧЕНИЕ ПРОФИЛЯ =====
const getProfile = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации

    const userWithProfile = await User.findById(user._id).select('-password_hash');
    
    let profile = null;
    if (userWithProfile.role === 'customer') {
      profile = await CustomerProfile.findOne({ user_id: user._id });
    }

    res.json({
      result: true,
      user: {
        id: userWithProfile._id,
        email: userWithProfile.email,
        role: userWithProfile.role,
        is_email_verified: userWithProfile.is_email_verified,
        profile: profile ? {
          first_name: profile.first_name,
          last_name: profile.last_name,
          full_name: profile.full_name,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
          delivery_addresses: profile.delivery_addresses,
          settings: profile.settings
        } : null
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при получении профиля"
    });
  }
};

// ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
const updateProfile = async (req, res) => {
  try {
    const { user } = req;
    const { first_name, last_name, phone } = req.body;

    if (user.role !== 'customer') {
      return res.status(403).json({
        result: false,
        message: "Доступно только для клиентов"
      });
    }

    const profile = await CustomerProfile.findOne({ user_id: user._id });
    if (!profile) {
      return res.status(404).json({
        result: false,
        message: "Профиль не найден"
      });
    }

    // Обновляем поля если они переданы
    if (first_name) profile.first_name = first_name;
    if (last_name) profile.last_name = last_name;
    if (phone !== undefined) profile.phone = phone;

    await profile.save();

    res.json({
      result: true,
      message: "Профиль обновлен",
      profile: {
        first_name: profile.first_name,
        last_name: profile.last_name,
        full_name: profile.full_name,
        phone: profile.phone
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при обновлении профиля"
    });
  }
};

module.exports = {
  registerCustomer,
  loginUser,
  getProfile,
  updateProfile
};