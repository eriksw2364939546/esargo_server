// ================ routes/Partner.route.js (ОБНОВЛЕННЫЙ С ВАЛИДАЦИЯМИ) ================
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
    validatePartnerRegistrationData,  // 🆕 НОВЫЙ MIDDLEWARE
    validateLegalInfoData            // 🆕 НОВЫЙ MIDDLEWARE
} from '../middleware/partnerAuth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/partners/register - Регистрация партнера
// ✅ ДОБАВЛЕНА валидация данных регистрации
router.post('/register', 
    validatePartnerRegistrationData,  // 🆕 Валидация французских данных
    registerPartner
);

// POST /api/partners/login - Авторизация партнера (логика не тронута)
router.post('/login', loginPartnerController);

// ================ ЗАЩИЩЕННЫЕ РОУТЫ (базовая проверка токена) ================

// GET /api/partners/verify - Верификация токена (логика не тронута)
router.get('/verify', checkPartnerToken, verifyPartner);

// GET /api/partners/dashboard - Статус личного кабинета (логика не тронута)
router.get('/dashboard', checkPartnerToken, getDashboardStatus);

// ================ ЮРИДИЧЕСКИЕ ДОКУМЕНТЫ (требуется статус 'approved') ================

// POST /api/partners/legal-info/:request_id - Подача юридических документов
// ✅ ДОБАВЛЕНА валидация юридических данных
router.post('/legal-info/:request_id', 
    checkPartnerStatus(['approved']),  // Проверка статуса (не тронута)
    validateLegalInfoData,             // 🆕 Валидация SIRET, IBAN, TVA и др.
    submitLegalInfo                    // Теперь полная реализация вместо заглушки
);

// ================ ПРОФИЛЬ (требуется созданный профиль + права доступа) ================

// GET /api/partners/profile - Получение своего профиля (логика не тронута)
router.get('/profile', requirePartnerProfile, getProfile);

// GET /api/partners/profile/:id - Получение профиля по ID (логика не тронута)
router.get('/profile/:id', checkProfileAccess, getProfile);

// PUT /api/partners/profile/:id - Обновление профиля (логика не тронута)  
router.put('/profile/:id', checkProfileAccess, updateProfile);

// DELETE /api/partners/profile/:id - Удаление партнера (логика не тронута)
router.delete('/profile/:id', checkPartnerToken, deletePartner);

// ================ ДОПОЛНИТЕЛЬНЫЕ МАРШРУТЫ (для будущего использования) ================

// 🆕 НОВЫЙ МАРШРУТ: Валидация данных перед отправкой
router.post('/validate-registration', 
    validatePartnerRegistrationData,
    (req, res) => {
        res.status(200).json({
            result: true,
            message: "Данные регистрации валидны",
            validated_fields: {
                phone_format: "french",
                has_brand_name: !!req.body.brand_name,
                has_whatsapp_consent: req.body.whatsapp_consent !== undefined,
                coordinates_valid: !isNaN(parseFloat(req.body.latitude)) && !isNaN(parseFloat(req.body.longitude))
            }
        });
    }
);

// 🆕 НОВЫЙ МАРШРУТ: Валидация юридических данных перед отправкой
router.post('/validate-legal', 
    checkPartnerToken,
    validateLegalInfoData,
    (req, res) => {
        res.status(200).json({
            result: true,
            message: "Юридические данные валидны",
            validated_fields: {
                siret_format: "valid_14_digits",
                iban_format: "french_iban",
                tva_format: req.body.tva_number ? "french_tva" : "not_provided",
                legal_form: req.body.legal_form,
                phone_format: "french"
            }
        });
    }
);

// ================ СПРАВОЧНАЯ ИНФОРМАЦИЯ ================

// GET /api/partners/forms/legal-forms - Получение списка юридических форм
router.get('/forms/legal-forms', (req, res) => {
    const legalForms = [
        'Auto-entrepreneur',
        'SASU', 
        'SARL',
        'SAS',
        'EURL',
        'SA',
        'SNC',
        'SCI',
        'SELARL',
        'Micro-entreprise',
        'EI',
        'EIRL',
        'Autre'
    ];

    res.status(200).json({
        result: true,
        message: "Доступные формы юридических лиц во Франции",
        legal_forms: legalForms.map(form => ({
            value: form,
            label: form,
            description: getLegalFormDescription(form)
        }))
    });
});

// GET /api/partners/validation/examples - Примеры форматов данных
router.get('/validation/examples', (req, res) => {
    res.status(200).json({
        result: true,
        message: "Примеры правильных форматов данных",
        examples: {
            french_phone: [
                "+33 1 42 34 56 78",
                "01 42 34 56 78",
                "+33 6 12 34 56 78"
            ],
            siret_number: [
                "123 456 789 00014",
                "12345678900014"
            ],
            french_iban: [
                "FR76 3000 6000 0112 3456 7890 189",
                "FR7630006000011234567890189"
            ],
            french_tva: [
                "FR12 345678912",
                "FR12345678912"
            ],
            coordinates: {
                paris: { latitude: 48.8566, longitude: 2.3522 },
                marseille: { latitude: 43.2965, longitude: 5.3698 },
                lyon: { latitude: 45.7640, longitude: 4.8357 }
            }
        },
        validation_rules: {
            phone: "Французский формат: +33 или 0 + 9 цифр",
            siret: "Точно 14 цифр",
            iban: "Начинается с FR + 25 символов",
            tva: "FR + 11 цифр (опционально)",
            coordinates: "Latitude: -90 до 90, Longitude: -180 до 180"
        }
    });
});

/**
 * Получение описания юридической формы
 */
function getLegalFormDescription(form) {
    const descriptions = {
        'Auto-entrepreneur': 'Индивидуальный предприниматель с упрощенным режимом',
        'SASU': 'Упрощенное акционерное общество с одним акционером',
        'SARL': 'Общество с ограниченной ответственностью',
        'SAS': 'Упрощенное акционерное общество',
        'EURL': 'Предприятие с единственным участником с ограниченной ответственностью',
        'SA': 'Акционерное общество',
        'SNC': 'Полное товарищество',
        'SCI': 'Гражданское общество недвижимости',
        'SELARL': 'Общество с ограниченной ответственностью либеральных профессий',
        'Micro-entreprise': 'Микропредприятие',
        'EI': 'Индивидуальное предприятие',
        'EIRL': 'Индивидуальное предприятие с ограниченной ответственностью',
        'Autre': 'Другая форма'
    };
    
    return descriptions[form] || 'Описание недоступно';
}

export default router;