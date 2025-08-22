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
export const getPartnerRequest = async (partnerId) => {
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
export const getPartnerProfile = async (partnerId) => {
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
export const getPartnerLegalInfo = async (partnerId) => {
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
export const getPartnerFullInfo = async (partnerId) => {
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
export const checkPartnerAccess = async (partnerId, resourceId, resourceType = 'profile') => {
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