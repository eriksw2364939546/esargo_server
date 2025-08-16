// routes/Customer.route.js (обновленный)
import express from 'express';
import {
  register,
  login,
  verify,
  getProfile,
  edit,
  delClient,
  addAddress,
  updateAddress,
  removeAddress
} from '../controllers/CustomerController.js';
import { 
  authenticateUser, 
  requireRole,
  optionalAuth 
} from '../middleware/auth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/customers/register - Регистрация клиента
router.post('/register', register);

// POST /api/customers/login - Авторизация пользователя  
router.post('/login', login);

// GET /api/customers/health - Проверка работы роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Customer routes working",
    service_layer: "enabled",
    available_endpoints: {
      register: "POST /api/customers/register",
      login: "POST /api/customers/login", 
      verify: "GET /api/customers/verify",
      profile: "GET /api/customers/profile",
      update_profile: "PUT /api/customers/profile/:id",
      delete_profile: "DELETE /api/customers/profile/:id",
      add_address: "POST /api/customers/addresses",
      update_address: "PUT /api/customers/addresses/:addressId", 
      remove_address: "DELETE /api/customers/addresses/:addressId"
    },
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ ================

// GET /api/customers/verify - Верификация токена
router.get('/verify', authenticateUser, verify);

// GET /api/customers/profile - Получение профиля пользователя
router.get('/profile', authenticateUser, requireRole('customer'), getProfile);

// PUT /api/customers/profile/:id - Обновление профиля пользователя
router.put('/profile/:id', authenticateUser, requireRole('customer'), edit);

// DELETE /api/customers/profile/:id - Удаление пользователя
router.delete('/profile/:id', authenticateUser, requireRole('customer'), delClient);

// ================ УПРАВЛЕНИЕ АДРЕСАМИ ================

// POST /api/customers/addresses - Добавление адреса доставки
router.post('/addresses', authenticateUser, requireRole('customer'), addAddress);

// PUT /api/customers/addresses/:addressId - Обновление адреса доставки  
router.put('/addresses/:addressId', authenticateUser, requireRole('customer'), updateAddress);

// DELETE /api/customers/addresses/:addressId - Удаление адреса доставки
router.delete('/addresses/:addressId', authenticateUser, requireRole('customer'), removeAddress);

export default router;