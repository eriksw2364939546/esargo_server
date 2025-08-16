// routes/Customer.route.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  registerCustomer,
  loginUser,
  getProfile,
  updateProfile
} = require('../controllers/CustomerController');

// ✅ РЕАЛЬНЫЙ JWT MIDDLEWARE С ОТЛАДКОЙ
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      result: false,
      message: "Токен авторизации отсутствует"
    });
  }
  
  try {
    // Расшифровываем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // 🔍 ВРЕМЕННАЯ ОТЛАДКА - ПОСМОТРИМ ЧТО В ТОКЕНЕ
    console.log('🔍 DEBUG: Decoded token:', decoded);
    console.log('🔍 DEBUG: User ID from token:', decoded.user_id);
    
    // Добавляем данные пользователя в req
    req.user = {
      _id: decoded.user_id,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.log('🚨 JWT Error:', error.message);
    return res.status(401).json({
      result: false,
      message: "Недействительный токен"
    });
  }
};

// ================ РОУТЫ ================

// POST /api/customers/register - Регистрация клиента
router.post('/register', registerCustomer);

// POST /api/customers/login - Авторизация пользователя
router.post('/login', loginUser);

// GET /api/customers/profile - Получение профиля пользователя
router.get('/profile', authenticateUser, getProfile);

// PUT /api/customers/profile - Обновление профиля пользователя
router.put('/profile', authenticateUser, updateProfile);

// GET /api/customers/health - Проверка работы роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Customer routes working",
    available_endpoints: {
      register: "POST /api/customers/register",
      login: "POST /api/customers/login",
      profile: "GET /api/customers/profile",
      update_profile: "PUT /api/customers/profile"
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;