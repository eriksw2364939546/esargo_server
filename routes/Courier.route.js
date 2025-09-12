// routes/Courier.route.js - ПОЛНЫЙ РОУТ С ИНТЕГРАЦИЕЙ ЗАГРУЗКИ PDF
import express from 'express';
import {
  registerCourier,
  loginCourierController,
  verifyCourier,
  getApplicationStatus,
  getProfile,
  updateProfile,
  toggleAvailability,
  updateLocation,
  getEarnings
} from '../controllers/CourierController.js';
import {
  checkCourierToken,
  checkCourierApplicationStatus,
  requireApprovedCourier,
  validateCourierRegistration,
  checkCourierProfileAccess
} from '../middleware/courierAuth.middleware.js';

// ✅ НОВЫЙ ИМПОРТ: Middleware для загрузки PDF документов
import { 
  uploadCourierRegistrationDocuments, 
  processCourierRegistrationDocuments 
} from '../middleware/registrationUpload.middleware.js';

import { authFieldsSanitizer } from '../middleware/security.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// ✅ ОБНОВЛЕННЫЙ РОУТ: POST /api/couriers/register - Регистрация курьера с PDF документами
router.post('/register', authFieldsSanitizer,
  // ✅ НОВЫЕ MIDDLEWARE для загрузки PDF файлов
  uploadCourierRegistrationDocuments,    // Multer для PDF документов (заменяет URL поля)
  processCourierRegistrationDocuments,   // Обработка файлов и создание URL полей в req.body
  
  // ✅ СУЩЕСТВУЮЩИЕ MIDDLEWARE остаются без изменений
  validateCourierRegistration,           // Валидация данных регистрации (проверяет URL поля)
  registerCourier                        // Контроллер регистрации (получает URL в req.body)
);

// POST /api/couriers/login - Авторизация курьера
router.post('/login', authFieldsSanitizer, loginCourierController);

// ================ ЗАЩИЩЕННЫЕ РОУТЫ (базовая проверка токена) ================

// GET /api/couriers/verify - Верификация токена
router.get('/verify', checkCourierToken, verifyCourier);

// GET /api/couriers/application-status - Статус заявки курьера
router.get('/application-status', checkCourierToken, getApplicationStatus);

// ================ РОУТЫ ДЛЯ ОДОБРЕННЫХ КУРЬЕРОВ ================

// GET /api/couriers/profile - Получение профиля курьера
router.get('/profile', requireApprovedCourier, getProfile);

// PUT /api/couriers/profile - Обновление профиля курьера
router.put('/profile', requireApprovedCourier, updateProfile);

// PATCH /api/couriers/availability - Переключение статуса Online/Offline
router.patch('/availability', requireApprovedCourier, toggleAvailability);

// PATCH /api/couriers/location - Обновление геолокации
router.patch('/location', requireApprovedCourier, updateLocation);

// GET /api/couriers/earnings - Статистика заработка
router.get('/earnings', requireApprovedCourier, getEarnings);

// ================ РОУТЫ С ПРОВЕРКОЙ ДОСТУПА К ПРОФИЛЮ ================

// GET /api/couriers/profile/:id - Получение профиля по ID (для админа)
router.get('/profile/:id', 
  checkCourierToken, 
  checkCourierProfileAccess, 
  getProfile
);

// PUT /api/couriers/profile/:id - Обновление профиля по ID
router.put('/profile/:id', 
  checkCourierToken,
  checkCourierProfileAccess,
  updateProfile
);

// ================ ДОПОЛНИТЕЛЬНЫЕ РОУТЫ (для будущего развития) ================

// POST /api/couriers/validate-registration - Предварительная валидация
router.post('/validate-registration',
  // ✅ ОБНОВЛЕНО: Поддержка PDF файлов для валидации
  uploadCourierRegistrationDocuments,
  processCourierRegistrationDocuments,
  validateCourierRegistration,
  (req, res) => {
    res.status(200).json({
      result: true,
      message: "Данные регистрации курьера валидны",
      validated_fields: {
        personal_data: "OK",
        vehicle_info: "OK",
        documents: "OK",
        consents: "OK"
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

// GET /api/couriers/workflow-info - Информация о процессе регистрации
router.get('/workflow-info', (req, res) => {
  res.status(200).json({
    result: true,
    message: "Информация о процессе регистрации курьера",
    workflow_stages: {
      stage_1: {
        name: "Подача заявки",
        description: "Заполнение формы и загрузка PDF документов",
        endpoint: "POST /api/couriers/register",
        method: "multipart/form-data", // ✅ ОБНОВЛЕНО
        required_documents: [
          "Удостоверение личности (id_card)",
          "RIB банковские реквизиты (bank_rib)"
        ],
        conditional_documents: {
          motorbike_car: [
            "Водительские права (driver_license)",
            "Страховка (insurance)"
          ],
          car_only: [
            "Регистрация ТС (vehicle_registration)"
          ]
        },
        file_requirements: {
          format: "PDF только",
          max_size: "5MB на файл",
          max_files: "5 документов максимум"
        }
      },
      stage_2: {
        name: "Рассмотрение заявки",
        description: "Проверка документов администратором (24 часа)",
        possible_outcomes: ["approved", "rejected"]
      },
      stage_3: {
        name: "Создание профиля",
        description: "Автоматическое создание рабочего профиля после одобрения"
      },
      stage_4: {
        name: "Начало работы",
        description: "Доступ к карте заказов и возможность работать"
      }
    },
    document_requirements: {
      all_couriers: ["id_card", "bank_rib"],
      motorbike_car: ["driver_license", "insurance"],
      car_only: ["vehicle_registration"]
    },
    vehicle_types: ["bike", "motorbike", "car"],
    // ✅ НОВАЯ ИНФОРМАЦИЯ О ФАЙЛАХ
    file_upload_info: {
      supported_formats: ["application/pdf"],
      max_file_size: "5MB",
      max_total_files: 5,
      storage_location: "uploads/couriers/documentsPdf/",
      security: "Files are encrypted and stored securely"
    }
  });
});

// ✅ НОВЫЙ РОУТ: GET /api/couriers/registration-example - Пример данных для регистрации
router.get('/registration-example', (req, res) => {
  res.status(200).json({
    result: true,
    message: "Пример данных для регистрации курьера с PDF файлами",
    postman_example: {
      method: "POST",
      url: "/api/couriers/register",
      headers: {
        "Content-Type": "multipart/form-data"
      },
      form_data: {
        // Личные данные
        first_name: "Иван",
        last_name: "Иванов",
        email: "ivan.ivanov@example.com",
        phone: "+33123456789",
        date_of_birth: "1990-05-15",
        
        // Адрес
        street: "123 Rue de la République",
        city: "Marseille",
        postal_code: "13001",
        country: "France",
        
        // Транспорт
        vehicle_type: "motorbike",
        vehicle_brand: "Yamaha",
        vehicle_model: "MT-07",
        license_plate: "AB-123-CD",
        
        // Согласия
        terms_accepted: true,
        privacy_policy_accepted: true,
        data_processing_accepted: true,
        background_check_accepted: true,
        
        // PDF ФАЙЛЫ (вместо URL полей)
        id_card: "[PDF FILE]",           // Загрузить PDF файл
        bank_rib: "[PDF FILE]",          // Загрузить PDF файл  
        driver_license: "[PDF FILE]",    // Для motorbike/car
        insurance: "[PDF FILE]",         // Для motorbike/car
        vehicle_registration: "[PDF FILE]" // Только для car
      }
    },
    old_vs_new: {
      old_way: "Нужно было загружать файлы отдельно и вставлять URL",
      new_way: "Прикрепляете PDF файлы прямо к форме регистрации",
      advantage: "Намного удобнее для пользователя"
    }
  });
});

export default router;