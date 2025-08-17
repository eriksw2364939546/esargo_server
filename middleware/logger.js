// middleware/logger.js
import chalk from 'chalk';

/**
 * Логгер для запуска приложения
 * @param {string} message - Сообщение для логирования
 */
export const startupLogger = (message) => {
  const timestamp = new Date().toISOString();
  console.log(chalk.green(`[${timestamp}] ${message}`));
};

/**
 * Логгер для ошибок
 * @param {string} message - Сообщение об ошибке
 * @param {Error} error - Объект ошибки (опционально)
 */
export const errorLogger = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.error(chalk.red(`[${timestamp}] ERROR: ${message}`));
  if (error) {
    console.error(chalk.red(error.stack));
  }
};

/**
 * Логгер для предупреждений
 * @param {string} message - Сообщение предупреждения
 */
export const warningLogger = (message) => {
  const timestamp = new Date().toISOString();
  console.warn(chalk.yellow(`[${timestamp}] WARNING: ${message}`));
};

/**
 * Логгер для информационных сообщений
 * @param {string} message - Информационное сообщение
 */
export const infoLogger = (message) => {
  const timestamp = new Date().toISOString();
  console.info(chalk.blue(`[${timestamp}] INFO: ${message}`));
};

/**
 * Логгер для отладки
 * @param {string} message - Сообщение отладки
 * @param {any} data - Дополнительные данные (опционально)
 */
export const debugLogger = (message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toISOString();
    console.log(chalk.magenta(`[${timestamp}] DEBUG: ${message}`));
    if (data) {
      console.log(chalk.magenta(JSON.stringify(data, null, 2)));
    }
  }
};

/**
 * Middleware для логирования HTTP запросов
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Логируем входящий запрос
  console.log(
    chalk.cyan(`[${timestamp}] ${req.method} ${req.originalUrl} - ${req.ip}`)
  );
  
  // Перехватываем окончание ответа
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? chalk.red : 
                       res.statusCode >= 300 ? chalk.yellow : chalk.green;
    
    console.log(
      statusColor(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`)
    );
    
    originalSend.call(this, data);
  };
  
  next();
};

export default {
  startupLogger,
  errorLogger,
  warningLogger,
  infoLogger,
  debugLogger,
  requestLogger
};