// controllers/CustomerController.js - ИСПРАВЛЕННЫЙ с генерацией токена при регистрации
import {
  createCustomerAccount,
  authenticateCustomer
} from '../services/auth.service.js';

import {
  getCustomerProfile,
  updateCustomerProfile,
  deleteCustomerProfile
} from '../services/customer.service.js';

import { generateCustomerToken } from '../services/token.service.js';

// РЕГИСТРАЦИЯ КЛИЕНТА - С ГЕНЕРАЦИЕЙ ТОКЕНА
export const register = async (req, res) => {
  try {
    const customerData = req.body;

    console.log('Customer registration attempt:', {
      email: customerData.email,
      has_password: !!customerData.password
    });

    const result = await createCustomerAccount(customerData);

    if (!result.isNewCustomer) {
      return res.status(409).json({
        result: false,
        message: "Клиент с таким email уже существует"
      });
    }

    // ✅ ГЕНЕРИРУЕМ ТОКЕН СРАЗУ ПОСЛЕ РЕГИСТРАЦИИ
    const token = generateCustomerToken({
      user_id: result.customer._id,
      _id: result.customer._id,
      email: result.customer.email,
      role: result.customer.role
    }, '30d'); // Токен на 30 дней

    console.log('✅ Customer registered and token generated:', {
      user_id: result.customer._id,
      email: result.customer.email,
      token_length: token ? token.length : 0
    });

    const response = {
      result: true,
      message: "Регистрация прошла успешно",
      user: {
        id: result.customer._id,
        email: result.customer.email,
        role: result.customer.role,
        profile: result.customer.profile
      },
      token // ✅ ДОБАВЛЯЕМ ТОКЕН В ОТВЕТ
    };

    if (result.generatedPassword) {
      response.generated_password = result.generatedPassword;
      response.message += ". Временный пароль создан автоматически.";
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Registration error:', error);
    
    const statusCode = error.message.includes('обязательны') ? 400 : 500;
    
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка при регистрации"
    });
  }
};

// АВТОРИЗАЦИЯ КЛИЕНТА - БЕЗ ИЗМЕНЕНИЙ
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        result: false,
        message: "Email и пароль обязательны"
      });
    }

    console.log('Customer login attempt:', { email });

    const loginResult = await authenticateCustomer(email, password);

    if (!loginResult || !loginResult.customer) {
      return res.status(401).json({
        result: false,
        message: "Неверный email или пароль"
      });
    }

    // Генерируем токен
    const token = generateCustomerToken({
      user_id: loginResult.customer._id,
      _id: loginResult.customer._id,
      email: loginResult.customer.email,
      role: loginResult.customer.role
    }, '30d');

    res.status(200).json({
      result: true,
      message: "Авторизация успешна",
      user: {
        id: loginResult.customer._id,
        email: loginResult.customer.email,
        role: loginResult.customer.role,
        profile: loginResult.customer.profile
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при авторизации",
      error: error.message
    });
  }
};

// ВЕРИФИКАЦИЯ ТОКЕНА
export const verify = async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    res.status(200).json({
      result: true,
      message: "Токен действителен",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка верификации токена"
    });
  }
};

// ПОЛУЧЕНИЕ ПРОФИЛЯ
export const getProfile = async (req, res) => {
  try {
    const { user } = req;

    const profileResult = await getCustomerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль получен",
      profile: profileResult.profile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения профиля",
      error: error.message
    });
  }
};

// ОБНОВЛЕНИЕ ПРОФИЛЯ
export const edit = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Проверяем, что пользователь редактирует свой профиль
    if (user._id.toString() !== id) {
      return res.status(403).json({
        result: false,
        message: "Можно редактировать только собственный профиль"
      });
    }

    const updatedProfile = await updateCustomerProfile(user._id, updateData);

    res.status(200).json({
      result: true,
      message: "Профиль обновлен",
      profile: updatedProfile.profile
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка обновления профиля",
      error: error.message
    });
  }
};

// УДАЛЕНИЕ ПРОФИЛЯ
export const delClient = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // Проверяем, что пользователь удаляет свой профиль
    if (user._id.toString() !== id) {
      return res.status(403).json({
        result: false,
        message: "Можно удалить только собственный профиль"
      });
    }

    await deleteCustomerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль клиента удален"
    });

  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка удаления профиля",
      error: error.message
    });
  }
};

export default {
  register,
  login,
  verify,
  getProfile,
  edit,
  delClient
};