// ================ routes/Partner.menu.routes.js (НОВЫЕ МАРШРУТЫ МЕНЮ) ================
import express from 'express';
import {
    getMenuCategories,
    addMenuCategory,
    updateMenuCategoryController,
    deleteMenuCategoryController,
    getProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getMenuStats
} from '../controllers/PartnerMenuController.js';
import { checkPartnerToken } from '../middleware/partnerAuth.middleware.js';
import {
    requireMenuAccess,
    validateMenuCategoryData,
    validateProductData,
    checkCategoryOwnership,
    checkProductOwnership
} from '../middleware/partner.menu.middleware.js';

const router = express.Router();

// ================ УПРАВЛЕНИЕ КАТЕГОРИЯМИ МЕНЮ ================

// GET /api/partners/menu/categories - Получение всех категорий
router.get('/categories', 
    checkPartnerToken,
    requireMenuAccess,
    getMenuCategories
);

// POST /api/partners/menu/categories - Добавление категории
router.post('/categories', 
    checkPartnerToken,
    requireMenuAccess,
    validateMenuCategoryData,
    addMenuCategory
);

// PUT /api/partners/menu/categories/:category_id - Обновление категории
router.put('/categories/:category_id', 
    checkPartnerToken,
    requireMenuAccess,
    checkCategoryOwnership,
    validateMenuCategoryData,
    updateMenuCategoryController
);

// DELETE /api/partners/menu/categories/:category_id - Удаление категории
router.delete('/categories/:category_id', 
    checkPartnerToken,
    requireMenuAccess,
    checkCategoryOwnership,
    deleteMenuCategoryController
);

// ================ УПРАВЛЕНИЕ ПРОДУКТАМИ ================

// GET /api/partners/menu/products - Получение всех продуктов
router.get('/products', 
    checkPartnerToken,
    requireMenuAccess,
    getProducts
);

// POST /api/partners/menu/products - Добавление продукта
router.post('/products', 
    checkPartnerToken,
    requireMenuAccess,
    validateProductData,
    addProduct
);

// PUT /api/partners/menu/products/:product_id - Обновление продукта
router.put('/products/:product_id', 
    checkPartnerToken,
    requireMenuAccess,
    checkProductOwnership,
    validateProductData,
    updateProduct
);

// DELETE /api/partners/menu/products/:product_id - Удаление продукта
router.delete('/products/:product_id', 
    checkPartnerToken,
    requireMenuAccess,
    checkProductOwnership,
    deleteProduct
);

// ================ СТАТИСТИКА МЕНЮ ================

// GET /api/partners/menu/stats - Получение статистики меню
router.get('/stats', 
    checkPartnerToken,
    requireMenuAccess,
    getMenuStats
);

export default router;