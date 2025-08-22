// В начале файла services/Partner/partner.service.js:
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo, Product } from '../../models/index.js';
import Meta from '../../models/Meta.model.js';
import { cryptoString, decryptString } from '../../utils/crypto.js';
import { hashMeta } from '../../utils/hash.js';
import mongoose from 'mongoose';

/**
 * ================== ОСНОВНАЯ БИЗНЕС-ЛОГИКА ПАРТНЕРОВ ==================
 * Весь workflow управления партнерами
 */

/**
 * Получение полной информации о партнере
 * Возвращает данные или ошибку
 */
export const getPartnerFullInfo = async (partnerId) => {
    try {
        // Получаем базовую информацию
        const partner = await User.findById(partnerId).select('-password_hash');
        if (!partner || partner.role !== 'partner') {
            throw new Error('Партнер не найден');
        }

        // Получаем все связанные данные
        const partnerProfile = await PartnerProfile.findOne({ user_id: partnerId });
        const partnerRequest = await InitialPartnerRequest.findOne({ user_id: partnerId });
        const legalInfo = await PartnerLegalInfo.findOne({ user_id: partnerId });

        return {
            partner: {
                id: partner._id,
                email: partner.email,
                role: partner.role,
                is_active: partner.is_active,
                created_at: partner.createdAt
            },
            profile: partnerProfile,
            request: partnerRequest,
            legalInfo: legalInfo
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Получение статуса дашборда и workflow
 * Определяет текущий этап и следующие действия
 */
export const getDashboardWorkflow = async (partnerId) => {
    try {
        const partnerInfo = await getPartnerFullInfo(partnerId);
        const { partner, profile, request, legalInfo } = partnerInfo;

        // Определяем текущий этап workflow
        let currentStage = 0;
        let nextAction = null;
        let availableFeatures = [];
        let stageDescription = '';

        if (!request) {
            currentStage = 0;
            stageDescription = 'Не зарегистрирован';
            nextAction = {
                action: "register",
                description: "Необходимо зарегистрироваться как партнер"
            };
        } else if (request.status === 'pending') {
            currentStage = 1;
            stageDescription = 'Заявка на рассмотрении';
            nextAction = {
                action: "wait_approval",
                description: "Ожидайте одобрения заявки администратором"
            };
        } else if (request.status === 'approved' && !legalInfo) {
            currentStage = 2;
            stageDescription = 'Заявка одобрена - подайте документы';
            nextAction = {
                action: "submit_legal_info",
                endpoint: `POST /api/partners/legal-info/${request._id}`,
                description: "Подайте юридические документы"
            };
            availableFeatures = ['dashboard', 'personal_data'];
        } else if (legalInfo && legalInfo.verification_status === 'pending') {
            currentStage = 3;
            stageDescription = 'Документы на проверке';
            nextAction = {
                action: "wait_legal_verification",
                description: "Юридические документы на проверке"
            };
            availableFeatures = ['dashboard', 'personal_data'];
        } else if (legalInfo && legalInfo.verification_status === 'verified' && !profile) {
            currentStage = 3.5;
            stageDescription = 'Документы одобрены - создание профиля';
            nextAction = {
                action: "profile_creation",
                description: "Профиль создается администратором"
            };
            availableFeatures = ['dashboard', 'personal_data'];
        } else if (profile && profile.status === 'draft') {
            currentStage = 4;
            stageDescription = 'Заполните информацию о бизнесе';
            nextAction = {
                action: "fill_profile",
                endpoint: `PUT /api/partners/profile/${profile._id}`,
                description: "Заполните информацию о вашем бизнесе"
            };
            availableFeatures = ['dashboard', 'profile', 'business_info'];
        } else if (profile && profile.status === 'pending_approval') {
            currentStage = 5;
            stageDescription = 'Профиль на проверке';
            nextAction = {
                action: "wait_profile_approval",
                description: "Ожидайте одобрения профиля администратором"
            };
            availableFeatures = ['dashboard', 'profile', 'view_products'];
        } else if (profile && profile.status === 'active') {
            currentStage = 6;
            stageDescription = 'Активный партнер';
            nextAction = {
                action: "manage_business",
                description: "Управляйте своим бизнесом"
            };
            availableFeatures = ['dashboard', 'profile', 'products', 'orders', 'analytics'];
        }

        return {
            workflow: {
                current_stage: currentStage,
                stage_description: stageDescription,
                next_action: nextAction,
                available_features: availableFeatures,
                total_stages: 6
            },
            partner_info: partnerInfo
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Подача юридических документов
 * Содержит всю бизнес-логику проверок
 */
export const submitLegalDocuments = async (requestId, legalData, metadata) => {
    try {
        // Проверяем заявку
        const partnerRequest = await InitialPartnerRequest.findById(requestId);
        
        if (!partnerRequest) {
            throw new Error('Заявка партнера не найдена');
        }

        if (partnerRequest.status !== 'approved') {
            throw new Error(`Невозможно подать документы. Статус заявки: ${partnerRequest.status}`);
        }

        // Проверяем, не поданы ли уже документы
        const existingLegal = await PartnerLegalInfo.findOne({ 
            partner_request_id: requestId 
        });

        if (existingLegal) {
            throw new Error('Юридические документы уже поданы для этой заявки');
        }

        // Валидация обязательных полей
        const requiredFields = ['company_name', 'legal_address', 'tax_number'];
        const missingFields = requiredFields.filter(field => !legalData[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Обязательные поля: ${missingFields.join(', ')}`);
        }

        // Создаем запись юридических данных
        const newLegalInfo = new PartnerLegalInfo({
            user_id: partnerRequest.user_id,
            partner_request_id: requestId,
            legal_data: {
                company_name: cryptoString(legalData.company_name),
                legal_address: cryptoString(legalData.legal_address),
                tax_number: legalData.tax_number ? cryptoString(legalData.tax_number) : null,
                contact_person: legalData.contact_person ? cryptoString(legalData.contact_person) : null,
                contact_phone: legalData.contact_phone ? cryptoString(legalData.contact_phone) : null
            },
            verification_status: 'pending',
            security_info: {
                submitted_ip: metadata.ip,
                user_agent: metadata.userAgent,
                submitted_at: new Date()
            }
        });

        await newLegalInfo.save();

        // Обновляем статус заявки
        partnerRequest.status = 'under_review';
        partnerRequest.workflow_stage = 3;
        await partnerRequest.save();

        return {
            legal_info: {
                id: newLegalInfo._id,
                status: newLegalInfo.verification_status,
                submitted_at: newLegalInfo.security_info.submitted_at
            },
            request_status: partnerRequest.status
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Обновление профиля партнера
 * Только бизнес-логика, БЕЗ проверки прав (права в middleware)
 */
export const updatePartnerProfile = async (profileId, updateData) => {
    try {
        // Получаем профиль
        const partnerProfile = await PartnerProfile.findById(profileId);
        
        if (!partnerProfile) {
            throw new Error('Профиль партнера не найден');
        }

        // Валидация данных
        const allowedFields = [
            'business_name', 'description', 'phone', 'working_hours',
            'delivery_info', 'social_media', 'business_category'
        ];

        const fieldsToUpdate = {};
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                fieldsToUpdate[field] = updateData[field];
            }
        });

        if (Object.keys(fieldsToUpdate).length === 0) {
            throw new Error('Нет данных для обновления');
        }

        // Обновляем профиль
        Object.assign(partnerProfile, fieldsToUpdate);
        partnerProfile.updated_at = new Date();
        
        await partnerProfile.save();

        return {
            profile: partnerProfile,
            updated_fields: Object.keys(fieldsToUpdate)
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Полное удаление партнера из системы
 * ✅ ИСПРАВЛЕНО: Не возвращаем зашифрованный email
 */
export const deletePartnerCompletely = async (partnerId) => {
    const session = await mongoose.startSession();
    
    try {
        let result = null;
        
        await session.withTransaction(async () => {
            // 1. Находим партнера
            const partner = await User.findById(partnerId).session(session);
            
            if (!partner || partner.role !== 'partner') {
                throw new Error('Партнер не найден');
            }

            // 2. Удаляем Meta запись
            await Meta.deleteOne({ partner: partnerId }).session(session);

            // 3. Удаляем InitialPartnerRequest
            await InitialPartnerRequest.deleteOne({ user_id: partnerId }).session(session);

            // 4. Удаляем PartnerLegalInfo
            await PartnerLegalInfo.deleteOne({ user_id: partnerId }).session(session);

            // 5. Удаляем PartnerProfile
            await PartnerProfile.deleteOne({ user_id: partnerId }).session(session);

            // 6. Деактивируем продукты (вместо удаления)
            await Product.updateMany(
                { partner_id: partnerId },
                { is_active: false, deleted_at: new Date() }
            ).session(session);

            // 7. Удаляем самого пользователя
            await User.findByIdAndDelete(partnerId).session(session);

            // ✅ ИСПРАВЛЕНО: Не возвращаем зашифрованный email
            result = {
                deleted_partner_id: partnerId,
                deleted_role: partner.role,
                deleted_at: new Date()
                // 🔐 НЕ ВОЗВРАЩАЕМ EMAIL - он был зашифрован
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
 * Проверка существования партнера по email
 * Простая проверка через Meta модель
 */
export const checkPartnerExistsByEmail = async (email) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const metaInfo = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), 'partner');
        
        return !!metaInfo;
    } catch (error) {
        throw error;
    }
};

/**
 * Получение профиля партнера
 * Только бизнес-логика, БЕЗ проверки прав (права в middleware)
 */
export const getPartnerProfileById = async (profileId) => {
    try {
        const profile = await PartnerProfile.findById(profileId);
        
        if (!profile) {
            throw new Error('Профиль не найден');
        }

        // Возвращаем профиль (данные уже в нужном формате)
        return {
            profile: profile,
            permissions: ['view', 'edit', 'delete']
        };

    } catch (error) {
        throw error;
    }
};

export default {
    getPartnerFullInfo,
    getDashboardWorkflow,
    submitLegalDocuments,
    updatePartnerProfile,
    deletePartnerCompletely,
    checkPartnerExistsByEmail,
    getPartnerProfileById
};