// services/Partner/partner.auth.service.js - ИСПРАВЛЕННЫЙ БЕЗ ДУБЛИРОВАНИЯ
import jwt from "jsonwebtoken";
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../../models/index.js';
import Meta from '../../models/Meta.model.js';
import { hashString, hashMeta, comparePassword } from '../../utils/hash.js';
import { cryptoString } from '../../utils/crypto.js';
import { generateCustomerToken } from '../token.service.js';
import { mockGeocode } from '../../utils/address.utils.js'; // ✅ ИСПОЛЬЗУЕМ УТИЛИТУ
import mongoose from 'mongoose';

/**
 * ================== СОЗДАНИЕ АККАУНТА ПАРТНЕРА ==================
 */
const createPartnerAccount = async (data) => {
    const {
        first_name, last_name, email, password, phone,
        business_name, brand_name, category, address, floor_unit,
        whatsapp_consent
    } = data;

    const session = await mongoose.startSession();
    
    try {
        let result = null;
        
        await session.withTransaction(async () => {
            const normalizedEmail = email.toLowerCase().trim();

            // Проверяем существование партнера
            const existingMeta = await Meta.findOne({
                em: hashMeta(normalizedEmail),
                role: 'partner'
            });

            if (existingMeta) {
                throw new Error('Партнер с таким email уже существует');
            }

            // ✅ АВТОМАТИЧЕСКОЕ ГЕОКОДИРОВАНИЕ АДРЕСА
            console.log('🗺️ GEOCODING ADDRESS:', address);
            const geocodeResult = mockGeocode(address);
            
            if (!geocodeResult.success) {
                throw new Error('Ошибка геокодирования адреса: ' + geocodeResult.error);
            }

            const coordinates = geocodeResult.coordinates;
            console.log('✅ GEOCODING SUCCESS:', coordinates);

            // Создаем пользователя
            const newUser = new User({
                email: cryptoString(normalizedEmail), // ✅ ДОБАВЛЯЕМ ЗАШИФРОВАННЫЙ EMAIL
                role: 'partner',
                is_email_verified: false,
                is_active: true,
                password_hash: await hashString(password),
                created_at: new Date(),
                last_login_at: null
            });

            await newUser.save({ session });

            // Создаем Meta запись
            const newMeta = new Meta({
                em: hashMeta(normalizedEmail),
                role: 'partner',
                partner: newUser._id,
                is_active: true,
                failed_attempts: 0,
                last_failed_attempt: null,
                account_locked_until: null
            });

            await newMeta.save({ session });

            // Шифруем персональные данные
            const encryptedPersonalData = {
                first_name: cryptoString(first_name),
                last_name: cryptoString(last_name),
                email: cryptoString(normalizedEmail),
                phone: cryptoString(phone)
            };

            // Шифруем бизнес данные
            const encryptedBusinessData = {
                business_name: cryptoString(business_name),
                brand_name: cryptoString(brand_name) || '',
                category: category,
                address: cryptoString(address),
                floor_unit: floor_unit ? cryptoString(floor_unit) : null,
                location: {
                    type: 'Point',
                    coordinates: [coordinates.lng, coordinates.lat] // GeoJSON: [longitude, latitude]
                },
                delivery_zones: [{
                    zone_number: coordinates.zone,
                    max_distance_km: coordinates.zone === 1 ? 5 : 10,
                    delivery_fee: coordinates.zone === 1 ? 2.99 : 4.99,
                    min_order_amount: 30,
                    is_active: true
                }],
                // ✅ ИСПРАВЛЕНО: owner_name и owner_surname ВНУТРИ business_data
                  owner_name: cryptoString(first_name),      // ✅ ЗАШИФРОВАННО
                  owner_surname: cryptoString(last_name)
            };

            // Создаем заявку партнера
            const savedRequest = new InitialPartnerRequest({
                user_id: newUser._id,
                personal_data: encryptedPersonalData,
                business_data: encryptedBusinessData,
                // ❌ УБИРАЕМ - owner_name и owner_surname теперь в business_data
                marketing_consent: {
                    whatsapp_consent: whatsapp_consent || false
                },
                status: 'pending',
                workflow_stage: 1,
                submitted_at: new Date()
            });

            await savedRequest.save({ session });

            // Генерируем токен БЕЗ email (последовательно)
            const token = generateCustomerToken({
                _id: newUser._id,
                user_id: newUser._id,
                role: 'partner'
            }, '30d');

            result = {
                token,
                user: {
                    id: newUser._id,
                    role: 'partner'
                },
                request: savedRequest,
                coordinates: coordinates // ✅ ВОЗВРАЩАЕМ КООРДИНАТЫ
            };
        });

        return result;

    } catch (error) {
        console.error('🚨 CREATE PARTNER ACCOUNT ERROR:', error);
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * ================== АВТОРИЗАЦИЯ ПАРТНЕРА ==================
 */
const loginPartner = async (email, password) => {
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

        // Генерируем токен БЕЗ EMAIL (последовательно)
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
 * ================== ВЕРИФИКАЦИЯ ТОКЕНА ==================
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
 * ================== ПРОВЕРКА СУЩЕСТВОВАНИЯ ==================
 */
const checkPartnerExists = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        const existingMeta = await Meta.findOne({
            em: hashMeta(normalizedEmail),
            role: 'partner'
        });
        
        return !!existingMeta;
        
    } catch (error) {
        console.error('🚨 CHECK PARTNER EXISTS - Error:', error);
        return false;
    }
};

export { 
    createPartnerAccount,
    loginPartner,
    verifyPartnerToken,
    checkPartnerExists 
};