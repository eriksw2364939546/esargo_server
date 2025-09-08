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
import { decryptString, cryptoString } from '../utils/crypto.js';

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
 * ЭТАП 4: Одобрение юридических документов и создание профиля
 * POST /api/admin/partners/legal/:id/approve
 * ✅ ПОЛНОСТЬЮ ИСПРАВЛЕНО: Расшифровка данных + создание профиля + проверка всех полей
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
        const legalInfo = await PartnerLegalInfo.findById(id)
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

        // ✅ ИСПРАВЛЕНО: Полная расшифровка всех данных
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

        // Расшифровываем юридические данные
        const decryptedLegalData = {
            legal_name: decryptString(legalInfo.legal_data.legal_name),
            siret_number: decryptString(legalInfo.legal_data.siret_number),
            legal_address: decryptString(legalInfo.legal_data.legal_address),
            legal_representative: decryptString(legalInfo.legal_data.legal_representative),
            tva_number: legalInfo.legal_data.tva_number ? 
                decryptString(legalInfo.legal_data.tva_number) : null
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
            },
            legal: {
                has_legal_name: !!decryptedLegalData.legal_name,
                has_siret: !!decryptedLegalData.siret_number,
                has_legal_address: !!decryptedLegalData.legal_address
            }
        });

        // ✅ ПРОВЕРКА ВСЕХ ОБЯЗАТЕЛЬНЫХ ПОЛЕЙ PartnerProfile
        const requiredProfileFields = {
            user_id: legalInfo.user_id._id,
            business_name: request.business_data.business_name,
            brand_name: request.business_data.brand_name,
            category: request.business_data.category,
            address: decryptedBusinessData.address,
            phone: decryptedPersonalData.phone,
            email: decryptedPersonalData.email,
            owner_name: decryptedPersonalData.first_name,
            owner_surname: decryptedPersonalData.last_name,
            location: request.business_data.location
        };

        // Проверяем что все обязательные поля заполнены
        const missingProfileFields = Object.entries(requiredProfileFields)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingProfileFields.length > 0) {
            console.error('❌ MISSING PROFILE FIELDS:', missingProfileFields);
            return res.status(400).json({
                result: false,
                message: `Отсутствуют данные для создания профиля: ${missingProfileFields.join(', ')}`,
                required_fields: Object.keys(requiredProfileFields),
                missing_fields: missingProfileFields
            });
        }

        // ✅ ИСПРАВЛЕНО: Полное создание профиля со ВСЕМИ обязательными полями
        const profileData = {
            user_id: legalInfo.user_id._id,
            
            // ✅ ОСНОВНАЯ ИНФОРМАЦИЯ БИЗНЕСА (обязательные поля)
            business_name: request.business_data.business_name, // НЕ зашифровано
            brand_name: request.business_data.brand_name || request.business_data.business_name,
            category: request.business_data.category, // 'restaurant' или 'store'
            description: '', // Заполнит партнер позже
            
            // ✅ ЗАШИФРОВАННЫЕ ДАННЫЕ (обязательные) - ПЕРЕШИФРОВЫВАЕМ для профиля
            address: cryptoString(decryptedBusinessData.address),
            phone: cryptoString(decryptedPersonalData.phone),
            email: cryptoString(decryptedPersonalData.email),
            owner_name: cryptoString(decryptedPersonalData.first_name),
            owner_surname: cryptoString(decryptedPersonalData.last_name),
            
            // ✅ ГЕОЛОКАЦИЯ (обязательная) - копируем из заявки
            location: {
                type: 'Point',
                coordinates: request.business_data.location.coordinates // [longitude, latitude]
            },
            
            // ✅ ОПЦИОНАЛЬНЫЕ ПОЛЯ
            floor_unit: decryptedBusinessData.floor_unit ? 
                cryptoString(decryptedBusinessData.floor_unit) : null,
            
            // ✅ ИСПРАВЛЕНО: Профиль сразу одобрен для работы с меню
            content_status: 'awaiting_content',  // ✅ Правильное значение из enum
            approval_status: 'awaiting_content', // ✅ Правильное значение из enum
            is_approved: true,                   // ✅ ИСПРАВЛЕНО: true вместо false
            is_active: false,                    // Станет true после публикации
            is_public: false,                    // Станет true после публикации
            
            // 🏢 СВЯЗКА С ЮРИДИЧЕСКОЙ ИНФОРМАЦИЕЙ
            legal_info_id: legalInfo._id,
            
            // 📊 ИНИЦИАЛИЗАЦИЯ СТАТИСТИКИ
            stats: {
                total_orders: 0,
                completed_orders: 0,
                total_revenue: 0,
                avg_order_value: 0,
                total_products: 0,
                active_products: 0,
                total_categories: 0,
                total_gallery_images: 0,
                last_stats_update: new Date(),
                cancelled_orders: 0
            },
            
            // 🎨 РЕЙТИНГ И ОТЗЫВЫ
            ratings: {
                avg_rating: 0,
                total_reviews: 0,
                rating_breakdown: {
                    five_star: 0,
                    four_star: 0,
                    three_star: 0,
                    two_star: 0,
                    one_star: 0
                }
            },
            
            // 🕒 РАБОЧИЕ ЧАСЫ (по умолчанию)
            working_hours: {
                monday: { is_open: true, open_time: "09:00", close_time: "21:00" },
                tuesday: { is_open: true, open_time: "09:00", close_time: "21:00" },
                wednesday: { is_open: true, open_time: "09:00", close_time: "21:00" },
                thursday: { is_open: true, open_time: "09:00", close_time: "21:00" },
                friday: { is_open: true, open_time: "09:00", close_time: "21:00" },
                saturday: { is_open: true, open_time: "09:00", close_time: "21:00" },
                sunday: { is_open: false, open_time: "09:00", close_time: "21:00" }
            }
        };

        console.log('🔍 PROFILE DATA PREPARED:', {
            has_all_required_fields: true,
            content_status: profileData.content_status,   // ✅ Проверяем правильное значение
            approval_status: profileData.approval_status, // ✅ Проверяем правильное значение
            category: profileData.category,
            location_coordinates: profileData.location.coordinates
        });

        console.log('✅ PROFILE DATA VALIDATION:', {
            user_id: !!profileData.user_id,
            business_name: !!profileData.business_name,
            brand_name: !!profileData.brand_name,
            category: profileData.category,
            has_address: !!profileData.address,
            has_phone: !!profileData.phone,
            has_email: !!profileData.email,
            has_owner_name: !!profileData.owner_name,
            has_owner_surname: !!profileData.owner_surname,
            location_valid: profileData.location && 
                           profileData.location.type === 'Point' && 
                           Array.isArray(profileData.location.coordinates) &&
                           profileData.location.coordinates.length === 2,
            all_required_fields_present: true
        });

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

        // ✅ СОЗДАЕМ ПРОФИЛЬ с полными данными через сервис
        const newProfile = await createPartnerProfile(profileData);

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
            message: "🎉 Документы одобрены и профиль партнера создан!",
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
                completion_percentage: 67, // 4/6 * 100
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
const getAllProfiles = async (req, res) => {
    try {
        const { admin } = req;
        const { 
            category, 
            is_active,
            is_public,
            page = 1, 
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Строим фильтры
        const filters = {};
        if (category) filters.category = category;
        if (is_active !== undefined) filters.is_active = is_active === 'true';
        if (is_public !== undefined) filters.is_public = is_public === 'true';

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const profiles = await PartnerProfile
            .find(filters)
            .select('business_name brand_name category is_active is_public content_status approval_status createdAt updatedAt stats')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await PartnerProfile.countDocuments(filters);

        res.status(200).json({
            result: true,
            message: "Список профилей получен",
            profiles: profiles,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('GET ALL PROFILES - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при получении профилей",
            error: error.message
        });
    }
};

const getProfileDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID профиля"
            });
        }

        const profile = await PartnerProfile.findById(id);
        if (!profile) {
            return res.status(404).json({
                result: false,
                message: "Профиль не найден"
            });
        }

        res.status(200).json({
            result: true,
            message: "Детали профиля получены",
            profile: profile
        });

    } catch (error) {
        console.error('GET PROFILE DETAILS - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при получении деталей профиля",
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

        // ✅ ИСПРАВЛЕНО: Проверяем правильные статусы из модели
        if (profile.is_public === true) {
            return res.status(400).json({
                result: false,
                message: `Партнер уже опубликован. Статус: активен`
            });
        }

        // Проверяем что партнер одобрен
        if (!profile.is_approved) {
            return res.status(400).json({
                result: false,
                message: "Партнер должен быть одобрен перед публикацией"
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

        // ✅ ИСПРАВЛЕНО: Правильные поля для публикации согласно модели
        const publishData = {
            // Основные статусы публикации
            is_active: true,          // Активен для работы  
            is_public: true,          // Виден клиентам
            
            // Административные поля
            approved_by: admin._id,
            approved_at: new Date(),
            published_at: new Date(),
            
            // Обновляем статусы контента
            content_status: 'approved',    // Контент одобрен
            approval_status: 'approved',   // Профиль одобрен
        };

        // Публикуем через сервис
        const publishedProfile = await publishPartnerProfile(id, publishData);

        console.log('✅ PUBLISH PARTNER - Success:', {
            profile_id: publishedProfile._id,
            is_active: publishedProfile.is_active,
            is_public: publishedProfile.is_public
        });

        res.status(200).json({
            result: true,
            message: "🎉 Партнер успешно опубликован!",
            profile: {
                id: publishedProfile._id,
                business_name: publishedProfile.business_name,
                is_active: publishedProfile.is_active,
                is_public: publishedProfile.is_public,
                content_status: publishedProfile.content_status,
                approval_status: publishedProfile.approval_status,
                published_at: publishedProfile.published_at
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
    getAllProfiles,
    getProfileDetails,
    publishPartner
};