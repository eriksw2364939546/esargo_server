// controllers/CustomerController.js - ИСПРАВЛЕННЫЙ контроллер
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

// РЕГИСТРАЦИЯ КЛИЕНТА
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

    const response = {
      result: true,
      message: "Регистрация прошла успешно",
      user: {
        id: result.customer._id,
        email: result.customer.email,
        role: result.customer.role,
        profile: result.customer.profile
      }
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

// АВТОРИЗАЦИЯ КЛИЕНТА
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

    const customerProfile = await getCustomerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Токен действителен",
      user: {
        id: customerProfile.user._id,
        email: customerProfile.user.email,
        role: customerProfile.user.role,
        profile: {
          first_name: customerProfile.profile.first_name,
          last_name: customerProfile.profile.last_name,
          full_name: customerProfile.profile.full_name,
          phone: customerProfile.profile.phone,
          avatar_url: customerProfile.profile.avatar_url,
          saved_addresses_count: customerProfile.profile.saved_addresses?.length || 0,
          has_default_address: customerProfile.profile.saved_addresses?.some(addr => addr.is_default) || false
        }
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при верификации токена",
      error: error.message
    });
  }
};

// ПОЛУЧЕНИЕ ПРОФИЛЯ
export const getProfile = async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    const customerProfile = await getCustomerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль получен",
      user: customerProfile.user,
      profile: customerProfile.profile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при получении профиля"
    });
  }
};

// ОБНОВЛЕНИЕ ПРОФИЛЯ
export const edit = async (req, res) => {
  try {
    const { user } = req;
    const updateData = req.body;

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    // Исключаем адреса из обновления профиля
    if (updateData.saved_addresses) {
      return res.status(400).json({
        result: false,
        message: "Управление адресами через отдельное API: /api/customers/addresses"
      });
    }

    const allowedFields = ['first_name', 'last_name', 'phone', 'avatar_url', 'language', 'current_password', 'new_password'];
    const filteredUpdateData = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field];
      }
    });

    if (Object.keys(filteredUpdateData).length === 0) {
      return res.status(400).json({
        result: false,
        message: "Нет данных для обновления"
      });
    }

    const updatedProfile = await updateCustomerProfile(user._id, filteredUpdateData);

    res.status(200).json({
      result: true,
      message: "Профиль обновлен успешно",
      user: updatedProfile.user,
      profile: {
        ...updatedProfile.profile,
        addresses_summary: {
          total_count: updatedProfile.profile.saved_addresses?.length || 0,
          has_default_address: updatedProfile.profile.saved_addresses?.some(addr => addr.is_default) || false
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.validationErrors) {
      return res.status(400).json({
        result: false,
        message: "Ошибки валидации",
        errors: error.validationErrors
      });
    }
    
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при обновлении профиля"
    });
  }
};

// УДАЛЕНИЕ ПРОФИЛЯ
export const delClient = async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    await deleteCustomerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль успешно удален"
    });

  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при удалении профиля"
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