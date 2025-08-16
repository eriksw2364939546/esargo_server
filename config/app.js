// config/app.js (исправленный - ES6 modules)

const config = {
  // Основные настройки
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,
  API_PREFIX: process.env.API_PREFIX || '/api',

  // База данных
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/esargo',

  // CORS настройки
  CORS_ORIGIN: process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',') : 
    ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],

  // Безопасность
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  HASH_KEY: process.env.HASH_KEY || 'your-hash-key',
  CRYPTO_SECRET: process.env.CRYPTO_SECRET || 'your-crypto-key',

  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 минут
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 запросов за окно

  // Request limits
  REQUEST_LIMIT: process.env.REQUEST_LIMIT || '10mb',

  // Security middleware
  HELMET_ENABLED: process.env.HELMET_ENABLED !== 'false',

  // Логирование
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'app.log',

  // Email (если понадобится)
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,

  // Файлы (если понадобится)
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB

  // Режим разработки
  isDevelopment: function() {
    return this.NODE_ENV === 'development';
  },

  // Режим продакшена
  isProduction: function() {
    return this.NODE_ENV === 'production';
  }
};

export default config;