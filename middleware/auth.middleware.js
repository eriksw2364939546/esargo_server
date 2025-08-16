// middleware/auth.middleware.js (исправленный)
import { verifyJWTToken, extractTokenFromHeader } from '../services/token.service.js';
import { getUserById } from '../services/auth.service.js';

/**
 * Middleware для аутентификации пользователей
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
    
    // Получаем полную информацию о пользователе
    const user = await getUserById(decoded.user_id);
    
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
    
    // Добавляем пользователя в req для использования в контроллерах
    req.user = user;
    req.token = token;
    
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
      
      if (!roles.includes(user.role)) {
        return res.status(403).json({
          result: false,
          message: "Недостаточно прав доступа"
        });
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
 * Упрощенная проверка админских разрешений (временно)
 * @param {string} section - Раздел (например, 'partners')
 * @param {string} action - Действие (например, 'read', 'write')
 */
export const requireAdminPermission = (section, action) => {
  return (req, res, next) => {
    try {
      const { user } = req;
      
      // Базовая проверка на админа
      if (!user || !user.isAdmin()) {
        return res.status(403).json({
          result: false,
          message: "Доступ разрешен только для администраторов"
        });
      }
      
      // Владелец имеет все права
      if (user.role === 'owner') {
        return next();
      }
      
      // Менеджер имеет большинство прав
      if (user.role === 'manager') {
        const restrictedActions = ['delete', 'system'];
        if (!restrictedActions.includes(action)) {
          return next();
        }
      }
      
      // Обычный админ имеет ограниченные права
      if (user.role === 'admin') {
        const allowedSections = ['partners', 'customers', 'orders'];
        const allowedActions = ['read', 'write'];
        
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
    
    // Админы не требуют верификации email
    if (user.isAdmin()) {
      return next();
    }
    
    if (!user.is_email_verified) {
      return res.status(403).json({
        result: false,
        message: "Необходимо подтвердить email адрес"
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
 * Опциональная аутентификация (не требует обязательного токена)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      try {
        const decoded = verifyJWTToken(token);
        const user = await getUserById(decoded.user_id);
        
        if (user && user.is_active) {
          req.user = user;
          req.token = token;
        }
      } catch (error) {
        // Игнорируем ошибки токена для опциональной аутентификации
        console.log('Optional auth token error:', error.message);
      }
    }
    
    next();
    
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Продолжаем выполнение даже при ошибке
  }
};