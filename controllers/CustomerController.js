// controllers/CustomerController.js (обновленный с сервисным слоем)
import { 
  createCustomerAccount, 
  loginCustomer, 
  getUserById 
} from '../services/auth.service.js';
import { 
  getCustomerProfile, 
  updateCustomerProfile, 
  deleteCustomer,
  addDeliveryAddress,
  updateDeliveryAddress,
  removeDeliveryAddress
} from '../services/customer.service.js';
import { generateCustomerToken } from '../services/token.service.js';
import mongoose from 'mongoose';

// ===== РЕГИСТРАЦИЯ КЛИЕНТА =====
export const register = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      confirm_password,
      gdpr_consent = true
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

    // Создаем аккаунт через сервис
    const newCustomerData = await createCustomerAccount({
      first_name,
      last_name,
      email,
      phone,
      password
    });

    // Проверяем, новый ли это клиент
    if (!newCustomerData.isNewCustomer) {
      return res.status(400).json({
        result: false,
        message: "Пользователь с таким email уже существует"
      });
    }

    // Генерируем токен
    const token = generateCustomerToken(newCustomerData.customer, '30d');

    res.status(201).json({
      result: true,
      message: "Регистрация прошла успешно!",
      user: {
        id: newCustomerData.customer._id,
        email: newCustomerData.customer.email,
        role: newCustomerData.customer.role,
        profile: {
          first_name: newCustomerData.customer.profile.first_name,
          last_name: newCustomerData.customer.profile.last_name,
          full_name: newCustomerData.customer.profile.full_name
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
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Базовая валидация
    if (!email || !password) {
      return res.status(400).json({
        result: false,
        message: "Email и пароль обязательны"
      });
    }

    // Авторизация через сервис
    const loginResult = await loginCustomer({ email, password });

    res.status(200).json({
      result: true,
      message: "Вход выполнен успешно",
      user: loginResult.user,
      token: loginResult.token
    });

  } catch (error) {
    console.error('Login error:', error);
    
    // Используем статус код из ошибки если он есть
    const statusCode = error.statusCode || 500;
    
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка при входе",
      error: error.message
    });
  }
};

// ===== ВЕРИФИКАЦИЯ ТОКЕНА =====
export const verify = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    // Получаем полную информацию о пользователе через сервис
    const userWithProfile = await getUserById(user._id);

    if (!userWithProfile) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не найден"
      });
    }

    res.status(200).json({
      result: true,
      message: "Пользователь верифицирован",
      user: {
        id: userWithProfile._id,
        email: userWithProfile.email,
        role: userWithProfile.role,
        is_email_verified: userWithProfile.is_email_verified,
        profile: userWithProfile.profile
      }
    });

  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при верификации",
      error: error.message
    });
  }
};

// ===== ПОЛУЧЕНИЕ ПРОФИЛЯ =====
export const getProfile = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    // Получаем профиль через сервис
    const profileData = await getCustomerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль получен",
      user: profileData.user,
      profile: profileData.profile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при получении профиля"
    });
  }
};

// ===== РЕДАКТИРОВАНИЕ ПРОФИЛЯ =====
export const edit = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const requester = req.user; // Из middleware

    // Валидация ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        result: false,
        message: "Некорректный ID пользователя"
      });
    }

    // Проверка прав доступа - пользователь может редактировать только свой профиль
    if (requester._id.toString() !== id) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен: Вы можете редактировать только свой профиль"
      });
    }

    // Запрещаем изменение роли
    if (updateData.role) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен: Роль нельзя изменить"
      });
    }

    // Обновляем профиль через сервис
    const updatedData = await updateCustomerProfile(id, updateData);

    res.status(200).json({
      result: true,
      message: "Профиль обновлен!",
      user: updatedData.user,
      profile: updatedData.profile
    });

  } catch (error) {
    console.error('Edit profile error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при обновлении профиля",
      error: error.message
    });
  }
};

// ===== УДАЛЕНИЕ КЛИЕНТА =====
export const delClient = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user; // Из middleware

    // Валидация ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        result: false,
        message: "Некорректный ID пользователя"
      });
    }

    // Проверка прав доступа - пользователь может удалить только свой аккаунт
    // или это должен быть админ
    if (requester._id.toString() !== id && !requester.role.includes('admin')) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен: Вы можете удалить только свой аккаунт"
      });
    }

    // Удаляем через сервис
    const deleteResult = await deleteCustomer(id);

    res.status(200).json({
      result: true,
      message: deleteResult.message,
      deletedUserId: deleteResult.deletedUserId
    });

  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при удалении клиента",
      error: error.message
    });
  }
};

// ===== УПРАВЛЕНИЕ АДРЕСАМИ ДОСТАВКИ =====

// Добавление адреса доставки
export const addAddress = async (req, res) => {
  try {
    const { user } = req;
    const addressData = req.body;

    const updatedProfile = await addDeliveryAddress(user._id, addressData);

    res.status(201).json({
      result: true,
      message: "Адрес доставки добавлен",
      addresses: updatedProfile.delivery_addresses
    });

  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при добавлении адреса"
    });
  }
};

// Обновление адреса доставки
export const updateAddress = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;
    const updateData = req.body;

    const updatedProfile = await updateDeliveryAddress(user._id, addressId, updateData);

    res.status(200).json({
      result: true,
      message: "Адрес доставки обновлен",
      addresses: updatedProfile.delivery_addresses
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при обновлении адреса"
    });
  }
};

// Удаление адреса доставки
export const removeAddress = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;

    const updatedProfile = await removeDeliveryAddress(user._id, addressId);

    res.status(200).json({
      result: true,
      message: "Адрес доставки удален",
      addresses: updatedProfile.delivery_addresses
    });

  } catch (error) {
    console.error('Remove address error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при удалении адреса"
    });
  }
};

export default {
  register,
  login,
  verify,
  getProfile,
  edit,
  delClient,
  addAddress,
  updateAddress,
  removeAddress
};