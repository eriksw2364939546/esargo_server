// middleware/security.middleware.js
// 🔐 КОМПЛЕКСНАЯ СИСТЕМА ЗАЩИТЫ ОТ ИНЪЕКЦИЙ

import validator from 'validator';
import mongoSanitize from 'express-mongo-sanitize';

/**
 * ================== БЛОК-ЛИСТЫ И ОПАСНЫЕ СИМВОЛЫ ==================
 */

// Опасные SQL команды (даже для MongoDB лучше блокировать)
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  /(\b(OR|AND)\s+\w+\s*=\s*\w+)/gi,
  /(--|\/\*|\*\/|;)/g,
  /(\b(WAITFOR|DELAY)\b)/gi,
  /(\$where|\$regex)/gi
];

// MongoDB инъекции
const MONGODB_INJECTION_PATTERNS = [
  /(\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$exists|\$regex|\$where)/gi,
  /(\{|\}|\[|\])/g, // JSON структуры в строках
  /(javascript:|data:|vbscript:)/gi
];

// XSS атаки
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /(javascript:|data:|vbscript:)/gi,
  /on\w+\s*=/gi, // onclick, onload, etc.
  /(<|>|&lt;|&gt;)/g
];

// Системные команды
const SYSTEM_COMMAND_PATTERNS = [
  /(\||&|;|`|\$\(|\$\{)/g,
  /(rm\s|del\s|format\s|shutdown\s|reboot\s)/gi,
  /(wget\s|curl\s|nc\s|netcat\s|telnet\s)/gi
];

/**
 * ================== ФУНКЦИИ САНИТИЗАЦИИ ==================
 */

/**
 * Глубокая санитизация строки от всех видов инъекций
 */
const deepSanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  let sanitized = str;
  
  // 1. Обрезаем пробелы
  sanitized = sanitized.trim();
  
  // 2. Проверяем на пустую строку
  if (!sanitized) return sanitized;
  
  // 3. Экранируем HTML (защита от XSS)
  sanitized = validator.escape(sanitized);
  
  // 4. Удаляем SQL инъекции
  SQL_INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // 5. Удаляем MongoDB инъекции
  MONGODB_INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // 6. Удаляем XSS
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // 7. Удаляем системные команды
  SYSTEM_COMMAND_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
};

/**
 * Специальная санитизация для email
 */
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  
  // Нормализуем email
  let sanitized = email.toLowerCase().trim();
  
  // Проверяем что это действительно email
  if (!validator.isEmail(sanitized)) {
    throw new Error('Некорректный формат email');
  }
  
  // Дополнительная защита
  sanitized = sanitized.replace(/[<>]/g, '');
  
  return sanitized;
};

/**
 * Специальная санитизация для паролей
 */
const sanitizePassword = (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Пароль обязателен');
  }
  
  // Проверяем длину
  if (password.length < 6) {
    throw new Error('Пароль должен содержать минимум 6 символов');
  }
  
  if (password.length > 128) {
    throw new Error('Пароль не может быть длиннее 128 символов');
  }
  
  // Блокируем опасные символы в паролях
  const dangerousChars = ['<', '>', '"', "'", '&', '`', ';', '|', '$'];
  if (dangerousChars.some(char => password.includes(char))) {
    throw new Error('Пароль содержит недопустимые символы: < > " \' & ` ; | $');
  }
  
  // Проверяем на SQL/MongoDB инъекции в пароле
  const sqlPattern = /(SELECT|INSERT|UPDATE|DELETE|DROP|\$ne|\$gt|javascript:|<script)/gi;
  if (sqlPattern.test(password)) {
    throw new Error('Пароль содержит недопустимые команды');
  }
  
  return password; // Пароль не санитизируем, только проверяем
};

/**
 * Рекурсивная санитизация объекта
 */
const deepSanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return deepSanitizeString(obj);
  }
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(deepSanitizeObject);
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Санитизируем ключи тоже
    const cleanKey = deepSanitizeString(key);
    sanitized[cleanKey] = deepSanitizeObject(value);
  }
  
  return sanitized;
};

/**
 * ================== MIDDLEWARE ФУНКЦИИ ==================
 */

/**
 * Основной middleware для защиты от всех видов инъекций
 */
export const securitySanitizer = (req, res, next) => {
  try {
    console.log('🔒 SECURITY SANITIZER - Start');
    
    // 1. Применяем express-mongo-sanitize (базовая защита)
    mongoSanitize.sanitize(req.body, {
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        console.warn(`🚨 MongoDB injection blocked: ${key}`);
      }
    });
    
    // 2. Глубокая санитизация body
    if (req.body && typeof req.body === 'object') {
      req.body = deepSanitizeObject(req.body);
    }
    
    // 3. Глубокая санитизация query параметров
    if (req.query && typeof req.query === 'object') {
      req.query = deepSanitizeObject(req.query);
    }
    
    // 4. Глубокая санитизация params
    if (req.params && typeof req.params === 'object') {
      req.params = deepSanitizeObject(req.params);
    }
    
    console.log('✅ SECURITY SANITIZER - Completed');
    next();
    
  } catch (error) {
    console.error('🚨 SECURITY SANITIZER ERROR:', error);
    return res.status(400).json({
      result: false,
      message: error.message || 'Данные содержат недопустимые символы',
      error_code: 'SECURITY_VIOLATION'
    });
  }
};

/**
 * Специальный middleware для защиты полей аутентификации
 */
export const authFieldsSanitizer = (req, res, next) => {
  try {
    console.log('🔒 AUTH FIELDS SANITIZER - Start');
    
    const { email, password, confirm_password } = req.body;
    
    // Санитизация email
    if (email) {
      try {
        req.body.email = sanitizeEmail(email);
      } catch (error) {
        return res.status(400).json({
          result: false,
          message: error.message
        });
      }
    }
    
    // Санитизация пароля
    if (password) {
      try {
        req.body.password = sanitizePassword(password);
      } catch (error) {
        return res.status(400).json({
          result: false,
          message: error.message
        });
      }
    }
    
    // Санитизация подтверждения пароля
    if (confirm_password) {
      try {
        req.body.confirm_password = sanitizePassword(confirm_password);
      } catch (error) {
        return res.status(400).json({
          result: false,
          message: 'Подтверждение пароля: ' + error.message
        });
      }
    }
    
    console.log('✅ AUTH FIELDS SANITIZER - Completed');
    next();
    
  } catch (error) {
    console.error('🚨 AUTH FIELDS SANITIZER ERROR:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка обработки данных аутентификации"
    });
  }
};

/**
 * Middleware для защиты от подозрительных заголовков
 */
export const headersSecurity = (req, res, next) => {
  try {
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-cluster-client-ip'
    ];
    
    suspiciousHeaders.forEach(header => {
      if (req.headers[header]) {
        const value = req.headers[header];
        if (typeof value === 'string' && 
            (value.includes('<') || value.includes('>') || value.includes('script'))) {
          console.warn(`🚨 Suspicious header blocked: ${header}=${value}`);
          delete req.headers[header];
        }
      }
    });
    
    next();
  } catch (error) {
    console.error('🚨 HEADERS SECURITY ERROR:', error);
    next();
  }
};

/**
 * Middleware для логирования подозрительных запросов
 */
export const securityLogger = (req, res, next) => {
  const originalBody = JSON.stringify(req.body);
  
  // Проверяем на подозрительные паттерны
  const suspiciousPatterns = [
    /\$ne|\$gt|\$lt/gi, // MongoDB инъекции
    /SELECT.*FROM/gi,   // SQL инъекции
    /<script/gi,        // XSS
    /javascript:/gi,    // XSS через URL
    /\|\||&&/g          // Логические операторы
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(originalBody) || 
    pattern.test(req.originalUrl)
  );
  
  if (isSuspicious) {
    console.warn('🚨 SUSPICIOUS REQUEST DETECTED:', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      body: originalBody,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * ================== ЭКСПОРТ ФУНКЦИЙ ==================
 */

export {
  deepSanitizeString,
  sanitizeEmail,
  sanitizePassword,
  deepSanitizeObject
};