// ================ controllers/PartnerController.js (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ) ================
import { createPartnerAccount, loginPartner, checkPartnerExists } from '../services/Partner/partner.auth.service.js';
import * as partnerService from '../services/Partner/partner.service.js';

/**
 * ЭТАП 1: Регистрация партнера
 */
const registerPartner = async (req, res) => {
    try {
        const partnerData = req.body;
        
        console.log('🔍 REGISTER PARTNER - Start:', {
            email: partnerData.email,
            business_name: partnerData.business_name,
            brand_name: partnerData.brand_name, // 🆕 НОВОЕ ПОЛЕ
            category: partnerData.category
        });

        // ✅ ОБНОВЛЕННАЯ валидация обязательных полей под скрин 1
        const requiredFields = [
            // Личные данные (как на скрине)
            'first_name', 'last_name', 'email', 'password', 'confirm_password', 'phone',
            
            // Бизнес данные (как на скрине)
            'address', 'business_name', 'brand_name', 'category',
            
            // Координаты (вместо объекта location)
            'latitude', 'longitude',
            
            // WhatsApp согласие (как на скрине)
            'whatsapp_consent'
        ];

        const missingFields = requiredFields.filter(field => !partnerData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля по скрину 1: ${missingFields.join(', ')}`
            });
        }

        // ✅ НОВАЯ французская валидация телефона
        const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
        const cleanPhone = partnerData.phone.replace(/\s/g, '');
        if (!frenchPhoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный формат французского телефона",
                examples: ["+33 1 42 34 56 78", "01 42 34 56 78"]
            });
        }

        // ✅ Валидация координат (вместо объекта location)
        const latitude = parseFloat(partnerData.latitude);
        const longitude = parseFloat(partnerData.longitude);
        
        if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                result: false,
                message: "Некорректные координаты (latitude: -90 до 90, longitude: -180 до 180)"
            });
        }

        // ✅ Валидация WhatsApp согласия
        if (typeof partnerData.whatsapp_consent !== 'boolean') {
            return res.status(400).json({
                result: false,
                message: "WhatsApp согласие должно быть true или false"
            });
        }

        // Проверка паролей (логика не тронута)
        if (partnerData.password !== partnerData.confirm_password) {
            return res.status(400).json({
                result: false,
                message: "Пароли не совпадают"
            });
        }

        // Проверка категории (логика не тронута)
        if (!['restaurant', 'store'].includes(partnerData.category)) {
            return res.status(400).json({
                result: false,
                message: "Категория должна быть 'restaurant' или 'store'"
            });
        }

        // Проверяем существование через сервис (логика не тронута)
        const exists = await checkPartnerExists(partnerData.email);
        
        if (exists) {
            return res.status(400).json({
                result: false,
                message: "Партнер с таким email уже существует"
            });
        }

        // ✅ ОБНОВЛЕНО: Формируем объект location из координат для совместимости
        partnerData.location = {
            latitude: latitude,
            longitude: longitude
        };

        // Добавляем метаданные (логика не тронута)
        partnerData.registration_ip = req.ip;
        partnerData.user_agent = req.get('User-Agent');

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ (не тронута)
        const result = await createPartnerAccount(partnerData);

        if (!result.isNewPartner) {
            return res.status(400).json({
                result: false,
                message: "Ошибка при создании партнера"
            });
        }

        console.log('✅ REGISTER PARTNER - Success with token');

        // ✅ ОТВЕТ ОБНОВЛЕН: Показываем новые поля
        res.status(201).json({
            result: true,
            message: "Регистрация успешна! Вы получили токен доступа. Следующий шаг - ждите одобрения администратора.",
            token: result.token,
            user: {
                id: result.partner.id,
                email: result.partner.email,
                role: result.partner.role
            },
            business: {
                id: result.partner.request._id,
                business_name: result.partner.request.business_data.business_name,
                brand_name: partnerData.brand_name, // 🆕 НОВОЕ ПОЛЕ в ответе
                category: result.partner.request.business_data.category,
                status: result.partner.request.status,
                has_floor_unit: !!partnerData.floor_unit, // 🆕 НОВОЕ ПОЛЕ
                whatsapp_consent: partnerData.whatsapp_consent // 🆕 НОВОЕ ПОЛЕ
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
 * ✅ ИСПРАВЛЕНО: Упрощенная версия без сложных зависимостей
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

        console.log('🔍 VERIFY PARTNER - Start:', {
            partner_id: partner._id,
            role: partner.role
        });

        // Простой ответ с базовой информацией
        res.status(200).json({
            result: true,
            message: "Токен действителен",
            partner: {
                id: partner._id,
                role: partner.role,
                is_active: partner.is_active,
                is_email_verified: partner.is_email_verified,
                last_login: partner.last_login_at,
                registration_date: partner.createdAt
            },
            token_info: {
                valid: true,
                type: "access_token",
                expires_in: "30d"
            },
            next_steps: {
                dashboard: "GET /api/partners/dashboard",
                profile: "GET /api/partners/profile"
            }
        });

        console.log('✅ VERIFY PARTNER - Success');

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
 * ✅ ОБНОВЛЕНО: Использует новые функции из сервиса
 */
const getDashboardStatus = async (req, res) => {
    try {
        const { partner } = req;

        console.log('🔍 GET DASHBOARD STATUS - Start:', {
            partner_id: partner._id
        });

        // Используем сервис для получения всех данных
        const partnerRequest = await partnerService.getPartnerRequest(partner._id);
        const partnerProfile = await partnerService.getPartnerProfile(partner._id);
        const legalInfo = await partnerService.getPartnerLegalInfo(partner._id);

        // Формируем ответ
        const dashboard = {
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
            content_status: {
                has_request: !!partnerRequest,
                has_legal: !!legalInfo,
                has_profile: !!partnerProfile,
                is_published: partnerProfile ? partnerProfile.is_published : false
            }
        };

        // Определяем следующие действия
        dashboard.next_actions = getNextActions(partnerRequest, legalInfo, partnerProfile);

        res.status(200).json({
            result: true,
            message: "Статус личного кабинета",
            dashboard: dashboard
        });

        console.log('✅ GET DASHBOARD STATUS - Success:', {
            workflow_stage: dashboard.workflow.current_stage,
            status: dashboard.workflow.status,
            has_request: dashboard.content_status.has_request
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
 * ✅ ИСПРАВЛЕНО: Убрана дублированная функция
 */
const getNextActions = (request, legal, profile) => {
    const actions = [];

    if (!request) {
        actions.push({
            action: "submit_request",
            description: "Подать заявку на регистрацию",
            status: "required",
            endpoint: "POST /api/partners/register"
        });
    } else if (request.status === 'pending') {
        actions.push({
            action: "wait_approval",
            description: "Ожидайте одобрения заявки администратором",
            status: "waiting",
            estimated_time: "1-3 рабочих дня"
        });
    } else if (request.status === 'approved' && !legal) {
        actions.push({
            action: "submit_legal",
            description: "Подать юридические документы",
            status: "available",
            endpoint: `POST /api/partners/legal-info/${request._id}`
        });
    } else if (legal && legal.status === 'pending') {
        actions.push({
            action: "wait_legal_approval",
            description: "Ожидайте проверки документов",
            status: "waiting",
            estimated_time: "2-5 рабочих дней"
        });
    } else if (legal && legal.status === 'approved' && !profile) {
        actions.push({
            action: "create_profile",
            description: "Создать профиль заведения",
            status: "available",
            endpoint: "POST /api/partners/profile"
        });
    } else if (profile && !profile.is_published) {
        actions.push({
            action: "wait_publication",
            description: "Ожидайте финальной публикации",
            status: "waiting",
            estimated_time: "1-2 рабочих дня"
        });
    } else if (profile && profile.is_published) {
        actions.push({
            action: "manage_content",
            description: "Управление контентом заведения",
            status: "active",
            endpoints: {
                update_profile: `PUT /api/partners/profile/${profile._id}`,
                manage_products: "GET /api/partners/products",
                view_orders: "GET /api/partners/orders"
            }
        });
    }

    return actions;
};

/**
 * Получение профиля партнера
 * Заглушка для будущей реализации
 */
const getProfile = async (req, res) => {
    try {
        const { partner } = req;
        
        res.status(200).json({
            result: true,
            message: "Получение профиля - функция в разработке",
            partner_id: partner._id
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
 * Заглушка для будущей реализации
 */
const updateProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;
        
        res.status(200).json({
            result: true,
            message: "Обновление профиля - функция в разработке",
            partner_id: partner._id,
            profile_id: id
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
 * Удаление партнера
 * Заглушка для будущей реализации
 */
const deletePartner = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;
        
        res.status(200).json({
            result: true,
            message: "Удаление партнера - функция в разработке",
            partner_id: partner._id,
            target_id: id
        });
        
    } catch (error) {
        console.error('🚨 DELETE PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка удаления партнера",
            error: error.message
        });
    }
};

/**
 * Подача юридических документов
 * Заглушка для будущей реализации
 */
const submitLegalInfo = async (req, res) => {
    try {
        const { partner } = req;
        const { request_id } = req.params;
        
        res.status(200).json({
            result: true,
            message: "Подача юридических документов - функция в разработке",
            partner_id: partner._id,
            request_id: request_id
        });
        
    } catch (error) {
        console.error('🚨 SUBMIT LEGAL INFO - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка подачи документов",
            error: error.message
        });
    }
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