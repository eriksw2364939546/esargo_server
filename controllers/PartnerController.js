// ================ controllers/PartnerController.js (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ) ================
import { createPartnerAccount, loginPartner, checkPartnerExists } from '../services/Partner/partner.auth.service.js';
import * as partnerService from '../services/Partner/partner.service.js';
import { PartnerLegalInfo } from '../models/index.js';
import { cryptoString } from '../utils/crypto.js';
import mongoose from 'mongoose';

/**
 * ЭТАП 1: Регистрация партнера
 * ✅ ОБНОВЛЕНО: Добавлены поля из новой модели InitialPartnerRequest
 */
const registerPartner = async (req, res) => {
    try {
        const partnerData = req.body;
        
        console.log('🔍 REGISTER PARTNER - Start:', {
            email: partnerData.email,
            business_name: partnerData.business_name,
            brand_name: partnerData.brand_name, // 🆕 НОВОЕ ПОЛЕ
            category: partnerData.category,
            has_floor_unit: !!partnerData.floor_unit // 🆕 НОВОЕ ПОЛЕ
        });

        // ✅ ОБНОВЛЕННАЯ валидация обязательных полей (точно по модели InitialPartnerRequest)
        const requiredFields = [
            // Личные данные (personal_data)
            'first_name', 'last_name', 'email', 'password', 'confirm_password', 'phone',
            
            // Бизнес данные (business_data) 
            'address', 'business_name', 'brand_name', 'category',
            
            // Координаты (для location)
            'latitude', 'longitude',
            
            // WhatsApp согласие (marketing_consent.whatsapp_consent)
            'whatsapp_consent'
        ];

        const missingFields = requiredFields.filter(field => !partnerData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля из модели InitialPartnerRequest: ${missingFields.join(', ')}`
            });
        }

        // ✅ НОВАЯ французская валидация телефона (соответствует модели)
        const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
        const cleanPhone = partnerData.phone.replace(/\s/g, '');
        if (!frenchPhoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон должен быть французский формат",
                expected_format: "+33 1 42 34 56 78 или 01 42 34 56 78"
            });
        }

        // ✅ Валидация координат (для поля location в модели)
        const latitude = parseFloat(partnerData.latitude);
        const longitude = parseFloat(partnerData.longitude);
        
        if (isNaN(latitude) || isNaN(longitude) || 
            latitude < -90 || latitude > 90 || 
            longitude < -180 || longitude > 180) {
            return res.status(400).json({
                result: false,
                message: "Некорректные координаты (latitude: -90 до 90, longitude: -180 до 180)"
            });
        }

        // ✅ Валидация WhatsApp согласия (соответствует marketing_consent.whatsapp_consent)
        if (typeof partnerData.whatsapp_consent !== 'boolean') {
            return res.status(400).json({
                result: false,
                message: "whatsapp_consent должно быть true или false"
            });
        }

        // ✅ Валидация brand_name (новое обязательное поле)
        if (!partnerData.brand_name || partnerData.brand_name.trim().length === 0) {
            return res.status(400).json({
                result: false,
                message: "brand_name обязательное поле из модели"
            });
        }

        // floor_unit опциональное, но валидируем если есть
        if (partnerData.floor_unit && typeof partnerData.floor_unit !== 'string') {
            return res.status(400).json({
                result: false,
                message: "floor_unit должно быть строкой"
            });
        }

        // ===== ВСЯ ОСТАЛЬНАЯ ЛОГИКА НЕ ТРОНУТА =====
        
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

        // ✅ ФОРМИРУЕМ location объект из координат (для совместимости с сервисом)
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

        console.log('✅ REGISTER PARTNER - Success with new fields');

        // ✅ ОТВЕТ ОБНОВЛЕН: Показываем новые поля из модели
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
                brand_name: partnerData.brand_name, // 🆕 НОВОЕ ПОЛЕ
                category: result.partner.request.business_data.category,
                status: result.partner.request.status,
                floor_unit: partnerData.floor_unit || null, // 🆕 НОВОЕ ПОЛЕ
                whatsapp_consent: partnerData.whatsapp_consent, // 🆕 НОВОЕ ПОЛЕ
                coordinates: {
                    latitude: latitude,
                    longitude: longitude
                }
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
 */
const getProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;

        console.log('🔍 GET PROFILE - Start:', {
            partner_id: partner._id,
            requested_id: id
        });

        // Определяем чей профиль запрашивается
        const targetPartnerId = id || partner._id;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const profileData = await partnerService.getPartnerFullInfo(targetPartnerId);

        res.status(200).json({
            result: true,
            message: "Профиль партнера получен",
            partner: profileData.partner,
            profile: profileData.profile,
            request: profileData.request,
            legal_info: profileData.legalInfo,
            permissions: {
                can_edit: targetPartnerId === partner._id.toString(),
                can_delete: targetPartnerId === partner._id.toString()
            }
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
 * ✅ ПОЛНАЯ РЕАЛИЗАЦИЯ вместо заглушки
 */
const updateProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;
        const updateData = req.body;

        console.log('🔍 UPDATE PROFILE - Start:', {
            partner_id: partner._id,
            target_id: id,
            update_fields: Object.keys(updateData)
        });

        // Проверка прав доступа (только свой профиль)
        if (id !== partner._id.toString()) {
            return res.status(403).json({
                result: false,
                message: "Можно редактировать только свой профиль"
            });
        }

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const updatedProfile = await partnerService.updatePartnerProfile(partner._id, updateData);

        res.status(200).json({
            result: true,
            message: "Профиль партнера обновлен",
            profile: updatedProfile,
            updated_fields: Object.keys(updateData)
        });
        
    } catch (error) {
        console.error('🚨 UPDATE PROFILE - Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка обновления профиля"
        });
    }
};

/**
 * Удаление партнера
 * ✅ ПОЛНАЯ РЕАЛИЗАЦИЯ вместо заглушки
 */
const deletePartner = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;

        console.log('🔍 DELETE PARTNER - Start:', {
            partner_id: partner._id,
            target_id: id
        });

        // Проверка прав доступа (только свой аккаунт)
        if (id !== partner._id.toString()) {
            return res.status(403).json({
                result: false,
                message: "Можно удалить только свой аккаунт"
            });
        }

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const deleteResult = await partnerService.deletePartnerAccount(partner._id);

        res.status(200).json({
            result: true,
            message: "Аккаунт партнера удален",
            deleted_partner: deleteResult.deleted_partner,
            cleanup_info: deleteResult.cleanup_info
        });
        
    } catch (error) {
        console.error('🚨 DELETE PARTNER - Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка удаления партнера"
        });
    }
};

/**
 * Подача юридических документов
 * ✅ ПОЛНАЯ РЕАЛИЗАЦИЯ: Обработка всех полей модели PartnerLegalInfo
 */
const submitLegalInfo = async (req, res) => {
    try {
        const { partner } = req;
        const { request_id } = req.params;
        const legalData = req.body;

        console.log('🔍 SUBMIT LEGAL INFO - Start:', {
            partner_id: partner._id,
            request_id: request_id,
            has_legal_name: !!legalData.legal_name,
            has_siret: !!legalData.siret_number,
            legal_form: legalData.legal_form
        });

        // ✅ ВАЛИДАЦИЯ ОБЯЗАТЕЛЬНЫХ ПОЛЕЙ (точно по модели PartnerLegalInfo)
        const requiredFields = [
            // 🏢 ЮРИДИЧЕСКИЕ ДАННЫЕ (legal_data)
            'legal_name',           // "Название юридического лица"
            'siret_number',         // "SIRET номер"
            'legal_form',          // "Форма юридического лица"
            'legal_address',       // "Юридический адрес (siège social)"
            'legal_representative', // "Имя и фамилия юр. представителя"
            
            // 🏦 БАНКОВСКИЕ ДАННЫЕ (bank_details)
            'iban',                // "IBAN"
            'bic',                 // "BIC"
            
            // 📞 КОНТАКТНЫЕ ДАННЫЕ (legal_contact)
            'legal_email',         // "Email юр. лица"
            'legal_phone'          // "Телефон юр. лица"
        ];

        const missingFields = requiredFields.filter(field => !legalData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля из модели PartnerLegalInfo: ${missingFields.join(', ')}`
            });
        }

        // ✅ ФРАНЦУЗСКИЕ ВАЛИДАЦИИ

        // Валидация SIRET номера (14 цифр)
        const cleanSiret = legalData.siret_number.replace(/\s/g, '');
        const siretRegex = /^\d{14}$/;
        if (!siretRegex.test(cleanSiret)) {
            return res.status(400).json({
                result: false,
                message: "SIRET номер должен содержать 14 цифр",
                example: "123 456 789 00014"
            });
        }

        // Валидация французского IBAN
        const cleanIban = legalData.iban.replace(/\s/g, '');
        const frenchIbanRegex = /^FR\d{2}[A-Z0-9]{23}$/;
        if (!frenchIbanRegex.test(cleanIban)) {
            return res.status(400).json({
                result: false,
                message: "IBAN должен быть французским форматом",
                example: "FR76 3000 6000 0112 3456 7890 189"
            });
        }

        // Валидация TVA номера (опционально)
        if (legalData.tva_number) {
            const cleanTva = legalData.tva_number.replace(/\s/g, '');
            const frenchTvaRegex = /^FR\d{11}$/;
            if (!frenchTvaRegex.test(cleanTva)) {
                return res.status(400).json({
                    result: false,
                    message: "TVA номер должен быть французским форматом",
                    example: "FR12 345678912"
                });
            }
        }

        // Валидация формы юридического лица
        const allowedLegalForms = [
            'Auto-entrepreneur', 'SASU', 'SARL', 'SAS', 'EURL', 
            'SA', 'SNC', 'SCI', 'SELARL', 'Micro-entreprise', 
            'EI', 'EIRL', 'Autre'
        ];
        
        if (!allowedLegalForms.includes(legalData.legal_form)) {
            return res.status(400).json({
                result: false,
                message: "Недопустимая форма юридического лица",
                allowed_forms: allowedLegalForms
            });
        }

        // Валидация французского телефона для юр. лица
        const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
        const cleanLegalPhone = legalData.legal_phone.replace(/\s/g, '');
        if (!frenchPhoneRegex.test(cleanLegalPhone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон юр. лица должен быть французским",
                example: "+33 1 42 34 56 78"
            });
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(legalData.legal_email)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный email юр. лица"
            });
        }

        // ✅ ПРОВЕРЯЕМ ЗАЯВКУ ПАРТНЕРА
        if (!mongoose.Types.ObjectId.isValid(request_id)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный ID заявки"
            });
        }

        // Ищем заявку партнера
        const partnerRequest = await InitialPartnerRequest.findOne({
            _id: request_id,
            user_id: partner._id
        });

        if (!partnerRequest) {
            return res.status(404).json({
                result: false,
                message: "Заявка партнера не найдена"
            });
        }

        // Проверяем статус заявки
        if (partnerRequest.status !== 'approved') {
            return res.status(400).json({
                result: false,
                message: "Заявка должна быть одобрена админом",
                current_status: partnerRequest.status
            });
        }

        // Проверяем не поданы ли уже документы
        const existingLegal = await PartnerLegalInfo.findOne({
            user_id: partner._id,
            partner_request_id: request_id
        });

        if (existingLegal) {
            return res.status(400).json({
                result: false,
                message: "Юридические документы уже поданы",
                status: existingLegal.verification_status
            });
        }

        // ✅ СОЗДАЕМ PartnerLegalInfo (точно по модели)
        const newLegalInfo = new PartnerLegalInfo({
            user_id: partner._id,
            partner_request_id: request_id,
            
            // 🏢 ЮРИДИЧЕСКИЕ ДАННЫЕ (точно как в модели legal_data)
            legal_data: {
                legal_name: cryptoString(legalData.legal_name),                    // 🔐 ЗАШИФРОВАНО
                siret_number: cryptoString(legalData.siret_number),                // 🔐 ЗАШИФРОВАНО
                legal_form: legalData.legal_form,                                  // ✅ ОТКРЫТО
                tva_number: legalData.tva_number ? cryptoString(legalData.tva_number) : null, // 🔐 ЗАШИФРОВАНО
                legal_address: cryptoString(legalData.legal_address),              // 🔐 ЗАШИФРОВАНО
                legal_representative: cryptoString(legalData.legal_representative) // 🔐 ЗАШИФРОВАНО
            },
            
            // 🏦 БАНКОВСКИЕ ДАННЫЕ (точно как в модели bank_details)
            bank_details: {
                iban: cryptoString(legalData.iban), // 🔐 ЗАШИФРОВАНО
                bic: cryptoString(legalData.bic)    // 🔐 ЗАШИФРОВАНО
            },
            
            // 📞 КОНТАКТНЫЕ ДАННЫЕ (точно как в модели legal_contact)
            legal_contact: {
                email: cryptoString(legalData.legal_email), // 🔐 ЗАШИФРОВАНО
                phone: cryptoString(legalData.legal_phone)  // 🔐 ЗАШИФРОВАНО
            },
            
            // 📄 СТАТУС ВЕРИФИКАЦИИ
            verification_status: 'pending',
            
            // 🛡️ ВАЛИДАЦИЯ (автоматическая проверка)
            validation_info: {
                siret_validated: siretRegex.test(cleanSiret),
                iban_validated: frenchIbanRegex.test(cleanIban),
                tva_status: legalData.tva_number ? 'pending' : 'not_applicable'
            },
            
            // 📅 ВРЕМЕННЫЕ МЕТКИ
            submitted_at: new Date(),
            updated_at: new Date()
        });

        await newLegalInfo.save();

        console.log('✅ SUBMIT LEGAL INFO - Success:', {
            legal_info_id: newLegalInfo._id,
            verification_status: newLegalInfo.verification_status
        });

        // ✅ УСПЕШНЫЙ ОТВЕТ
        res.status(201).json({
            result: true,
            message: "Юридические документы успешно поданы",
            legal_info: {
                id: newLegalInfo._id,
                status: newLegalInfo.verification_status,
                legal_form: newLegalInfo.legal_data.legal_form,
                validation: {
                    siret_valid: newLegalInfo.validation_info.siret_validated,
                    iban_valid: newLegalInfo.validation_info.iban_validated,
                    tva_status: newLegalInfo.validation_info.tva_status
                }
            },
            next_step: {
                action: "wait_for_admin_verification",
                description: "Документы отправлены на проверку администратору",
                expected_time: "2-5 рабочих дней"
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