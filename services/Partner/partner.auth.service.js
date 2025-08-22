// ================ services/Partner/partner.auth.service.js (ПОЛНЫЙ ФАЙЛ) ================
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
 * ================== ОСНОВНЫЕ МЕТОДЫ АВТОРИЗАЦИИ ==================
 */

/**
 * Создание аккаунта партнера
 * Полная бизнес-логика регистрации
 */
export const createPartnerAccount = async (partnerData) => {
    const session = await mongoose.startSession();
    
    try {
        let result = null;
        
        await session.withTransaction(async () => {
            const {
                first_name, last_name, email, password,
                phone, business_name, category, address, location,
                registration_ip, user_agent
            } = partnerData;

            const normalizedEmail = email.toLowerCase().trim();

            // 1. Создаем User
            const hashedPassword = await hashString(password);
            
            const newUser = new User({
                email: normalizedEmail,
                password_hash: hashedPassword,
                role: 'partner',
                is_active: true,
                is_email_verified: false,
                created_at: new Date(),
                last_activity_at: new Date()
            });

            await newUser.save({ session });

            // 2. Создаем Meta
            const newMeta = new Meta({
                em: hashMeta(normalizedEmail),
                role: 'partner',
                partner: newUser._id,
                is_active: true,
                created_at: new Date()
            });

            await newMeta.save({ session });

            // 3. Создаем InitialPartnerRequest
            const newRequest = new InitialPartnerRequest({
                user_id: newUser._id,
                personal_data: {
                    first_name: cryptoString(first_name),
                    last_name: cryptoString(last_name),
                    phone: cryptoString(phone),
                    email: cryptoString(normalizedEmail)
                },
                business_data: {
                    business_name: cryptoString(business_name),
                    category: category,
                    description: cryptoString(`${category === 'restaurant' ? 'Ресторан' : 'Магазин'} ${business_name}`),
                    address: cryptoString(address),
                    phone: cryptoString(phone),
                    email: cryptoString(normalizedEmail),
                    
                    // ОБЯЗАТЕЛЬНЫЕ ПОЛЯ
                    owner_name: first_name,
                    owner_surname: last_name,
                    
                    // Location внутри business_data
                    location: {
                        type: 'Point',
                        coordinates: location?.lng && location?.lat ? 
                            [location.lng, location.lat] : 
                            [0, 0]
                    }
                },
                
                // Location на уровне InitialPartnerRequest
                location: location || {
                    coordinates: {
                        type: 'Point',
                        coordinates: [0, 0]
                    },
                    address: address
                },
                
                status: 'pending',
                workflow_stage: 1,
                submitted_at: new Date(),
                security_info: {
                    registration_ip: registration_ip,
                    user_agent: user_agent
                },
                marketing_consent: {
                    whatsapp: partnerData.whatsapp_consent || false,
                    email_newsletter: false,
                    sms: false
                }
            });

            await newRequest.save({ session });

            // 4. Генерируем токен
            const token = generateCustomerToken({
                _id: newUser._id,
                user_id: newUser._id,
                email: newUser.email,
                role: 'partner'
            }, '30d');

            result = {
                isNewPartner: true,
                user: newUser,
                meta: newMeta,
                request: newRequest,
                token: token
            };
        });

        return result;

    } catch (error) {
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Авторизация партнера
 * Только проверка в БД и возврат данных
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
 */
export const checkPartnerExists = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const metaInfo = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), 'partner');
        
        return !!metaInfo;
    } catch (error) {
        return false;
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

export {
    verifyPartnerToken,
    verifyPartnerByStatus,
    verifyPartnerProfile,
    createPartnerAccount,
    loginPartner,
    checkPartnerExists,
    getPartnerById,
    checkUserByEmailAndRole
};