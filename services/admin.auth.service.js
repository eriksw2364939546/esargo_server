// services/admin.auth.service.js (исправленный)
import { AdminUser } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';

/**
 * Создание аккаунта администратора
 * @param {object} adminData - Данные администратора
 * @returns {object} - Результат создания аккаунта
 */
export const createAdminAccount = async (adminData) => {
  try {
    let { 
      full_name, 
      email, 
      password, 
      role, 
      department, 
      contact_info 
    } = adminData;

    // Проверка обязательных полей
    if (!full_name || !email || !password || !role) {
      throw new Error('Отсутствуют обязательные поля: full_name, email, password, role');
    }

    // Нормализация email
    email = email.toLowerCase().trim();

    // 🆕 ИСПРАВЛЕНО: Используем новый метод поиска
    const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'admin');

    if (metaInfo) {
      return { 
        isNewAdmin: false, 
        admin: metaInfo.admin 
      };
    }

    // Хешируем пароль
    const hashedPassword = await hashString(password);

    // Создаем администратора
    const newAdmin = new AdminUser({
      full_name,
      email,
      password_hash: hashedPassword,
      role,
      contact_info: {
        department: department || 'general',
        ...contact_info
      },
      is_active: true,
      created_by: null, // Первый админ создается без ссылки
      permissions: getDefaultPermissions(role)
    });

    await newAdmin.save();

    // 🆕 ИСПРАВЛЕНО: Создаем Meta запись через статический метод
    const newMetaInfo = await Meta.createForAdmin(newAdmin._id, hashMeta(email));

    await newMetaInfo.save(); // Убираем так как createForAdmin уже сохраняет

    return { 
      isNewAdmin: true, 
      admin: newAdmin
    };

  } catch (error) {
    console.error('Create admin account error:', error);
    throw error;
  }
};

/**
 * Авторизация администратора
 * @param {object} loginData - Данные для входа
 * @returns {object} - Результат авторизации
 */
export const loginAdmin = async ({ email, password }) => {
  try {
    // Валидация входных данных
    if (!email || !password) {
      const error = new Error('Email и пароль обязательны');
      error.statusCode = 400;
      throw error;
    }

    // Нормализация email
    email = email.toLowerCase().trim();

    // 🆕 ИСПРАВЛЕНО: Используем новый метод поиска с populate
    const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'admin');

    if (!metaInfo || !metaInfo.admin) {
      const error = new Error('Администратор не найден');
      error.statusCode = 404;
      throw error;
    }

    // Проверяем, заблокирован ли аккаунт
    if (metaInfo.admin.isAccountLocked()) {
      const error = new Error('Аккаунт временно заблокирован из-за множественных неудачных попыток входа');
      error.statusCode = 423;
      throw error;
    }

    // Проверяем активность администратора
    if (!metaInfo.admin.is_active) {
      const error = new Error('Аккаунт администратора деактивирован');
      error.statusCode = 403;
      throw error;
    }

    // Проверяем приостановку
    if (metaInfo.admin.isSuspended()) {
      const error = new Error('Аккаунт администратора приостановлен');
      error.statusCode = 403;
      throw error;
    }

    // Проверяем пароль
    const isPasswordValid = await comparePassword(password, metaInfo.admin.password_hash);
    
    if (!isPasswordValid) {
      // Увеличиваем счетчик неудачных попыток
      await metaInfo.admin.incrementLoginAttempts();
      
      const error = new Error('Неверный пароль');
      error.statusCode = 401;
      throw error;
    }

    // Сбрасываем счетчик неудачных попыток при успешном входе
    await metaInfo.admin.resetLoginAttempts();

    // Обновляем активность админа
    await metaInfo.admin.recordActivity();

    // 🆕 ИСПРАВЛЕНО: Генерируем токен с правильными данными
    const token = generateCustomerToken({
      user_id: metaInfo.admin._id, // ИСПРАВЛЕНО: используем user_id
      _id: metaInfo.admin._id,
      email: metaInfo.admin.email,
      role: 'admin', // 🆕 ИСПРАВЛЕНО: всегда 'admin' для проверки в middleware
      admin_role: metaInfo.admin.role, // 🆕 ДОБАВЛЕНО: конкретная админская роль
      is_admin: true // 🆕 ДОБАВЛЕНО: флаг для быстрой проверки
    }, '8h'); // Короткий срок для админов

    return { 
      token,
      admin: {
        id: metaInfo.admin._id,
        email: metaInfo.admin.email,
        full_name: metaInfo.admin.full_name,
        role: metaInfo.admin.role,
        department: metaInfo.admin.contact_info?.department,
        permissions: metaInfo.admin.permissions,
        is_admin: true // 🆕 ДОБАВЛЕНО
      }
    };

  } catch (error) {
    console.error('Login admin error:', error);
    throw error;
  }
};

/**
 * Получение администратора по ID (для middleware)
 * @param {string} adminId - ID администратора
 * @returns {object} - Администратор
 */
export const getAdminById = async (adminId) => {
  try {
    const admin = await AdminUser.findById(adminId).select('-password_hash');
    if (!admin) return null;

    // 🆕 ДОБАВЛЕНО: Добавляем метод isAdmin для совместимости
    admin.isAdmin = function() {
      return ['admin', 'manager', 'owner', 'support', 'moderator'].includes(this.role);
    };

    return admin;
  } catch (error) {
    console.error('Get admin by ID error:', error);
    return null;
  }
};

/**
 * Проверка разрешений администратора
 * @param {object} admin - Объект администратора
 * @param {string} section - Раздел (например, 'partners')
 * @param {string} action - Действие (например, 'read', 'write')
 * @returns {boolean} - Есть ли разрешение
 */
export const checkAdminPermission = (admin, section, action) => {
  try {
    // Владелец имеет все права
    if (admin.role === 'owner') {
      return true;
    }

    // Проверяем конкретные разрешения
    const sectionPermissions = admin.permissions[section];
    if (!sectionPermissions) {
      return false;
    }

    return sectionPermissions[action] === true;
  } catch (error) {
    console.error('Check admin permission error:', error);
    return false;
  }
};

/**
 * Получение разрешений по умолчанию для роли
 * @param {string} role - Роль администратора
 * @returns {object} - Объект разрешений
 */
const getDefaultPermissions = (role) => {
  const basePermissions = {
    dashboard: { read: false, write: false },
    users: { read: false, write: false, delete: false },
    partners: { read: false, write: false, approve: false },
    couriers: { read: false, write: false, approve: false },
    orders: { read: false, write: false, cancel: false },
    finance: { read: false, write: false },
    analytics: { read: false, write: false },
    system: { read: false, write: false, maintain: false }
  };

  switch (role) {
    case 'owner':
      // Владелец имеет все права
      Object.keys(basePermissions).forEach(section => {
        Object.keys(basePermissions[section]).forEach(action => {
          basePermissions[section][action] = true;
        });
      });
      break;

    case 'manager':
      // Менеджер имеет большинство прав кроме системных
      basePermissions.dashboard = { read: true, write: true };
      basePermissions.users = { read: true, write: true, delete: false };
      basePermissions.partners = { read: true, write: true, approve: true };
      basePermissions.couriers = { read: true, write: true, approve: true };
      basePermissions.orders = { read: true, write: true, cancel: true };
      basePermissions.finance = { read: true, write: false };
      basePermissions.analytics = { read: true, write: false };
      break;

    case 'admin': // 🆕 ДОБАВЛЕНО: обычный админ
      // Админ имеет базовые права
      basePermissions.dashboard = { read: true, write: false };
      basePermissions.users = { read: true, write: true, delete: false };
      basePermissions.partners = { read: true, write: true, approve: true };
      basePermissions.couriers = { read: true, write: false, approve: false };
      basePermissions.orders = { read: true, write: true, cancel: true };
      basePermissions.analytics = { read: true, write: false };
      break;

    case 'support':
      // Поддержка имеет ограниченные права
      basePermissions.dashboard = { read: true, write: false };
      basePermissions.users = { read: true, write: false, delete: false };
      basePermissions.partners = { read: true, write: false, approve: false };
      basePermissions.couriers = { read: true, write: false, approve: false };
      basePermissions.orders = { read: true, write: true, cancel: false };
      break;

    case 'moderator':
      // Модератор работает с контентом и заявками
      basePermissions.dashboard = { read: true, write: false };
      basePermissions.partners = { read: true, write: true, approve: true };
      basePermissions.couriers = { read: true, write: true, approve: false };
      basePermissions.orders = { read: true, write: false, cancel: false };
      break;
  }

  return basePermissions;
};