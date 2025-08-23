// ================ middleware/partnerAuth.middleware.js (ОБНОВЛЕННЫЙ) ================
import jwt from "jsonwebtoken";
import { User, InitialPartnerRequest, PartnerProfile, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { verifyPartnerToken } from '../services/Partner/partner.auth.service.js';


const validateFrenchPhone = (phone) => {
    if (!phone) return false;
    const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
    const cleanPhone = phone.replace(/\s/g, '');
    return frenchPhoneRegex.test(cleanPhone);
};


const validateSiret = (siret) => {
    if (!siret) return false;
    const cleaned = siret.replace(/\s/g, '');
    const siretRegex = /^\d{14}$/;
    return siretRegex.test(cleaned);
};


const validateFrenchIban = (iban) => {
    if (!iban) return false;
    const cleaned = iban.replace(/\s/g, '');
    const frenchIbanRegex = /^FR\d{2}[A-Z0-9]{23}$/;
    return frenchIbanRegex.test(cleaned);
};


const validateFrenchTva = (tva) => {
    if (!tva) return true; // TVA опционально
    const cleaned = tva.replace(/\s/g, '');
    const frenchTvaRegex = /^FR\d{11}$/;
    return frenchTvaRegex.test(cleaned);
};


const validatePartnerRegistrationData = (req, res, next) => {
    try {
        const data = req.body;

        console.log('🔍 VALIDATE PARTNER DATA - Start:', {
            has_phone: !!data.phone,
            has_brand_name: !!data.brand_name,
            has_whatsapp_consent: data.whatsapp_consent !== undefined
        });

        // ✅ Проверка французского телефона
        if (data.phone && !validateFrenchPhone(data.phone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон должен быть французским форматом",
                example: "+33 1 42 34 56 78 или 01 42 34 56 78"
            });
        }

        // ✅ Проверка brand_name (новое обязательное поле)
        if (data.brand_name && typeof data.brand_name !== 'string') {
            return res.status(400).json({
                result: false,
                message: "brand_name должно быть строкой"
            });
        }

        // ✅ Проверка whatsapp_consent (новое обязательное поле)
        if (data.whatsapp_consent !== undefined && typeof data.whatsapp_consent !== 'boolean') {
            return res.status(400).json({
                result: false,
                message: "whatsapp_consent должно быть true или false"
            });
        }

        // ✅ Проверка координат
        if (data.latitude !== undefined || data.longitude !== undefined) {
            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            
            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return res.status(400).json({
                    result: false,
                    message: "Некорректные координаты"
                });
            }
        }

        console.log('✅ PARTNER DATA VALIDATION PASSED');
        next();

    } catch (error) {
        console.error('🚨 VALIDATE PARTNER DATA ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка валидации данных партнера"
        });
    }
};

const validateLegalInfoData = (req, res, next) => {
    try {
        const data = req.body;

        console.log('🔍 VALIDATE LEGAL DATA - Start:', {
            has_siret: !!data.siret_number,
            has_iban: !!data.iban,
            legal_form: data.legal_form
        });

        // ✅ Валидация SIRET
        if (data.siret_number && !validateSiret(data.siret_number)) {
            return res.status(400).json({
                result: false,
                message: "SIRET должен содержать 14 цифр",
                example: "123 456 789 00014"
            });
        }

        // ✅ Валидация IBAN
        if (data.iban && !validateFrenchIban(data.iban)) {
            return res.status(400).json({
                result: false,
                message: "IBAN должен быть французским",
                example: "FR76 3000 6000 0112 3456 7890 189"
            });
        }

        // ✅ Валидация TVA (если указан)
        if (data.tva_number && !validateFrenchTva(data.tva_number)) {
            return res.status(400).json({
                result: false,
                message: "TVA должен быть французским форматом",
                example: "FR12 345678912"
            });
        }

        // ✅ Валидация телефона юр. лица
        if (data.legal_phone && !validateFrenchPhone(data.legal_phone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон юр. лица должен быть французским"
            });
        }

        // ✅ Валидация формы юридического лица
        const allowedLegalForms = [
            'Auto-entrepreneur', 'SASU', 'SARL', 'SAS', 'EURL', 
            'SA', 'SNC', 'SCI', 'SELARL', 'Micro-entreprise', 
            'EI', 'EIRL', 'Autre'
        ];
        
        if (data.legal_form && !allowedLegalForms.includes(data.legal_form)) {
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
 * ================ СУЩЕСТВУЮЩИЕ MIDDLEWARE (ЛОГИКА НЕ ТРОНУТА) ================
 */
const decodeToken = async (token) => {
    try {
        const result = await verifyPartnerToken(token);
        
        if (!result.success) {
            return {
                result: false,
                message: result.message,
                status: result.statusCode || 401
            };
        }
        
        return {
            result: true,
            partner: result.partner,
            metaInfo: result.metaInfo
        };
        
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { message: "Access denied! Token expired!", result: false, status: 401 };
        } else if (err.name === 'JsonWebTokenError') {
            return { message: "Access denied! Token invalid!", result: false, status: 401 };
        } else {
            return { message: "Access denied! Token error!", result: false, status: 401 };
        }
    }
};

/**
 * Базовая проверка токена партнера (логика не тронута)
 */
const checkPartnerToken = async (req, res, next) => {
    try {
        console.log('🔍 CHECK PARTNER TOKEN - START');
        
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        req.partner = data.partner;
        req.user = data.partner;
        req.metaInfo = data.metaInfo;

        console.log('✅ TOKEN VERIFIED');
        next();

    } catch (error) {
        console.error('🚨 CHECK PARTNER TOKEN ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * Проверка статуса партнера (логика не тронута, но добавлены логи новых полей)
 */
const checkPartnerStatus = (requiredStatuses) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK PARTNER STATUS:', requiredStatuses);
            
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];

            if (!token) {
                return res.status(401).json({ 
                    message: "Access denied! Token required!", 
                    result: false 
                });
            }

            const data = await decodeToken(token);
            if (!data.result) {
                return res.status(data.status).json({
                    message: data.message,
                    result: false
                });
            }

            const partner = data.partner;

            const partnerRequest = await InitialPartnerRequest.findOne({ 
                user_id: partner._id 
            });

            if (!partnerRequest) {
                return res.status(404).json({
                    message: "Partner request not found!",
                    result: false
                });
            }

            // ✅ НОВОЕ: Логируем наличие новых полей
            console.log('🔍 PARTNER REQUEST FIELDS:', {
                has_brand_name: !!partnerRequest.business_data?.brand_name,
                has_floor_unit: !!partnerRequest.business_data?.floor_unit,
                whatsapp_consent: partnerRequest.marketing_consent?.whatsapp_consent,
                status: partnerRequest.status
            });

            if (!requiredStatuses.includes(partnerRequest.status)) {
                return res.status(403).json({
                    message: `Access denied! Required status: ${requiredStatuses.join(' or ')}. Current: ${partnerRequest.status}`,
                    result: false
                });
            }

            console.log('✅ STATUS CHECK PASSED');
            req.partner = partner;
            req.user = partner;
            req.metaInfo = data.metaInfo;
            req.partnerRequest = partnerRequest;

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
 * Проверка наличия профиля партнера (логика не тронута)
 */
const requirePartnerProfile = async (req, res, next) => {
    try {
        console.log('🔍 REQUIRE PARTNER PROFILE');
        
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        const partner = data.partner;

        const partnerProfile = await PartnerProfile.findOne({ 
            user_id: partner._id 
        });

        if (!partnerProfile) {
            return res.status(404).json({
                message: "Partner profile not found! Profile must be created first.",
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
 * Проверка доступа к профилю (логика не тронута)
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

        const data = await decodeToken(token);
        if (!data.result) {
            return res.status(data.status).json({
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
    validatePartnerRegistrationData,  // 🆕 НОВЫЙ MIDDLEWARE
    validateLegalInfoData            // 🆕 НОВЫЙ MIDDLEWARE
};