const express = require('express');
const router = express.Router();
const {
  createInitialPartnerRequest,
  submitPartnerLegalInfo,
  getPartnerRequests,
  updatePartnerRequestStatus
} = require('../controllers/PartnerController');

// Временный middleware для аутентификации (замените на ваш)
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    // Для тестирования разрешаем без токена, используя user_id из body
    if (req.body.user_id) {
      req.user = { _id: req.body.user_id };
      return next();
    }
    return res.status(401).json({
      result: false,
      message: "Authorization token required or provide user_id in body for testing"
    });
  }
  
  // Фейковый пользователь для тестирования
  req.user = {
    _id: req.body.user_id || "64e8b2f0c2a4f91a12345678",
    email: "test@example.com",
    role: "customer"
  };
  
  next();
};

// Middleware для админов
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      result: false,
      message: "Admin authorization required"
    });
  }
  
  // Фейковый админ для тестирования
  req.admin = {
    _id: "64e8b2f0c2a4f91a12345679",
    email: "admin@example.com",
    role: "admin",
    full_name: "Test Admin"
  };
  
  next();
};

// ================ РОУТЫ ================

// POST /api/partners/initial-request - Этап 1: Создание первичной заявки
router.post('/initial-request', authenticateUser, createInitialPartnerRequest);

// POST /api/partners/:request_id/legal-info - Этап 2: Юридические данные
router.post('/:request_id/legal-info', authenticateUser, submitPartnerLegalInfo);

// GET /api/partners/requests - Получение всех заявок (админы)
router.get('/requests', authenticateAdmin, getPartnerRequests);

// PATCH /api/partners/:id/status - Обновление статуса заявки (админы)
router.patch('/:id/status', authenticateAdmin, updatePartnerRequestStatus);

// GET /api/partners/health - Проверка работы роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Partner routes working",
    available_endpoints: {
      create_initial: "POST /api/partners/initial-request",
      submit_legal: "POST /api/partners/:request_id/legal-info", 
      list_requests: "GET /api/partners/requests",
      update_status: "PATCH /api/partners/:id/status"
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;