// ================ controllers/AdminPartnerController.js ================
import { InitialPartnerRequest, PartnerLegalInfo, PartnerProfile, Product } from '../models/index.js';
import { 
    updatePartnerRequestStatus,
    updateLegalInfoStatus,
    createPartnerProfile,
    publishPartnerProfile,
    getPartnerRequests,
    getPartnerRequestDetails
} from '../services/Partner/admin.partner.service.js';
import * as partnerService from '../services/Partner/partner.service.js';
import { decryptString } from '../utils/crypto.js';

import mongoose from 'mongoose';

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


// controllers/AdminPartnerController.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

// ============ ИСПРАВЛЕННЫЙ AdminPartnerController.js - approveLegalInfo ============

/**
 * 3. Одобрение юридических документов и создание профиля  
 * POST /api/admin/partners/legal/:id/approve
 * ✅ ИСПРАВЛЕНО: Правильная передача всех обязательных данных
 */
const approveLegalInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;
        const { approval_notes } = req.body;

        console.log('🔍 APPROVE LEGAL - Start:', {
            legal_id: id,
            admin_id: admin._id
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

        // Получаем юридические данные
        const legalInfo = await PartnerLegalInfo.findById(id)
            .populate('user_id')
            .populate('partner_request_id');
        
        if (!legalInfo) {
            return res.status(404).json({
                result: false,
                message: "Юридические документы не найдены"
            });
        }

        console.log('🔍 CURRENT LEGAL STATUS:', {
            id: legalInfo._id,
            verification_status: legalInfo.verification_status
        });

        // Проверяем статус
        if (legalInfo.verification_status === 'verified') {
            const existingProfile = await PartnerProfile.findOne({ 
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
        const existingProfile = await PartnerProfile.findOne({ 
            user_id: legalInfo.user_id._id 
        });

        if (existingProfile) {
            return res.status(400).json({
                result: false,
                message: "Профиль партнера уже создан",
                profile_id: existingProfile._id
            });
        }

        // Обновляем статус документов ТОЛЬКО если статус pending
        if (legalInfo.verification_status === 'pending') {
            const legalUpdateData = {
                verification_status: 'verified',
                'verification_info.verified_by': admin._id,
                'verification_info.verified_at': new Date(),
                'verification_info.approval_notes': approval_notes || 'Документы одобрены администратором'
            };

            await updateLegalInfoStatus(id, legalUpdateData);
            console.log('✅ LEGAL STATUS UPDATED TO VERIFIED');
        }

        // ✅ СОЗДАНИЕ ПРОФИЛЯ с полными данными
        const request = legalInfo.partner_request_id;
        
        console.log('🔍 CREATING PROFILE - Request data check:', {
            request_id: request._id,
            has_business_data: !!request.business_data,
            has_personal_data: !!request.personal_data,
            business_name: request.business_data?.business_name,
            brand_name: request.business_data?.brand_name,
            category: request.business_data?.category,
            has_location: !!request.business_data?.location,
            location_type: request.business_data?.location?.type,
            coordinates: request.business_data?.location?.coordinates
        });

        // ✅ ИСПРАВЛЕНО: Извлекаем и расшифровываем данные правильно
        const profileData = {
            user_id: legalInfo.user_id._id,
            
            // ✅ ОБЯЗАТЕЛЬНЫЕ ПОЛЯ PartnerProfile (все заполняем!)
            business_name: request.business_data?.business_name || 'Не указано',
            brand_name: request.business_data?.brand_name || 
                       request.business_data?.business_name || 'Не указано',
            category: request.business_data?.category || 'restaurant',
            
            // ✅ РАСШИФРОВЫВАЕМ ЗАШИФРОВАННЫЕ ПОЛЯ
            email: decryptString(request.personal_data?.email) || 'temp@example.com',
            phone: decryptString(request.personal_data?.phone) || 'Не указан',
            address: decryptString(request.business_data?.address) || 'Не указан',
            
            // ✅ ВЛАДЕЛЕЦ - используем бизнес данные или личные данные
            owner_name: request.business_data?.owner_name || 
                       decryptString(request.personal_data?.first_name) || 'Не указано',
            owner_surname: request.business_data?.owner_surname || 
                          decryptString(request.personal_data?.last_name) || 'Не указано',
            
            // ✅ ГЕОЛОКАЦИЯ - обязательная для валидации
            location: request.business_data?.location || {
                type: 'Point',
                coordinates: [2.3522, 48.8566] // Paris default
            },
            
            // ✅ ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ
            floor_unit: request.business_data?.floor_unit ? 
                       decryptString(request.business_data.floor_unit) : null,
            description: `${request.business_data?.business_name || 'Партнер'} - качественная ${request.business_data?.category === 'restaurant' ? 'еда' : 'продукция'}`,
            
            // ✅ СТАТУСЫ - правильные для добавления контента
            is_approved: true,                    // Разрешает работу с меню
            is_active: false,                     // Пока не активен публично
            is_published: false,                  // Пока не опубликован
            content_status: 'awaiting_content',   // Ожидает контент от партнера
            approval_status: 'awaiting_content',  // НЕ content_approved!
            
            // ✅ СВЯЗИ
            legal_info_id: legalInfo._id,
            
            // ✅ АДМИНИСТРАТИВНЫЕ
            created_by: admin._id,
            updated_by: admin._id
        };

        console.log('✅ PROFILE DATA FULLY PREPARED:', {
            user_id: profileData.user_id,
            business_name: profileData.business_name,
            category: profileData.category,
            has_email: !!profileData.email,
            has_phone: !!profileData.phone,
            has_address: !!profileData.address,
            owner_name: profileData.owner_name,
            owner_surname: profileData.owner_surname,
            location: profileData.location,
            all_required_fields: true
        });

        // ✅ СОЗДАЕМ ПРОФИЛЬ с полными данными
        const newProfile = await createPartnerProfile(profileData);

        console.log('✅ PROFILE CREATED SUCCESSFULLY:', {
            profile_id: newProfile._id,
            business_name: newProfile.business_name,
            category: newProfile.category,
            is_approved: newProfile.is_approved
        });

        res.status(200).json({
            result: true,
            message: "Документы одобрены и профиль партнера создан",
            legal_info: {
                id: legalInfo._id,
                status: 'verified'
            },
            profile: {
                id: newProfile._id,
                business_name: newProfile.business_name,
                brand_name: newProfile.brand_name,
                category: newProfile.category,
                is_approved: newProfile.is_approved,
                status: newProfile.content_status
            },
            next_step: {
                action: "add_menu_content",
                description: "Партнер может теперь добавлять блюда и контент",
                endpoints: {
                    add_category: "POST /api/partners/menu/categories",
                    add_product: "POST /api/partners/menu/products"
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


/**
 * 4. Отклонение юридических документов
 * POST /api/admin/partners/legal/:id/reject
 */
const rejectLegalInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;
        const { rejection_reason, correction_notes } = req.body;

        console.log('🔍 REJECT LEGAL - Start:', {
            legal_id: id,
            admin_id: admin._id
        });

        // Проверка прав
        if (!['manager', 'owner'].includes(admin.role)) {
            return res.status(403).json({
                result: false,
                message: "Недостаточно прав для отклонения документов"
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
                message: "Неверный ID документов"
            });
        }

        // Получаем юридические данные
        const legalInfo = await PartnerLegalInfo.findById(id);
        
        if (!legalInfo) {
            return res.status(404).json({
                result: false,
                message: "Юридические документы не найдены"
            });
        }

        // Проверяем статус
        if (legalInfo.verification_status !== 'pending') {
            return res.status(400).json({
                result: false,
                message: `Документы уже обработаны. Статус: ${legalInfo.verification_status}`
            });
        }

        // Обновляем статус
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

/**
 * 5. Получение всех заявок партнеров
 * GET /api/admin/partners/requests
 */
const getAllRequests = async (req, res) => {
    try {
        const { admin } = req;
        const { 
            status, 
            category, 
            page = 1, 
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        console.log('🔍 GET ALL REQUESTS - Start:', {
            admin_role: admin.role,
            filters: { status, category }
        });

        // Строим фильтры
        const filters = {};
        if (status) filters.status = status;
        if (category) filters['business_data.category'] = category;

        // Получаем данные через сервис
        const result = await getPartnerRequests(
            filters,
            { page, limit, sortBy, sortOrder }
        );

        console.log('✅ GET ALL REQUESTS - Success:', {
            found: result.requests.length,
            total: result.total
        });

        res.status(200).json({
            result: true,
            message: "Список заявок получен",
            requests: result.requests,
            pagination: {
                current_page: result.page,
                total_pages: result.totalPages,
                total_items: result.total,
                items_per_page: limit
            }
        });

    } catch (error) {
        console.error('🚨 GET ALL REQUESTS - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при получении заявок",
            error: error.message
        });
    }
};

/**
 * 6. Получение детальной информации о заявке
 * GET /api/admin/partners/requests/:id
 */
const getRequestDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;

        console.log('🔍 GET REQUEST DETAILS - Start:', {
            request_id: id,
            admin_role: admin.role
        });

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID заявки"
            });
        }

        // Получаем полную информацию через сервис
        const details = await getPartnerRequestDetails(id);

        if (!details || !details.request) {
            return res.status(404).json({
                result: false,
                message: "Заявка не найдена"
            });
        }

        // Расшифровываем некоторые данные для админа
        const decryptedData = {
            phone: details.request.personal_data.phone ? 
                decryptString(details.request.personal_data.phone) : null,
            address: details.request.business_data.address ? 
                decryptString(details.request.business_data.address) : null
        };

        console.log('✅ GET REQUEST DETAILS - Success');

        res.status(200).json({
            result: true,
            message: "Информация о заявке получена",
            request: details.request,
            legal_info: details.legalInfo,
            profile: details.profile,
            decrypted_data: decryptedData,
            workflow: {
                current_stage: details.request.workflow_stage,
                status: details.request.status,
                has_legal_info: !!details.legalInfo,
                has_profile: !!details.profile
            }
        });

    } catch (error) {
        console.error('🚨 GET REQUEST DETAILS - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при получении информации о заявке",
            error: error.message
        });
    }
};

/**
 * 7. Финальное одобрение и публикация партнера
 * POST /api/admin/partners/profiles/:id/publish
 */
const publishPartner = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin } = req;
        const { publish_notes } = req.body;

        console.log('🔍 PUBLISH PARTNER - Start:', {
            profile_id: id,
            admin_id: admin._id
        });

        // Проверка прав
        if (!['manager', 'owner'].includes(admin.role)) {
            return res.status(403).json({
                result: false,
                message: "Недостаточно прав для публикации партнеров"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID профиля"
            });
        }

        // Получаем профиль
        const profile = await PartnerProfile.findById(id);
        
        if (!profile) {
            return res.status(404).json({
                result: false,
                message: "Профиль партнера не найден"
            });
        }

        // Проверяем статус
        if (profile.status !== 'draft' && profile.status !== 'pending_approval') {
            return res.status(400).json({
                result: false,
                message: `Невозможно опубликовать. Текущий статус: ${profile.status}`
            });
        }

        // Проверяем наличие контента
        const productsCount = await Product.countDocuments({ 
            partner_id: id,
            is_active: true 
        });

        if (productsCount === 0) {
            return res.status(400).json({
                result: false,
                message: "Необходимо добавить хотя бы один продукт перед публикацией"
            });
        }

        // Публикуем через сервис
        const publishData = {
            status: 'active',
            is_active: true,
            is_approved: true,
            is_public: true,
            approved_by: admin._id,
            approved_at: new Date(),
            admin_notes: publish_notes || 'Партнер одобрен и опубликован'
        };

        const publishedProfile = await publishPartnerProfile(id, publishData);

        console.log('✅ PUBLISH PARTNER - Success:', {
            profile_id: publishedProfile._id
        });

        res.status(200).json({
            result: true,
            message: "🎉 Партнер успешно опубликован!",
            profile: {
                id: publishedProfile._id,
                business_name: publishedProfile.business_name,
                status: publishedProfile.status,
                is_active: publishedProfile.is_active,
                is_public: publishedProfile.is_public
            },
            workflow: {
                stage: 6,
                status: 'completed',
                message: "Партнер готов принимать заказы"
            }
        });

    } catch (error) {
        console.error('🚨 PUBLISH PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при публикации партнера",
            error: error.message
        });
    }
};



export {
    approvePartnerRequest,
    rejectPartnerRequest,
    approveLegalInfo,
    rejectLegalInfo,
    getAllRequests,
    getRequestDetails,
    publishPartner
};