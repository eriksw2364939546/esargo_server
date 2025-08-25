// ================ routes/Partner.menu.routes.js (ИСПРАВЛЕННЫЙ) ================
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

/**
 * GET /api/partners/menu/categories - Получение всех категорий
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → controller
 */
router.get('/categories', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    getMenuCategories               // 3. Контроллер
);

/**
 * POST /api/partners/menu/categories - Добавление категории
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → validation → controller
 */
router.post('/categories', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    validateMenuCategoryData,       // 3. Валидация данных категории
    addMenuCategory                 // 4. Контроллер
);

/**
 * PUT /api/partners/menu/categories/:category_id - Обновление категории
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → ownership → validation → controller
 */
router.put('/categories/:category_id', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    checkCategoryOwnership,         // 3. Проверка принадлежности категории
    validateMenuCategoryData,       // 4. Валидация данных категории
    updateMenuCategoryController    // 5. Контроллер
);

/**
 * DELETE /api/partners/menu/categories/:category_id - Удаление категории
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → ownership → controller
 */
router.delete('/categories/:category_id', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    checkCategoryOwnership,         // 3. Проверка принадлежности категории
    deleteMenuCategoryController    // 4. Контроллер
);

// ================ УПРАВЛЕНИЕ ПРОДУКТАМИ ================

/**
 * GET /api/partners/menu/products - Получение всех продуктов
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → controller
 */
router.get('/products', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    getProducts                     // 3. Контроллер
);

/**
 * POST /api/partners/menu/products - Добавление продукта
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → validation (использует partnerProfile) → controller
 */
router.post('/products', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    validateProductData,            // 3. Валидация данных продукта (включая логику ресторан/магазин)
    addProduct                      // 4. Контроллер
);

/**
 * PUT /api/partners/menu/products/:product_id - Обновление продукта
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → ownership → validation → controller
 */
router.put('/products/:product_id', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    checkProductOwnership,          // 3. Проверка принадлежности продукта
    validateProductData,            // 4. Валидация данных продукта (включая логику ресторан/магазин)
    updateProduct                   // 5. Контроллер
);

/**
 * DELETE /api/partners/menu/products/:product_id - Удаление продукта
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → ownership → controller
 */
router.delete('/products/:product_id', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    checkProductOwnership,          // 3. Проверка принадлежности продукта
    deleteProduct                   // 4. Контроллер
);

// ================ СТАТИСТИКА МЕНЮ ================

/**
 * GET /api/partners/menu/stats - Получение статистики меню
 * ✅ ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ: token → access → controller
 */
router.get('/stats', 
    checkPartnerToken,              // 1. Проверка JWT токена
    requireMenuAccess,              // 2. Проверка прав + добавляет partnerProfile в req
    getMenuStats                    // 3. Контроллер
);

// ================ ДОКУМЕНТАЦИЯ MIDDLEWARE ================

/*
ПОСЛЕДОВАТЕЛЬНОСТЬ ВЫПОЛНЕНИЯ MIDDLEWARE:

1. checkPartnerToken - Проверяет JWT токен партнера
   - Добавляет user в req
   - Проверяет роль 'partner'

2. requireMenuAccess - Проверяет права на управление меню
   - Находит профиль партнера по user_id
   - Проверяет статус одобрения (is_approved)
   - Добавляет partnerProfile в req

3. validateMenuCategoryData - Валидация данных категории
   - Проверяет обязательные поля
   - Проверяет длину строк
   - НЕ работает с базой данных

4. validateProductData - Валидация данных продукта
   - Использует partnerProfile из req (добавлен в requireMenuAccess)
   - Проверяет бизнес-логику: ресторан (добавки) vs магазин (упаковки)
   - НЕ работает с базой данных для основной валидации

5. checkCategoryOwnership - Проверка принадлежности категории
   - Проверяет что категория принадлежит текущему партнеру
   - Добавляет menuCategory в req

6. checkProductOwnership - Проверка принадлежности продукта
   - Проверяет что продукт принадлежит текущему партнеру
   - Добавляет product в req

БИЗНЕС-ПРАВИЛА:
- Ресторан: может добавлять опции (добавки) к блюдам
- Магазин: НЕ может добавлять опции, но может указывать упаковку
- Время приготовления только для ресторанов
- Валидация штрих-кодов только для магазинов
*/

export default router;