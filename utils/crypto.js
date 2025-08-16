// utils/crypto.js
import CryptoJS from 'crypto-js';

// Получаем ключ шифрования из переменных окружения
const CRYPTO_SECRET = process.env.CRYPTO_SECRET || 'default-crypto-secret-key';

/**
 * Шифрование строки
 * @param {string} text - Текст для шифрования
 * @returns {string} - Зашифрованный текст
 */
export const cryptoString = (text) => {
  try {
    if (!text) return '';
    return CryptoJS.AES.encrypt(text.toString(), CRYPTO_SECRET).toString();
  } catch (error) {
    console.error('Crypto encryption error:', error);
    throw new Error('Ошибка шифрования данных');
  }
};

/**
 * Расшифровка строки
 * @param {string} encryptedText - Зашифрованный текст
 * @returns {string} - Расшифрованный текст
 */
export const decryptString = (encryptedText) => {
  try {
    if (!encryptedText) return '';
    const bytes = CryptoJS.AES.decrypt(encryptedText, CRYPTO_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Crypto decryption error:', error);
    throw new Error('Ошибка расшифровки данных');
  }
};

/**
 * Проверка, является ли строка зашифрованной
 * @param {string} text - Проверяемый текст
 * @returns {boolean} - true если зашифрован
 */
export const isEncrypted = (text) => {
  try {
    if (!text) return false;
    const decrypted = decryptString(text);
    return decrypted !== text;
  } catch (error) {
    return false;
  }
};