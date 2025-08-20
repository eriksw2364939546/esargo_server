// ================ 4. routes/Admin.route.js ================
import express from 'express';
import { createAdmin, loginAdminController, verifyAdmin, editAdmin, deleteAdmin } from '../controllers/AdminController.js';
import { checkAdminToken, checkAccessByGroup } from '../middleware/adminAuth.middleware.js';

const router = express.Router();

// Публичные роуты
router.post('/login', loginAdminController);

// Защищенные роуты
router.get('/verify', checkAdminToken, verifyAdmin);
router.post('/create', checkAccessByGroup(['owner', 'manager']), createAdmin);
router.put('/edit/:id', checkAccessByGroup(['owner', 'manager']), editAdmin);
router.delete('/delete/:id', checkAccessByGroup(['owner']), deleteAdmin);

export default router;