// utils/generatePassword.js
import crypto from 'crypto';

/**
 * Генерация случайного пароля
 * @param {number} length - Длина пароля (по умолчанию 12)
 * @param {object} options - Настройки генерации
 * @returns {string} - Сгенерированный пароль
 */
const generatePassword = (length = 12, options = {}) => {
  const defaultOptions = {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSpecialChars: true,
    excludeSimilar: true, // Исключить похожие символы (0, O, l, 1, I)
    minUppercase: 1,
    minLowercase: 1,
    minNumbers: 1,
    minSpecialChars: 1
  };

  const config = { ...defaultOptions, ...options };

  // Определяем наборы символов
  let lowercase = 'abcdefghijklmnopqrstuvwxyz';
  let uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let numbers = '0123456789';
  let specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Исключаем похожие символы если нужно
  if (config.excludeSimilar) {
    lowercase = lowercase.replace(/[il]/g, '');
    uppercase = uppercase.replace(/[IOL]/g, '');
    numbers = numbers.replace(/[01]/g, '');
    specialChars = specialChars.replace(/[|]/g, '');
  }

  // Формируем доступные символы
  let availableChars = '';
  let requiredChars = '';

  if (config.includeLowercase) {
    availableChars += lowercase;
    // Добавляем минимальное количество строчных букв
    for (let i = 0; i < config.minLowercase; i++) {
      requiredChars += getRandomChar(lowercase);
    }
  }

  if (config.includeUppercase) {
    availableChars += uppercase;
    // Добавляем минимальное количество заглавных букв
    for (let i = 0; i < config.minUppercase; i++) {
      requiredChars += getRandomChar(uppercase);
    }
  }

  if (config.includeNumbers) {
    availableChars += numbers;
    // Добавляем минимальное количество цифр
    for (let i = 0; i < config.minNumbers; i++) {
      requiredChars += getRandomChar(numbers);
    }
  }

  if (config.includeSpecialChars) {
    availableChars += specialChars;
    // Добавляем минимальное количество специальных символов
    for (let i = 0; i < config.minSpecialChars; i++) {
      requiredChars += getRandomChar(specialChars);
    }
  }

  // Проверяем, что у нас есть доступные символы
  if (!availableChars) {
    throw new Error('Нет доступных символов для генерации пароля');
  }

  // Генерируем оставшиеся символы
  const remainingLength = length - requiredChars.length;
  let remainingChars = '';

  for (let i = 0; i < remainingLength; i++) {
    remainingChars += getRandomChar(availableChars);
  }

  // Объединяем и перемешиваем символы
  const allChars = requiredChars + remainingChars;
  return shuffleString(allChars);
};

/**
 * Получение случайного символа из строки
 * @param {string} chars - Строка символов
 * @returns {string} - Случайный символ
 */
const getRandomChar = (chars) => {
  const randomIndex = crypto.randomInt(0, chars.length);
  return chars[randomIndex];
};

/**
 * Перемешивание символов в строке
 * @param {string} str - Исходная строка
 * @returns {string} - Перемешанная строка
 */
const shuffleString = (str) => {
  const array = str.split('');
  
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  
  return array.join('');
};

/**
 * Генерация простого пароля (для тестирования)
 * @returns {string} - Простой пароль
 */
export const generateSimplePassword = () => {
  return generatePassword(8, {
    includeSpecialChars: false,
    excludeSimilar: true
  });
};

/**
 * Генерация сложного пароля (для продакшена)
 * @returns {string} - Сложный пароль
 */
export const generateStrongPassword = () => {
  return generatePassword(16, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSpecialChars: true,
    minUppercase: 2,
    minLowercase: 2,
    minNumbers: 2,
    minSpecialChars: 2
  });
};

export default generatePassword;