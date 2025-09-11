// routes/Partner.route.js - ПОЛНЫЙ РОУТ С ИНТЕГРАЦИЕЙ ЗАГРУЗКИ PDF
import express from 'express';
import {
    registerPartner,
    loginPartnerController,
    verifyPartner,
    getProfile,
    updateProfile,
    deletePartner,
    getDashboardStatus,
    submitLegalInfo,
    submitProfileForReview  
} from '../controllers/PartnerController.js';
import { 
    checkPartnerToken, 
    checkPartnerStatus,
    requirePartnerProfile,
    checkProfileAccess,
    validatePartnerRegistrationData,
    validateLegalInfoData
} from '../middleware/partnerAuth.middleware.js';

// ✅ НОВЫЙ ИМПОРТ: Middleware для загрузки PDF документов
import { 
    uploadPartnerLegalDocuments, 
    processPartnerLegalDocuments 
} from '../middleware/registrationUpload.middleware.js';

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
 * ✅ ОБНОВЛЕННЫЙ РОУТ: POST /api/partners/legal-info/:request_id - Подача юридических документов с PDF
 * Этап 3: После одобрения заявки партнер подает юридические документы
 */
router.post('/legal-info/:request_id', 
    checkPartnerToken,                    // Проверка токена
    checkPartnerStatus(['approved']),     // Проверка что заявка одобрена
    
    // ✅ НОВЫЕ MIDDLEWARE для загрузки PDF файлов
    uploadPartnerLegalDocuments,          // Multer для PDF документов (заменяет URL поля)
    processPartnerLegalDocuments,         // Обработка файлов и создание объекта documents в req.body
    
    // ✅ СУЩЕСТВУЮЩИЕ MIDDLEWARE остаются без изменений
    validateLegalInfoData,                // Валидация SIRET, IBAN, TVA и др. (проверяет documents объект)
    submitLegalInfo                       // Создание PartnerLegalInfo (получает documents в req.body)
);

/**
 * POST /api/partners/profile/:id/submit-for-review - Отправка профиля на проверку
 * Этап 5.5: Партнер отправляет готовый профиль на проверку администратору
 */
router.post('/profile/:id/submit-for-review', 
    checkPartnerToken,                // Проверка токена
    requirePartnerProfile,            // Проверка что профиль создан
    checkProfileAccess,               // Проверка принадлежности профиля
    submitProfileForReview            // Контроллер
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
                description: "Партнер загружает SIRET, IBAN и другие PDF документы",
                endpoint: "POST /api/partners/legal-info/:request_id",
                method: "multipart/form-data", // ✅ ОБНОВЛЕНО
                status: "legal_pending",
                duration: "Зависит от партнера",
                // ✅ НОВАЯ ИНФОРМАЦИЯ О ФАЙЛАХ
                file_requirements: {
                    format: "PDF только",
                    max_size: "5MB на файл",
                    max_files: "5 документов максимум",
                    required_documents: [
                        "KBIS документ (kbis_document)",
                        "Удостоверение личности (id_document)"
                    ],
                    optional_documents: [
                        "Дополнительные документы (other)"
                    ]
                }
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
            stage_3: ["SIRET", "IBAN", "Юридический адрес", "Представитель", "KBIS PDF", "ID PDF"], // ✅ ОБНОВЛЕНО
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
        ],
        // ✅ НОВАЯ ИНФОРМАЦИЯ О ФАЙЛАХ
        file_upload_info: {
            supported_formats: ["application/pdf"],
            max_file_size: "5MB",
            max_total_files: 5,
            storage_location: "uploads/partners/documentsImage/",
            security: "Files are encrypted and stored securely"
        }
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
 * ✅ ОБНОВЛЕННЫЙ РОУТ: POST /api/partners/validate-legal - Предварительная валидация юридических данных с PDF
 */
router.post('/validate-legal', 
    // ✅ НОВЫЕ MIDDLEWARE для поддержки PDF валидации
    uploadPartnerLegalDocuments,
    processPartnerLegalDocuments,
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
            },
            uploaded_documents: {
                count: req.uploadedDocuments?.length || 0,
                files: req.uploadedDocuments?.map(doc => ({
                    type: doc.documentType,
                    size: doc.size,
                    status: "uploaded"
                })) || []
            }
        });
    }
);

// ✅ НОВЫЙ РОУТ: GET /api/partners/legal-example - Пример данных для подачи документов
router.get('/legal-example', (req, res) => {
    res.status(200).json({
        result: true,
        message: "Пример данных для подачи юридических документов с PDF файлами",
        postman_example: {
            method: "POST", 
            url: "/api/partners/legal-info/:request_id",
            headers: {
                "Content-Type": "multipart/form-data",
                "Authorization": "Bearer YOUR_TOKEN"
            },
            form_data: {
                // Юридические данные
                legal_name: "RESTAURANT MARSEILLE SARL",
                siret_number: "12345678901234",
                legal_form: "SARL",
                legal_address: "123 Boulevard de la République, 13001 Marseille",
                tva_number: "FR12345678901",
                
                // Банковские данные
                iban: "FR1420041010050500013M02606",
                bic: "CCBPFRPPMAR",
                bank_name: "Crédit Agricole",
                account_holder: "RESTAURANT MARSEILLE SARL",
                
                // Контактное лицо
                legal_contact_email: "legal@restaurant-marseille.fr",
                legal_contact_phone: "+33491123456",
                representative_first_name: "Jean",
                representative_last_name: "Dupont",
                representative_position: "Gérant",
                
                // PDF ФАЙЛЫ (вместо URL полей)
                kbis_document: "[PDF FILE]",    // Обязательно - KBIS документ
                id_document: "[PDF FILE]",      // Обязательно - Удостоверение личности
                additional_doc_1: "[PDF FILE]", // Опционально - Дополнительные документы
                additional_doc_2: "[PDF FILE]"  // Опционально - Дополнительные документы
            }
        },
        old_vs_new: {
            old_way: "Загружать PDF отдельно, получать URL, вставлять в поля",
            new_way: "Прикрепить PDF файлы прямо к форме подачи документов",
            advantage: "Намного проще и безопаснее"
        },
        file_naming_convention: {
            kbis_document: "kbis-[timestamp].pdf",
            id_document: "id-[timestamp].pdf", 
            additional_documents: "additional-[timestamp].pdf"
        }
    });
});

export default router;