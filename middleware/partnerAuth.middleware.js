// middleware/partnerAuth.middleware.js - ИСПРАВЛЕННЫЙ БЕЗ ДУБЛИРОВАНИЯ
import jwt from "jsonwebtoken";
import { User, InitialPartnerRequest, PartnerProfile, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { verifyPartnerToken } from '../services/Partner/partner.auth.service.js';
import { validateFrenchPhone, validateSiret, validateFrenchIban, validateFrenchTva } from '../utils/validation.utils.js';

/**
 * ================== ВАЛИДАЦИЯ ДАННЫХ РЕГИСТРАЦИИ ==================
 */
const validatePartnerRegistrationData = (req, res, next) => {
    try {
        const data = req.body;

        console.log('🔍 VALIDATE PARTNER DATA - Start:', {
            has_phone: !!data.phone,
            has_brand_name: !!data.brand_name,
            whatsapp_consent: data.whatsapp_consent
        });

        // Проверка обязательных полей
        const requiredFields = ['first_name', 'last_name', 'email', 'password', 'phone', 'business_name', 'category', 'address'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля отсутствуют: ${missingFields.join(', ')}`
            });
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный формат email"
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
            legal_form: data.legal_data?.legal_form
        });

        // Проверка структуры данных
        if (!data.legal_data || !data.bank_details || !data.legal_contact) {
            return res.status(400).json({
                result: false,
                message: "Требуются секции: legal_data, bank_details, legal_contact"
            });
        }

        // Проверка обязательных полей
        const requiredLegalFields = ['business_name', 'siret_number', 'legal_address', 'legal_representative'];
        const missingLegalFields = requiredLegalFields.filter(field => !data.legal_data[field]);
        
        if (missingLegalFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные юридические поля: ${missingLegalFields.join(', ')}`
            });
        }

        // Валидация SIRET
        if (!validateSiret(data.legal_data.siret_number)) {
            return res.status(400).json({
                result: false,
                message: "SIRET должен содержать 14 цифр",
                example: "123 456 789 00014"
            });
        }

        // Валидация IBAN
        if (!validateFrenchIban(data.bank_details.iban)) {
            return res.status(400).json({
                result: false,
                message: "IBAN должен быть французским",
                example: "FR76 3000 6000 0112 3456 7890 189"
            });
        }

        // Валидация TVA (если указан)
        if (data.legal_data.tva_number && !validateFrenchTva(data.legal_data.tva_number)) {
            return res.status(400).json({
                result: false,
                message: "TVA должен быть французским форматом",
                example: "FR12 345678912"
            });
        }

        // Валидация email юр. лица
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.legal_contact.email)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный email юридического лица"
            });
        }

        // Валидация телефона юр. лица (если указан)
        if (data.legal_contact.phone && !validateFrenchPhone(data.legal_contact.phone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон юр. лица должен быть французским"
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