// utils/index.js - Главный файл для экспорта всех утилит

// Экспортируем функции хеширования
export { 
  hashString, 
  comparePassword, 
  hashMeta, 
  generateRandomToken 
} from './hash.js';

// Экспортируем функции шифрования
export { 
  cryptoString,
  cryptoString as encryptString, 
  decryptString, 
  isEncrypted 
} from './crypto.js';

// Экспортируем функции генерации паролей
export { 
  default as generatePassword,
  generateSimplePassword,
  generateStrongPassword 
} from './generatePassword.js';

// ================ ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ================

/**
 * Валидация email адреса
 * @param {string} email - Email для проверки
 * @returns {boolean} - Результат валидации
 */
export const validateEmail = (email) => {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
};

/**
 * Валидация номера телефона
 * @param {string} phone - Номер телефона для проверки
 * @returns {boolean} - Результат валидации
 */
export const validatePhone = (phone) => {
  if (!phone) return false;
  
  // Убираем все пробелы и специальные символы
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // Французские номера (начинающиеся с 0) или международные (начинающиеся с +33)
  const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/;
  
  return phoneRegex.test(cleanPhone);
};

/**
 * Нормализация номера телефона
 * @param {string} phone - Номер телефона
 * @returns {string} - Нормализованный номер
 */
export const normalizePhone = (phone) => {
  if (!phone) return '';
  
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Конвертируем французский формат в международный
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '+33' + cleanPhone.substring(1);
  }
  
  return cleanPhone;
};

/**
 * Создание безопасного имени файла
 * @param {string} filename - Исходное имя файла
 * @returns {string} - Безопасное имя файла
 */
export const sanitizeFilename = (filename) => {
  if (!filename) return '';
  
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

/**
 * Форматирование цены
 * @param {number} price - Цена в центах
 * @returns {string} - Отформатированная цена
 */
export const formatPrice = (price) => {
  if (typeof price !== 'number') return '0,00 €';
  
  return (price / 100).toFixed(2).replace('.', ',') + ' €';
};

/**
 * Генерация уникального ID
 * @returns {string} - Уникальный ID
 */
export const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * ✅ ВАЖНАЯ ФУНКЦИЯ: Расчет расстояния между координатами (Haversine formula)
 * Используется в Delivery и Address сервисах
 * @param {number} lat1 - Широта первой точки
 * @param {number} lng1 - Долгота первой точки  
 * @param {number} lat2 - Широта второй точки
 * @param {number} lng2 - Долгота второй точки
 * @returns {number} - Расстояние в километрах
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

