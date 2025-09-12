// ================ routes/Admin.route.js ================
import express from 'express';
import { 
    createAdmin, 
    loginAdminController, 
    verifyAdmin, 
    editAdmin, 
    deleteAdmin,
    getProfile,
    getAdminsList 
} from '../controllers/AdminController.js';
import { checkAdminToken, checkAccessByGroup } from '../middleware/adminAuth.middleware.js';

import { authFieldsSanitizer } from '../middleware/security.middleware.js';

const router = express.Router();

// Публичные роуты
router.post('/login', authFieldsSanitizer, loginAdminController);

// Защищенные роуты
router.get('/verify', checkAdminToken, verifyAdmin);
router.get('/profile', checkAdminToken, getProfile);
router.get('/profile/:id', checkAccessByGroup(['owner']), getProfile);
router.get('/list', checkAccessByGroup(['owner', 'manager']), getAdminsList);
router.post('/create', authFieldsSanitizer, checkAccessByGroup(['owner', 'manager']), createAdmin);
router.put('/edit/:id', checkAccessByGroup(['owner', 'manager']), editAdmin);
router.delete('/delete/:id', checkAccessByGroup(['owner']), deleteAdmin);

export default router;