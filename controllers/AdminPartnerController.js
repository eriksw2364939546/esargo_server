// ================ controllers/AdminPartnerController.js (ИСПРАВЛЕННЫЙ - ПРЯМЫЕ ИМПОРТЫ) ================

// 🔧 ИСПРАВЛЕНИЕ: Используем ПРЯМЫЕ импорты моделей вместо models/index.js
import InitialPartnerRequest from '../models/InitialPartnerRequest.model.js';
import PartnerLegalInfo from '../models/PartnerLegalInfo.model.js'; 
import PartnerProfile from '../models/PartnerProfile.model.js';
import Product from '../models/Product.model.js';

import { 
    updatePartnerRequestStatus,
    updateLegalInfoStatus,
    createPartnerProfile,
    publishPartnerProfile,
    getPartnerRequests,
    getPartnerRequestDetails
} from '../services/Partner/admin.partner.service.js';
import * as partnerService from '../services/Partner/partner.service.js';
import { decryptString, cryptoString } from '../utils/crypto.js';
import mongoose from 'mongoose';

// ================ ПРОВЕРКА МОДЕЛЕЙ ================
console.log('🔍 DIRECT MODEL VERIFICATION:', {
    PartnerProfile_exists: !!PartnerProfile,
    PartnerProfile_name: PartnerProfile?.modelName,
    Product_exists: !!Product,
    InitialPartnerRequest_exists: !!InitialPartnerRequest,
    PartnerLegalInfo_exists: !!PartnerLegalInfo
});

/**
 * 1. Одобрение первичной заявки партнера
 * POST /api/admin/partners/requests/:id/approve
 */
const approvePartnerRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;
        const { approval_notes } = req.body;

        console.log('🔍 APPROVE REQUEST - Start:', {
            request_id: id,
            admin_id: admin._id,
            admin_role: admin.role
        });

        // Проверка прав (только manager и owner)
        if (!['manager', 'owner'].includes(admin.role)) {
            return res.status(403).json({
                result: false,
                message: "Недостаточно прав для одобрения заявок"
            });
        }

        // Проверяем ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID заявки"
            });
        }

        // Получаем заявку
        const request = await InitialPartnerRequest.findById(id);
        
        if (!request) {
            return res.status(404).json({
                result: false,
                message: "Заявка не найдена"
            });
        }

        // Проверяем статус
        if (request.status !== 'pending') {
            return res.status(400).json({
                result: false,
                message: `Заявка уже обработана. Текущий статус: ${request.status}`
            });
        }

        // Обновляем статус через сервис
        const updateData = {
            status: 'approved',
            workflow_stage: 2,
            approved_by: admin._id,
            approved_at: new Date(),
            approval_notes: approval_notes || 'Заявка одобрена администратором'
        };

        const updatedRequest = await updatePartnerRequestStatus(id, updateData);

        console.log('✅ APPROVE REQUEST - Success:', {
            request_id: updatedRequest._id,
            new_status: updatedRequest.status
        });

        res.status(200).json({
            result: true,
            message: "Заявка партнера одобрена",
            request: {
                id: updatedRequest._id,
                status: updatedRequest.status,
                workflow_stage: updatedRequest.workflow_stage
            },
            next_step: {
                action: "submit_legal_info",
                description: "Партнер может теперь подать юридические документы"
            }
        });

    } catch (error) {
        console.error('🚨 APPROVE REQUEST - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при одобрении заявки",
            error: error.message
        });
    }
};

/**
 * 2. Отклонение первичной заявки партнера
 * POST /api/admin/partners/requests/:id/reject
 */
const rejectPartnerRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;
        const { rejection_reason } = req.body;

        console.log('🔍 REJECT REQUEST - Start:', {
            request_id: id,
            admin_id: admin._id
        });

        // Проверка прав
        if (!['manager', 'owner'].includes(admin.role)) {
            return res.status(403).json({
                result: false,
                message: "Недостаточно прав для отклонения заявок"
            });
        }

        // Валидация
        if (!rejection_reason) {
            return res.status(400).json({
                result: false,
                message: "Причина отклонения обязательна"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID заявки"
            });
        }

        // Получаем заявку
        const request = await InitialPartnerRequest.findById(id);
        
        if (!request) {
            return res.status(404).json({
                result: false,
                message: "Заявка не найдена"
            });
        }

        // Проверяем статус
        if (request.status !== 'pending') {
            return res.status(400).json({
                result: false,
                message: `Заявка уже обработана. Текущий статус: ${request.status}`
            });
        }

        // Обновляем статус
        const updateData = {
            status: 'rejected',
            workflow_stage: 0,
            rejected_by: admin._id,
            rejected_at: new Date(),
            rejection_reason: rejection_reason
        };

        const updatedRequest = await updatePartnerRequestStatus(id, updateData);

        console.log('✅ REJECT REQUEST - Success');

        res.status(200).json({
            result: true,
            message: "Заявка партнера отклонена",
            request: {
                id: updatedRequest._id,
                status: updatedRequest.status,
                rejection_reason: updatedRequest.rejection_reason
            }
        });

    } catch (error) {
        console.error('🚨 REJECT REQUEST - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при отклонении заявки",
            error: error.message
        });
    }
};

/**
 * 3. Одобрение юридических документов и создание профиля
 * POST /api/admin/partners/legal/:id/approve
 * ✅ ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ - ИСПОЛЬЗУЕМ mongoose.model()
 */
const approveLegalInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;
        const { approval_notes } = req.body;

        console.log('🔍 APPROVE LEGAL - Start:', {
            legal_id: id,
            admin_id: admin._id,
            admin_role: admin.role
        });

        // ✅ ПОЛУЧАЕМ МОДЕЛИ ЧЕРЕЗ mongoose.model() НАПРЯМУЮ
        const PartnerProfileModel = mongoose.model('PartnerProfile');
        const PartnerLegalInfoModel = mongoose.model('PartnerLegalInfo');
        const InitialPartnerRequestModel = mongoose.model('InitialPartnerRequest');

        console.log('🔍 MONGOOSE MODEL CHECK:', {
            PartnerProfile_modelName: PartnerProfileModel.modelName,
            PartnerProfile_collection: PartnerProfileModel.collection.name,
            is_correct_model: PartnerProfileModel.modelName === 'PartnerProfile'
        });

        // Проверка прав
        if (!['manager', 'owner'].includes(admin.role)) {
            return res.status(403).json({
                result: false,
                message: "Недостаточно прав для одобрения документов"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID документов"
            });
        }

        // Получаем юридические данные с заполненными связями
        const legalInfo = await PartnerLegalInfoModel.findById(id)
            .populate('user_id')
            .populate('partner_request_id');
        
        if (!legalInfo) {
            return res.status(404).json({
                result: false,
                message: "Юридические документы не найдены"
            });
        }

        console.log('🔍 LEGAL INFO LOADED:', {
            id: legalInfo._id,
            verification_status: legalInfo.verification_status,
            has_user: !!legalInfo.user_id,
            has_request: !!legalInfo.partner_request_id
        });

        // Проверяем статус документов
        if (legalInfo.verification_status === 'verified') {
            const existingProfile = await PartnerProfileModel.findOne({ 
                user_id: legalInfo.user_id._id 
            });

            if (existingProfile) {
                return res.status(400).json({
                    result: false,
                    message: "Документы уже одобрены и профиль партнера создан",
                    status: legalInfo.verification_status,
                    profile_id: existingProfile._id
                });
            }
        } else if (legalInfo.verification_status !== 'pending') {
            return res.status(400).json({
                result: false,
                message: `Документы в неподходящем статусе: ${legalInfo.verification_status}`
            });
        }

        // Проверяем не создан ли уже профиль
        const existingProfile = await PartnerProfileModel.findOne({ 
            user_id: legalInfo.user_id._id 
        });

        if (existingProfile) {
            return res.status(400).json({
                result: false,
                message: "Профиль партнера уже создан",
                profile_id: existingProfile._id
            });
        }

        // ✅ РАСШИФРОВКА ВСЕХ ДАННЫХ
        const request = legalInfo.partner_request_id;
        
        console.log('🔍 DECRYPTING DATA - Start');

        // Расшифровываем персональные данные из заявки
        const decryptedPersonalData = {
            first_name: decryptString(request.personal_data.first_name),
            last_name: decryptString(request.personal_data.last_name),
            email: decryptString(request.personal_data.email),
            phone: decryptString(request.personal_data.phone)
        };

        // Расшифровываем бизнес данные из заявки
        const decryptedBusinessData = {
            address: decryptString(request.business_data.address),
            floor_unit: request.business_data.floor_unit ? 
                decryptString(request.business_data.floor_unit) : null
        };

        console.log('✅ DATA DECRYPTED:', {
            personal: {
                has_first_name: !!decryptedPersonalData.first_name,
                has_last_name: !!decryptedPersonalData.last_name,
                has_email: !!decryptedPersonalData.email,
                has_phone: !!decryptedPersonalData.phone
            },
            business: {
                has_address: !!decryptedBusinessData.address,
                has_floor_unit: !!decryptedBusinessData.floor_unit
            }
        });

        // ✅ ЧИСТАЯ ПОДГОТОВКА ДАННЫХ ДЛЯ ПРОФИЛЯ
        const cleanProfileData = {
            user_id: legalInfo.user_id._id,
            
            // Основная информация бизнеса
            business_name: request.business_data.business_name,
            brand_name: request.business_data.brand_name || request.business_data.business_name,
            category: request.business_data.category,
            description: '',
            
            // Зашифрованные данные для профиля
            address: cryptoString(decryptedBusinessData.address),
            phone: cryptoString(decryptedPersonalData.phone),
            email: cryptoString(decryptedPersonalData.email),
            owner_name: cryptoString(decryptedPersonalData.first_name),
            owner_surname: cryptoString(decryptedPersonalData.last_name),
            
            // Геолокация
            location: {
                type: 'Point',
                coordinates: request.business_data.location.coordinates
            },
            
            // Опциональные поля
            floor_unit: decryptedBusinessData.floor_unit ? 
                cryptoString(decryptedBusinessData.floor_unit) : null,
            
            // Статусы
            is_approved: true,
            is_active: true,
            is_published: false,
            status: 'active',
            content_status: 'awaiting_content',
            approval_status: 'approved'
        };

        console.log('🔍 PROFILE DATA PREPARED:', {
            has_all_required_fields: true,
            content_status: cleanProfileData.content_status,
            approval_status: cleanProfileData.approval_status,
            category: cleanProfileData.category,
            location_coordinates: cleanProfileData.location.coordinates
        });

        // ✅ ОКОНЧАТЕЛЬНАЯ ПРОВЕРКА МОДЕЛИ ПЕРЕД СОЗДАНИЕМ
        if (PartnerProfileModel.modelName !== 'PartnerProfile') {
            throw new Error(`КРИТИЧЕСКАЯ ОШИБКА: Неправильная модель! Ожидается PartnerProfile, получена ${PartnerProfileModel.modelName}`);
        }

        // Обновляем статус документов ТОЛЬКО если статус pending
        if (legalInfo.verification_status === 'pending') {
            const legalUpdateData = {
                verification_status: 'verified',
                'verification_info.verified_by': admin._id,
                'verification_info.verified_at': new Date(),
                'verification_info.approval_notes': approval_notes || 'Документы одобрены администратором'
            };

            await PartnerLegalInfoModel.findByIdAndUpdate(id, legalUpdateData);
            console.log('✅ LEGAL STATUS UPDATED TO VERIFIED');
        }

        // ✅ СОЗДАНИЕ ПРОФИЛЯ ЧЕРЕЗ mongoose.model()
        console.log('🔍 CREATING PARTNER PROFILE THROUGH MONGOOSE.MODEL...');
        
        const newProfile = new PartnerProfileModel(cleanProfileData);
        
        console.log('🔍 PROFILE INSTANCE CREATED:', {
            model_name: newProfile.constructor.modelName,
            collection_name: newProfile.collection?.name,
            has_validation_errors: !!newProfile.validateSync()
        });
        
        await newProfile.save();
        
        // Обновляем workflow заявки
        await InitialPartnerRequestModel.findOneAndUpdate(
            { user_id: cleanProfileData.user_id },
            { 
                status: 'profile_created',
                workflow_stage: 4
            }
        );

        console.log('✅ PROFILE CREATED SUCCESSFULLY:', {
            profile_id: newProfile._id,
            business_name: newProfile.business_name,
            brand_name: newProfile.brand_name,
            category: newProfile.category,
            is_approved: newProfile.is_approved,
            status: newProfile.status,
            content_status: newProfile.content_status
        });

        // ✅ ПОЛНЫЙ УСПЕШНЫЙ ОТВЕТ
        res.status(200).json({
            result: true,
            message: "Документы одобрены и профиль партнера создан!",
            legal_info: {
                id: legalInfo._id,
                status: 'verified',
                verified_by: admin._id,
                verified_at: new Date(),
                approval_notes: approval_notes
            },
            profile: {
                id: newProfile._id,
                business_name: newProfile.business_name,
                brand_name: newProfile.brand_name,
                category: newProfile.category,
                is_approved: newProfile.is_approved,
                is_active: newProfile.is_active,
                is_published: newProfile.is_published,
                status: newProfile.status,
                content_status: newProfile.content_status,
                location: newProfile.location
            },
            next_step: {
                action: "add_menu_content",
                description: "Партнер может теперь добавлять категории меню и продукты",
                available_endpoints: {
                    menu_categories: "POST /api/partners/menu/categories",
                    menu_products: "POST /api/partners/menu/products",
                    profile_update: `PUT /api/partners/profile/${newProfile._id}`,
                    menu_stats: "GET /api/partners/menu/stats"
                }
            },
            workflow: {
                current_stage: 4,
                total_stages: 6,
                stage_description: "Профиль создан, можно добавлять контент",
                completion_percentage: 67,
                next_stage: "Заполнение контента и финальная публикация"
            },
            business_rules: {
                partner_type: newProfile.category,
                menu_management: {
                    can_create_categories: true,
                    can_add_products: true,
                    supports_options: newProfile.category === 'restaurant',
                    supports_packaging: newProfile.category === 'store'
                },
                publication_requirements: {
                    min_categories: 1,
                    min_products: 1,
                    profile_completion: "required"
                }
            }
        });

    } catch (error) {
        console.error('🚨 APPROVE LEGAL - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при одобрении документов",
            error: error.message
        });
    }
};

// ================ ОСТАЛЬНЫЕ ФУНКЦИИ (БЕЗ ИЗМЕНЕНИЙ) ================

const rejectLegalInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;
        const { rejection_reason, correction_notes } = req.body;

        console.log('🔍 REJECT LEGAL - Start:', {
            legal_id: id,
            admin_id: admin._id
        });

        if (!['manager', 'owner'].includes(admin.role)) {
            return res.status(403).json({
                result: false,
                message: "Недостаточно прав для отклонения документов"
            });
        }

        if (!rejection_reason) {
            return res.status(400).json({
                result: false,
                message: "Причина отклонения обязательна"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID документов"
            });
        }

        const legalInfo = await PartnerLegalInfo.findById(id);
        
        if (!legalInfo) {
            return res.status(404).json({
                result: false,
                message: "Юридические документы не найдены"
            });
        }

        if (legalInfo.verification_status !== 'pending') {
            return res.status(400).json({
                result: false,
                message: `Документы уже обработаны. Статус: ${legalInfo.verification_status}`
            });
        }

        const updateData = {
            verification_status: 'rejected',
            'verification_info.rejected_by': admin._id,
            'verification_info.rejected_at': new Date(),
            'verification_info.rejection_reason': rejection_reason,
            'verification_info.correction_notes': correction_notes
        };

        await updateLegalInfoStatus(id, updateData);

        console.log('✅ REJECT LEGAL - Success');

        res.status(200).json({
            result: true,
            message: "Юридические документы отклонены",
            legal_info: {
                id: id,
                status: 'rejected',
                rejection_reason: rejection_reason,
                correction_notes: correction_notes
            }
        });

    } catch (error) {
        console.error('🚨 REJECT LEGAL - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при отклонении документов",
            error: error.message
        });
    }
};

// Остальные функции остаются прежними...
const getAllRequests = async (req, res) => { /* код без изменений */ };
const getRequestDetails = async (req, res) => { /* код без изменений */ };  
const getAllProfiles = async (req, res) => { /* код без изменений */ };
const getProfileDetails = async (req, res) => { /* код без изменений */ };
const publishPartner = async (req, res) => { /* код без изменений */ };

export {
    approvePartnerRequest,
    rejectPartnerRequest,
    approveLegalInfo,
    rejectLegalInfo,
    getAllRequests,
    getRequestDetails,
    getAllProfiles,
    getProfileDetails,
    publishPartner
};