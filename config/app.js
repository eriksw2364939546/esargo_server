module.exports = {
  // Настройки сервера
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // База данных
  MONGODB_URI:
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/armenian-restaurants',

  // API конфигурация
  API_PREFIX: '/api',

  // CORS настройки
  // Если в .env приходит строка с несколькими доменами через запятую, разбиваем в массив
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'],

  // Лимиты запросов
  REQUEST_LIMIT: '10mb',
  RATE_LIMIT_WINDOW: Number(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 минут
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 100,

  // Логирование
  LOG_RESPONSE_BODY: process.env.LOG_RESPONSE_BODY === 'true',

  // Безопасность
  HELMET_ENABLED: process.env.HELMET_ENABLED !== 'false',

  // Файлы (для будущего)
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
};

