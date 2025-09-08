// utils/validation.utils.js - ЦЕНТРАЛИЗОВАННЫЕ ВАЛИДАЦИИ

/**
 * ================== ВАЛИДАЦИЯ ФРАНЦУЗСКОГО ТЕЛЕФОНА ==================
 */
export const validateFrenchPhone = (phone) => {
    if (!phone) return false;
    const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
    const cleanPhone = phone.replace(/\s/g, '');
    return frenchPhoneRegex.test(cleanPhone);
};

/**
 * ================== ВАЛИДАЦИЯ SIRET ==================
 */
export const validateSiret = (siret) => {
    if (!siret) return false;
    const cleaned = siret.replace(/\s/g, '');
    const siretRegex = /^\d{14}$/;
    return siretRegex.test(cleaned);
};

/**
 * ================== ВАЛИДАЦИЯ ФРАНЦУЗСКОГО IBAN ==================
 */
export const validateFrenchIban = (iban) => {
    if (!iban) return false;
    const cleaned = iban.replace(/\s/g, '');
    const frenchIbanRegex = /^FR\d{2}[A-Z0-9]{23}$/;
    return frenchIbanRegex.test(cleaned);
};

/**
 * ================== ВАЛИДАЦИЯ ФРАНЦУЗСКОГО TVA ==================
 */
export const validateFrenchTva = (tva) => {
    if (!tva) return true; // TVA опционально
    const cleaned = tva.replace(/\s/g, '');
    const frenchTvaRegex = /^FR\d{11}$/;
    return frenchTvaRegex.test(cleaned);
};

/**
 * ================== ВАЛИДАЦИЯ EMAIL ==================
 */
export const validateEmail = (email) => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * ================== ВАЛИДАЦИЯ ПАРОЛЯ ==================
 */
export const validatePassword = (password) => {
    if (!password) return false;
    return password.length >= 6;
};

/**
 * ================== ВАЛИДАЦИЯ ФРАНЦУЗСКИХ ЮРИДИЧЕСКИХ ФОРМ ==================
 */
export const validateLegalForm = (legalForm) => {
    const allowedLegalForms = [
        'Auto-entrepreneur', 'SASU', 'SARL', 'SAS', 'EURL', 
        'SA', 'SNC', 'SCI', 'SELARL', 'Micro-entreprise', 
        'EI', 'EIRL', 'Autre'
    ];
    
    return allowedLegalForms.includes(legalForm);
};

/**
 * ================== ВАЛИДАЦИЯ КАТЕГОРИЙ ПАРТНЕРОВ ==================
 */
export const validatePartnerCategory = (category) => {
    const allowedCategories = [
        'restaurant', 'cafe', 'bakery', 'grocery', 'pharmacy', 
        'alcohol', 'flowers', 'convenience', 'other'
    ];
    
    return allowedCategories.includes(category);
};

/**
 * ================== ВАЛИДАЦИЯ КООРДИНАТ ==================
 */
export const validateCoordinates = (lat, lng) => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    return !isNaN(latitude) && 
           !isNaN(longitude) && 
           latitude >= -90 && 
           latitude <= 90 && 
           longitude >= -180 && 
           longitude <= 180;
};

/**
 * ================== ВАЛИДАЦИЯ ОБЪЕКТА MONGODB ID ==================
 */
export const validateMongoId = (id) => {
    if (!id) return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * ================== ВАЛИДАЦИЯ СУММЫ ДЕНЕГ ==================
 */
export const validateAmount = (amount) => {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount > 0 && numAmount <= 9999.99;
};

/**
 * ================== ВАЛИДАЦИЯ СТАТУСОВ ЗАКАЗОВ ==================
 */
export const validateOrderStatus = (status) => {
    const allowedStatuses = [
        'pending', 'confirmed', 'preparing', 'ready', 
        'picked_up', 'delivering', 'delivered', 
        'cancelled', 'refunded'
    ];
    return allowedStatuses.includes(status);
};

/**
 * ================== ВАЛИДАЦИЯ СТАТУСОВ ПАРТНЕРОВ ==================
 */
export const validatePartnerStatus = (status) => {
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    return allowedStatuses.includes(status);
};

/**
 * ================== ВАЛИДАЦИЯ СТАТУСОВ КУРЬЕРОВ ==================
 */
export const validateCourierStatus = (status) => {
    const allowedStatuses = ['pending', 'approved', 'rejected', 'active', 'inactive'];
    return allowedStatuses.includes(status);
};

/**
 * ================== ВАЛИДАЦИЯ ТИПОВ ТРАНСПОРТА ==================
 */
export const validateVehicleType = (vehicleType) => {
    const allowedTypes = ['bike', 'motorbike', 'car'];
    return allowedTypes.includes(vehicleType);
};

/**
 * ================== ВАЛИДАЦИЯ РОЛЕЙ ПОЛЬЗОВАТЕЛЕЙ ==================
 */
export const validateUserRole = (role) => {
    const allowedRoles = ['customer', 'partner', 'courier', 'admin'];
    return allowedRoles.includes(role);
};

/**
 * ================== ВАЛИДАЦИЯ НОМЕРА ЗАКАЗА ==================
 */
export const validateOrderNumber = (orderNumber) => {
    if (!orderNumber) return false;
    // Формат: ESG-YYYYMMDD-XXXXX (например: ESG-20241209-00001)
    const orderRegex = /^ESG-\d{8}-\d{5}$/;
    return orderRegex.test(orderNumber);
};

/**
 * ================== ВАЛИДАЦИЯ URL ДОКУМЕНТОВ ==================
 */
export const validateDocumentUrl = (url) => {
    if (!url) return false;
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
        return false;
    }
};

/**
 * ================== ВАЛИДАЦИЯ РЕЙТИНГА ==================
 */
export const validateRating = (rating) => {
    const numRating = parseFloat(rating);
    return !isNaN(numRating) && numRating >= 1 && numRating <= 5;
};

/**
 * ================== ВАЛИДАЦИЯ ВРЕМЕНИ ДОСТАВКИ ==================
 */
export const validateDeliveryTime = (minutes) => {
    const numMinutes = parseInt(minutes);
    return !isNaN(numMinutes) && numMinutes >= 10 && numMinutes <= 120;
};

/**
 * ================== ВАЛИДАЦИЯ КОЛИЧЕСТВА ТОВАРА ==================
 */
export const validateQuantity = (quantity) => {
    const numQuantity = parseInt(quantity);
    return !isNaN(numQuantity) && numQuantity >= 1 && numQuantity <= 99;
};

/**
 * ================== ВАЛИДАЦИЯ ЗОНЫ ДОСТАВКИ ==================
 */
export const validateDeliveryZone = (zone) => {
    const numZone = parseInt(zone);
    return !isNaN(numZone) && [1, 2].includes(numZone);
};

/**
 * ================== ВАЛИДАЦИЯ НОМЕРА ТЕЛЕФОНА (ОБЩАЯ) ==================
 */
export const validatePhoneNumber = (phone) => {
    if (!phone) return false;
    // Международный формат
    const phoneRegex = /^(\+\d{1,3}[- ]?)?\d{10}$/;
    const cleanPhone = phone.replace(/[\s-]/g, '');
    return phoneRegex.test(cleanPhone);
};

/**
 * ================== ВАЛИДАЦИЯ ДЛИНЫ ТЕКСТА ==================
 */
export const validateTextLength = (text, minLength = 0, maxLength = 1000) => {
    if (!text && minLength === 0) return true;
    if (!text) return false;
    return text.length >= minLength && text.length <= maxLength;
};

/**
 * ================== ВАЛИДАЦИЯ МАССИВА ==================
 */
export const validateArray = (arr, minLength = 0, maxLength = 100) => {
    if (!Array.isArray(arr)) return false;
    return arr.length >= minLength && arr.length <= maxLength;
};

/**
 * ================== ВАЛИДАЦИЯ ВОЗРАСТА ==================
 */
export const validateAge = (age) => {
    const numAge = parseInt(age);
    return !isNaN(numAge) && numAge >= 18 && numAge <= 99;
};

/**
 * ================== КОМПЛЕКСНЫЕ ВАЛИДАЦИИ ==================
 */

/**
 * Валидация полного профиля партнера
 */
export const validatePartnerProfile = (profile) => {
    const errors = [];
    
    if (!validateTextLength(profile.business_name, 2, 100)) {
        errors.push('Название бизнеса должно быть от 2 до 100 символов');
    }
    
    if (!validatePartnerCategory(profile.category)) {
        errors.push('Неверная категория партнера');
    }
    
    if (profile.phone && !validateFrenchPhone(profile.phone)) {
        errors.push('Неверный формат французского телефона');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Валидация данных заказа
 */
export const validateOrderData = (orderData) => {
    const errors = [];
    
    if (!validateAmount(orderData.total_price)) {
        errors.push('Неверная сумма заказа');
    }
    
    if (!validateCoordinates(orderData.delivery_lat, orderData.delivery_lng)) {
        errors.push('Неверные координаты доставки');
    }
    
    if (!validateArray(orderData.items, 1, 50)) {
        errors.push('Заказ должен содержать от 1 до 50 товаров');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Валидация регистрационных данных
 */
export const validateRegistrationData = (userData, userType) => {
    const errors = [];
    
    if (!validateEmail(userData.email)) {
        errors.push('Неверный формат email');
    }
    
    if (!validatePassword(userData.password)) {
        errors.push('Пароль должен содержать минимум 6 символов');
    }
    
    if (!validateTextLength(userData.first_name, 2, 50)) {
        errors.push('Имя должно быть от 2 до 50 символов');
    }
    
    if (!validateTextLength(userData.last_name, 2, 50)) {
        errors.push('Фамилия должна быть от 2 до 50 символов');
    }
    
    if (userType === 'partner' && !validateFrenchPhone(userData.phone)) {
        errors.push('Требуется французский номер телефона');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * ================== BIC ВАЛИДАЦИЯ (ДОПОЛНИТЕЛЬНО) ==================
 */
export const validateBic = (bic) => {
    if (!bic) return true; // BIC опционально
    const cleanBic = bic.replace(/\s/g, '');
    // BIC может быть 8 или 11 символов
    const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    return bicRegex.test(cleanBic);
};

/**
 * ================== ВАЛИДАЦИЯ ПРОЦЕНТОВ ==================
 */
export const validatePercentage = (percentage) => {
    const numPercentage = parseFloat(percentage);
    return !isNaN(numPercentage) && numPercentage >= 0 && numPercentage <= 100;
};

/**
 * ================== ВАЛИДАЦИЯ ЦЕНЫ ТОВАРА ==================
 */
export const validateProductPrice = (price) => {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice >= 0.01 && numPrice <= 999.99;
};

/**
 * ================== ВАЛИДАЦИЯ РАССТОЯНИЯ ==================
 */
export const validateDistance = (distance) => {
    const numDistance = parseFloat(distance);
    return !isNaN(numDistance) && numDistance >= 0 && numDistance <= 50; // до 50км
};

/**
 * ================== ВАЛИДАЦИЯ ВРЕМЕНИ (ЧАСЫ:МИНУТЫ) ==================
 */
export const validateTimeFormat = (time) => {
    if (!time) return false;
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
};

/**
 * ================== ВАЛИДАЦИЯ ДНЕЙ НЕДЕЛИ ==================
 */
export const validateWeekDay = (day) => {
    const allowedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return allowedDays.includes(day.toLowerCase());
};

/**
 * ================== ВАЛИДАЦИЯ ЯЗЫКА ==================
 */
export const validateLanguage = (language) => {
    const allowedLanguages = ['fr', 'en', 'ru'];
    return allowedLanguages.includes(language);
};

/**
 * ================== ВАЛИДАЦИЯ МЕТОДОВ ОПЛАТЫ ==================
 */
export const validatePaymentMethod = (method) => {
    const allowedMethods = ['card', 'cash', 'online'];
    return allowedMethods.includes(method);
};