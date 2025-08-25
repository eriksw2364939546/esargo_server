// ================ controllers/PartnerController.js (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ) ================
import { createPartnerAccount, loginPartner, checkPartnerExists } from '../services/Partner/partner.auth.service.js';
import * as partnerService from '../services/Partner/partner.service.js';
import { PartnerLegalInfo, InitialPartnerRequest } from '../models/index.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import mongoose from 'mongoose';

/**
 * ЭТАП 1: Регистрация партнера
 * ✅ ПОЛНОСТЬЮ ИСПРАВЛЕНО: Завершена валидация телефона и создание location
 */

const registerPartner = async (req, res) => {
    try {
        const partnerData = req.body;
        const {
            first_name, last_name, email, password, confirm_password, phone,
            business_name, brand_name, category, address, floor_unit,
            latitude, longitude, whatsapp_consent
        } = partnerData;
        
        console.log('🔍 REGISTER PARTNER - Start:', {
            email: email,
            business_name: business_name,
            brand_name: brand_name,
            category: category,
            has_floor_unit: !!floor_unit,
            coordinates: { latitude, longitude }
        });

        // ✅ Валидация обязательных полей
        const requiredFields = [
            'first_name', 'last_name', 'email', 'password', 'confirm_password', 'phone',
            'address', 'business_name', 'brand_name', 'category',
            'latitude', 'longitude', 'whatsapp_consent'
        ];

        const missingFields = requiredFields.filter(field => !partnerData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля: ${missingFields.join(', ')}`
            });
        }

        // ✅ Валидация французского телефона
        const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
        const cleanPhone = phone.replace(/\s+/g, '');
        
        if (!frenchPhoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон должен быть французским номером",
                format_examples: [
                    "+33 1 42 34 56 78",
                    "01 42 34 56 78",
                    "+33 6 12 34 56 78"
                ],
                provided_phone: phone
            });
        }

        // Валидация паролей
        if (password !== confirm_password) {
            return res.status(400).json({
                result: false,
                message: "Пароли не совпадают"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                result: false,
                message: "Пароль должен содержать минимум 6 символов"
            });
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный email"
            });
        }

        // Валидация геолокации (должна быть во Франции)
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({
                result: false,
                message: "Координаты должны быть числовыми значениями"
            });
        }

        // Проверка координат Франции (приблизительно)
        if (latitude < 41.0 || latitude > 51.5 || longitude < -5.5 || longitude > 9.6) {
            return res.status(400).json({
                result: false,
                message: "Геолокация должна быть на территории Франции"
            });
        }

        // Валидация категории
        if (!['restaurant', 'store'].includes(category)) {
            return res.status(400).json({
                result: false,
                message: "Категория должна быть 'restaurant' или 'store'"
            });
        }

        // ✅ ИСПРАВЛЕНО: Правильная подготовка данных для сервиса
        const serviceData = {
            // Личные данные
            first_name,
            last_name, 
            email,
            password,
            phone: cleanPhone, // Очищенный телефон

            // Бизнес данные
            business_name,
            brand_name,
            category,
            address,
            floor_unit: floor_unit || null,

            // ✅ ИСПРАВЛЕНО: Создаем правильный объект location
            location: {
                type: 'Point',
                coordinates: [longitude, latitude] // [lng, lat] - правильный порядок для MongoDB
            },

            // Согласие
            whatsapp_consent
        };

        console.log('✅ VALIDATION COMPLETED - Calling service:', {
            email: serviceData.email,
            phone: serviceData.phone,
            location: serviceData.location,
            whatsapp_consent: serviceData.whatsapp_consent
        });

        // ✅ Вызов сервиса создания аккаунта
        const result = await createPartnerAccount(serviceData);

        res.status(201).json({
            result: true,
            message: "✅ Заявка на партнерство подана успешно!",
            token: result.token,
            request: {
                id: result.request._id,
                user_id: result.request.user_id,
                business_name: result.request.business_data.business_name,
                brand_name: result.request.business_data.brand_name,
                category: result.request.business_data.category,
                status: result.request.status,
                submitted_at: result.request.submitted_at
            },
            workflow_info: {
                current_stage: result.request.workflow_stage,
                status: result.request.status,
                stage_description: "Ожидание одобрения админом"
            },
            next_step: {
                action: "wait_for_approval",
                description: "Ваша заявка отправлена на рассмотрение администратору. Вы получите уведомление о результате."
            }
        });

    } catch (error) {
        console.warn('🚨 REGISTER PARTNER - Error:', error);
        
        // Обработка специфических ошибок
        if (error.message.includes('уже существует')) {
            return res.status(409).json({
                result: false,
                message: error.message
            });
        }
        
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                result: false,
                message: "Ошибка валидации данных",
                validation_errors: validationErrors
            });
        }

        res.status(500).json({
            result: false,
            message: "Внутренняя ошибка сервера при регистрации партнера"
        });
    }
};

/**
 * АВТОРИЗАЦИЯ ПАРТНЕРА
 * ✅ Логика не тронута - работает корректно
 */
const loginPartnerController = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                result: false,
                message: "Email и пароль обязательны"
            });
        }

        const result = await loginPartner({ email, password });

        res.status(200).json({
            result: true,
            message: "Авторизация успешна",
            partner: result.partner,
            token: result.token
        });

    } catch (error) {
        console.error('🚨 LOGIN PARTNER - Error:', error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка авторизации"
        });
    }
};

/**
 * ВЕРИФИКАЦИЯ ТОКЕНА
 * ✅ Логика не тронута - работает корректно
 */
const verifyPartner = async (req, res) => {
    try {
        const { user } = req;

        res.status(200).json({
            result: true,
            message: "Токен валиден",
            partner: {
                id: user._id,
                email: user.email,
                role: user.role,
                is_active: user.is_active
            }
        });

    } catch (error) {
        console.error('🚨 VERIFY PARTNER - Error:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка верификации токена"
        });
    }
};

/**
 * ПОЛУЧЕНИЕ СТАТУСА ДАШБОРДА
 * ✅ Логика не тронута - работает корректно
 */
const getDashboardStatus = async (req, res) => {
    try {
        const { user } = req;

        console.log('🔍 GET DASHBOARD STATUS:', { user_id: user._id });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const dashboardData = await partnerService.getDashboardWorkflow(user._id);

        res.status(200).json({
            result: true,
            message: "Статус дашборда получен",
            user: dashboardData.user,
            workflow: dashboardData.workflow
        });

    } catch (error) {
        console.error('🚨 GET DASHBOARD STATUS - Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка получения статуса дашборда"
        });
    }
};

/**
 * ЭТАП 3: Подача юридических документов
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
                message: `Обязательные поля: ${missingFields.join(', ')}`
            });
        }

        // ✅ ФРАНЦУЗСКАЯ ВАЛИДАЦИЯ
        
        // Валидация SIRET (14 цифр)
        const siretRegex = /^\d{14}$/;
        const cleanSiret = legalData.siret_number.replace(/\s/g, '');
        if (!siretRegex.test(cleanSiret)) {
            return res.status(400).json({
                result: false,
                message: "SIRET должен содержать ровно 14 цифр",
                example: "123 456 789 00014"
            });
        }

        // Валидация французского IBAN
        const frenchIbanRegex = /^FR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}$/;
        const cleanIban = legalData.iban.replace(/\s/g, '');
        if (!frenchIbanRegex.test(cleanIban)) {
            return res.status(400).json({
                result: false,
                message: "IBAN должен быть французским",
                example: "FR76 3000 6000 0112 3456 7890 189"
            });
        }

        // Валидация BIC (8-11 символов)
        const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
        if (!bicRegex.test(legalData.bic.toUpperCase())) {
            return res.status(400).json({
                result: false,
                message: "BIC должен содержать 8-11 символов",
                example: "AGRIFRPPXXX"
            });
        }

        // Валидация TVA номера (если указан)
        if (legalData.tva_number) {
            const tvaRegex = /^FR\d{2}\s?\d{9}$/;
            const cleanTva = legalData.tva_number.replace(/\s/g, '');
            if (!tvaRegex.test(cleanTva)) {
                return res.status(400).json({
                    result: false,
                    message: "TVA номер должен быть французским",
                    example: "FR12 345678912"
                });
            }
        }

        // Валидация французского телефона юр. лица
        const frenchPhoneRegex2 = /^(\+33|0)[1-9](\d{8})$/;
        const cleanLegalPhone = legalData.legal_phone.replace(/\s/g, '');
        if (!frenchPhoneRegex2.test(cleanLegalPhone)) {
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
                tva_number: legalData.tva_number ? 
                    cryptoString(legalData.tva_number) : null,                     // 🔐 ЗАШИФРОВАНО
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
            },
            workflow_info: {
                current_stage: 3,
                total_stages: 6,
                stage_description: "Документы поданы и ожидают проверки"
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

/**
 * ПОЛУЧЕНИЕ ПРОФИЛЯ ПАРТНЕРА
 * ✅ Логика не тронута - работает корректно
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
 * ОБНОВЛЕНИЕ ПРОФИЛЯ ПАРТНЕРА
 * ✅ Логика не тронута - работает корректно
 */
const updateProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;
        const updateData = req.body;

        console.log('🔍 UPDATE PROFILE - Start:', {
            partner_id: partner._id,
            profile_id: id,
            fields_to_update: Object.keys(updateData)
        });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const updatedProfile = await partnerService.updatePartnerProfile(id, updateData, partner._id);

        res.status(200).json({
            result: true,
            message: "Профиль обновлен",
            profile: updatedProfile
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
 * УДАЛЕНИЕ ПАРТНЕРА
 * ✅ Логика не тронута - работает корректно
 */
const deletePartner = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;

        console.log('🔍 DELETE PARTNER - Start:', {
            partner_id: partner._id,
            target_id: id
        });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await partnerService.deletePartnerAccount(id, partner._id);

        res.status(200).json({
            result: true,
            message: "Партнер удален",
            deleted_partner_id: result.deletedPartnerId
        });

    } catch (error) {
        console.error('🚨 DELETE PARTNER - Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка удаления партнера"
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