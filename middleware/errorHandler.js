// middleware/errorHandler.js
import { errorLogger } from './logger.js';

/**
 * Middleware для обработки 404 ошибок (маршрут не найден)
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Маршрут не найден - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Основной обработчик ошибок
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Логируем ошибку
  errorLogger(`${error.message} - ${req.method} ${req.originalUrl}`, err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Некорректный ID ресурса';
    error = {
      message,
      statusCode: 400
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Дублирующиеся данные. Ресурс уже существует';
    error = {
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message: `Ошибка валидации: ${message}`,
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Недействительный токен авторизации';
    error = {
      message,
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Токен авторизации истек';
    error = {
      message,
      statusCode: 401
    };
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError') {
    const message = 'Ошибка подключения к базе данных';
    error = {
      message,
      statusCode: 503
    };
  }

  // Rate limiting errors
  if (err.message && err.message.includes('Too many requests')) {
    const message = 'Слишком много запросов. Попробуйте позже';
    error = {
      message,
      statusCode: 429
    };
  }

  // Определяем статус код
  const statusCode = error.statusCode || err.statusCode || 500;

  // Формируем ответ
  const response = {
    success: false,
    result: false,
    message: error.message || 'Внутренняя ошибка сервера',
    timestamp: new Date().toISOString()
  };

  // В режиме разработки добавляем stack trace
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error_details = {
      name: err.name,
      code: err.code,
      statusCode: err.statusCode
    };
  }

  // Возвращаем ошибку
  res.status(statusCode).json(response);
};

/**
 * Обработчик для асинхронных ошибок в маршрутах
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware для обработки CORS ошибок
 */
export const corsErrorHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    return res.status(200).end();
  }
  next();
};

/**
 * Middleware для обработки больших payload
 */
export const payloadErrorHandler = (err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      result: false,
      message: 'Размер запроса слишком большой',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

/**
 * Глобальный обработчик неперехваченных ошибок
 */
export const setupGlobalErrorHandlers = () => {
  // Неперехваченные исключения
  process.on('uncaughtException', (err) => {
    errorLogger('Неперехваченное исключение! Выключение приложения...', err);
    process.exit(1);
  });

  // Неперехваченные отклонения промисов
  process.on('unhandledRejection', (err, promise) => {
    errorLogger('Неперехваченное отклонение промиса! Выключение приложения...', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM получен. Корректное завершение работы...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT получен. Корректное завершение работы...');
    process.exit(0);
  });
};

export default {
  notFound,
  errorHandler,
  asyncHandler,
  corsErrorHandler,
  payloadErrorHandler,
  setupGlobalErrorHandlers
};