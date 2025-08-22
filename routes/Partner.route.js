// ================ routes/Partner.route.js (ИСПРАВЛЕННЫЙ ПО АРХИТЕКТУРЕ) ================
import express from 'express';
import {
    registerPartner,
    loginPartnerController,
    verifyPartner,
    getProfile,
    updateProfile,
    deletePartner,
    getDashboardStatus,
    submitLegalInfo
} from '../controllers/PartnerController.js';
import { 
    checkPartnerToken, 
    checkPartnerStatus,
    requirePartnerProfile,
    checkProfileAccess
} from '../middleware/partnerAuth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/partners/register - Регистрация партнера
router.post('/register', registerPartner);

// POST /api/partners/login - Авторизация партнера
router.post('/login', loginPartnerController);

// ================ ЗАЩИЩЕННЫЕ РОУТЫ (базовая проверка токена) ================

// GET /api/partners/verify - Верификация токена
router.get('/verify', checkPartnerToken, verifyPartner);

// GET /api/partners/dashboard - Статус личного кабинета
router.get('/dashboard', checkPartnerToken, getDashboardStatus);

// ================ ЮРИДИЧЕСКИЕ ДОКУМЕНТЫ (требуется статус 'approved') ================

// POST /api/partners/legal-info/:request_id - Подача юридических документов
router.post('/legal-info/:request_id', 
    checkPartnerStatus(['approved']), 
    submitLegalInfo
);

// ================ ПРОФИЛЬ (требуется созданный профиль + права доступа) ================

// GET /api/partners/profile - Получение своего профиля
router.get('/profile', requirePartnerProfile, getProfile);

// GET /api/partners/profile/:id - Получение профиля по ID (с проверкой прав)
router.get('/profile/:id', checkProfileAccess, getProfile);

// PUT /api/partners/profile/:id - Обновление профиля (с проверкой прав)
router.put('/profile/:id', checkProfileAccess, updateProfile);

// DELETE /api/partners/profile/:id - Удаление партнера (базовая проверка токена)
router.delete('/profile/:id', checkPartnerToken, deletePartner);

export default router;