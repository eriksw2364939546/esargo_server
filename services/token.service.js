// services/token.service.js - С ОТЛАДКОЙ
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
    console.log('🔍 GENERATING JWT TOKEN:', {
      payload_keys: Object.keys(payload),
      expires_in: expiresIn,
      has_secret: !!JWT_SECRET,
      secret_length: JWT_SECRET ? JWT_SECRET.length : 0
    });

    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload должен быть объектом');
    }

    const token = jwt.sign(payload, JWT_SECRET, { 
      expiresIn,
      issuer: 'esargo-app',
      audience: 'esargo-users'
    });

    console.log('✅ JWT TOKEN GENERATED:', {
      token_length: token.length,
      token_preview: token.substring(0, 20) + '...'
    });

    return token;
  } catch (error) {
    console.error('🚨 JWT GENERATION ERROR:', error);
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
  console.log('🔍 GENERATING CUSTOMER TOKEN:', {
    user_provided: !!user,
    user_id: user ? (user._id || user.user_id) : null,
    email: user ? user.email : null,
    role: user ? user.role : null,
    expires_in: expiresIn
  });

  const payload = {
    user_id: user._id || user.user_id,
    email: user.email,
    role: user.role || 'customer',
    type: 'access_token'
  };

  console.log('🔍 TOKEN PAYLOAD PREPARED:', payload);

  const token = generateJWTToken(payload, expiresIn);
  
  console.log('✅ CUSTOMER TOKEN GENERATED:', {
    success: !!token,
    token_length: token ? token.length : 0
  });

  return token;
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