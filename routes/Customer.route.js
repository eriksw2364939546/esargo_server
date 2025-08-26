// routes/Customer.route.js (обновленный с middleware)
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
  authenticateCustomer, 
  requireRole,
  checkProfileOwnership,
  validateCustomerRegistration,  // Новый middleware для регистрации
  validateCustomerUpdate        // Новый middleware для обновления
} from '../middleware/customerAuth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ (без middleware) ================

/**
 * POST /api/customers/register - Регистрация клиента
 * Middleware: validateCustomerRegistration (валидация данных + подтверждение пароля)
 */
router.post('/register', 
  validateCustomerRegistration,
  register
);

/**
 * POST /api/customers/login - Авторизация пользователя
 * Middleware: нет (публичный endpoint)
 */
router.post('/login', login);

/**
 * GET /api/customers/health - Проверка работы роутов
 * Middleware: нет (служебный endpoint)
 */
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Customer routes working correctly",
    service_layer: "enabled",
    middleware: "enabled",
    available_endpoints: {
      public: {
        register: "POST /api/customers/register",
        login: "POST /api/customers/login",
        health: "GET /api/customers/health"
      },
      protected: {
        verify: "GET /api/customers/verify",
        profile: "GET /api/customers/profile",
        update_profile: "PUT /api/customers/profile/:id",
        delete_profile: "DELETE /api/customers/profile/:id",
        addresses: {
          add: "POST /api/customers/addresses",
          update: "PUT /api/customers/addresses/:addressId",
          remove: "DELETE /api/customers/addresses/:addressId"
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ (требуют аутентификации) ================

/**
 * GET /api/customers/verify - Верификация токена
 * Middleware: authenticateCustomer (проверка токена)
 */
router.get('/verify', 
  authenticateCustomer, 
  verify
);

/**
 * GET /api/customers/profile - Получение профиля пользователя
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/profile', 
  authenticateCustomer, 
  requireRole('customer'), 
  getProfile
);

/**
 * PUT /api/customers/profile/:id - Обновление профиля пользователя
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 * - checkProfileOwnership (проверка права редактировать профиль)
 * - validateCustomerUpdate (валидация данных + подтверждение пароля при смене)
 */
router.put('/profile/:id', 
  authenticateCustomer, 
  requireRole('customer'), 
  checkProfileOwnership,
  validateCustomerUpdate,
  edit
);

/**
 * DELETE /api/customers/profile/:id - Удаление пользователя
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 * - checkProfileOwnership (проверка права удалить профиль)
 */
router.delete('/profile/:id', 
  authenticateCustomer, 
  requireRole('customer'), 
  checkProfileOwnership,
  delClient
);

// ================ УПРАВЛЕНИЕ АДРЕСАМИ ДОСТАВКИ ================

/**
 * POST /api/customers/addresses - Добавление адреса доставки
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.post('/addresses', 
  authenticateCustomer, 
  requireRole('customer'), 
  addAddress
);

/**
 * PUT /api/customers/addresses/:addressId - Обновление адреса доставки
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.put('/addresses/:addressId', 
  authenticateCustomer, 
  requireRole('customer'), 
  updateAddress
);

/**
 * DELETE /api/customers/addresses/:addressId - Удаление адреса доставки
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.delete('/addresses/:addressId', 
  authenticateCustomer, 
  requireRole('customer'), 
  removeAddress
);

// ================ ДОПОЛНИТЕЛЬНЫЕ ЗАЩИЩЕННЫЕ РОУТЫ ================

/**
 * GET /api/customers/favorites - Получение избранных партнеров
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/favorites', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для избранных
    res.json({
      result: true,
      message: "Функционал избранных партнеров в разработке",
      favorites: []
    });
  }
);

/**
 * POST /api/customers/favorites/:partnerId - Добавление в избранное
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.post('/favorites/:partnerId', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для добавления в избранное
    res.json({
      result: true,
      message: "Функционал добавления в избранное в разработке"
    });
  }
);

/**
 * DELETE /api/customers/favorites/:partnerId - Удаление из избранного
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.delete('/favorites/:partnerId', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для удаления из избранного
    res.json({
      result: true,
      message: "Функционал удаления из избранного в разработке"
    });
  }
);

/**
 * GET /api/customers/orders - Получение истории заказов
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/orders', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для истории заказов
    res.json({
      result: true,
      message: "История заказов в разработке",
      orders: []
    });
  }
);

export default router;