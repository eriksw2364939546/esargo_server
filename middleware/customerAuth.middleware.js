// middleware/customerAuth.middleware.js
import { verifyJWTToken } from '../services/token.service.js';
import { getUserById } from '../services/auth.service.js';

/**
 * Проверка JWT токена для клиентов
 * @param {object} req - Объект запроса
 * @param {object} res - Объект ответа  
 * @param {function} next - Следующий middleware
 */
export const authenticateCustomer = async (req, res, next) => {
  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        result: false,
        message: "Токен не предоставлен"
      });
    }

    // Проверяем формат токена (Bearer TOKEN)
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        result: false,
        message: "Неверный формат токена"
      });
    }

    // Верифицируем JWT токен
    const decoded = verifyJWTToken(token);
    
    if (!decoded.user_id && !decoded._id) {
      return res.status(401).json({
        result: false,
        message: "Недействительный токен"
      });
    }

    // Получаем пользователя из базы данных
    const userId = decoded.user_id || decoded._id;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
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
    next();

  } catch (error) {
    console.error('Customer auth middleware error:', error);
    
    if (error.message.includes('истек')) {
      return res.status(401).json({
        result: false,
        message: "Токен истек, необходима повторная авторизация"
      });
    }

    return res.status(401).json({
      result: false,
      message: "Недействительный токен"
    });
  }
};

/**
 * Проверка роли пользователя
 * @param {array} allowedRoles - Массив разрешенных ролей
 * @returns {function} - Middleware функция
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

      // Приводим к массиву если передана строка
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          result: false,
          message: `Доступ разрешен только для ролей: ${roles.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({
        result: false,
        message: "Ошибка проверки прав доступа"
      });
    }
  };
};

/**
 * Проверка доступа к собственному профилю
 * @param {object} req - Объект запроса
 * @param {object} res - Объект ответа
 * @param {function} next - Следующий middleware
 */
export const checkProfileOwnership = (req, res, next) => {
  try {
    const { user } = req;
    const profileId = req.params.id;

    if (!user) {
      return res.status(401).json({
        result: false,
        message: "Пользователь не аутентифицирован"
      });
    }

    // Проверяем, что пользователь редактирует свой профиль
    if (user._id.toString() !== profileId) {
      return res.status(403).json({
        result: false,
        message: "Доступ запрещен: можно редактировать только свой профиль"
      });
    }

    next();
  } catch (error) {
    console.error('Profile ownership middleware error:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка проверки прав доступа к профилю"
    });
  }
};

/**
 * Middleware для валидации данных клиента
 * @param {object} req - Объект запроса
 * @param {object} res - Объект ответа
 * @param {function} next - Следующий middleware
 */
export const validateCustomerData = (req, res, next) => {
  try {
    const { first_name, last_name, email, phone } = req.body;

    const errors = [];

    // Проверка имени
    if (!first_name || first_name.trim().length === 0) {
      errors.push('Имя обязательно');
    } else if (first_name.trim().length < 2) {
      errors.push('Имя должно содержать минимум 2 символа');
    }

    // Проверка фамилии
    if (!last_name || last_name.trim().length === 0) {
      errors.push('Фамилия обязательна');
    } else if (last_name.trim().length < 2) {
      errors.push('Фамилия должна содержать минимум 2 символа');
    }

    // Проверка email (если предоставлен)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Неверный формат email');
      }
    }

    // Проверка телефона (если предоставлен)
    if (phone) {
      // Французский формат телефона
      const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        errors.push('Неверный формат телефона (ожидается французский формат)');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        result: false,
        message: "Ошибки валидации",
        errors
      });
    }

    // Нормализуем данные
    req.body.first_name = first_name.trim();
    req.body.last_name = last_name.trim();
    if (email) req.body.email = email.toLowerCase().trim();
    if (phone) req.body.phone = phone.replace(/\s/g, '');

    next();
  } catch (error) {
    console.error('Customer data validation error:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка валидации данных"
    });
  }
};