// ================ services/Partner/partner.auth.service.js (ИСПРАВЛЕННЫЕ ЭКСПОРТЫ) ================
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
export const verifyPartnerToken = async (token) => {
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
export const verifyPartnerByStatus = async (token, requiredStatuses) => {
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
export const verifyPartnerProfile = async (token) => {
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
export const createPartnerAccount = async (partnerData) => {
    try {
        let { 
            first_name, last_name, email, password, phone,
            business_name, category, address, location,
            registration_ip, user_agent
        } = partnerData;

        // Нормализация email
        email = email.toLowerCase().trim();

        // ✅ ПРОВЕРЯЕМ СУЩЕСТВОВАНИЕ ТОЛЬКО ЧЕРЕЗ META
        const existingMeta = await Meta.findByEmailAndRole(hashMeta(email), 'partner');
        if (existingMeta) {
            throw new Error('Партнер с таким email уже существует');
        }

        // 🔐 НЕ ПРОВЕРЯЕМ User по email - поиск только через Meta!
        // const existingUser = await User.findOne({ email: email });

        // Хешируем пароль
        const hashedPassword = await hashString(password);

        // Создаем пользователя с ЗАШИФРОВАННЫМ EMAIL
        const newUser = new User({
            email: cryptoString(email), // 🔐 ЗАШИФРОВАННЫЙ EMAIL
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
            em: hashMeta(email), // ✅ ИСПРАВЛЕНО: используем правильное поле em
            role: 'partner',
            partner: newUser._id,
            is_active: true,
            security_info: {
                last_login_attempt: null,
                failed_login_attempts: 0,
                account_locked_until: null
            }
        });

        await newMeta.save();

        // ✅ ИСПРАВЛЕНО: Правильная структура данных для InitialPartnerRequest
        const partnerRequest = new InitialPartnerRequest({
            user_id: newUser._id,
            
            // Персональные данные (зашифрованы)
            personal_data: {
                first_name: cryptoString(first_name),
                last_name: cryptoString(last_name),
                phone: cryptoString(phone),
                email: cryptoString(email) // Зашифрованная копия
            },
            
            // Бизнес данные (микс открытого и зашифрованного)
            business_data: {
                // Открытые данные
                business_name: business_name, // ✅ НЕ шифруем для поиска
                category: category, // ✅ НЕ шифруем для фильтров
                description: `${category === 'restaurant' ? 'Ресторан' : 'Магазин'} ${business_name}`,
                
                // Владелец (имена не критичны)
                owner_name: first_name,
                owner_surname: last_name,
                
                // Зашифрованные данные
                address: cryptoString(address),
                phone: cryptoString(phone),
                email: cryptoString(email),
                
                // Геолокация
                location: {
                    type: 'Point',
                    coordinates: location?.longitude && location?.latitude ? 
                        [parseFloat(location.longitude), parseFloat(location.latitude)] : 
                        [0, 0] // Default coordinates if not provided
                }
            },
            
            // Геолокация на уровне заявки
            location: {
                coordinates: {
                    type: 'Point',
                    coordinates: location?.longitude && location?.latitude ? 
                        [parseFloat(location.longitude), parseFloat(location.latitude)] : 
                        [0, 0]
                },
                address: address
            },
            
            // Статус и workflow
            status: 'pending', // ✅ ИСПРАВЛЕНО: используем правильный статус из enum
            workflow_stage: 1,
            
            // Временные метки
            submitted_at: new Date(),
            updated_at: new Date(),
            
            // Безопасность
            security_info: {
                registration_ip: registration_ip,
                user_agent: user_agent,
                email_verified: false,
                phone_verified: false
            },
            
            // Маркетинговые согласия
            marketing_consent: {
                whatsapp: partnerData.whatsapp_consent || false,
                email_newsletter: false,
                sms: false
            }
        });

        await partnerRequest.save();

        return {
            isNewPartner: true,
            partner: {
                id: newUser._id,
                role: newUser.role,
                request: partnerRequest
                // 🔐 EMAIL НЕ ВОЗВРАЩАЕМ - он зашифрован в request
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
export const loginPartner = async ({ email, password }) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        // Ищем через Meta
        const metaInfo = await Meta.findOne({
            em: hashMeta(normalizedEmail),
            role: 'partner'
        }).populate('partner');

        if (!metaInfo || !metaInfo.partner) {
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
                role: partner.role,
                is_email_verified: partner.is_email_verified,
                is_active: partner.is_active,
                profile: profile
                // 🔐 EMAIL НЕ ВОЗВРАЩАЕМ - он зашифрован
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
 * ✅ С АВТОМАТИЧЕСКОЙ ОЧИСТКОЙ БИТЫХ ЗАПИСЕЙ
 */
export const checkPartnerExists = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        console.log('🔍 CHECK PARTNER EXISTS - Start:', {
            original_email: email,
            normalized_email: normalizedEmail,
            hashed_email: hashMeta(normalizedEmail)
        });
        
        // 1. ✅ ПОИСК ТОЛЬКО ЧЕРЕЗ META (по хешу email)
        const metaInfo = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), 'partner');
        console.log('🔍 Meta check result:', {
            metaInfo_found: !!metaInfo,
            metaInfo_id: metaInfo?._id,
            metaInfo_role: metaInfo?.role
        });
        
        if (metaInfo) {
            // Проверяем есть ли соответствующий User
            const correspondingUser = await User.findById(metaInfo.partner);
            
            if (!correspondingUser) {
                // Meta есть, но User нет - удаляем Meta
                console.log('🧹 Found orphaned Meta record - cleaning up...');
                await Meta.findByIdAndDelete(metaInfo._id);
                await InitialPartnerRequest.deleteOne({ user_id: metaInfo.partner });
                await PartnerProfile.deleteOne({ user_id: metaInfo.partner });
                console.log('✅ Orphaned Meta record cleaned up successfully');
                return false;
            } else {
                console.log('❌ Partner EXISTS in Meta table with valid User');
                return true;
            }
        }
        
        // 2. 🔐 НЕ ИЩЕМ В USER - поиск только через Meta
        // Поиск по email в User больше не поддерживается для безопасности
        
        console.log('✅ Partner does NOT exist - OK to register');
        return false;
        
    } catch (error) {
        console.error('🚨 CHECK PARTNER EXISTS - Error:', error);
        return false; // В случае ошибки считаем что партнер не существует
    }
};

/**
 * Получение партнера по ID с полной информацией
 */
export const getPartnerById = async (partnerId) => {
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
export const checkUserByEmailAndRole = async (email, role = 'partner') => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const metaInfo = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), role);
        
        return !!metaInfo;
    } catch (error) {
        return false;
    }
};