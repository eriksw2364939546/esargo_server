// ================ services/partner.auth.service.js (ТОЛЬКО БД) ================
import { User, InitialPartnerRequest, PartnerProfile, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

/**
 * Создание аккаунта партнера в БД
 * Только сохранение - без валидации и бизнес-логики
 */
export const createPartnerAccount = async (partnerData) => {
    const session = await mongoose.startSession();
    
    try {
        let result = null;
        
        await session.withTransaction(async () => {
            const normalizedEmail = partnerData.email.toLowerCase().trim();
            const hashedEmail = hashMeta(normalizedEmail);

            // 1. Создаем User
            const hashedPassword = await hashString(partnerData.password);
            
            const newUser = new User({
                email: normalizedEmail,
                password_hash: hashedPassword,
                role: 'partner',
                is_active: true,
                is_email_verified: false,
                gdpr_consent: {
                    data_processing: true,
                    marketing: partnerData.whatsapp_consent || false,
                    analytics: true,
                    consent_date: new Date()
                },
                registration_source: 'web',
                registration_ip: partnerData.registration_ip,
                user_agent: partnerData.user_agent
            });

            await newUser.save({ session });

            // 2. Создаем Meta запись
            const newMeta = new Meta({
                partner: newUser._id,
                role: 'partner',
                em: hashedEmail,
                is_active: true
            });

            await newMeta.save({ session });

            // 3. Создаем InitialPartnerRequest
            const newRequest = new InitialPartnerRequest({
                user_id: newUser._id,
                personal_data: partnerData.personal_data,
                business_data: partnerData.business_data,
                location: partnerData.location,
                status: 'pending',
                workflow_stage: 1,
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

        // Проверяем пароль
        const isPasswordValid = await comparePassword(password, partner.password_hash);
        
        if (!isPasswordValid) {
            await metaInfo.incrementFailedAttempts();
            const error = new Error('Неверный пароль');
            error.statusCode = 401;
            throw error;
        }

        // Сбрасываем счетчик
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
                profile: profile
            }
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Инициализация тестового партнера (как initOwnerAccount)
 */
export const initTestPartner = async () => {
    try {
        const existingPartner = await User.findOne({ 
            email: 'partner@test.com',
            role: 'partner'
        });

        if (existingPartner) {
            console.log("🎯 Test partner already exists");
            return;
        }

        const testPartnerData = {
            email: 'partner@test.com',
            password: 'partner123',
            personal_data: {
                first_name: 'Test',
                last_name: 'Partner',
                phone: '+33612345678',
                email: 'partner@test.com'
            },
            business_data: {
                business_name: 'Test Restaurant',
                brand_name: 'Test Restaurant',
                category: 'restaurant',
                description: 'Test restaurant for development',
                address: '123 Test Street, Paris',
                phone: '+33612345678',
                email: 'partner@test.com'
            },
            location: {
                coordinates: {
                    type: 'Point',
                    coordinates: [2.3522, 48.8566]
                },
                address: '123 Test Street, Paris'
            },
            registration_ip: '127.0.0.1',
            user_agent: 'Test'
        };

        const result = await createPartnerAccount(testPartnerData);

        console.log("🎉 Test partner created:", {
            email: 'partner@test.com',
            password: 'partner123',
            id: result.user._id
        });

    } catch (error) {
        console.error("🚨 Error creating test partner:", error);
    }
};