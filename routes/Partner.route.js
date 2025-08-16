// routes/Partner.route.js (обновленный)
import express from 'express';
import {
  createInitialPartnerRequest,
  submitPartnerLegalInfo,
  loginPartnerUser,
  getPartnerProfileData,
  getRequestStatus,
  getPartnerRequests,
  updatePartnerRequestStatus,
  approveLegalInfoAndCreate,
  rejectLegalInfoData,
  getRequestDetails
} from '../controllers/PartnerController.js';
import { 
  authenticateUser, 
  requireRole,
  requireAdminPermission,
  optionalAuth 
} from '../middleware/auth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/partners/login - Авторизация партнера
router.post('/login', loginPartnerUser);

// GET /api/partners/health - Проверка работы роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Partner routes working with service layer",
    service_layer: "enabled",
    meta_model: "enabled",
    available_endpoints: {
      // Публичные
      login: "POST /api/partners/login",
      
      // Регистрация партнера
      create_initial: "POST /api/partners/initial-request",
      submit_legal: "POST /api/partners/:request_id/legal-info",
      request_status: "GET /api/partners/status",
      
      // Профиль партнера
      profile: "GET /api/partners/profile",
      
      // Админские
      list_requests: "GET /api/partners/requests",
      request_details: "GET /api/partners/requests/:request_id",
      update_status: "PATCH /api/partners/:id/status",
      approve_legal: "POST /api/partners/legal-info/:legal_info_id/approve",
      reject_legal: "POST /api/partners/legal-info/:legal_info_id/reject"
    },
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ ПАРТНЕРОВ ================

// POST /api/partners/initial-request - Этап 1: Создание первичной заявки
router.post('/initial-request', authenticateUser, createInitialPartnerRequest);

// POST /api/partners/:request_id/legal-info - Этап 2: Юридические данные
router.post('/:request_id/legal-info', authenticateUser, submitPartnerLegalInfo);

// GET /api/partners/profile - Получение профиля партнера
router.get('/profile', authenticateUser, requireRole('partner'), getPartnerProfileData);

// GET /api/partners/status - Получение статуса заявки
router.get('/status', authenticateUser, getRequestStatus);

// ================ АДМИНСКИЕ РОУТЫ ================

// GET /api/partners/requests - Получение всех заявок (админы)
router.get('/requests', authenticateUser, requireRole('admin'), requireAdminPermission('partners', 'read'), getPartnerRequests);

// GET /api/partners/requests/:request_id - Получение детальной информации о заявке
router.get('/requests/:request_id', authenticateUser, requireRole('admin'), requireAdminPermission('partners', 'read'), getRequestDetails);

// PATCH /api/partners/:id/status - Обновление статуса первичной заявки (админы)
router.patch('/:id/status', authenticateUser, requireRole('admin'), requireAdminPermission('partners', 'approve'), updatePartnerRequestStatus);

// 🆕 POST /api/partners/legal-info/:legal_info_id/approve - Одобрение юридических данных
router.post('/legal-info/:legal_info_id/approve', authenticateUser, requireRole('admin'), requireAdminPermission('partners', 'approve'), approveLegalInfoAndCreate);

// 🆕 POST /api/partners/legal-info/:legal_info_id/reject - Отклонение юридических данных  
router.post('/legal-info/:legal_info_id/reject', authenticateUser, requireRole('admin'), requireAdminPermission('partners', 'write'), rejectLegalInfoData);

export default router;