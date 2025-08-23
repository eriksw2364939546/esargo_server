// ================ services/Partner/partner.auth.service.js (ОБНОВЛЕННЫЙ) ================
import jwt from "jsonwebtoken";
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../../models/index.js';
import Meta from '../../models/Meta.model.js';
import { hashString, hashMeta, comparePassword } from '../../utils/hash.js';
import { cryptoString } from '../../utils/crypto.js';
import { generateCustomerToken } from '../token.service.js';
import mongoose from 'mongoose';

/**
 * ================== БИЗНЕС-ЛОГИКА АВТОРИЗАЦИИ ==================
 */

/**
 * Создание аккаунта партнера
 * ✅ ОБНОВЛЕНО: Создает InitialPartnerRequest с полями из новой модели
 */
export const createPartnerAccount = async (partnerData) => {
    try {
        let { 
            first_name, last_name, email, password, phone,
            business_name, brand_name, category, address, floor_unit, // 🆕 НОВЫЕ ПОЛЯ
            location, whatsapp_consent, // 🆕 НОВЫЕ ПОЛЯ
            registration_ip, user_agent
        } = partnerData;

        // Нормализация email (логика не тронута)
        email = email.toLowerCase().trim();

        // ✅ ПРОВЕРЯЕМ СУЩЕСТВОВАНИЕ ТОЛЬКО ЧЕРЕЗ META (логика не тронута)
        const existingMeta = await Meta.findByEmailAndRole(hashMeta(email), 'partner');
        if (existingMeta) {
            throw new Error('Партнер с таким email уже существует');
        }

        // Хешируем пароль (логика не тронута)
        const hashedPassword = await hashString(password);

        // Создаем пользователя с ЗАШИФРОВАННЫМ EMAIL (логика не тронута)
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

        // Создаем Meta запись (логика не тронута)
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

        // ✅ СОЗДАЕМ InitialPartnerRequest ПО НОВОЙ МОДЕЛИ
        const partnerRequest = new InitialPartnerRequest({
            user_id: newUser._id,
            
            // 👤 ЛИЧНЫЕ ДАННЫЕ (точно как в модели personal_data)
            personal_data: {
                first_name: cryptoString(first_name), // 🔐 ЗАШИФРОВАНО
                last_name: cryptoString(last_name),   // 🔐 ЗАШИФРОВАНО
                email: cryptoString(email),           // 🔐 ЗАШИФРОВАНО
                phone: cryptoString(phone)            // 🔐 ЗАШИФРОВАНО
            },
            
            // 🏪 БИЗНЕС ДАННЫЕ (точно как в модели business_data)
            business_data: {
                // Адрес и этаж
                address: cryptoString(address),                    // 🔐 ЗАШИФРОВАНО - "Адрес магазина"
                floor_unit: floor_unit ? cryptoString(floor_unit) : null, // 🔐 ЗАШИФРОВАНО - "Этаж/люкс (по желанию)"
                
                // Названия
                business_name: business_name,  // ✅ ОТКРЫТО - "Название магазина"
                brand_name: brand_name,        // ✅ ОТКРЫТО - "Название бренда" 🆕 НОВОЕ ПОЛЕ
                
                // Тип бизнеса
                category: category,            // ✅ ОТКРЫТО - "Тип бизнеса" (restaurant/store)
                
                // Геолокация (структура из модели)
                location: {
                    type: 'Point',
                    coordinates: location?.longitude && location?.latitude ? 
                        [parseFloat(location.longitude), parseFloat(location.latitude)] : 
                        [0, 0] // Default coordinates if not provided
                },
                
                // Владелец (для внутреннего использования)
                owner_name: first_name,        // ✅ ОТКРЫТО
                owner_surname: last_name       // ✅ ОТКРЫТО
            },
            
            // 📱 WHATSAPP СОГЛАСИЕ (точно как в модели marketing_consent)
            marketing_consent: {
                whatsapp_consent: Boolean(whatsapp_consent) // 🆕 ИСПРАВЛЕНО: правильное поле
            },
            
            // 🎯 СТАТУС ЗАЯВКИ (логика не тронута)
            status: 'pending',
            workflow_stage: 1,
            
            // ℹ️ ИНФОРМАЦИЯ О РАССМОТРЕНИИ (пустая при создании)
            review_info: {
                reviewed_by: null,
                reviewed_at: null,
                approved_at: null,
                rejection_reason: null,
                admin_notes: null
            },
            
            // 🛡️ БЕЗОПАСНОСТЬ (обновлено под модель)
            security_info: {
                registration_ip: registration_ip,
                user_agent: user_agent,
                country_code: 'FR',           // Соответствует французской системе
                phone_country: 'FR'           // Соответствует выпадающему "FR" на скрине
            },
            
            // 📅 ВРЕМЕННЫЕ МЕТКИ (соответствуют модели)
            submitted_at: new Date(),
            updated_at: new Date()
        });

        await partnerRequest.save();

        // 🆕 ГЕНЕРИРУЕМ ТОКЕН (логика не тронута)
        console.log('🔍 GENERATING TOKEN FOR NEW PARTNER:', {
            user_id: newUser._id,
            role: newUser.role,
            has_brand_name: !!brand_name, // 🆕 ЛОГИРУЕМ НОВОЕ ПОЛЕ
            has_floor_unit: !!floor_unit,  // 🆕 ЛОГИРУЕМ НОВОЕ ПОЛЕ
            whatsapp_consent: whatsapp_consent // 🆕 ЛОГИРУЕМ НОВОЕ ПОЛЕ
        });

        const token = generateCustomerToken({
            _id: newUser._id,
            user_id: newUser._id,
            role: 'partner'
            // 🔐 НЕ ВКЛЮЧАЕМ EMAIL в токен - он зашифрован
        }, '30d');

        console.log('✅ TOKEN GENERATED FOR NEW PARTNER WITH NEW FIELDS:', {
            token_length: token ? token.length : 0,
            token_preview: token ? token.substring(0, 20) + '...' : null
        });

        // Возвращаем результат (структура обновлена)
        return {
            isNewPartner: true,
            partner: {
                id: newUser._id,
                role: newUser.role,
                email: email, // ✅ Возвращаем оригинальный email для ответа
                request: partnerRequest
            },
            token: token // 🆕 Возвращаем токен
        };

    } catch (error) {
        console.error('🚨 CREATE PARTNER ACCOUNT ERROR:', error);
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

        // Генерируем токен БЕЗ EMAIL
        const token = generateCustomerToken({
            _id: partner._id,
            user_id: partner._id,
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
            }
        };

    } catch (error) {
        throw error;
    }
};

/**
 * ================== МЕТОДЫ ДЛЯ MIDDLEWARE ==================
 */

/**
 * Верификация токена партнера (для middleware)
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
 * Проверка существования партнера по email
 */
export const checkPartnerExists = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        console.log('🔍 CHECK PARTNER EXISTS - Start:', {
            original_email: email,
            normalized_email: normalizedEmail,
            hashed_email: hashMeta(normalizedEmail)
        });
        
        // Ищем через Meta
        const existingMeta = await Meta.findOne({
            em: hashMeta(normalizedEmail),
            role: 'partner'
        });
        
        console.log('🔍 CHECK PARTNER EXISTS - Result:', {
            found: !!existingMeta,
            meta_id: existingMeta ? existingMeta._id : null
        });
        
        return !!existingMeta;
        
    } catch (error) {
        console.error('🚨 CHECK PARTNER EXISTS - Error:', error);
        return false;
    }
};