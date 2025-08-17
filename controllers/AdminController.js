// controllers/AdminController.js (исправленный)
import { 
  createAdminAccount, 
  loginAdmin, 
  getAdminById 
} from '../services/admin.auth.service.js';
import { generateCustomerToken } from '../services/token.service.js';

/**
 * Авторизация администратора
 */
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
    const loginResult = await loginAdmin({ email, password });

    res.status(200).json({
      result: true,
      message: "Вход администратора выполнен успешно",
      admin: loginResult.admin,
      token: loginResult.token
    });

  } catch (error) {
    console.error('Admin login error:', error);
    
    const statusCode = error.statusCode || 500;
    
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка при входе администратора",
      error: error.message
    });
  }
};

/**
 * Создание нового администратора (только для owner или manager)
 */
export const createAdmin = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      role,
      department,
      contact_info
    } = req.body;
    const creator = req.user; // Из middleware

    // 🆕 ИСПРАВЛЕНО: Проверка что создатель - админ
    if (!creator || !creator.is_admin_user) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен"
      });
    }

    // 🆕 ИСПРАВЛЕНО: Правильная проверка админской роли
    if (creator.admin_role !== 'owner' && creator.admin_role !== 'manager') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для создания администраторов"
      });
    }

    // Валидация обязательных полей
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        result: false,
        message: "Все поля обязательны: full_name, email, password, role"
      });
    }

    // 🆕 ИСПРАВЛЕНО: Проверка допустимых ролей
    const allowedRoles = ['support', 'moderator', 'admin'];
    
    // Owner может создавать manager'ов
    if (creator.admin_role === 'owner') {
      allowedRoles.push('manager');
    }
    
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        result: false,
        message: `Недопустимая роль. Доступные роли: ${allowedRoles.join(', ')}`
      });
    }

    // 🆕 ДОБАВЛЕНО: Нельзя создавать owner'а
    if (role === 'owner') {
      return res.status(400).json({
        result: false,
        message: "Роль 'owner' не может быть назначена"
      });
    }

    // Создание администратора через сервис
    const newAdminData = await createAdminAccount({
      full_name,
      email,
      password,
      role,
      department,
      contact_info
    });

    if (!newAdminData.isNewAdmin) {
      return res.status(400).json({
        result: false,
        message: "Администратор с таким email уже существует"
      });
    }

    res.status(201).json({
      result: true,
      message: "Администратор создан успешно!",
      admin: {
        id: newAdminData.admin._id,
        full_name: newAdminData.admin.full_name,
        email: newAdminData.admin.email,
        role: newAdminData.admin.role,
        department: newAdminData.admin.contact_info?.department
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при создании администратора",
      error: error.message
    });
  }
};

/**
 * Верификация токена администратора
 */
export const verify = async (req, res) => {
  try {
    const { user } = req; // Из middleware аутентификации

    // 🆕 ИСПРАВЛЕНО: Проверка что это админ
    if (!user || !user.is_admin_user) {
      return res.status(404).json({
        result: false,
        message: "Администратор не определен!"
      });
    }

    res.status(200).json({
      result: true,
      message: "Токен администратора действителен",
      admin: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.admin_role, // 🆕 ИСПРАВЛЕНО: используем admin_role
        department: user.contact_info?.department,
        permissions: user.permissions,
        last_activity: user.last_activity_at
      }
    });

  } catch (error) {
    console.error('Admin verify error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при верификации администратора"
    });
  }
};

/**
 * Получение профиля администратора
 */
export const getProfile = async (req, res) => {
  try {
    const { user } = req; // Из middleware

    // 🆕 ИСПРАВЛЕНО: Проверка что это админ
    if (!user || !user.is_admin_user) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен"
      });
    }

    res.status(200).json({
      result: true,
      message: "Профиль администратора получен",
      admin: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.admin_role, // 🆕 ИСПРАВЛЕНО
        department: user.contact_info?.department,
        permissions: user.permissions,
        is_active: user.is_active,
        last_login_at: user.last_login_at,
        last_activity_at: user.last_activity_at,
        activity_stats: user.activity_stats,
        created_at: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при получении профиля администратора"
    });
  }
};

/**
 * Обновление разрешений администратора (только для owner/manager)
 */
export const updatePermissions = async (req, res) => {
  try {
    const { admin_id } = req.params;
    const { permissions } = req.body;
    const updater = req.user; // Из middleware

    // 🆕 ИСПРАВЛЕНО: Проверка прав
    if (!updater || !updater.is_admin_user) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен"
      });
    }

    if (updater.admin_role !== 'owner' && updater.admin_role !== 'manager') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для обновления разрешений"
      });
    }

    // Получаем администратора для обновления
    const targetAdmin = await getAdminById(admin_id);
    if (!targetAdmin) {
      return res.status(404).json({
        result: false,
        message: "Администратор не найден"
      });
    }

    // Нельзя изменять разрешения владельца
    if (targetAdmin.role === 'owner') {
      return res.status(403).json({
        result: false,
        message: "Нельзя изменить разрешения владельца"
      });
    }

    // 🆕 ДОБАВЛЕНО: Нельзя изменять свои собственные разрешения
    if (targetAdmin._id.toString() === updater._id.toString()) {
      return res.status(403).json({
        result: false,
        message: "Нельзя изменить свои собственные разрешения"
      });
    }

    // 🆕 ДОБАВЛЕНО: Manager не может изменять разрешения другого manager'а
    if (updater.admin_role === 'manager' && targetAdmin.role === 'manager') {
      return res.status(403).json({
        result: false,
        message: "Manager не может изменять разрешения другого manager'а"
      });
    }

    // Обновляем разрешения через метод модели
    await targetAdmin.updatePermissions(permissions);

    res.status(200).json({
      result: true,
      message: "Разрешения обновлены успешно",
      admin: {
        id: targetAdmin._id,
        full_name: targetAdmin.full_name,
        role: targetAdmin.role,
        permissions: targetAdmin.permissions
      }
    });

  } catch (error) {
    console.error('Update admin permissions error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при обновлении разрешений",
      error: error.message
    });
  }
};

/**
 * Получение списка администраторов (только для owner/manager)
 */
export const getAdminsList = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, department } = req.query;
    const requester = req.user; // Из middleware

    // 🆕 ИСПРАВЛЕНО: Проверка прав
    if (!requester || !requester.is_admin_user) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен"
      });
    }

    if (requester.admin_role !== 'owner' && requester.admin_role !== 'manager') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для просмотра списка администраторов"
      });
    }

    // Строим фильтр
    const filter = { is_active: true };
    if (role) filter.role = role;
    if (department) filter['contact_info.department'] = department; // 🆕 ИСПРАВЛЕНО

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Импортируем AdminUser модель
    const { AdminUser } = await import('../models/index.js');

    const admins = await AdminUser.find(filter)
      .select('-password_hash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await AdminUser.countDocuments(filter);

    res.status(200).json({
      result: true,
      message: "Список администраторов получен",
      admins: admins.map(admin => ({
        id: admin._id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        department: admin.contact_info?.department,
        is_active: admin.is_active,
        last_login_at: admin.last_login_at,
        created_at: admin.createdAt
      })),
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get admins list error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при получении списка администраторов"
    });
  }
};

export default {
  login,
  createAdmin,
  verify,
  getProfile,
  updatePermissions,
  getAdminsList
};