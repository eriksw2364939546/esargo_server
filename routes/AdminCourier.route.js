// routes/AdminCourier.route.js
import express from 'express';
import {
  getAllCourierApplications,
  getCourierApplicationDetails,
  approveCourierApplication,
  rejectCourierApplication,
  getAllCourierProfiles,
  blockCourierProfile,
  unblockCourierProfile,
  getCourierStatistics
} from '../controllers/AdminCourierController.js';
import { checkAdminToken, checkAccessByGroup } from '../middleware/adminAuth.middleware.js';

const router = express.Router();

// ================ ПРОСМОТР (любой админ) ================

// GET /api/admin/couriers/applications - Получение всех заявок курьеров
router.get('/applications', checkAdminToken, getAllCourierApplications);

// GET /api/admin/couriers/applications/:id - Детальная информация о заявке
router.get('/applications/:id', checkAdminToken, getCourierApplicationDetails);

// GET /api/admin/couriers/profiles - Получение всех профилей курьеров
router.get('/profiles', checkAdminToken, getAllCourierProfiles);

// GET /api/admin/couriers/statistics - Статистика курьеров
router.get('/statistics', checkAdminToken, getCourierStatistics);

// ================ УПРАВЛЕНИЕ ЗАЯВКАМИ (manager, owner) ================

// POST /api/admin/couriers/applications/:id/approve - Одобрение заявки курьера
router.post('/applications/:id/approve', 
  checkAccessByGroup(['manager', 'owner']), 
  approveCourierApplication
);

// POST /api/admin/couriers/applications/:id/reject - Отклонение заявки курьера
router.post('/applications/:id/reject', 
  checkAccessByGroup(['manager', 'owner']), 
  rejectCourierApplication
);

// ================ УПРАВЛЕНИЕ ПРОФИЛЯМИ (manager, owner) ================

// POST /api/admin/couriers/profiles/:id/block - Блокировка курьера
router.post('/profiles/:id/block', 
  checkAccessByGroup(['manager', 'owner']), 
  blockCourierProfile
);

// POST /api/admin/couriers/profiles/:id/unblock - Разблокировка курьера
router.post('/profiles/:id/unblock', 
  checkAccessByGroup(['manager', 'owner']), 
  unblockCourierProfile
);

// ================ ДОПОЛНИТЕЛЬНЫЕ РОУТЫ ================

// GET /api/admin/couriers/workflow-info - Информация о workflow курьеров
router.get('/workflow-info', checkAdminToken, (req, res) => {
  res.status(200).json({
    result: true,
    message: "Информация о workflow курьеров",
    courier_workflow: {
      stage_1: {
        name: "Подача заявки",
        description: "Курьер подает заявку с документами",
        status: "pending",
        duration: "Моментально",
        required_documents: [
          "Удостоверение личности (id_card_url)",
          "Банковские реквизиты RIB (bank_rib_url)",
          "Водительские права (для мотоцикла/авто)",
          "Страховка (для мотоцикла/авто)",
          "Регистрация ТС (только для авто)"
        ]
      },
      stage_2: {
        name: "Рассмотрение админом",
        description: "Администратор проверяет документы и принимает решение",
        possible_actions: ["approve", "reject"],
        typical_duration: "24 часа",
        admin_roles: ["manager", "owner"]
      },
      stage_3: {
        name: "Создание профиля",
        description: "Автоматическое создание CourierProfile после одобрения",
        status: "approved",
        automatic: true
      },
      stage_4: {
        name: "Готов к работе",
        description: "Курьер может включить статус On-e и начать получать заказы",
        features: ["Переключение доступности", "Геолокация", "Прием заказов"]
      }
    },
    admin_permissions: {
      view: "Просмотр заявок и профилей (все админы)",
      approve_reject: "Одобрение/отклонение заявок (manager, owner)",
      block_unblock: "Блокировка/разблокировка курьеров (manager, owner)"
    },
    api_endpoints: {
      view_applications: "GET /api/admin/couriers/applications",
      view_application_details: "GET /api/admin/couriers/applications/:id",
      approve_application: "POST /api/admin/couriers/applications/:id/approve",
      reject_application: "POST /api/admin/couriers/applications/:id/reject",
      view_profiles: "GET /api/admin/couriers/profiles",
      block_courier: "POST /api/admin/couriers/profiles/:id/block",
      unblock_courier: "POST /api/admin/couriers/profiles/:id/unblock",
      statistics: "GET /api/admin/couriers/statistics"
    },
    vehicle_types: ["bike", "motorbike", "car"],
    application_statuses: ["pending", "approved", "rejected"],
    courier_profile_statuses: ["approved", "rejected", "blocked"]
  });
});

export default router;