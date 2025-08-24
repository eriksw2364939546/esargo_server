// ================ services/Partner/partner.service.js (ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ) ================
// Добавить эти функции в существующий файл services/Partner/partner.service.js

import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo, Product } from '../../models/index.js';
import Meta from '../../models/Meta.model.js';
import { cryptoString, decryptString } from '../../utils/crypto.js';
import { hashMeta } from '../../utils/hash.js';
import mongoose from 'mongoose';

/**
 * ================== ОСНОВНЫЕ ФУНКЦИИ ДЛЯ КОНТРОЛЛЕРОВ ==================
 */

/**
 * Получение заявки партнера
 * @param {string} partnerId - ID партнера
 * @returns {object|null} - Заявка партнера или null
 */
 const getPartnerRequest = async (partnerId) => {
    try {
        console.log('🔍 GET PARTNER REQUEST:', { partnerId });
        
        if (!partnerId) {
            console.log('❌ PARTNER REQUEST - No partnerId provided');
            return null;
        }
        
        const request = await InitialPartnerRequest.findOne({ 
            user_id: partnerId 
        });
        
        console.log('✅ PARTNER REQUEST FOUND:', {
            found: !!request,
            status: request ? request.status : null,
            workflow_stage: request ? request.workflow_stage : null,
            business_name: request ? request.business_data?.business_name : null
        });
        
        return request;
        
    } catch (error) {
        console.error('🚨 GET PARTNER REQUEST ERROR:', error);
        return null;
    }
};

/**
 * Получение профиля партнера
 * @param {string} partnerId - ID партнера
 * @returns {object|null} - Профиль партнера или null
 */
 const getPartnerProfile = async (partnerId) => {
    try {
        console.log('🔍 GET PARTNER PROFILE:', { partnerId });
        
        if (!partnerId) {
            console.log('❌ PARTNER PROFILE - No partnerId provided');
            return null;
        }
        
        const profile = await PartnerProfile.findOne({ 
            user_id: partnerId 
        });
        
        console.log('✅ PARTNER PROFILE FOUND:', {
            found: !!profile,
            is_published: profile ? profile.is_published : null,
            status: profile ? profile.status : null
        });
        
        return profile;
        
    } catch (error) {
        console.error('🚨 GET PARTNER PROFILE ERROR:', error);
        return null;
    }
};

/**
 * Получение юридической информации партнера
 * @param {string} partnerId - ID партнера
 * @returns {object|null} - Юридическая информация или null
 */
 const getPartnerLegalInfo = async (partnerId) => {
    try {
        console.log('🔍 GET PARTNER LEGAL INFO:', { partnerId });
        
        if (!partnerId) {
            console.log('❌ PARTNER LEGAL INFO - No partnerId provided');
            return null;
        }
        
        const legalInfo = await PartnerLegalInfo.findOne({ 
            user_id: partnerId 
        });
        
        console.log('✅ PARTNER LEGAL INFO FOUND:', {
            found: !!legalInfo,
            status: legalInfo ? legalInfo.status : null
        });
        
        return legalInfo;
        
    } catch (error) {
        console.error('🚨 GET PARTNER LEGAL INFO ERROR:', error);
        return null;
    }
};

/**
 * Получение полной информации о партнере
 * @param {string} partnerId - ID партнера
 * @returns {object} - Полная информация о партнере
 */
 const getPartnerFullInfo = async (partnerId) => {
    try {
        console.log('🔍 GET PARTNER FULL INFO:', { partnerId });
        
        if (!partnerId) {
            throw new Error('Partner ID не предоставлен');
        }
        
        // Получаем базовую информацию
        const partner = await User.findById(partnerId).select('-password_hash');
        if (!partner || partner.role !== 'partner') {
            throw new Error('Партнер не найден');
        }

        // Получаем все связанные данные
        const partnerProfile = await getPartnerProfile(partnerId);
        const partnerRequest = await getPartnerRequest(partnerId);
        const legalInfo = await getPartnerLegalInfo(partnerId);

        const fullInfo = {
            partner: {
                id: partner._id,
                email: partner.email,
                role: partner.role,
                is_active: partner.is_active,
                is_email_verified: partner.is_email_verified,
                created_at: partner.createdAt
            },
            profile: partnerProfile,
            request: partnerRequest,
            legalInfo: legalInfo
        };
        
        console.log('✅ PARTNER FULL INFO COLLECTED:', {
            has_partner: !!fullInfo.partner,
            has_profile: !!fullInfo.profile,
            has_request: !!fullInfo.request,
            has_legal: !!fullInfo.legalInfo
        });

        return fullInfo;

    } catch (error) {
        console.error('🚨 GET PARTNER FULL INFO ERROR:', error);
        throw error;
    }
};

/**
 * Получение статуса дашборда и workflow
 * @param {string} partnerId - ID партнера
 * @returns {object} - Статус дашборда
 */
 const getDashboardWorkflow = async (partnerId) => {
    try {
        console.log('🔍 GET DASHBOARD WORKFLOW:', { partnerId });
        
        const partnerInfo = await getPartnerFullInfo(partnerId);
        const { partner, profile, request, legalInfo } = partnerInfo;

        // Определяем текущий этап workflow
        let currentStage = 0;
        let nextAction = null;
        let permissions = {
            can_submit_legal: false,
            can_create_profile: false,
            can_manage_content: false
        };

        if (request) {
            currentStage = request.workflow_stage || 1;
            
            // Определяем разрешения на основе статусов
            if (request.status === 'approved') {
                permissions.can_submit_legal = true;
            }
            
            if (legalInfo && legalInfo.status === 'approved') {
                permissions.can_create_profile = true;
            }
            
            if (profile && profile.is_published) {
                permissions.can_manage_content = true;
            }
            
            // Определяем следующее действие
            nextAction = getNextAction(request, legalInfo, profile);
        }

        const workflow = {
            current_stage: currentStage,
            status: request ? request.status : 'not_found',
            business_name: request ? request.business_data?.business_name : null,
            permissions: permissions,
            next_action: nextAction
        };
        
        console.log('✅ DASHBOARD WORKFLOW PREPARED:', {
            current_stage: workflow.current_stage,
            status: workflow.status,
            permissions: workflow.permissions
        });

        return {
            user: partner,
            workflow: workflow
        };

    } catch (error) {
        console.error('🚨 GET DASHBOARD WORKFLOW ERROR:', error);
        throw error;
    }
};

/**
 * Определение следующего действия в workflow
 * @param {object} request - Заявка партнера
 * @param {object} legal - Юридическая информация
 * @param {object} profile - Профиль партнера
 * @returns {object} - Следующее действие
 */
const getNextAction = (request, legal, profile) => {
    if (!request) {
        return {
            action: "submit_request",
            description: "Подать заявку на регистрацию",
            status: "required"
        };
    }
    
    if (request.status === 'pending') {
        return {
            action: "wait_approval",
            description: "Ожидайте одобрения заявки администратором",
            status: "waiting"
        };
    }
    
    if (request.status === 'approved' && !legal) {
        return {
            action: "submit_legal",
            description: "Подать юридические документы",
            status: "available"
        };
    }
    
    if (legal && legal.status === 'pending') {
        return {
            action: "wait_legal_approval",
            description: "Ожидайте проверки документов",
            status: "waiting"
        };
    }
    
    if (legal && legal.status === 'approved' && !profile) {
        return {
            action: "create_profile",
            description: "Создать профиль заведения",
            status: "available"
        };
    }
    
    if (profile && !profile.is_published) {
        return {
            action: "wait_publication",
            description: "Ожидайте финальной публикации",
            status: "waiting"
        };
    }
    
    if (profile && profile.is_published) {
        return {
            action: "manage_content",
            description: "Управление контентом заведения",
            status: "active"
        };
    }
    
    return {
        action: "unknown",
        description: "Неопределенное состояние",
        status: "error"
    };
};

/**
 * Проверка прав доступа партнера к ресурсу
 * @param {string} partnerId - ID партнера
 * @param {string} resourceId - ID ресурса
 * @param {string} resourceType - Тип ресурса (profile, request, legal)
 * @returns {boolean} - Имеет ли права доступа
 */
 const checkPartnerAccess = async (partnerId, resourceId, resourceType = 'profile') => {
    try {
        console.log('🔍 CHECK PARTNER ACCESS:', {
            partnerId,
            resourceId,
            resourceType
        });
        
        // Простая проверка - партнер может работать только со своими ресурсами
        let resource = null;
        
        switch (resourceType) {
            case 'profile':
                resource = await PartnerProfile.findById(resourceId);
                break;
            case 'request':
                resource = await InitialPartnerRequest.findById(resourceId);
                break;
            case 'legal':
                resource = await PartnerLegalInfo.findById(resourceId);
                break;
            default:
                return false;
        }
        
        if (!resource) {
            console.log('❌ RESOURCE NOT FOUND');
            return false;
        }
        
        const hasAccess = resource.user_id.toString() === partnerId.toString();
        
        console.log('✅ ACCESS CHECK RESULT:', {
            hasAccess,
            resource_owner: resource.user_id,
            requesting_partner: partnerId
        });
        
        return hasAccess;
        
    } catch (error) {
        console.error('🚨 CHECK PARTNER ACCESS ERROR:', error);
        return false;
    }
};

/**
 * Обновление профиля партнера
 * @param {string} partnerId - ID партнера
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Обновленный профиль
 */
 const updatePartnerProfile = async (partnerId, updateData) => {
    try {
        console.log('🔍 UPDATE PARTNER PROFILE:', { partnerId, fields: Object.keys(updateData) });
        
        if (!partnerId) {
            throw new Error('Partner ID не предоставлен');
        }

        // Ищем профиль партнера
        const profile = await PartnerProfile.findOne({ user_id: partnerId });
        
        if (!profile) {
            throw new Error('Профиль партнера не найден');
        }

        // Проверяем статус профиля
        if (!profile.is_approved) {
            throw new Error('Профиль не одобрен администратором');
        }

        // Разрешенные поля для обновления
        const allowedFields = [
            'business_name', 'brand_name', 'description', 'phone',
            'cover_image_url', 'working_hours', 'delivery_info',
            'contact_info', 'social_media'
        ];

        // Обновляем только разрешенные поля
        const updateFields = {};
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updateFields[field] = updateData[field];
            }
        });

        // Специальная обработка некоторых полей
        if (updateData.working_hours) {
            // Валидация рабочих часов
            const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const hours = updateData.working_hours;
            
            for (const day of validDays) {
                if (hours[day]) {
                    if (hours[day].open_time && hours[day].close_time) {
                        // Проверяем формат времени
                        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
                        if (!timeRegex.test(hours[day].open_time) || !timeRegex.test(hours[day].close_time)) {
                            throw new Error(`Некорректный формат времени для ${day}`);
                        }
                    }
                }
            }
            updateFields.working_hours = hours;
        }

        // Обновляем профиль
        const updatedProfile = await PartnerProfile.findOneAndUpdate(
            { user_id: partnerId },
            { 
                ...updateFields,
                updated_at: new Date()
            },
            { new: true, runValidators: true }
        );

        console.log('✅ PARTNER PROFILE UPDATED:', {
            profile_id: updatedProfile._id,
            updated_fields: Object.keys(updateFields)
        });

        return updatedProfile;

    } catch (error) {
        console.error('🚨 UPDATE PARTNER PROFILE ERROR:', error);
        throw error;
    }
};


/**
 * Удаление аккаунта партнера (полная очистка)
 * @param {string} partnerId - ID партнера
 * @returns {object} - Результат удаления
 */
 const deletePartnerAccount = async (partnerId) => {
    const session = await mongoose.startSession();
    
    try {
        console.log('🔍 DELETE PARTNER ACCOUNT:', { partnerId });
        
        if (!partnerId) {
            throw new Error('Partner ID не предоставлен');
        }

        let cleanupInfo = {
            user_deleted: false,
            meta_deleted: false,
            request_deleted: false,
            legal_deleted: false,
            profile_deleted: false,
            products_deleted: 0
        };

        await session.withTransaction(async () => {
            // 1. Удаляем продукты
            const deleteProductsResult = await Product.deleteMany({ 
                partner_id: partnerId 
            }, { session });
            cleanupInfo.products_deleted = deleteProductsResult.deletedCount;

            // 2. Удаляем профиль
            const profileResult = await PartnerProfile.findOneAndDelete({ 
                user_id: partnerId 
            }, { session });
            cleanupInfo.profile_deleted = !!profileResult;

            // 3. Удаляем юридическую информацию
            const legalResult = await PartnerLegalInfo.findOneAndDelete({ 
                user_id: partnerId 
            }, { session });
            cleanupInfo.legal_deleted = !!legalResult;

            // 4. Удаляем заявку
            const requestResult = await InitialPartnerRequest.findOneAndDelete({ 
                user_id: partnerId 
            }, { session });
            cleanupInfo.request_deleted = !!requestResult;

            // 5. Удаляем Meta запись
            const metaResult = await Meta.findOneAndDelete({ 
                partner: partnerId,
                role: 'partner'
            }, { session });
            cleanupInfo.meta_deleted = !!metaResult;

            // 6. Удаляем пользователя
            const userResult = await User.findByIdAndDelete(partnerId, { session });
            cleanupInfo.user_deleted = !!userResult;
        });

        console.log('✅ PARTNER ACCOUNT DELETED:', cleanupInfo);

        return {
            deleted_partner: {
                id: partnerId,
                deleted_at: new Date()
            },
            cleanup_info: cleanupInfo
        };

    } catch (error) {
        console.error('🚨 DELETE PARTNER ACCOUNT ERROR:', error);
        throw error;
    } finally {
        await session.endSession();
    }
};

// ================ services/Partner/partner.service.js (ИСПРАВЛЕННАЯ ФУНКЦИЯ) ================

/**
 * ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ: Нормализация данных партнера с расшифровкой
 * @param {object} partnerData - Данные партнера из InitialPartnerRequest
 * @returns {object} - Нормализованные и расшифрованные данные
 */
const normalizePartnerData = (partnerData) => {
    try {
        console.log('🔍 NORMALIZING PARTNER DATA:', {
            has_business_data: !!partnerData.business_data,
            has_personal_data: !!partnerData.personal_data,
            business_name: partnerData.business_data?.business_name
        });

        // ✅ РАСШИФРОВКА ЗАШИФРОВАННЫХ ПОЛЕЙ
        let decryptedEmail = '';
        let decryptedPhone = '';
        let decryptedAddress = '';

        try {
            // Расшифровываем email из personal_data
            if (partnerData.personal_data?.email) {
                decryptedEmail = decryptString(partnerData.personal_data.email);
            }

            // Расшифровываем phone из personal_data  
            if (partnerData.personal_data?.phone) {
                decryptedPhone = decryptString(partnerData.personal_data.phone);
            }

            // Расшифровываем address из business_data
            if (partnerData.business_data?.address) {
                decryptedAddress = decryptString(partnerData.business_data.address);
            }

            console.log('✅ DECRYPTION SUCCESS:', {
                has_email: !!decryptedEmail,
                has_phone: !!decryptedPhone,
                has_address: !!decryptedAddress
            });

        } catch (decryptError) {
            console.warn('⚠️ DECRYPTION WARNING:', decryptError.message);
            // Fallback к пустым строкам если расшифровка не удалась
        }

        const normalized = {
            // Обязательные поля
            business_name: partnerData.business_data?.business_name || 'Не указано',
            brand_name: partnerData.business_data?.brand_name || 
                       partnerData.business_data?.business_name || 'Не указано',
            category: partnerData.business_data?.category || 'store',
            
            // ✅ ИСПРАВЛЕНО: Используем расшифрованные данные
            phone: decryptedPhone || 'Не указан',           // ← РАСШИФРОВАННЫЙ
            email: decryptedEmail || 'не-указан@example.com', // ← РАСШИФРОВАННЫЙ
            address: decryptedAddress || '',                  // ← РАСШИФРОВАННЫЙ
            
            // Опциональные поля с fallback
            floor_unit: partnerData.business_data?.floor_unit ? 
                       decryptString(partnerData.business_data.floor_unit) : null,
            description: partnerData.business_data?.description || 
                        `Партнер ${partnerData.business_data?.business_name || 'без названия'}`,
            
            // Геолокация с fallback
            location: partnerData.business_data?.location || {
                type: 'Point',
                coordinates: [2.3522, 48.8566] // Paris coordinates
            },
            
            // Согласия
            whatsapp_consent: partnerData.marketing_consent?.whatsapp_consent || false
        };

        console.log('✅ DATA NORMALIZED WITH DECRYPTION:', {
            has_brand_name: !!normalized.brand_name,
            has_floor_unit: !!normalized.floor_unit,
            category: normalized.category,
            has_phone: !!normalized.phone && normalized.phone !== 'Не указан',
            has_email: !!normalized.email && normalized.email !== 'не-указан@example.com',
            whatsapp_consent: normalized.whatsapp_consent
        });

        return normalized;

    } catch (error) {
        console.error('🚨 NORMALIZE PARTNER DATA ERROR:', error);
        
        // ✅ ИСПРАВЛЕНО: Возвращаем ВАЛИДНЫЕ fallback данные
        return {
            business_name: 'Не указано',
            brand_name: 'Не указано', 
            category: 'store',
            floor_unit: null,
            description: 'Описание недоступно',
            address: 'Адрес не указан',
            phone: '+33 1 00 00 00 00',              // ← ВАЛИДНЫЙ телефон
            email: 'fallback@partner-temp.com',     // ← ВАЛИДНЫЙ email
            location: { type: 'Point', coordinates: [2.3522, 48.8566] },
            whatsapp_consent: false
        };
    }
};


export{
    getPartnerRequest,
    getPartnerProfile,
    getPartnerLegalInfo,
    getPartnerFullInfo,
    getDashboardWorkflow,
    getNextAction,
    checkPartnerAccess,
    updatePartnerProfile,
    deletePartnerAccount,
    normalizePartnerData
}