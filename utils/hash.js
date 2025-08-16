// utils/hash.js
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Получаем ключ хеширования из переменных окружения
const HASH_KEY = process.env.HASH_KEY || 'default-hash-key';

/**
 * Хеширование пароля с солью
 * @param {string} password - Пароль для хеширования
 * @returns {Promise<string>} - Хешированный пароль
 */
export const hashString = async (password) => {
  try {
    if (!password) throw new Error('Пароль не может быть пустым');
    
    // Добавляем соль из переменной окружения
    const saltedPassword = password + HASH_KEY;
    
    // Генерируем соль и хешируем
    const saltRounds = 12;
    return await bcrypt.hash(saltedPassword, saltRounds);
  } catch (error) {
    console.error('Hash error:', error);
    throw new Error('Ошибка хеширования пароля');
  }
};

/**
 * Сравнение пароля с хешем
 * @param {string} password - Обычный пароль
 * @param {string} hashedPassword - Хешированный пароль
 * @returns {Promise<boolean>} - Результат сравнения
 */
export const comparePassword = async (password, hashedPassword) => {
  try {
    if (!password || !hashedPassword) return false;
    
    // Добавляем соль из переменной окружения
    const saltedPassword = password + HASH_KEY;
    
    return await bcrypt.compare(saltedPassword, hashedPassword);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

/**
 * Хеширование мета-информации (email для Meta модели)
 * @param {string} email - Email для хеширования
 * @returns {string} - SHA256 хеш email
 */
export const hashMeta = (email) => {
  try {
    if (!email) throw new Error('Email не может быть пустым');
    
    // Приводим к нижнему регистру и хешируем с солью
    const normalizedEmail = email.toLowerCase().trim();
    const saltedEmail = normalizedEmail + HASH_KEY;
    
    return crypto
      .createHash('sha256')
      .update(saltedEmail)
      .digest('hex');
  } catch (error) {
    console.error('Meta hash error:', error);
    throw new Error('Ошибка хеширования meta информации');
  }
};

/**
 * Генерация случайного токена
 * @param {number} length - Длина токена (по умолчанию 32)
 * @returns {string} - Случайный токен
 */
export const generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};