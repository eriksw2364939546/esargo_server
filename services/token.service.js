// services/token.service.js - ИСПРАВЛЕН ПОРЯДОК ФУНКЦИЙ
import jwt from 'jsonwebtoken';

// Получаем секретный ключ из переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Генерация JWT токена - ОБЪЯВЛЯЕМ ПЕРВОЙ!
 * @param {object} payload - Данные для токена
 * @param {string} expiresIn - Время жизни токена (по умолчанию 3d)
 * @returns {string} - JWT токен
 */
const generateJWTToken = (payload, expiresIn = '3d') => {
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
 * Верификация JWT токена - ОБЪЯВЛЯЕМ ВТОРОЙ!
 * @param {string} token - JWT токен
 * @returns {object} - Декодированные данные токена
 */
const verifyJWTToken = (token) => {
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
 * Универсальная функция верификации токена (для совместимости)
 * @param {string} token - JWT токен
 * @returns {object} - Декодированные данные токена
 */
const verifyToken = verifyJWTToken; // 🔧 ТЕПЕРЬ verifyJWTToken УЖЕ ОБЪЯВЛЕНА!

/**
 * Генерация токена для курьера
 * @param {object} courier - Объект курьера
 * @param {string} expiresIn - Время жизни токена
 * @returns {string} - JWT токен
 */
const generateCourierToken = (courier, expiresIn = '3d') => {
  console.log('🚚 GENERATING COURIER TOKEN:', {
    courier_provided: !!courier,
    user_id: courier ? (courier._id || courier.user_id) : null,
    email: courier ? courier.email : null,
    role: courier ? courier.role : null,
    expires_in: expiresIn
  });

  const payload = {
    user_id: courier._id || courier.user_id,
    _id: courier._id || courier.user_id,
    email: courier.email,
    role: 'courier',
    type: 'courier_access_token'
  };

  console.log('🚚 COURIER TOKEN PAYLOAD PREPARED:', payload);

  const token = generateJWTToken(payload, expiresIn);
  
  console.log('✅ COURIER TOKEN GENERATED:', {
    success: !!token,
    token_length: token ? token.length : 0,
    token_preview: token ? token.substring(0, 20) + '...' : null
  });

  return token;
};

/**
 * Генерация админского токена
 * @param {object} admin - Объект администратора
 * @param {string} expiresIn - Время жизни токена
 * @returns {string} - JWT токен
 */
const generateAdminToken = (admin, expiresIn = '3h') => {
  console.log('🔍 GENERATING ADMIN TOKEN:', {
    admin_provided: !!admin,
    admin_id: admin ? admin._id : null,
    admin_email: admin ? admin.email : null,
    admin_role: admin ? admin.role : null,
    expires_in: expiresIn
  });

  const payload = {
    user_id: admin._id,
    _id: admin._id,
    email: admin.email,
    role: 'admin',
    admin_role: admin.role,
    type: 'admin_access_token',
    full_name: admin.full_name,
    department: admin.contact_info?.department
  };

  console.log('🔍 ADMIN TOKEN PAYLOAD PREPARED:', payload);

  const token = generateJWTToken(payload, expiresIn);
  
  console.log('✅ ADMIN TOKEN GENERATED:', {
    success: !!token,
    token_length: token ? token.length : 0,
    token_preview: token ? token.substring(0, 20) + '...' : null
  });

  return token;
};

/**
 * Универсальный генератор токенов для обычных пользователей
 * @param {object} user - Объект пользователя
 * @param {string} expiresIn - Время жизни токена
 * @returns {string} - JWT токен
 */
const generateCustomerToken = (user, expiresIn = '3d') => {
  console.log('🔍 GENERATING UNIVERSAL TOKEN:', {
    user_provided: !!user,
    user_id: user ? (user._id || user.user_id) : null,
    email: user ? user.email : null,
    role: user ? user.role : null,
    admin_role: user ? user.admin_role : null,
    expires_in: expiresIn
  });

  let payload;
  
  if (user.role === 'admin' || user.admin_role) {
    // Админский токен
    payload = {
      user_id: user._id || user.user_id,
      _id: user._id || user.user_id,
      email: user.email,
      role: 'admin',
      admin_role: user.admin_role || user.role,
      type: 'admin_access_token',
      full_name: user.full_name
    };
  } else {
    // Обычный пользователь (customer/partner)
    payload = {
      user_id: user._id || user.user_id,
      email: user.email,
      role: user.role || 'customer',
      type: 'access_token'
    };
  }

  console.log('🔍 UNIVERSAL TOKEN PAYLOAD PREPARED:', payload);

  const token = generateJWTToken(payload, expiresIn);
  
  console.log('✅ UNIVERSAL TOKEN GENERATED:', {
    success: !!token,
    token_length: token ? token.length : 0,
    is_admin: payload.role === 'admin'
  });

  return token;
};

/**
 * Генерация refresh токена
 * @param {object} user - Объект пользователя
 * @returns {string} - Refresh токен
 */
const generateRefreshToken = (user) => {
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
const extractTokenFromHeader = (authHeader) => {
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
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};

export {
  generateJWTToken,        // Базовая функция - ПЕРВАЯ!
  verifyJWTToken,         // Верификация - ВТОРАЯ!
  verifyToken,            // Алиас - ТРЕТИЙ!
  generateCourierToken,   // Курьерский токен
  generateAdminToken,     // Админский токен
  generateCustomerToken,  // Универсальный токен
  generateRefreshToken,
  extractTokenFromHeader,
  decodeToken
};