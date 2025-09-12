// middleware/partnerAuth.middleware.js - ИСПРАВЛЕННЫЙ С ПОДТВЕРЖДЕНИЕМ ПАРОЛЯ
import jwt from "jsonwebtoken";
import { User, InitialPartnerRequest, PartnerProfile, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { verifyPartnerToken } from '../services/Partner/partner.auth.service.js';
import { validateFrenchPhone, validateSiret, validateFrenchIban, validateFrenchTva } from '../utils/validation.utils.js';

/**
 * ================== СТРОГАЯ ВАЛИДАЦИЯ EMAIL ==================
 */
const validateStrictEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return { valid: false, message: "Email обязателен" };
    }

    // 1. Базовая проверка длины
    if (email.length < 5 || email.length > 254) {
        return { valid: false, message: "Email должен быть от 5 до 254 символов" };
    }

    // 2. Строгий regex для email (RFC 5322 compliant)
    const strictEmailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])*@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])*\.[a-zA-Z]{2,}$/;
    
    if (!strictEmailRegex.test(email)) {
        return { valid: false, message: "Некорректный формат email. Используйте формат: name@domain.com" };
    }

    // 3. Проверка на недопустимые символы и последовательности
    const forbiddenPatterns = [
        /\{\{.*?\}\}/, // Template переменные {{...}}
        /\$\{.*?\}/, // JavaScript template literals ${...}
        /<%.*?%>/, // Template tags <%...%>
        /\[.*?\]/, // Квадратные скобки [...]
        /\s/, // Пробелы
        /[<>()[\]\\,;:"]/, // Специальные символы
        /\.\./, // Двойные точки
        /^\./, // Начинается с точки
        /\.$/, // Заканчивается точкой
        /@\./, // @ сразу после точки
        /\.@/, // Точка сразу перед @
        /@@/, // Двойные @
        /__{2,}/, // Множественные подчеркивания
        /--{2,}/, // Множественные дефисы
        /\.{2,}/ // Множественные точки
    ];

    for (const pattern of forbiddenPatterns) {
        if (pattern.test(email)) {
            if (pattern.toString().includes('{{')) {
                return { valid: false, message: "Email не может содержать template переменные типа {{timestamp}}" };
            } else if (pattern.toString().includes('$')) {
                return { valid: false, message: "Email не может содержать JavaScript template переменные" };
            } else if (pattern.toString().includes('<')) {
                return { valid: false, message: "Email не может содержать HTML теги или специальные символы" };
            } else {
                return { valid: false, message: "Email содержит недопустимые символы или последовательности" };
            }
        }
    }

    // 4. Проверка частей email
    const [localPart, domainPart] = email.split('@');
    
    if (!localPart || !domainPart) {
        return { valid: false, message: "Email должен содержать локальную часть и домен, разделенные @" };
    }

    if (localPart.length > 64) {
        return { valid: false, message: "Локальная часть email слишком длинная (максимум 64 символа)" };
    }

    if (domainPart.length > 255) {
        return { valid: false, message: "Доменная часть email слишком длинная (максимум 255 символов)" };
    }

    // 4.1. Дополнительная проверка локальной части на подозрительные паттерны
    const suspiciousLocalPartPatterns = [
        /\d{10,}/, // Длинные числа (автогенерированные timestamp)
        /timestamp/i, // Слово timestamp
        /random/i, // Слово random
        /guid/i, // Слово guid
        /uuid/i, // Слово uuid
        /temp/i, // Слово temp
        /test\d+/i, // test + числа
        /user\d{5,}/i, // user + длинные числа
        /\d{4,}\.\d{4,}/, // Паттерн чисел через точку
    ];

    for (const pattern of suspiciousLocalPartPatterns) {
        if (pattern.test(localPart)) {
            return { valid: false, message: "Email содержит подозрительные автогенерированные элементы. Используйте реальный email" };
        }
    }

    // 5. Проверка домена
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])*(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])*)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domainPart)) {
        return { valid: false, message: "Некорректный формат домена в email" };
    }

    return { valid: true, message: "Email корректен" };
};

/**
 * ================== ВАЛИДАЦИЯ ДАННЫХ РЕГИСТРАЦИИ ПАРТНЕРА ==================
 */
const validatePartnerRegistrationData = (req, res, next) => {
    try {
        const data = req.body;

        console.log('🔍 VALIDATE PARTNER DATA - Start:', {
            email: data.email,
            has_phone: !!data.phone,
            has_brand_name: !!data.brand_name,
            has_password: !!data.password,
            has_confirm_password: !!data.confirm_password,
            whatsapp_consent: data.whatsapp_consent
        });

        // Проверка обязательных полей
        const requiredFields = ['first_name', 'last_name', 'email', 'password', 'confirm_password', 'phone', 'business_name', 'category', 'address'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля отсутствуют: ${missingFields.join(', ')}`
            });
        }

        // Строгая валидация email
        const emailValidation = validateStrictEmail(data.email);
        if (!emailValidation.valid) {
            return res.status(400).json({
                result: false,
                message: emailValidation.message,
                field: 'email',
                examples: [
                    'pierre@gmail.com',
                    'restaurant.owner@hotmail.fr',
                    'business123@yahoo.com'
                ]
            });
        }

        // Валидация французского телефона
        if (!validateFrenchPhone(data.phone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон должен быть французским форматом",
                example: "+33 6 12 34 56 78 или 06 12 34 56 78"
            });
        }

        // Валидация пароля
        if (data.password.length < 6) {
            return res.status(400).json({
                result: false,
                message: "Пароль должен содержать минимум 6 символов"
            });
        }

        if (data.password.length > 128) {
            return res.status(400).json({
                result: false,
                message: "Пароль не может быть длиннее 128 символов"
            });
        }

        // ✅ ПРОВЕРКА ПОДТВЕРЖДЕНИЯ ПАРОЛЯ
        if (!data.confirm_password || data.confirm_password.trim().length === 0) {
            return res.status(400).json({
                result: false,
                message: "Подтверждение пароля обязательно"
            });
        }

        if (data.password !== data.confirm_password) {
            return res.status(400).json({
                result: false,
                message: "Пароли не совпадают"
            });
        }

        // Валидация категории
        const allowedCategories = [
            'restaurant', 'cafe', 'bakery', 'grocery', 'pharmacy', 
            'alcohol', 'flowers', 'convenience', 'other'
        ];
        
        if (!allowedCategories.includes(data.category)) {
            return res.status(400).json({
                result: false,
                message: "Недопустимая категория",
                allowed_categories: allowedCategories
            });
        }

        // ✅ НОРМАЛИЗАЦИЯ ДАННЫХ
        req.body.first_name = data.first_name.trim();
        req.body.last_name = data.last_name.trim();
        req.body.email = data.email.toLowerCase().trim();
        req.body.phone = data.phone.replace(/\s/g, '');
        
        // ✅ УБИРАЕМ confirm_password из req.body перед передачей в контроллер
        delete req.body.confirm_password;

        console.log('✅ PARTNER REGISTRATION DATA VALIDATION PASSED');
        next();

    } catch (error) {
        console.error('🚨 VALIDATE PARTNER DATA ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка валидации данных регистрации"
        });
    }
};

/**
 * ================== ВАЛИДАЦИЯ ЮРИДИЧЕСКИХ ДАННЫХ ==================
 */
const validateLegalInfoData = (req, res, next) => {
    try {
        const data = req.body;

        console.log('🔍 VALIDATE LEGAL DATA - Start:', {
            has_siret: !!data.legal_data?.siret_number,
            has_iban: !!data.bank_details?.iban,
            has_legal_name: !!data.legal_data?.legal_name,
            has_legal_form: !!data.legal_data?.legal_form,
            has_documents: !!data.documents
        });

        // Проверка обязательных полей
        const requiredFields = {
            'legal_data.legal_name': 'Название юридического лица',
            'legal_data.siret_number': 'SIRET номер',
            'legal_data.legal_form': 'Форма юридического лица',
            'legal_data.legal_address': 'Юридический адрес',
            'legal_data.legal_representative': 'Представитель юридического лица',
            'bank_details.iban': 'IBAN',
            'bank_details.bic': 'BIC код',
            'legal_contact.email': 'Email юридического лица',
            'legal_contact.phone': 'Телефон юридического лица'
        };

        const missingFields = [];
        for (const [fieldPath, fieldName] of Object.entries(requiredFields)) {
            const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], data);
            if (!value || (typeof value === 'string' && value.trim().length === 0)) {
                missingFields.push(fieldName);
            }
        }

        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля отсутствуют: ${missingFields.join(', ')}`
            });
        }

        // Валидация SIRET номера
        if (!validateSiret(data.legal_data.siret_number)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный SIRET номер",
                format: "14 цифр, например: 12345678901234"
            });
        }

        // Валидация французского IBAN
        if (!validateFrenchIban(data.bank_details.iban)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный французский IBAN",
                format: "Должен начинаться с FR, например: FR1420041010050500013M02606"
            });
        }

        // Валидация TVA номера (если указан)
        if (data.legal_data.tva_number && !validateFrenchTva(data.legal_data.tva_number)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный TVA номер",
                format: "Формат: FR + 11 цифр, например: FR12345678901"
            });
        }

        // Валидация email юридического лица
        const emailValidation = validateStrictEmail(data.legal_contact.email);
        if (!emailValidation.valid) {
            return res.status(400).json({
                result: false,
                message: "Некорректный email юридического лица: " + emailValidation.message
            });
        }

        // Валидация телефона юр. лица
        if (!validateFrenchPhone(data.legal_contact.phone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон юр. лица должен быть французским"
            });
        }

        // Валидация формы юридического лица
        const allowedLegalForms = [
            'Auto-entrepreneur', 'SASU', 'SARL', 'SAS', 'EURL', 
            'SA', 'SNC', 'SCI', 'SELARL', 'Micro-entreprise', 
            'EI', 'EIRL', 'Autre'
        ];
        
        if (data.legal_data.legal_form && !allowedLegalForms.includes(data.legal_data.legal_form)) {
            return res.status(400).json({
                result: false,
                message: "Недопустимая форма юридического лица",
                allowed_forms: allowedLegalForms
            });
        }

        console.log('✅ LEGAL DATA VALIDATION PASSED');
        next();

    } catch (error) {
        console.error('🚨 VALIDATE LEGAL DATA ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка валидации юридических данных"
        });
    }
};

/**
 * ================== ПРОВЕРКА ТОКЕНА ПАРТНЕРА ==================
 */
const checkPartnerToken = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await verifyPartnerToken(token);
        
        if (!data.success) {
            return res.status(data.statusCode || 401).json({
                message: data.message,
                result: false
            });
        }

        console.log('✅ TOKEN CHECK PASSED');
        req.partner = data.partner;
        req.user = data.partner;
        req.metaInfo = data.metaInfo;

        next();

    } catch (error) {
        console.error('🚨 TOKEN CHECK ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * ================== ПРОВЕРКА СТАТУСА ПАРТНЕРА ==================
 */
const checkPartnerStatus = (allowedStatuses) => {
    return async (req, res, next) => {
        try {
            const { partner } = req;

            const request = await InitialPartnerRequest.findOne({ 
                user_id: partner._id 
            });

            if (!request) {
                return res.status(404).json({
                    message: "Заявка партнера не найдена",
                    result: false
                });
            }

            if (!allowedStatuses.includes(request.status)) {
                return res.status(403).json({
                    message: `Действие недоступно. Требуемые статусы: ${allowedStatuses.join(', ')}. Текущий статус: ${request.status}`,
                    result: false
                });
            }

            console.log('✅ STATUS CHECK PASSED');
            req.partnerRequest = request;
            next();

        } catch (error) {
            console.error('🚨 STATUS CHECK ERROR:', error);
            res.status(500).json({ 
                message: "Access denied! Server error!", 
                result: false, 
                error: error.message 
            });
        }
    };
};

/**
 * ================== ТРЕБОВАНИЕ ПРОФИЛЯ ПАРТНЕРА ==================
 */
const requirePartnerProfile = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await verifyPartnerToken(token);
        if (!data.success) {
            return res.status(data.statusCode).json({
                message: data.message,
                result: false
            });
        }

        const partner = data.partner;
        const partnerProfile = await PartnerProfile.findOne({ user_id: partner._id });

        if (!partnerProfile) {
            return res.status(404).json({
                message: "Profile must be created first.",
                result: false
            });
        }

        console.log('✅ PROFILE CHECK PASSED');
        req.partner = partner;
        req.user = partner;
        req.metaInfo = data.metaInfo;
        req.partnerProfile = partnerProfile;

        next();

    } catch (error) {
        console.error('🚨 PROFILE CHECK ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * ================== ПРОВЕРКА ДОСТУПА К ПРОФИЛЮ ==================
 */
const checkProfileAccess = async (req, res, next) => {
    try {
        const { id } = req.params;
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await verifyPartnerToken(token);
        if (!data.success) {
            return res.status(data.statusCode).json({
                message: data.message,
                result: false
            });
        }

        const partner = data.partner;
        const profile = await PartnerProfile.findById(id);

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found!",
                result: false
            });
        }

        if (profile.user_id.toString() !== partner._id.toString()) {
            return res.status(403).json({
                message: "Access denied! You can only access your own profile!",
                result: false
            });
        }

        req.partner = partner;
        req.user = partner;
        req.metaInfo = data.metaInfo;
        req.partnerProfile = profile;

        next();

    } catch (error) {
        console.error('🚨 PROFILE ACCESS CHECK ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

export {
    checkPartnerToken,
    checkPartnerStatus,
    requirePartnerProfile,
    checkProfileAccess,
    validatePartnerRegistrationData,
    validateLegalInfoData
};