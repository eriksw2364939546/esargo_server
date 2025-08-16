// routes/Auth.route.js
const express = require('express');
const router = express.Router();
const {
  registerCustomer,
  loginUser,
  getProfile,
  updateProfile
} = require('../controllers/CustomerController');

// Временный middleware для аутентификации (замените на реальный JWT middleware)
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      result: false,
      message: "Токен авторизации отсутствует"
    });
  }
  
  // Временная заглушка для тестирования
  // В реальном приложении здесь будет проверка JWT токена
  req.user = {
    _id: "64e8b2f0c2a4f91a12345678",
    email: "test@example.com",
    role: "customer"
  };
  
  next();
};

// ================ РОУТЫ ================

// POST /api/auth/register - Регистрация клиента
router.post('/register', registerCustomer);

// POST /api/auth/login - Авторизация пользователя
router.post('/login', loginUser);

// GET /api/auth/profile - Получение профиля пользователя
router.get('/profile', authenticateUser, getProfile);

// PUT /api/auth/profile - Обновление профиля пользователя
router.put('/profile', authenticateUser, updateProfile);

// GET /api/auth/health - Проверка работы роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Auth routes working",
    available_endpoints: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      profile: "GET /api/auth/profile",
      update_profile: "PUT /api/auth/profile"
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;