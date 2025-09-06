// controllers/CustomerController.js - Очищенный от старых функций управления адресами
import { 
  createCustomerAccount, 
  loginCustomer, 
  getUserById 
} from '../services/auth.service.js';
import { 
  getCustomerProfile, 
  updateCustomerProfile, 
  deleteCustomerProfile
} from '../services/customer.service.js';
import { generateCustomerToken } from '../services/token.service.js';

// ===== РЕГИСТРАЦИЯ =====
export const register = async (req, res) => {
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
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        result: false,
        message: "Email и пароль обязательны для заполнения"
      });
    }

    // Авторизация через сервис
    const loginResult = await loginCustomer(email, password);
    
    if (!loginResult.isValid) {
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
        profile: {
          first_name: loginResult.customer.profile.first_name,
          last_name: loginResult.customer.profile.last_name,
          full_name: loginResult.customer.profile.full_name,
          phone: loginResult.customer.profile.phone,
          avatar_url: loginResult.customer.profile.avatar_url
        }
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

    // Получаем полную информацию о профиле
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
          // ✅ НОВЫЕ ПОЛЯ: Количество сохраненных адресов
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
    const customerProfile = await getCustomerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль получен успешно",
      user: customerProfile.user,
      profile: {
        ...customerProfile.profile,
        // ✅ ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ОБ АДРЕСАХ
        addresses_summary: {
          total_count: customerProfile.profile.saved_addresses?.length || 0,
          default_address: customerProfile.profile.saved_addresses?.find(addr => addr.is_default) || null,
          zones_used: [...new Set(customerProfile.profile.saved_addresses?.map(addr => addr.delivery_info?.zone).filter(Boolean))] || []
        }
      }
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
export const edit = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации
    const updateData = req.body;

    if (!user) {
      return res.status(404).json({
        result: false,
        message: "Пользователь не определен!"
      });
    }

    // Фильтруем данные для обновления (исключаем адреса)
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

    // Обновляем профиль через сервис (валидация внутри сервиса)
    const updatedProfile = await updateCustomerProfile(user._id, filteredUpdateData);

    res.status(200).json({
      result: true,
      message: "Профиль обновлен успешно",
      user: updatedProfile.user,
      profile: {
        ...updatedProfile.profile,
        // ✅ СОХРАНЯЕМ ИНФОРМАЦИЮ ОБ АДРЕСАХ
        addresses_summary: {
          total_count: updatedProfile.profile.saved_addresses?.length || 0,
          has_default_address: updatedProfile.profile.saved_addresses?.some(addr => addr.is_default) || false
        }
      }
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
export const delClient = async (req, res) => {
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

// ================ ЭКСПОРТ ================



// ✅ УДАЛЕНЫ СТАРЫЕ ФУНКЦИИ: addAddress, updateAddress, removeAddress
// Теперь управление адресами полностью в AddressController.js

export default {
  register,
  login,
  verify,
  getProfile,
  edit,
  delClient
};