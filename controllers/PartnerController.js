// controllers/PartnerController.js - ИСПРАВЛЕННЫЙ СТРОГО ПО АРХИТЕКТУРЕ
import { createPartnerAccount, loginPartner, checkPartnerExists } from '../services/Partner/partner.auth.service.js';
import * as partnerService from '../services/Partner/partner.service.js';
import { submitPartnerLegalInfo } from '../services/Partner/partner.legal.service.js';

/**
 * ================== КОНТРОЛЛЕРЫ РАБОТАЮТ ТОЛЬКО С REQ/RES ==================
 */

/**
 * 🏪 РЕГИСТРАЦИЯ ПАРТНЕРА
 * POST /api/partners/register
 */
const registerPartner = async (req, res) => {
    try {
        console.log('🔍 REGISTER PARTNER - Start:', {
            body_keys: Object.keys(req.body)
        });

        // Принимаем данные из запроса
        const {
            first_name, last_name, email, password, phone,
            business_name, brand_name, category, address, floor_unit,
            latitude, longitude, whatsapp_consent
        } = req.body;

        // Проверяем обязательные поля
        if (!first_name || !last_name || !email || !password || !phone || 
            !business_name || !category || !address) {
            return res.status(400).json({
                result: false,
                message: "Обязательные поля: first_name, last_name, email, password, phone, business_name, category, address"
            });
        }

        // Передаем данные в сервис
        const result = await createPartnerAccount({
            first_name,
            last_name,
            email,
            password,
            phone,
            business_name,
            brand_name,
            category,
            address,
            floor_unit,
            location: latitude && longitude ? { lat: latitude, lng: longitude } : null,
            whatsapp_consent
        });

        // Возвращаем ответ клиенту
        res.status(201).json({
            result: true,
            message: "✅ Заявка на партнерство подана успешно!",
            token: result.token,
            user: result.user,
            data: {
                user_id: result.user.id,
                request_id: result.request._id,
                next_step: "Ожидайте одобрения администратора"
            }
        });

    } catch (error) {
        console.error('🚨 REGISTER PARTNER - Error:', error);
        
        const statusCode = error.message.includes('уже существует') ? 409 :
                          error.message.includes('Обязательные поля') ? 400 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message || 'Ошибка при регистрации партнера'
        });
    }
};

/**
 * 🔐 АВТОРИЗАЦИЯ ПАРТНЕРА
 * POST /api/partners/login
 */
const loginPartnerController = async (req, res) => {
    try {
        // Принимаем данные из запроса
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                result: false,
                message: "Email и пароль обязательны"
            });
        }

        // Передаем данные в сервис
        const result = await loginPartner(email, password);

        // Возвращаем ответ клиенту
        res.status(200).json({
            result: true,
            message: "Успешный вход",
            ...result
        });

    } catch (error) {
        console.error('🚨 LOGIN PARTNER - Error:', error);
        
        const statusCode = error.message.includes('не найден') ? 404 :
                          error.message.includes('неверный') ? 401 :
                          error.message.includes('неактивен') ? 403 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message || 'Ошибка при входе'
        });
    }
};

/**
 * 🔍 ВЕРИФИКАЦИЯ ТОКЕНА
 * GET /api/partners/verify
 */
const verifyPartner = async (req, res) => {
    try {
        // Данные уже подготовлены middleware
        const { partner } = req;

        // Возвращаем ответ клиенту
        res.status(200).json({
            result: true,
            message: "Токен валиден",
            partner: {
                id: partner._id,
                role: partner.role,
                is_active: partner.is_active,
                is_email_verified: partner.is_email_verified
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
 * 📊 СТАТУС ДАШБОРДА
 * GET /api/partners/dashboard
 */
const getDashboardStatus = async (req, res) => {
    try {
        // Данные подготовлены middleware
        const { partner } = req;

        // Передаем в сервис
        const dashboardData = await partnerService.getDashboardWorkflow(partner._id);

        // Возвращаем ответ клиенту
        res.status(200).json({
            result: true,
            message: "Статус дашборда получен",
            ...dashboardData
        });

    } catch (error) {
        console.error('🚨 GET DASHBOARD - Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка получения статуса дашборда"
        });
    }
};

/**
 * 👤 ПОЛУЧЕНИЕ ПРОФИЛЯ
 * GET /api/partners/profile
 */
const getProfile = async (req, res) => {
    try {
        // Данные подготовлены middleware
        const { partner, partnerProfile } = req;

        // Возвращаем ответ клиенту
        res.status(200).json({
            result: true,
            message: "Профиль получен",
            profile: partnerProfile,
            user: {
                id: partner._id,
                role: partner.role,
                is_active: partner.is_active
            }
        });

    } catch (error) {
        console.error('🚨 GET PROFILE - Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка получения профиля"
        });
    }
};

/**
 * 📝 ОБНОВЛЕНИЕ ПРОФИЛЯ
 * PUT /api/partners/profile/:id
 */
const updateProfile = async (req, res) => {
    try {
        // Принимаем данные из запроса
        const { id } = req.params;
        const updateData = req.body;
        const { partner } = req;

        // Передаем в сервис
        const updatedProfile = await partnerService.updatePartnerProfile(id, updateData, partner._id);

        // Возвращаем ответ клиенту
        res.status(200).json({
            result: true,
            message: "Профиль обновлен",
            profile: updatedProfile
        });

    } catch (error) {
        console.error('🚨 UPDATE PROFILE - Error:', error);
        
        const statusCode = error.message.includes('не найден') ? 404 :
                          error.message.includes('доступ') ? 403 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка обновления профиля"
        });
    }
};

/**
 * 🗑️ УДАЛЕНИЕ ПАРТНЕРА
 * DELETE /api/partners/profile/:id
 */
const deletePartner = async (req, res) => {
    try {
        // Принимаем данные из запроса
        const { id } = req.params;
        const { partner } = req;

        // Передаем в сервис
        const result = await partnerService.deletePartnerAccount(id, partner._id);

        // Возвращаем ответ клиенту
        res.status(200).json({
            result: true,
            message: "Партнер удален",
            ...result
        });

    } catch (error) {
        console.error('🚨 DELETE PARTNER - Error:', error);
        
        const statusCode = error.message.includes('не найден') ? 404 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка удаления партнера"
        });
    }
};

/**
 * 📋 ПОДАЧА ЮРИДИЧЕСКИХ ДОКУМЕНТОВ
 * POST /api/partners/legal-info/:request_id
 */
const submitLegalInfo = async (req, res) => {
    try {
        // Принимаем данные из запроса
        const { request_id } = req.params;
        const legalData = req.body;
        const { partner } = req;

        // Передаем в сервис
        const result = await submitPartnerLegalInfo(partner._id, request_id, legalData);

        // Возвращаем ответ клиенту
        res.status(201).json({
            result: true,
            message: "Юридические документы поданы успешно",
            legal_info_id: result.legal_info_id,
            verification_status: result.verification_status,
            workflow_stage: result.workflow_stage,
            next_step: "Ожидайте проверки администратором"
        });

    } catch (error) {
        console.error('🚨 SUBMIT LEGAL INFO - Error:', error);
        
        const statusCode = error.message.includes('не найден') ? 404 :
                          error.message.includes('уже подан') ? 409 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка подачи юридических документов"
        });
    }
};

// ================ ЭКСПОРТ ВСЕХ ФУНКЦИЙ ================

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