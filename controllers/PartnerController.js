// ================ controllers/PartnerController.js (С META) ================
import { User, PartnerProfile, InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { createPartnerAccount, loginPartner } from '../services/partner.auth.service.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import { hashMeta } from '../utils/hash.js';
import mongoose from 'mongoose';

/**
 * ЭТАП 1: Регистрация партнера
 * Создает User + Meta + InitialPartnerRequest
 */
const registerPartner = async (req, res) => {
    try {
        const partnerData = req.body;
        
        console.log('🔍 REGISTER PARTNER - Start:', {
            email: partnerData.email,
            business_name: partnerData.business_name,
            category: partnerData.category
        });

        // Валидация обязательных полей
        const requiredFields = [
            'first_name', 'last_name', 'email', 'password', 'confirm_password',
            'phone', 'business_name', 'category', 'address', 'location'
        ];

        const missingFields = requiredFields.filter(field => !partnerData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля: ${missingFields.join(', ')}`
            });
        }

        // Проверка паролей
        if (partnerData.password !== partnerData.confirm_password) {
            return res.status(400).json({
                result: false,
                message: "Пароли не совпадают"
            });
        }

        // Проверка категории
        if (!['restaurant', 'store'].includes(partnerData.category)) {
            return res.status(400).json({
                result: false,
                message: "Категория должна быть 'restaurant' или 'store'"
            });
        }

        // Проверяем существование через Meta
        const normalizedEmail = partnerData.email.toLowerCase().trim();
        const existingMeta = await Meta.findByEmailAndRole(hashMeta(normalizedEmail), 'partner');
        
        if (existingMeta) {
            return res.status(400).json({
                result: false,
                message: "Партнер с таким email уже существует"
            });
        }

        // Добавляем IP и User-Agent
        partnerData.registration_ip = req.ip;
        partnerData.user_agent = req.get('User-Agent');

        // Создаем аккаунт через сервис
        const result = await createPartnerAccount(partnerData);

        if (!result.isNewPartner) {
            return res.status(400).json({
                result: false,
                message: "Ошибка при создании партнера"
            });
        }

        console.log('✅ REGISTER PARTNER - Success:', {
            user_id: result.user._id,
            request_id: result.request._id,
            meta_id: result.meta._id,
            has_token: !!result.token
        });

        res.status(201).json({
            result: true,
            message: "Регистрация успешна! Следующий шаг - подача юридических документов.",
            user: {
                id: result.user._id,
                email: result.user.email,
                role: result.user.role
            },
            request: {
                id: result.request._id,
                status: result.request.status,
                business_name: result.request.business_data.business_name
            },
            token: result.token,
            next_step: {
                action: "submit_legal_info",
                endpoint: `POST /api/partners/legal-info/${result.request._id}`,
                description: "Подайте юридические документы для проверки"
            }
        });

    } catch (error) {
        console.error('🚨 REGISTER PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при регистрации партнера",
            error: error.message
        });
    }
};

/**
 * Авторизация партнера
 */
const loginPartnerController = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔍 LOGIN PARTNER - Start:', {
            email: email
        });

        if (!email || !password) {
            return res.status(400).json({
                result: false,
                message: "Email и пароль обязательны"
            });
        }

        const { token, partner } = await loginPartner({ email, password });

        console.log('✅ LOGIN PARTNER - Success:', {
            partner_id: partner.id,
            has_profile: !!partner.profile
        });

        res.status(200).json({
            result: true,
            message: "Авторизация успешна",
            token,
            partner
        });

    } catch (error) {
        console.error('🚨 LOGIN PARTNER - Error:', error);
        res.status(error.statusCode || 500).json({
            result: false,
            message: error.message || "Ошибка авторизации"
        });
    }
};

/**
 * Верификация токена партнера
 */
const verifyPartner = async (req, res) => {
    try {
        const { partner, metaInfo } = req;

        if (!partner) {
            return res.status(404).json({
                result: false,
                message: "Партнер не определен!"
            });
        }

        // Получаем полную информацию
        const partnerProfile = await PartnerProfile.findOne({ user_id: partner._id });
        const partnerRequest = await InitialPartnerRequest.findOne({ user_id: partner._id });

        res.status(200).json({
            result: true,
            message: "Партнер верифицирован",
            partner: {
                id: partner._id,
                email: partner.email,
                role: partner.role,
                is_active: partner.is_active
            },
            profile: partnerProfile,
            request: partnerRequest ? {
                id: partnerRequest._id,
                status: partnerRequest.status,
                stage: partnerRequest.workflow_stage
            } : null
        });

    } catch (error) {
        console.error('🚨 VERIFY PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка верификации",
            error: error.message
        });
    }
};

/**
 * Получение профиля партнера
 */
const getProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;

        console.log('🔍 GET PROFILE - Start:', {
            partner_id: partner._id,
            requested_id: id
        });

        // Если запрашивается конкретный ID
        let targetPartnerId = partner._id;
        if (id && mongoose.Types.ObjectId.isValid(id)) {
            targetPartnerId = id;
        }

        // Проверяем что партнер может просматривать только свой профиль
        if (targetPartnerId.toString() !== partner._id.toString()) {
            return res.status(403).json({
                result: false,
                message: "Доступ запрещен"
            });
        }

        const partnerProfile = await PartnerProfile.findOne({ 
            user_id: targetPartnerId 
        });

        if (!partnerProfile) {
            return res.status(404).json({
                result: false,
                message: "Профиль партнера не найден"
            });
        }

        res.status(200).json({
            result: true,
            message: "Профиль партнера получен",
            profile: partnerProfile
        });

    } catch (error) {
        console.error('🚨 GET PROFILE - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка получения профиля",
            error: error.message
        });
    }
};

/**
 * Обновление профиля партнера
 */
const updateProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;
        const updateData = req.body;

        console.log('🔍 UPDATE PROFILE - Start:', {
            partner_id: partner._id,
            profile_id: id,
            fields: Object.keys(updateData)
        });

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID профиля"
            });
        }

        const partnerProfile = await PartnerProfile.findOne({
            _id: id,
            user_id: partner._id
        });

        if (!partnerProfile) {
            return res.status(404).json({
                result: false,
                message: "Профиль не найден"
            });
        }

        // Запрещаем менять критические поля
        const protectedFields = ['user_id', 'status', 'is_active', 'is_approved'];
        protectedFields.forEach(field => delete updateData[field]);

        // Обновляем профиль
        Object.assign(partnerProfile, updateData);
        await partnerProfile.save();

        console.log('✅ UPDATE PROFILE - Success');

        res.status(200).json({
            result: true,
            message: "Профиль обновлен",
            profile: partnerProfile
        });

    } catch (error) {
        console.error('🚨 UPDATE PROFILE - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка обновления профиля",
            error: error.message
        });
    }
};

/**
 * Удаление партнера (полное удаление из системы)
 */
const deletePartner = async (req, res) => {
    const session = await mongoose.startSession();
    
    try {
        const { partner } = req;
        const { id } = req.params;

        console.log('🔍 DELETE PARTNER - Start:', {
            requester_id: partner._id,
            target_id: id
        });

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                result: false,
                message: "Неверный ID партнера"
            });
        }

        // Партнер может удалить только себя
        if (id !== partner._id.toString()) {
            return res.status(403).json({
                result: false,
                message: "Вы можете удалить только свой аккаунт"
            });
        }

        await session.withTransaction(async () => {
            // 1. Находим все связанные данные
            const partnerToDelete = await User.findById(id).session(session);
            
            if (!partnerToDelete) {
                throw new Error("Партнер не найден");
            }

            // 2. Удаляем Meta запись
            await Meta.deleteOne({ partner: id }).session(session);
            console.log('✅ Meta запись удалена');

            // 3. Удаляем InitialPartnerRequest
            await InitialPartnerRequest.deleteOne({ user_id: id }).session(session);
            console.log('✅ Заявка партнера удалена');

            // 4. Удаляем PartnerLegalInfo
            await PartnerLegalInfo.deleteOne({ user_id: id }).session(session);
            console.log('✅ Юридические данные удалены');

            // 5. Удаляем PartnerProfile
            await PartnerProfile.deleteOne({ user_id: id }).session(session);
            console.log('✅ Профиль партнера удален');

            // 6. Удаляем самого пользователя
            await User.findByIdAndDelete(id).session(session);
            console.log('✅ Пользователь удален');
        });

        console.log('✅ DELETE PARTNER - Success');

        res.status(200).json({
            result: true,
            message: "Партнер успешно удален из системы",
            deletedPartner: {
                id: id,
                email: partner.email
            }
        });

    } catch (error) {
        console.error('🚨 DELETE PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при удалении партнера",
            error: error.message
        });
    } finally {
        await session.endSession();
    }
};

/**
 * Получение статуса дашборда партнера
 */
const getDashboardStatus = async (req, res) => {
    try {
        const { partner } = req;

        console.log('🔍 GET DASHBOARD - Start:', {
            partner_id: partner._id
        });

        // Получаем все связанные данные
        const partnerRequest = await InitialPartnerRequest.findOne({ 
            user_id: partner._id 
        });
        
        const legalInfo = await PartnerLegalInfo.findOne({ 
            user_id: partner._id 
        });
        
        const partnerProfile = await PartnerProfile.findOne({ 
            user_id: partner._id 
        });

        // Определяем текущий этап
        let currentStage = 1;
        let nextAction = null;
        let availableFeatures = [];

        if (!partnerRequest) {
            currentStage = 0;
            nextAction = {
                action: "register",
                description: "Необходимо зарегистрироваться как партнер"
            };
        } else if (partnerRequest.status === 'pending') {
            currentStage = 1;
            nextAction = {
                action: "wait_approval",
                description: "Ожидайте одобрения заявки администратором"
            };
        } else if (partnerRequest.status === 'approved' && !legalInfo) {
            currentStage = 2;
            nextAction = {
                action: "submit_legal_info",
                endpoint: `POST /api/partners/legal-info/${partnerRequest._id}`,
                description: "Подайте юридические документы"
            };
            availableFeatures = ['dashboard', 'personal_data'];
        } else if (legalInfo && legalInfo.verification_status === 'pending') {
            currentStage = 3;
            nextAction = {
                action: "wait_legal_verification",
                description: "Юридические документы на проверке"
            };
            availableFeatures = ['dashboard', 'personal_data'];
        } else if (legalInfo && legalInfo.verification_status === 'verified' && !partnerProfile) {
            currentStage = 3.5;
            nextAction = {
                action: "profile_creation",
                description: "Профиль создается администратором"
            };
            availableFeatures = ['dashboard', 'personal_data'];
        } else if (partnerProfile && partnerProfile.status === 'draft') {
            currentStage = 4;
            nextAction = {
                action: "fill_profile",
                description: "Заполните профиль и меню"
            };
            availableFeatures = ['dashboard', 'personal_data', 'profile', 'menu'];
        } else if (partnerProfile && partnerProfile.status === 'pending_approval') {
            currentStage = 5;
            nextAction = {
                action: "wait_content_approval",
                description: "Контент на проверке у администратора"
            };
            availableFeatures = ['dashboard', 'personal_data', 'profile', 'menu'];
        } else if (partnerProfile && partnerProfile.status === 'active') {
            currentStage = 6;
            nextAction = {
                action: "manage_business",
                description: "Управляйте вашим бизнесом"
            };
            availableFeatures = ['dashboard', 'personal_data', 'profile', 'menu', 'orders', 'analytics'];
        }

        console.log('✅ GET DASHBOARD - Success:', {
            current_stage: currentStage,
            available_features: availableFeatures
        });

        res.status(200).json({
            result: true,
            message: "Статус дашборда получен",
            dashboard: {
                current_stage: currentStage,
                stage_name: getStageNameByNumber(currentStage),
                next_action: nextAction,
                available_features: availableFeatures,
                partner_request: partnerRequest ? {
                    id: partnerRequest._id,
                    status: partnerRequest.status,
                    created_at: partnerRequest.createdAt
                } : null,
                legal_info: legalInfo ? {
                    id: legalInfo._id,
                    status: legalInfo.verification_status,
                    submitted_at: legalInfo.createdAt
                } : null,
                profile: partnerProfile ? {
                    id: partnerProfile._id,
                    status: partnerProfile.status,
                    is_active: partnerProfile.is_active
                } : null
            }
        });

    } catch (error) {
        console.error('🚨 GET DASHBOARD - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка получения статуса",
            error: error.message
        });
    }
};

/**
 * ЭТАП 2: Подача юридических документов
 */
const submitLegalInfo = async (req, res) => {
    try {
        const { partner, partnerRequest } = req;
        const legalData = req.body;

        console.log('🔍 SUBMIT LEGAL INFO - Start:', {
            partner_id: partner._id,
            request_id: partnerRequest._id
        });

        // Проверяем статус заявки
        if (partnerRequest.status !== 'approved') {
            return res.status(403).json({
                result: false,
                message: "Заявка должна быть одобрена перед подачей документов"
            });
        }

        // Проверяем не поданы ли уже документы
        const existingLegal = await PartnerLegalInfo.findOne({ 
            user_id: partner._id 
        });

        if (existingLegal) {
            return res.status(400).json({
                result: false,
                message: "Юридические документы уже поданы",
                legal_status: existingLegal.verification_status
            });
        }

        // Валидация обязательных полей
        const requiredFields = [
            'legal_name', 'siret_number', 'legal_form', 
            'business_address', 'bank_details'
        ];

        const missingFields = requiredFields.filter(field => !legalData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля: ${missingFields.join(', ')}`
            });
        }

        // Создаем запись с зашифрованными данными
        const newLegalInfo = new PartnerLegalInfo({
            user_id: partner._id,
            partner_request_id: partnerRequest._id,
            legal_data: {
                legal_name: cryptoString(legalData.legal_name),
                siret_number: cryptoString(legalData.siret_number),
                legal_form: legalData.legal_form,
                business_address: cryptoString(legalData.business_address),
                bank_details: cryptoString(JSON.stringify(legalData.bank_details)),
                tax_number: legalData.tax_number ? cryptoString(legalData.tax_number) : null,
                contact_person: legalData.contact_person ? cryptoString(legalData.contact_person) : null,
                contact_phone: legalData.contact_phone ? cryptoString(legalData.contact_phone) : null
            },
            verification_status: 'pending',
            security_info: {
                submitted_ip: req.ip,
                user_agent: req.get('User-Agent')
            }
        });

        await newLegalInfo.save();

        // Обновляем статус заявки
        partnerRequest.status = 'under_review';
        partnerRequest.workflow_stage = 3;
        await partnerRequest.save();

        console.log('✅ SUBMIT LEGAL INFO - Success:', {
            legal_id: newLegalInfo._id
        });

        res.status(201).json({
            result: true,
            message: "Юридические документы поданы на проверку",
            legal_info: {
                id: newLegalInfo._id,
                status: newLegalInfo.verification_status
            },
            next_step: {
                action: "wait_verification",
                description: "Ожидайте проверки документов администратором"
            }
        });

    } catch (error) {
        console.error('🚨 SUBMIT LEGAL INFO - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка при подаче документов",
            error: error.message
        });
    }
};

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

function getStageNameByNumber(stage) {
    const stages = {
        0: "Не зарегистрирован",
        1: "Заявка подана",
        2: "Заявка одобрена",
        3: "Документы на проверке",
        3.5: "Создание профиля",
        4: "Заполнение контента",
        5: "Контент на проверке",
        6: "Активный партнер"
    };
    return stages[stage] || "Неизвестный этап";
}

export {
    registerPartner,
    loginPartnerController,
    verifyPartner,
    getProfile,
    updateProfile,
    deletePartner,
    getDashboardStatus,
    submitLegalInfo
};