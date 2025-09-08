// routes/Partner.route.js - ИСПРАВЛЕННЫЕ РОУТЫ БЕЗ ДУБЛИРОВАНИЯ
import express from 'express';
import {
    registerPartner,
    loginPartnerController,
    verifyPartner,
    getProfile,
    updateProfile,
    deletePartner,
    getDashboardStatus,
    submitLegalInfo
} from '../controllers/PartnerController.js';
import { 
    checkPartnerToken, 
    checkPartnerStatus,
    requirePartnerProfile,
    checkProfileAccess,
    validatePartnerRegistrationData,
    validateLegalInfoData
} from '../middleware/partnerAuth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

/**
 * POST /api/partners/register - Регистрация партнера
 * Этап 1: Создание InitialPartnerRequest со статусом 'pending'
 */
router.post('/register', 
    validatePartnerRegistrationData,  // Валидация французских данных
    registerPartner
);

/**
 * POST /api/partners/login - Авторизация партнера
 */
router.post('/login', loginPartnerController);

// ================ ЗАЩИЩЕННЫЕ РОУТЫ (базовая проверка токена) ================

/**
 * GET /api/partners/verify - Верификация токена
 */
router.get('/verify', checkPartnerToken, verifyPartner);

/**
 * GET /api/partners/dashboard - Статус личного кабинета
 * Показывает workflow и следующие шаги
 */
router.get('/dashboard', checkPartnerToken, getDashboardStatus);

// ================ ЮРИДИЧЕСКИЕ ДОКУМЕНТЫ (требуется статус 'approved') ================

/**
 * POST /api/partners/legal-info/:request_id - Подача юридических документов
 * Этап 3: После одобрения заявки партнер подает юридические документы
 */
router.post('/legal-info/:request_id', 
    checkPartnerToken,                // Проверка токена
    checkPartnerStatus(['approved']), // Проверка что заявка одобрена
    validateLegalInfoData,            // Валидация SIRET, IBAN, TVA и др.
    submitLegalInfo                   // Создание PartnerLegalInfo
);

// ================ ПРОФИЛЬ (требуется созданный профиль) ================

/**
 * GET /api/partners/profile - Получение своего профиля
 * Доступно только после создания профиля администратором
 */
router.get('/profile', requirePartnerProfile, getProfile);

/**
 * GET /api/partners/profile/:id - Получение профиля по ID
 * Только владелец может получить свой профиль
 */
router.get('/profile/:id', checkProfileAccess, getProfile);

/**
 * PUT /api/partners/profile/:id - Обновление профиля
 * Этап 5: Наполнение контента (меню, фото, описание)
 */
router.put('/profile/:id', checkProfileAccess, updateProfile);

/**
 * DELETE /api/partners/profile/:id - Удаление партнера
 * Полное удаление аккаунта и всех связанных данных
 */
router.delete('/profile/:id', checkProfileAccess, deletePartner);

// ================ ИНФОРМАЦИОННЫЕ РОУТЫ ================

/**
 * GET /api/partners/workflow-info - Информация о процессе регистрации
 */
router.get('/workflow-info', (req, res) => {
    res.status(200).json({
        result: true,
        message: "Информация о процессе регистрации партнера",
        workflow_stages: {
            stage_1: {
                name: "Подача заявки",
                description: "Регистрация с основными данными бизнеса",
                endpoint: "POST /api/partners/register",
                status: "pending",
                duration: "Мгновенно"
            },
            stage_2: {
                name: "Рассмотрение заявки",
                description: "Администратор проверяет и одобряет заявку",
                admin_endpoint: "POST /api/admin/partners/requests/:id/approve",
                status: "approved",
                typical_duration: "24-48 часов"
            },
            stage_3: {
                name: "Подача юридических документов",
                description: "Партнер загружает SIRET, IBAN и другие документы",
                endpoint: "POST /api/partners/legal-info/:request_id",
                status: "legal_pending",
                duration: "Зависит от партнера"
            },
            stage_4: {
                name: "Проверка документов",
                description: "Администратор проверяет юридические документы",
                admin_endpoint: "POST /api/admin/partners/legal/:id/approve",
                status: "legal_approved",
                typical_duration: "24-72 часа"
            },
            stage_5: {
                name: "Создание профиля",
                description: "Автоматическое создание PartnerProfile",
                status: "profile_created",
                duration: "Автоматически"
            },
            stage_6: {
                name: "Наполнение контента",
                description: "Партнер добавляет меню, фото, описание",
                endpoint: "PUT /api/partners/profile/:id",
                status: "content_ready",
                duration: "Зависит от партнера"
            },
            stage_7: {
                name: "Публикация",
                description: "Администратор публикует профиль партнера",
                admin_endpoint: "POST /api/admin/partners/profiles/:id/publish",
                status: "published",
                duration: "24 часа"
            }
        },
        required_documents: {
            stage_1: ["Основные данные бизнеса", "Контактная информация"],
            stage_3: ["SIRET", "IBAN", "Юридический адрес", "Представитель"],
            stage_6: ["Меню/каталог", "Фотографии", "Описание заведения"]
        },
        legal_forms: [
            'Auto-entrepreneur', 'SASU', 'SARL', 'SAS', 'EURL', 
            'SA', 'SNC', 'SCI', 'SELARL', 'Micro-entreprise', 
            'EI', 'EIRL', 'Autre'
        ],
        categories: [
            'restaurant', 'cafe', 'bakery', 'grocery', 'pharmacy', 
            'alcohol', 'flowers', 'convenience', 'other'
        ]
    });
});

/**
 * POST /api/partners/validate-registration - Предварительная валидация данных
 */
router.post('/validate-registration', 
    validatePartnerRegistrationData,
    (req, res) => {
        res.status(200).json({
            result: true,
            message: "Данные регистрации валидны",
            validated_fields: {
                phone_format: "french",
                email_format: "valid",
                category: "allowed",
                required_fields: "complete"
            }
        });
    }
);

/**
 * POST /api/partners/validate-legal - Предварительная валидация юридических данных
 */
router.post('/validate-legal', 
    validateLegalInfoData,
    (req, res) => {
        res.status(200).json({
            result: true,
            message: "Юридические данные валидны",
            validated_fields: {
                siret_format: "valid",
                iban_format: "french",
                tva_format: "french_or_empty",
                required_fields: "complete"
            }
        });
    }
);

export default router;