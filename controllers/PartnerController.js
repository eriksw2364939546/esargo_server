// ================ controllers/PartnerController.js (ОБНОВЛЕННЫЙ) ================
import { createPartnerAccount, loginPartner, checkPartnerExists } from '../services/Partner/partner.auth.service.js';
import * as partnerService from '../services/Partner/partner.service.js';

/**
 * ЭТАП 1: Регистрация партнера
 * ✅ ОБНОВЛЕНО: Теперь возвращает токен при успешной регистрации
 */
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

        console.log('✅ REGISTER PARTNER - Success with token');

        // ✅ ОБНОВЛЕНО: Возвращаем токен при регистрации
        res.status(201).json({
            result: true,
            message: "Регистрация успешна! Вы получили токен доступа. Следующий шаг - ждите одобрения администратора.",
            token: result.token, // 🆕 НОВОЕ: Токен при регистрации
            user: {
                id: result.partner.id,
                email: result.partner.email,
                role: result.partner.role
            },
            request: {
                id: result.partner.request._id,
                status: result.partner.request.status,
                business_name: result.partner.request.business_data.business_name
            },
            next_step: {
                action: "wait_for_admin_approval",
                description: "Ваша заявка отправлена на рассмотрение администратору",
                current_status: "pending",
                available_endpoints: {
                    verify_token: "GET /api/partners/verify",
                    dashboard: "GET /api/partners/dashboard"
                }
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

        // Получаем заявку партнера для статуса
        const partnerRequest = await partnerService.getPartnerRequest(partner._id);
        const partnerProfile = await partnerService.getPartnerProfile(partner._id);

        res.status(200).json({
            result: true,
            message: "Токен действителен",
            partner: {
                id: partner._id,
                role: partner.role,
                is_active: partner.is_active,
                is_email_verified: partner.is_email_verified,
                request_status: partnerRequest ? partnerRequest.status : null,
                has_profile: !!partnerProfile,
                workflow_stage: partnerRequest ? partnerRequest.workflow_stage : null
            }
        });

    } catch (error) {
        console.error('🚨 VERIFY PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка верификации токена",
            error: error.message
        });
    }
};

/**
 * Получение статуса личного кабинета
 */
const getDashboardStatus = async (req, res) => {
    try {
        const { partner } = req;

        // Получаем все данные партнера
        const partnerRequest = await partnerService.getPartnerRequest(partner._id);
        const partnerProfile = await partnerService.getPartnerProfile(partner._id);
        const legalInfo = await partnerService.getPartnerLegalInfo(partner._id);

        res.status(200).json({
            result: true,
            message: "Статус личного кабинета",
            dashboard: {
                user: {
                    id: partner._id,
                    role: partner.role,
                    is_active: partner.is_active,
                    is_email_verified: partner.is_email_verified,
                    registration_date: partner.createdAt
                },
                workflow: {
                    current_stage: partnerRequest ? partnerRequest.workflow_stage : 0,
                    status: partnerRequest ? partnerRequest.status : 'not_found',
                    business_name: partnerRequest ? partnerRequest.business_data.business_name : null
                },
                permissions: {
                    can_submit_legal: partnerRequest && partnerRequest.status === 'approved',
                    can_create_profile: legalInfo && legalInfo.status === 'approved',
                    can_manage_content: partnerProfile && partnerProfile.is_published
                },
                next_actions: getNextActions(partnerRequest, legalInfo, partnerProfile)
            }
        });

    } catch (error) {
        console.error('🚨 GET DASHBOARD STATUS - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка получения статуса кабинета",
            error: error.message
        });
    }
};

/**
 * Вспомогательная функция для определения следующих действий
 */
const getNextActions = (request, legal, profile) => {
    const actions = [];

    if (!request) {
        actions.push({
            action: "submit_request",
            description: "Подать заявку на регистрацию",
            status: "required"
        });
    } else if (request.status === 'pending') {
        actions.push({
            action: "wait_approval",
            description: "Ожидайте одобрения заявки администратором",
            status: "waiting"
        });
    } else if (request.status === 'approved' && !legal) {
        actions.push({
            action: "submit_legal",
            description: "Подать юридические документы",
            status: "available"
        });
    } else if (legal && legal.status === 'pending') {
        actions.push({
            action: "wait_legal_approval",
            description: "Ожидайте проверки документов",
            status: "waiting"
        });
    } else if (legal && legal.status === 'approved' && !profile) {
        actions.push({
            action: "create_profile",
            description: "Создать профиль заведения",
            status: "available"
        });
    } else if (profile && !profile.is_published) {
        actions.push({
            action: "wait_publication",
            description: "Ожидайте финальной публикации",
            status: "waiting"
        });
    } else if (profile && profile.is_published) {
        actions.push({
            action: "manage_content",
            description: "Управление контентом заведения",
            status: "active"
        });
    }

    return actions;
};

// Остальные методы без изменений...
const getProfile = async (req, res) => {
    // Реализация получения профиля
};

const updateProfile = async (req, res) => {
    // Реализация обновления профиля
};

const deletePartner = async (req, res) => {
    // Реализация удаления партнера
};

const submitLegalInfo = async (req, res) => {
    // Реализация подачи юридических документов
};

export {
    registerPartner,
    loginPartnerController,
    verifyPartner,
    getDashboardStatus,
    getProfile,
    updateProfile,
    deletePartner,
    submitLegalInfo
};