// routes/Partner.route.js - ОСНОВНЫЕ ФУНКЦИИ ПАРТНЕРОВ
import express from 'express';
import {
  registerPartner,  // 🆕 ГЛАВНАЯ ФУНКЦИЯ
  loginPartnerUser,
  getDashboardStatus,
  getRequestStatus,
  checkFeatureAccess,
  submitPartnerLegalInfo,
  getPartnerProfileData,
  createInitialPartnerRequest  // deprecated
} from '../controllers/PartnerController.js';
import { 
  authenticateUser, 
  requireRole
} from '../middleware/auth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// 🎯 1️⃣ РЕГИСТРАЦИЯ ПАРТНЕРА (главная функция)
router.post('/register', registerPartner);

// 🎯 2️⃣ АВТОРИЗАЦИЯ ПАРТНЕРА
router.post('/login', loginPartnerUser);

// GET /api/partners/health - Проверка работы роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Partner routes working - основные функции",
    service_layer: "enabled",
    meta_model: "enabled",
    available_endpoints: {
      // 📋 ОСНОВНОЙ ПОТОК
      "1️⃣ Регистрация": "POST /api/partners/register",
      "2️⃣ Авторизация": "POST /api/partners/login",
      "3️⃣ Статус кабинета": "GET /api/partners/dashboard",
      "4️⃣ Юридические данные": "POST /api/partners/:request_id/legal-info",
      "5️⃣ Профиль": "GET /api/partners/profile",
      
      // 🔧 ДОПОЛНИТЕЛЬНО  
      check_access: "GET /api/partners/access/:feature",
      status_old: "GET /api/partners/status"
    },
    workflow: {
      step1: "POST /register -> Создает User + InitialPartnerRequest",
      step2: "POST /login -> Авторизация в личный кабинет",
      step3: "GET /dashboard -> Проверка что нужно сделать дальше",
      step4: "POST /:request_id/legal-info -> Подача документов (после одобрения админом)",
      step5: "GET /profile -> Полный доступ (после одобрения документов)"
    },
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ ПАРТНЕРОВ ================

// 🎯 3️⃣ СТАТУС ЛИЧНОГО КАБИНЕТА (что делать дальше)
router.get('/dashboard', authenticateUser, requireRole('partner'), getDashboardStatus);

// 🎯 4️⃣ ПОДАЧА ЮРИДИЧЕСКИХ ДАННЫХ
router.post('/:request_id/legal-info', authenticateUser, requireRole('partner'), submitPartnerLegalInfo);

// 🎯 5️⃣ ПОЛУЧЕНИЕ ПРОФИЛЯ (после полного одобрения)
router.get('/profile', authenticateUser, requireRole('partner'), getPartnerProfileData);

// 🔧 ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ

// Проверка доступа к функции
router.get('/access/:feature', authenticateUser, requireRole('partner'), checkFeatureAccess);

// Старый метод получения статуса
router.get('/status', authenticateUser, requireRole('partner'), getRequestStatus);

// ================ УСТАРЕВШИЕ РОУТЫ ================

// POST /api/partners/initial-request - УСТАРЕЛО
router.post('/initial-request', authenticateUser, createInitialPartnerRequest);

// ================ ЗАМЕТКИ ДЛЯ РАЗРАБОТЧИКОВ ================
/*
📋 ПОТОК РЕГИСТРАЦИИ ПАРТНЕРА:

1️⃣ POST /api/partners/register
   - Создает User с role='partner' 
   - Создает InitialPartnerRequest со статусом 'pending'
   - Возвращает JWT токен
   - Партнер может войти в кабинет

2️⃣ POST /api/partners/login  
   - Авторизация партнера
   - Получение токена доступа

3️⃣ GET /api/partners/dashboard
   - Проверка статуса заявки
   - Показывает что нужно сделать дальше:
     • pending -> "Ждите одобрения админом"
     • approved -> "Заполните юридические данные"  
     • under_review -> "Документы на проверке"
     • completed -> "Доступны все функции"

4️⃣ POST /api/partners/:request_id/legal-info
   - Подача юридических данных (SIRET, и т.д.)
   - Только после одобрения первичной заявки (status=approved)

5️⃣ GET /api/partners/profile
   - Получение полного профиля партнера
   - Только после одобрения всех документов

🔄 СЛЕДУЮЩИЕ ЭТАПЫ:
- Админские функции для одобрения заявок
- Управление меню и товарами  
- Обработка заказов
- Аналитика и отчеты
*/

export default router;