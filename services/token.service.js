// services/token.service.js
import jwt from 'jsonwebtoken';

// Получаем секретный ключ из переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Генерация JWT токена
 * @param {object} payload - Данные для токена
 * @param {string} expiresIn - Время жизни токена (по умолчанию 3d)
 * @returns {string} - JWT токен
 */
export const generateJWTToken = (payload, expiresIn = '3d') => {
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload должен быть объектом');
    }

    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn,
      issuer: 'esargo-app',
      audience: 'esargo-users'
    });
  } catch (error) {
    console.error('JWT generation error:', error);
    throw new Error('Ошибка генерации токена');
  }
};

/**
 * Верификация JWT токена
 * @param {string} token - JWT токен
 * @returns {object} - Декодированные данные токена
 */
export const verifyJWTToken = (token) => {
  try {
    if (!token) {
      throw new Error('Токен не предоставлен');
    }

    return jwt.verify(token, JWT_SECRET, {
      issuer: 'esargo-app',
      audience: 'esargo-users'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Токен истек');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Недействительный токен');
    }
    
    console.error('JWT verification error:', error);
    throw new Error('Ошибка верификации токена');
  }
};

/**
 * Генерация токена для клиента
 * @param {object} user - Объект пользователя
 * @param {string} expiresIn - Время жизни токена
 * @returns {string} - JWT токен
 */
export const generateCustomerToken = (user, expiresIn = '30d') => {
  const payload = {
    user_id: user._id,
    email: user.email,
    role: user.role || 'customer',
    type: 'access_token'
  };

  return generateJWTToken(payload, expiresIn);
};

/**
 * Генерация refresh токена
 * @param {object} user - Объект пользователя
 * @returns {string} - Refresh токен
 */
export const generateRefreshToken = (user) => {
  const payload = {
    user_id: user._id,
    type: 'refresh_token'
  };

  return generateJWTToken(payload, '7d');
};

/**
 * Извлечение токена из заголовка Authorization
 * @param {string} authHeader - Заголовок авторизации
 * @returns {string|null} - Токен или null
 */
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  
  // Формат: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Декодирование токена без верификации (для отладки)
 * @param {string} token - JWT токен
 * @returns {object|null} - Декодированные данные или null
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};