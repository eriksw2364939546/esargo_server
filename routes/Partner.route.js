// ================ routes/Partner.route.js (АКТИВИРОВАННЫЙ) ================
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
    requirePartnerProfile 
} from '../middleware/partnerAuth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/partners/register - Регистрация партнера
router.post('/register', registerPartner);

// POST /api/partners/login - Авторизация партнера
router.post('/login', loginPartnerController);

// ================ ЗАЩИЩЕННЫЕ РОУТЫ (базовая проверка) ================

// GET /api/partners/verify - Верификация токена
router.get('/verify', checkPartnerToken, verifyPartner);

// GET /api/partners/dashboard - Статус личного кабинета
router.get('/dashboard', checkPartnerToken, getDashboardStatus);

// ================ ЮРИДИЧЕСКИЕ ДОКУМЕНТЫ (требуется одобренная заявка) ================

// POST /api/partners/legal-info/:request_id - Подача юридических документов
router.post('/legal-info/:request_id', 
    checkPartnerStatus(['approved']), 
    submitLegalInfo
);

// ================ ПРОФИЛЬ (требуется созданный профиль) ================

// GET /api/partners/profile - Получение профиля
router.get('/profile', requirePartnerProfile, getProfile);

// GET /api/partners/profile/:id - Получение профиля по ID
router.get('/profile/:id', requirePartnerProfile, getProfile);

// PUT /api/partners/profile/:id - Обновление профиля
router.put('/profile/:id', requirePartnerProfile, updateProfile);

// DELETE /api/partners/profile/:id - Удаление партнера
router.delete('/profile/:id', checkPartnerToken, deletePartner);

export default router;