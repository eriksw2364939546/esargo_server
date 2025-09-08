// services/Partner/partner.service.js - ИСПРАВЛЕННЫЙ ОСНОВНОЙ СЕРВИС
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo, Product } from '../../models/index.js';
import Meta from '../../models/Meta.model.js';
import { decryptString } from '../../utils/crypto.js';
import { getPartnerLegalInfo } from './partner.legal.service.js';
import mongoose from 'mongoose';

/**
 * ================== ПОЛУЧЕНИЕ ПОЛНОЙ ИНФОРМАЦИИ О ПАРТНЕРЕ ==================
 */
export const getPartnerFullInfo = async (partnerId) => {
    try {
        console.log('🔍 GET PARTNER FULL INFO:', { partnerId });
        
        if (!partnerId) {
            throw new Error('ID партнера не указан');
        }

        // Получаем пользователя
        const partner = await User.findById(partnerId);
        if (!partner) {
            throw new Error('Партнер не найден');
        }

        // Получаем заявку
        const request = await InitialPartnerRequest.findOne({ 
            user_id: partnerId 
        });

        // Получаем юридическую информацию
        const legalInfo = await getPartnerLegalInfo(partnerId);

        // Получаем профиль
        const profile = await PartnerProfile.findOne({ 
            user_id: partnerId 
        });

        const fullInfo = {
            partner,
            request,
            legalInfo,
            profile
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
 * ================== ПОЛУЧЕНИЕ СТАТУСА ДАШБОРДА ==================
 */
export const getDashboardWorkflow = async (partnerId) => {
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
            
            if (legalInfo && legalInfo.verification_status === 'approved') {
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
 * ================== ОПРЕДЕЛЕНИЕ СЛЕДУЮЩЕГО ДЕЙСТВИЯ ==================
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
    
    if (legal && legal.verification_status === 'pending') {
        return {
            action: "wait_legal_approval",
            description: "Ожидайте проверки документов",
            status: "waiting"
        };
    }
    
    if (legal && legal.verification_status === 'approved' && !profile) {
        return {
            action: "create_profile",
            description: "Создать профиль заведения",
            status: "available"
        };
    }
    
    if (profile && !profile.is_published) {
        return {
            action: "wait_publication",
            description: "Ожидайте публикации профиля",
            status: "waiting"
        };
    }
    
    if (profile && profile.is_published) {
        return {
            action: "manage_content",
            description: "Управление контентом и заказами",
            status: "active"
        };
    }
    
    return {
        action: "unknown",
        description: "Неизвестный статус",
        status: "error"
    };
};

/**
 * ================== ОБНОВЛЕНИЕ ПРОФИЛЯ ПАРТНЕРА ==================
 */
export const updatePartnerProfile = async (profileId, updateData, partnerId) => {
    try {
        console.log('🔍 UPDATE PARTNER PROFILE:', { profileId, partnerId });

        // Проверяем существование профиля
        const profile = await PartnerProfile.findById(profileId);
        if (!profile) {
            throw new Error('Профиль не найден');
        }

        // Проверяем права доступа
        if (profile.user_id.toString() !== partnerId.toString()) {
            throw new Error('Доступ запрещен: можно изменять только свой профиль');
        }

        // Обновляем профиль
        const updatedProfile = await PartnerProfile.findByIdAndUpdate(
            profileId,
            { ...updateData, updated_at: new Date() },
            { new: true }
        );

        console.log('✅ PARTNER PROFILE UPDATED');
        return updatedProfile;

    } catch (error) {
        console.error('🚨 UPDATE PARTNER PROFILE ERROR:', error);
        throw error;
    }
};

/**
 * ================== УДАЛЕНИЕ АККАУНТА ПАРТНЕРА ==================
 */
export const deletePartnerAccount = async (profileId, partnerId) => {
    const session = await mongoose.startSession();

    try {
        let cleanupInfo = {
            profile_deleted: false,
            products_deleted: false,
            legal_deleted: false,
            request_deleted: false,
            meta_deleted: false,
            user_deleted: false
        };

        await session.withTransaction(async () => {
            // 1. Удаляем профиль партнера
            const profileResult = await PartnerProfile.findOneAndDelete({ 
                _id: profileId,
                user_id: partnerId 
            }, { session });
            cleanupInfo.profile_deleted = !!profileResult;

            // 2. Удаляем товары партнера
            const productsResult = await Product.deleteMany({ 
                partner_id: partnerId 
            }, { session });
            cleanupInfo.products_deleted = productsResult.deletedCount > 0;

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

/**
 * ================== НОРМАЛИЗАЦИЯ ДАННЫХ ПАРТНЕРА ==================
 */
export const normalizePartnerData = (partnerData) => {
    try {
        console.log('🔍 NORMALIZING PARTNER DATA:', {
            has_business_data: !!partnerData.business_data,
            has_personal_data: !!partnerData.personal_data,
            business_name: partnerData.business_data?.business_name
        });

        // Расшифровка зашифрованных полей
        let decryptedEmail = '';
        let decryptedPhone = '';
        let decryptedAddress = '';

        try {
            if (partnerData.personal_data?.email) {
                decryptedEmail = decryptString(partnerData.personal_data.email);
            }

            if (partnerData.personal_data?.phone) {
                decryptedPhone = decryptString(partnerData.personal_data.phone);
            }

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
            // Продолжаем с пустыми значениями
        }

        // Возвращаем нормализованную структуру
        return {
            // Открытые данные
            business_name: partnerData.business_data?.business_name || '',
            brand_name: partnerData.business_data?.brand_name || '',
            category: partnerData.business_data?.category || '',
            owner_name: partnerData.owner_name || '',
            owner_surname: partnerData.owner_surname || '',
            
            // Расшифрованные данные
            email: decryptedEmail,
            phone: decryptedPhone,
            address: decryptedAddress,
            
            // Координаты
            location: partnerData.business_data?.location || null,
            delivery_zones: partnerData.business_data?.delivery_zones || [],
            
            // Статус
            status: partnerData.status || 'pending',
            workflow_stage: partnerData.workflow_stage || 1,
            
            // Согласия
            whatsapp_consent: partnerData.marketing_consent?.whatsapp_consent || false,
            
            // Даты
            submitted_at: partnerData.submitted_at,
            updated_at: partnerData.updated_at
        };

    } catch (error) {
        console.error('🚨 NORMALIZE PARTNER DATA ERROR:', error);
        throw error;
    }
};