// controllers/CustomerController.js (обновленный)
import { 
  createCustomerAccount, 
  loginCustomer, 
  getUserById 
} from '../services/auth.service.js';
import { 
  getCustomerProfile, 
  updateCustomerProfile, 
  deleteCustomerProfile,
  addDeliveryAddress
} from '../services/customer.service.js';
import { generateCustomerToken } from '../services/token.service.js';

// ===== РЕГИСТРАЦИЯ =====
const register = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body;

    // Данные уже прошли валидацию в middleware
    const customerData = { first_name, last_name, email, phone, password };
    
    // Создание аккаунта через сервис
    const newCustomerData = await createCustomerAccount(customerData);
    
    // Если клиент уже существует
    if (!newCustomerData.isNewCustomer) {
      return res.status(409).json({
        result: false,
        message: "Пользователь с таким email уже существует"
      });
    }

    // Генерируем токен для нового клиента
    const token = generateCustomerToken({
      user_id: newCustomerData.customer._id,
      _id: newCustomerData.customer._id,
      email: newCustomerData.customer.email,
      role: newCustomerData.customer.role
    }, '30d');

    res.status(201).json({
      result: true,
      message: "Регистрация выполнена успешно",
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
    
    // Обработка ошибок валидации
    if (error.validationErrors) {
      return res.status(400).json({
        result: false,
        message: "Ошибки валидации",
        errors: error.validationErrors
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка при регистрации",
      error: error.message
    });
  }
};

// ===== АВТОРИЗАЦИЯ =====
const login = async (req, res) => {
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
      message: error.message || "Ошибка при входе"
    });
  }
};

// ===== ВЕРИФИКАЦИЯ ТОКЕНА =====
const verify = async (req, res) => {
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
      message: "Ошибка при верификации"
    });
  }
};

// ===== ПОЛУЧЕНИЕ ПРОФИЛЯ =====
const getProfile = async (req, res) => {
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
      message: "Профиль получен успешно",
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

// ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
const edit = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации
    const updateData = req.body;

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    // Обновляем профиль через сервис (валидация внутри сервиса)
    const updatedProfile = await updateCustomerProfile(user._id, updateData);

    res.status(200).json({
      result: true,
      message: "Профиль обновлен успешно",
      user: updatedProfile.user,
      profile: updatedProfile.profile
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    // Обработка ошибок валидации
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

// ===== УДАЛЕНИЕ ПРОФИЛЯ =====
const delClient = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    // Удаляем профиль через сервис
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

// ===== УПРАВЛЕНИЕ АДРЕСАМИ ДОСТАВКИ =====

/**
 * Добавление нового адреса доставки
 */
const addAddress = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации
    const { label, address, lat, lng, is_default } = req.body;

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    // Базовая валидация
    if (!label || !address || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        result: false,
        message: "Обязательные поля: label, address, lat, lng"
      });
    }

    const addressData = { label, address, lat, lng, is_default };
    
    // Добавляем адрес через сервис (валидация внутри сервиса)
    const updatedProfile = await addDeliveryAddress(user._id, addressData);

    res.status(201).json({
      result: true,
      message: "Адрес добавлен успешно",
      profile: updatedProfile.profile
    });

  } catch (error) {
    console.error('Add address error:', error);
    
    // Обработка ошибок валидации
    if (error.validationErrors) {
      return res.status(400).json({
        result: false,
        message: "Ошибки валидации адреса",
        errors: error.validationErrors
      });
    }
    
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при добавлении адреса"
    });
  }
};

/**
 * Обновление адреса доставки
 */
const updateAddress = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;
    const updateData = req.body;

    // TODO: Реализовать обновление адреса в сервисе
    res.status(200).json({
      result: true,
      message: "Обновление адреса в разработке",
      addressId,
      updateData
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при обновлении адреса"
    });
  }
};

/**
 * Удаление адреса доставки
 */
const removeAddress = async (req, res) => {
  try {
    const { user } = req;
    const { addressId } = req.params;

    // TODO: Реализовать удаление адреса в сервисе
    res.status(200).json({
      result: true,
      message: "Удаление адреса в разработке",
      addressId
    });

  } catch (error) {
    console.error('Remove address error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при удалении адреса"
    });
  }
};


export { register, login, verify, getProfile, edit, delClient, addAddress, updateAddress, removeAddress}