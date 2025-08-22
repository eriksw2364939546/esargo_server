// ================ services/Partner/partner.auth.service.js (ИСПРАВЛЕННЫЙ) ================
import jwt from "jsonwebtoken";
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../../models/index.js';
import Meta from '../../models/Meta.model.js';
import { hashString, hashMeta, comparePassword } from '../../utils/hash.js';
import { cryptoString } from '../../utils/crypto.js';
import { generateCustomerToken } from '../token.service.js';
import mongoose from 'mongoose';

/**
 * ================== МЕТОДЫ ДЛЯ MIDDLEWARE ==================
 * Все методы возвращают { success, message, statusCode, данные }
 */

/**
 * Верификация токена партнера (для middleware)
 * Возвращает стандартный ответ для middleware
 */
const verifyPartnerToken = async (token) => {
    try {
        // Декодируем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { user_id, _id, role } = decoded;
        const partnerId = user_id || _id;

        // Проверяем роль
        if (role !== "partner") {
            return { 
                success: false,
                message: "Access denied! Not a partner account!", 
                statusCode: 403 
            };
        }

        // Ищем через Meta с populate
        const metaInfo = await Meta.findOne({
            partner: partnerId,
            role: "partner"
        }).populate("partner");

        if (!metaInfo || !metaInfo.partner) {
            return { 
                success: false,
                message: "Access denied! Partner not found!", 
                statusCode: 404 
            };
        }

        const partner = metaInfo.partner;

        // Проверяем активность
        if (!metaInfo.is_active || !partner.is_active) {
            return {
                success: false,
                message: "Access denied! Account is inactive!",
                statusCode: 403
            };
        }

        // Проверяем блокировку
        if (metaInfo.isAccountLocked && metaInfo.isAccountLocked()) {
            return {
                success: false,
                message: "Access denied! Account is locked!",
                statusCode: 423
            };
        }

        return { 
            success: true,
            message: "Access approved!", 
            partner: partner,
            metaInfo: metaInfo
        };

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { success: false, message: "Access denied! Token expired!", statusCode: 401 };
        } else if (err.name === 'JsonWebTokenError') {
            return { success: false, message: "Access denied! Token invalid!", statusCode: 401 };
        } else {
            return { success: false, message: "Access denied! Token error!", statusCode: 401 };
        }
    }
};

/**
 * Верификация партнера по статусу (для middleware)
 */
 const verifyPartnerByStatus = async (token, requiredStatuses) => {
    try {
        // Сначала проверяем токен
        const tokenResult = await verifyPartnerToken(token);
        
        if (!tokenResult.success) {
            return tokenResult;
        }

        const partner = tokenResult.partner;

        // Получаем заявку партнера
        const partnerRequest = await InitialPartnerRequest.findOne({ 
            user_id: partner._id 
        });

        if (!partnerRequest) {
            return {
                success: false,
                message: "Partner request not found!",
                statusCode: 404
            };
        }

        // Проверяем статус
        if (!requiredStatuses.includes(partnerRequest.status)) {
            return {
                success: false,
                message: `Access denied! Required status: ${requiredStatuses.join(' or ')}. Current: ${partnerRequest.status}`,
                statusCode: 403
            };
        }

        return {
            success: true,
            message: "Status check passed!",
            partner: partner,
            metaInfo: tokenResult.metaInfo,
            partnerRequest: partnerRequest
        };

    } catch (error) {
        return {
            success: false,
            message: "Server error during status check!",
            statusCode: 500
        };
    }
};

/**
 * Верификация наличия профиля партнера (для middleware)
 */
 const verifyPartnerProfile = async (token) => {
    try {
        // Сначала проверяем токен
        const tokenResult = await verifyPartnerToken(token);
        
        if (!tokenResult.success) {
            return tokenResult;
        }

        const partner = tokenResult.partner;

        // Проверяем наличие профиля
        const partnerProfile = await PartnerProfile.findOne({ 
            user_id: partner._id 
        });

        if (!partnerProfile) {
            return {
                success: false,
                message: "Partner profile not found! Profile must be created first.",
                statusCode: 404
            };
        }

        return {
            success: true,
            message: "Profile check passed!",
            partner: partner,
            metaInfo: tokenResult.metaInfo,
            partnerProfile: partnerProfile
        };

    } catch (error) {
        return {
            success: false,
            message: "Server error during profile check!",
            statusCode: 500
        };
    }
};

/**
 * ================== БИЗНЕС-ЛОГИКА АВТОРИЗАЦИИ ==================
 */

/**
 * Создание аккаунта партнера
 * Содержит всю логику создания партнера
 */
const createPartnerAccount = async (partnerData) => {
    try {
        let { 
            first_name, last_name, email, password, phone,
            business_name, category, address, location,
            registration_ip, user_agent
        } = partnerData;

        // Нормализация email
        email = email.toLowerCase().trim();

        // Проверяем существование через Meta
        const existingMeta = await Meta.findByEmailAndRole(hashMeta(email), 'partner');
        if (existingMeta) {
            throw new Error('Партнер с таким email уже существует');
        }

        // Хешируем пароль
        const hashedPassword = await hashString(password);

        // Создаем пользователя
        const newUser = new User({
            email: email,
            password_hash: hashedPassword,
            role: 'partner',
            is_active: true,
            is_email_verified: false,
            gdpr_consent: {
                data_processing: true,
                marketing: false,
                analytics: false,
                consent_date: new Date()
            },
            registration_source: 'web'
        });

        await newUser.save();

        // Создаем Meta запись
        const newMeta = new Meta({
            email_hash: hashMeta(email),
            role: 'partner',
            partner: newUser._id,
            encrypted_email: cryptoString(email),
            is_active: true,
            registration_ip: registration_ip,
            user_agent: user_agent,
            failed_login_attempts: 0,
            last_failed_login: null,
            account_locked_until: null
        });

        await newMeta.save();

        // Создаем заявку на партнерство
        const partnerRequest = new InitialPartnerRequest({
            user_id: newUser._id,
            first_name: first_name,
            last_name: last_name,
            email: email,
            phone: phone,
            business_name: business_name,
            category: category,
            address: address,
            location: location,
            status: 'pending_documents',
            created_at: new Date()
        });

        await partnerRequest.save();

        return {
            isNewPartner: true,
            partner: {
                id: newUser._id,
                email: newUser.email,
                role: newUser.role,
                request: partnerRequest
            }
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Авторизация партнера
 * Полная логика входа с проверками безопасности
 */
const loginPartner = async (email, password) => {
    try {
        // Нормализация
        const normalizedEmail = email.toLowerCase().trim();
        
        // Ищем через Meta с populate
        const metaInfo = await Meta.findOne({
            email_hash: hashMeta(normalizedEmail),
            role: 'partner'
        }).populate('partner');

        if (!metaInfo) {
            const error = new Error('Партнер не найден');
            error.statusCode = 404;
            throw error;
        }

        const partner = metaInfo.partner;

        // Проверяем активность аккаунта
        if (!partner.is_active) {
            const error = new Error('Аккаунт деактивирован');
            error.statusCode = 403;
            throw error;
        }

        // Проверяем блокировку аккаунта
        if (metaInfo.isAccountLocked && metaInfo.isAccountLocked()) {
            const error = new Error('Аккаунт временно заблокирован из-за множественных неудачных попыток входа');
            error.statusCode = 423;
            throw error;
        }

        // Проверяем пароль
        const isPasswordValid = await comparePassword(password, partner.password_hash);
        
        if (!isPasswordValid) {
            await metaInfo.incrementFailedAttempts();
            const error = new Error('Неверный пароль');
            error.statusCode = 401;
            throw error;
        }

        // Сбрасываем счетчик неудачных попыток при успешном входе
        await metaInfo.resetFailedAttempts();

        // Обновляем активность
        partner.last_login_at = new Date();
        await partner.save();

        // Получаем профиль
        const profile = await PartnerProfile.findOne({ user_id: partner._id });

        // Генерируем токен
        const token = generateCustomerToken({
            _id: partner._id,
            user_id: partner._id,
            email: partner.email,
            role: 'partner'
        }, '30d');

        return {
            token,
            partner: {
                id: partner._id,
                email: partner.email,
                role: partner.role,
                is_email_verified: partner.is_email_verified,
                is_active: partner.is_active,
                profile: profile
            }
        };

    } catch (error) {
        throw error;
    }
};

/**
 * ================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==================
 */

/**
 * Проверка существования партнера по email
 * ✅ ИСПРАВЛЕНО: Проверяем и Meta и User таблицы
 */
const checkPartnerExists = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        // 1. Проверяем Meta записи
        const metaInfo = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), 'partner');
        if (metaInfo) {
            return true;
        }
        
        // 2. Проверяем User записи (может быть битая регистрация)
        const userInfo = await User.findOne({ 
            email: normalizedEmail, 
            role: 'partner' 
        });
        if (userInfo) {
            return true;
        }
        
        return false;
    } catch (error) {
        return false;
    }
};

/**
 * Получение партнера по ID с полной информацией
 */
 const getPartnerById = async (partnerId) => {
    try {
        const partner = await User.findById(partnerId).select('-password_hash');
        if (!partner || partner.role !== 'partner') {
            return null;
        }

        const profile = await PartnerProfile.findOne({ user_id: partnerId });
        const request = await InitialPartnerRequest.findOne({ user_id: partnerId });
        const legalInfo = await PartnerLegalInfo.findOne({ user_id: partnerId });

        return {
            ...partner.toObject(),
            profile,
            request,
            legalInfo
        };
    } catch (error) {
        return null;
    }
};

/**
 * Проверка пользователя по email и роли
 */
 const checkUserByEmailAndRole = async (email, role = 'partner') => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const metaInfo = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), role);
        
        return !!metaInfo;
    } catch (error) {
        return false;
    }
};

// ✅ ИСПРАВЛЕНО: Убрали дублированный экспорт checkUserByEmailAndRole
export {
    verifyPartnerToken,
    verifyPartnerByStatus,
    verifyPartnerProfile,
    createPartnerAccount,
    loginPartner,
    checkPartnerExists,
    getPartnerById
};