// routes/Courier.route.js
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

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/couriers/register - Регистрация курьера с подачей документов
router.post('/register', 
  validateCourierRegistration,  // Валидация данных регистрации
  registerCourier
);

// POST /api/couriers/login - Авторизация курьера
router.post('/login', loginCourierController);

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

// PATCH /api/couriers/availability - Переключение статуса On-e/Off-e
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
        description: "Заполнение формы и загрузка документов",
        required_documents: ["Удостоверение личности", "RIB банковские реквизиты"],
        conditional_documents: {
          motorbike_car: ["Водительские права", "Страховка"],
          car_only: ["Регистрация ТС"]
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
      all_couriers: ["id_card_url", "bank_rib_url"],
      motorbike_car: ["driver_license_url", "insurance_url"],
      car_only: ["vehicle_registration_url"]
    },
    vehicle_types: ["bike", "motorbike", "car"]
  });
});

export default router;