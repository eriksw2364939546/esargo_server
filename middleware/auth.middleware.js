// middleware/auth.middleware.js (исправленный)
import { verifyJWTToken, extractTokenFromHeader } from '../services/token.service.js';
import { getUserById } from '../services/auth.service.js';
import { getAdminById } from '../services/admin.auth.service.js'; // 🆕 ДОБАВЛЕНО

/**
 * Middleware для аутентификации пользователей (включая админов)
 */
export const authenticateUser = async (req, res, next) => {
  try {
    // Извлекаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return res.status(401).json({
        result: false,
        message: "Токен авторизации отсутствует"
      });
    }
    
    // Верифицируем токен
    const decoded = verifyJWTToken(token);
    
    let user = null;
    
    // 🆕 ИСПРАВЛЕНО: Проверяем, это админ или обычный пользователь
    if (decoded.is_admin || decoded.role === 'admin') {
      // Получаем данные админа
      user = await getAdminById(decoded.user_id || decoded._id);
      if (user) {
        // Добавляем поля для совместимости с обычными пользователями
        user.role = 'admin'; // Для проверок в requireRole
        user.admin_role = decoded.admin_role || user.role; // Конкретная админская роль
        user.is_admin_user = true; // Флаг что это админ
      }
    } else {
      // Получаем обычного пользователя
      user = await getUserById(decoded.user_id || decoded._id);
      if (user) {
        user.is_admin_user = false;
      }
    }
    
    if (!user) {
      return res.status(401).json({
        result: false,
        message: "Пользователь не найден"
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        result: false,
        message: "Аккаунт деактивирован"
      });
    }
    
    // 🆕 ДОБАВЛЕНО: Дополнительная проверка для админов
    if (user.is_admin_user && user.isSuspended && user.isSuspended()) {
      return res.status(403).json({
        result: false,
        message: "Аккаунт администратора приостановлен"
      });
    }
    
    // Добавляем пользователя в req для использования в контроллерах
    req.user = user;
    req.token = token;
    req.decoded = decoded; // 🆕 ДОБАВЛЕНО: для отладки
    
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    let message = "Ошибка аутентификации";
    let statusCode = 401;
    
    if (error.message === 'Токен истек') {
      message = "Токен истек, необходимо войти заново";
    } else if (error.message === 'Недействительный токен') {
      message = "Недействительный токен";
    }
    
    return res.status(statusCode).json({
      result: false,
      message,
      error: error.message
    });
  }
};

/**
 * Middleware для проверки роли пользователя
 * @param {string|string[]} allowedRoles - Разрешенные роли
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const { user } = req;
      
      if (!user) {
        return res.status(401).json({
          result: false,
          message: "Пользователь не аутентифицирован"
        });
      }
      
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      // 🆕 ИСПРАВЛЕНО: Проверка ролей для админов
      if (user.is_admin_user) {
        // Для админов проверяем как обычную роль 'admin', так и конкретную админскую роль
        const hasAdminRole = roles.includes('admin');
        const hasSpecificRole = roles.includes(user.admin_role);
        
        if (!hasAdminRole && !hasSpecificRole) {
          return res.status(403).json({
            result: false,
            message: "Недостаточно прав доступа"
          });
        }
      } else {
        // Для обычных пользователей стандартная проверка
        if (!roles.includes(user.role)) {
          return res.status(403).json({
            result: false,
            message: "Недостаточно прав доступа"
          });
        }
      }
      
      next();
      
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        result: false,
        message: "Ошибка проверки прав доступа"
      });
    }
  };
};

/**
 * 🆕 ИСПРАВЛЕНО: Улучшенная проверка админских разрешений
 * @param {string} section - Раздел (например, 'partners')
 * @param {string} action - Действие (например, 'read', 'write')
 */
export const requireAdminPermission = (section, action) => {
  return (req, res, next) => {
    try {
      const { user } = req;
      
      // Базовая проверка на аутентификацию
      if (!user) {
        return res.status(401).json({
          result: false,
          message: "Пользователь не аутентифицирован"
        });
      }
      
      // 🆕 ИСПРАВЛЕНО: Проверяем что это именно админ
      if (!user.is_admin_user || user.role !== 'admin') {
        return res.status(403).json({
          result: false,
          message: "Доступ разрешен только для администраторов"
        });
      }
      
      // Владелец имеет все права
      if (user.admin_role === 'owner') {
        return next();
      }
      
      // Менеджер имеет большинство прав
      if (user.admin_role === 'manager') {
        const restrictedActions = ['delete', 'maintain'];
        const restrictedSections = ['system'];
        
        if (!restrictedSections.includes(section) && !restrictedActions.includes(action)) {
          return next();
        }
      }
      
      // 🆕 ДОБАВЛЕНО: Проверка через систему разрешений
      if (user.hasPermission && user.hasPermission(section, action)) {
        return next();
      }
      
      // Упрощенная проверка для базовых ролей
      if (user.admin_role === 'admin') {
        const allowedSections = ['partners', 'customers', 'orders', 'users'];
        const allowedActions = ['read', 'write', 'approve'];
        
        if (allowedSections.includes(section) && allowedActions.includes(action)) {
          return next();
        }
      }
      
      if (user.admin_role === 'support') {
        const allowedSections = ['customers', 'orders'];
        const allowedActions = ['read', 'write'];
        
        if (allowedSections.includes(section) && allowedActions.includes(action)) {
          return next();
        }
      }
      
      if (user.admin_role === 'moderator') {
        const allowedSections = ['partners', 'couriers'];
        const allowedActions = ['read', 'write', 'approve'];
        
        if (allowedSections.includes(section) && allowedActions.includes(action)) {
          return next();
        }
      }
      
      return res.status(403).json({
        result: false,
        message: `Недостаточно прав для выполнения действия ${action} в разделе ${section}`
      });
      
    } catch (error) {
      console.error('Admin permission check error:', error);
      return res.status(500).json({
        result: false,
        message: "Ошибка проверки административных прав"
      });
    }
  };
};

/**
 * Middleware для проверки верификации email
 */
export const requireEmailVerification = (req, res, next) => {
  try {
    const { user } = req;
    
    if (!user) {
      return res.status(401).json({
        result: false,
        message: "Пользователь не аутентифицирован"
      });
    }
    
    // 🆕 ИСПРАВЛЕНО: Админы не требуют верификации email
    if (user.is_admin_user || (user.isAdmin && user.isAdmin())) {
      return next();
    }
    
    if (!user.is_email_verified) {
      return res.status(403).json({
        result: false,
        message: "Необходимо подтвердить email для доступа к этой функции"
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Email verification check error:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка проверки верификации email"
    });
  }
};

/**
 * 🆕 ДОБАВЛЕНО: Опциональная аутентификация (для публичных роутов с дополнительными возможностями)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    try {
      const decoded = verifyJWTToken(token);
      
      let user = null;
      if (decoded.is_admin || decoded.role === 'admin') {
        user = await getAdminById(decoded.user_id || decoded._id);
        if (user) {
          user.role = 'admin';
          user.admin_role = decoded.admin_role || user.role;
          user.is_admin_user = true;
        }
      } else {
        user = await getUserById(decoded.user_id || decoded._id);
        if (user) {
          user.is_admin_user = false;
        }
      }
      
      req.user = user;
      req.token = token;
    } catch (authError) {
      // Игнорируем ошибки аутентификации для опционального middleware
      req.user = null;
    }
    
    next();
    
  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
};