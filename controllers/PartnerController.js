// ================ controllers/PartnerController.js (ИСПРАВЛЕННЫЙ) ================
import { createPartnerAccount, loginPartner, checkPartnerExists } from '../services/Partner/partner.auth.service.js';
import * as partnerService from '../services/Partner/partner.service.js';
// ================== КОНТРОЛЛЕРЫ РАБОТАЮТ ТОЛЬКО С REQ/RES ==================
// Вся бизнес-логика в сервисах



// ЭТАП 1: Регистрация партнера
// Только валидация и передача в сервис
 
const registerPartner = async (req, res) => {
    try {
        const partnerData = req.body;
        
        console.log('🔍 REGISTER PARTNER - Start:', {
            email: partnerData.email,
            business_name: partnerData.business_name,
            category: partnerData.category
        });

        // Простая валидация обязательных полей
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

        // Проверяем существование через сервис
        const exists = await checkPartnerExists(partnerData.email);
        
        if (exists) {
            return res.status(400).json({
                result: false,
                message: "Партнер с таким email уже существует"
            });
        }

        // Добавляем метаданные
        partnerData.registration_ip = req.ip;
        partnerData.user_agent = req.get('User-Agent');

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await createPartnerAccount(partnerData);

        if (!result.isNewPartner) {
            return res.status(400).json({
                result: false,
                message: "Ошибка при создании партнера"
            });
        }

        console.log('✅ REGISTER PARTNER - Success');

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
 * Только передача данных в сервис
 */
const loginPartnerController = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔍 LOGIN PARTNER - Start:', { email });

        if (!email || !password) {
            return res.status(400).json({
                result: false,
                message: "Email и пароль обязательны"
            });
        }

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const { token, partner } = await loginPartner({ email, password });

        console.log('✅ LOGIN PARTNER - Success');

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
 * Простой ответ с данными из middleware
 */
const verifyPartner = async (req, res) => {
    try {
        const { partner } = req;

        if (!partner) {
            return res.status(404).json({
                result: false,
                message: "Партнер не определен!"
            });
        }

        // ✅ ПОЛУЧАЕМ ПОЛНУЮ ИНФОРМАЦИЮ ЧЕРЕЗ СЕРВИС
        const partnerInfo = await partnerService.getPartnerFullInfo(partner._id);

        res.status(200).json({
            result: true,
            message: "Партнер верифицирован",
            partner: partnerInfo.partner,
            profile: partnerInfo.profile,
            request: partnerInfo.request,
            legal_info: partnerInfo.legalInfo
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
 * Получение статуса дашборда партнера
 * Логика workflow в сервисе
 */
const getDashboardStatus = async (req, res) => {
    try {
        const { partner } = req;

        console.log('🔍 GET DASHBOARD - Start:', { partner_id: partner._id });

        // ✅ ВСЯ ЛОГИКА WORKFLOW В СЕРВИСЕ
        const dashboardData = await partnerService.getDashboardWorkflow(partner._id);

        console.log('✅ GET DASHBOARD - Success');

        res.status(200).json({
            result: true,
            message: "Статус дашборда получен",
            workflow: dashboardData.workflow,
            partner_info: dashboardData.partner_info
        });

    } catch (error) {
        console.error('🚨 GET DASHBOARD - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка получения статуса дашборда",
            error: error.message
        });
    }
};

/**
 * Подача юридических документов
 * Простая валидация и передача в сервис
 */
const submitLegalInfo = async (req, res) => {
    try {
        const { request_id } = req.params;
        const legalData = req.body;

        console.log('🔍 SUBMIT LEGAL INFO - Start:', { request_id });

        // Простая валидация
        if (!request_id) {
            return res.status(400).json({
                result: false,
                message: "ID заявки обязателен"
            });
        }

        const requiredFields = ['company_name', 'legal_address', 'tax_number'];
        const missingFields = requiredFields.filter(field => !legalData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля: ${missingFields.join(', ')}`
            });
        }

        // Метаданные
        const metadata = {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        };

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await partnerService.submitLegalDocuments(request_id, legalData, metadata);

        console.log('✅ SUBMIT LEGAL INFO - Success');

        res.status(201).json({
            result: true,
            message: "Юридические документы поданы на проверку",
            legal_info: result.legal_info,
            next_step: {
                action: "wait_verification",
                description: "Ожидайте проверки документов администратором"
            }
        });

    } catch (error) {
        console.error('🚨 SUBMIT LEGAL INFO - Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка при подаче документов",
            error: error.message
        });
    }
};

/**
 * Получение профиля партнера
 * Права проверяются в middleware
 */
const getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { partnerProfile } = req; // Из middleware checkProfileAccess

        console.log('🔍 GET PROFILE - Start:', { profile_id: id });

        // Если профиль уже получен в middleware, используем его
        if (partnerProfile) {
            console.log('✅ GET PROFILE - Success (from middleware)');
            return res.status(200).json({
                result: true,
                message: "Профиль получен",
                profile: partnerProfile,
                permissions: ['view', 'edit', 'delete']
            });
        }

        // Иначе получаем через сервис
        const result = await partnerService.getPartnerProfileById(id);

        console.log('✅ GET PROFILE - Success');

        res.status(200).json({
            result: true,
            message: "Профиль получен",
            profile: result.profile,
            permissions: result.permissions
        });

    } catch (error) {
        console.error('🚨 GET PROFILE - Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка получения профиля"
        });
    }
};

/**
 * Обновление профиля партнера
 * Права проверяются в middleware checkProfileAccess
 */
const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('🔍 UPDATE PROFILE - Start:', { profile_id: id });

        if (!updateData || Object.keys(updateData).length === 0) {
            return res.status(400).json({
                result: false,
                message: "Нет данных для обновления"
            });
        }

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ, ПРАВА УЖЕ ПРОВЕРЕНЫ В MIDDLEWARE
        const result = await partnerService.updatePartnerProfile(id, updateData);

        console.log('✅ UPDATE PROFILE - Success');

        res.status(200).json({
            result: true,
            message: "Профиль обновлен",
            profile: result.profile,
            updated_fields: result.updated_fields
        });

    } catch (error) {
        console.error('🚨 UPDATE PROFILE - Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка обновления профиля"
        });
    }
};

/**
 * Удаление партнера
 * Права проверяются в middleware (партнер может удалить только себя)
 */
const deletePartner = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;

        console.log('🔍 DELETE PARTNER - Start:', {
            requester_id: partner._id,
            target_id: id
        });

        // Простая проверка - партнер может удалить только себя
        if (id !== partner._id.toString()) {
            return res.status(403).json({
                result: false,
                message: "Вы можете удалить только свой аккаунт"
            });
        }

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ, БЕЗ ПРОВЕРКИ ПРАВ
        const result = await partnerService.deletePartnerCompletely(id);

        console.log('✅ DELETE PARTNER - Success');

        res.status(200).json({
            result: true,
            message: "Партнер успешно удален из системы",
            deleted_partner: result
        });

    } catch (error) {
        console.error('🚨 DELETE PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка при удалении партнера"
        });
    }
};

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