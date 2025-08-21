// ================ routes/AdminPartner.route.js ================
import express from 'express';
import {
    approvePartnerRequest,
    rejectPartnerRequest,
    approveLegalInfo,
    rejectLegalInfo,
    getAllRequests,
    getRequestDetails,
    publishPartner
} from '../controllers/AdminPartnerController.js';
import { checkAdminToken, checkAccessByGroup } from '../middleware/adminAuth.middleware.js';

const router = express.Router();

// ================ ПРОСМОТР (любой админ) ================

// GET /api/admin/partners/requests - Получение всех заявок
router.get('/requests', checkAdminToken, getAllRequests);

// GET /api/admin/partners/requests/:id - Детальная информация о заявке
router.get('/requests/:id', checkAdminToken, getRequestDetails);

// ================ УПРАВЛЕНИЕ ЗАЯВКАМИ (manager, owner) ================

// POST /api/admin/partners/requests/:id/approve - Одобрение заявки
router.post('/requests/:id/approve', 
    checkAccessByGroup(['manager', 'owner']), 
    approvePartnerRequest
);

// POST /api/admin/partners/requests/:id/reject - Отклонение заявки
router.post('/requests/:id/reject', 
    checkAccessByGroup(['manager', 'owner']), 
    rejectPartnerRequest
);

// ================ УПРАВЛЕНИЕ ДОКУМЕНТАМИ (manager, owner) ================

// POST /api/admin/partners/legal/:id/approve - Одобрение документов
router.post('/legal/:id/approve', 
    checkAccessByGroup(['manager', 'owner']), 
    approveLegalInfo
);

// POST /api/admin/partners/legal/:id/reject - Отклонение документов
router.post('/legal/:id/reject', 
    checkAccessByGroup(['manager', 'owner']), 
    rejectLegalInfo
);

// ================ ПУБЛИКАЦИЯ (manager, owner) ================

// POST /api/admin/partners/profiles/:id/publish - Публикация партнера
router.post('/profiles/:id/publish', 
    checkAccessByGroup(['manager', 'owner']), 
    publishPartner
);

export default router;