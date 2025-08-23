// ================ controllers/PartnerMenuController.js (АРХИТЕКТУРНО ПРАВИЛЬНЫЙ) ================
import {
    getPartnerMenuCategories,
    addMenuCategoryService,
    updateMenuCategory,
    deleteMenuCategory,
    getPartnerProducts,
    addPartnerProduct,
    updatePartnerProduct,
    deletePartnerProduct,
    getPartnerMenuStats
} from '../services/Partner/partner.menu.service.js';

/**
 * ================== УПРАВЛЕНИЕ КАТЕГОРИЯМИ МЕНЮ ==================
 * ✅ ТОЛЬКО req/res - ВСЯ ЛОГИКА В СЕРВИСАХ
 */

/**
 * 📋 ПОЛУЧЕНИЕ ВСЕХ КАТЕГОРИЙ МЕНЮ ПАРТНЕРА
 * GET /api/partners/menu/categories
 */
export const getMenuCategories = async (req, res) => {
    try {
        const { user } = req;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await getPartnerMenuCategories(user._id);

        res.status(200).json({
            result: true,
            message: "Категории меню получены",
            categories: result.categories,
            total_categories: result.total_categories,
            business_info: result.business_info
        });

    } catch (error) {
        console.error('🚨 GET MENU CATEGORIES - Controller Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка получения категорий меню"
        });
    }
};

/**
 * ➕ ДОБАВЛЕНИЕ НОВОЙ КАТЕГОРИИ МЕНЮ
 * POST /api/partners/menu/categories
 */
export const addMenuCategory = async (req, res) => {
    try {
        const { user } = req;
        const categoryData = req.body;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await addMenuCategoryService(user._id, categoryData);

        res.status(201).json({
            result: true,
            message: "Категория меню добавлена",
            category: result.category,
            total_categories: result.total_categories
        });

    } catch (error) {
        console.error('🚨 ADD MENU CATEGORY - Controller Error:', error);
        res.status(error.message.includes('обязательно') || error.message.includes('превышать') ? 400 : 500).json({
            result: false,
            message: error.message || "Ошибка добавления категории"
        });
    }
};

/**
 * ✏️ РЕДАКТИРОВАНИЕ КАТЕГОРИИ МЕНЮ
 * PUT /api/partners/menu/categories/:category_id
 */
export const updateMenuCategoryController = async (req, res) => {
    try {
        const { user } = req;
        const { category_id } = req.params;
        const updateData = req.body;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await updateMenuCategory(user._id, category_id, updateData);

        res.status(200).json({
            result: true,
            message: "Категория обновлена",
            category: result.category
        });

    } catch (error) {
        console.error('🚨 UPDATE MENU CATEGORY - Controller Error:', error);
        res.status(error.message === 'Категория не найдена' ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка обновления категории"
        });
    }
};

/**
 * 🗑️ УДАЛЕНИЕ КАТЕГОРИИ МЕНЮ
 * DELETE /api/partners/menu/categories/:category_id
 */
export const deleteMenuCategoryController = async (req, res) => {
    try {
        const { user } = req;
        const { category_id } = req.params;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await deleteMenuCategory(user._id, category_id);

        res.status(200).json({
            result: true,
            message: "Категория удалена",
            remaining_categories: result.remaining_categories
        });

    } catch (error) {
        console.error('🚨 DELETE MENU CATEGORY - Controller Error:', error);
        
        const statusCode = error.message.includes('не найдена') ? 404 :
                          error.message.includes('товаров') ? 400 : 500;
        
        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка удаления категории"
        });
    }
};

/**
 * ================== УПРАВЛЕНИЕ ПРОДУКТАМИ/БЛЮДАМИ ==================
 * ✅ ТОЛЬКО req/res - ВСЯ ЛОГИКА В СЕРВИСАХ
 */

/**
 * 📋 ПОЛУЧЕНИЕ ВСЕХ ПРОДУКТОВ ПАРТНЕРА
 * GET /api/partners/menu/products
 */
export const getProducts = async (req, res) => {
    try {
        const { user } = req;
        const filters = {
            category_slug: req.query.category_slug,
            include_inactive: req.query.include_inactive
        };

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await getPartnerProducts(user._id, filters);

        res.status(200).json({
            result: true,
            message: "Продукты получены",
            products_by_category: result.products_by_category,
            total_products: result.total_products,
            business_info: result.business_info
        });

    } catch (error) {
        console.error('🚨 GET PRODUCTS - Controller Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка получения продуктов"
        });
    }
};

/**
 * ➕ ДОБАВЛЕНИЕ НОВОГО ПРОДУКТА/БЛЮДА
 * POST /api/partners/menu/products
 */
export const addProduct = async (req, res) => {
    try {
        const { user } = req;
        const productData = req.body;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ (включая логику добавок ресторан/магазин)
        const result = await addPartnerProduct(user._id, productData);

        res.status(201).json({
            result: true,
            message: "Продукт добавлен",
            product: result.product,
            category_info: result.category_info,
            business_rules: result.business_rules,
            warnings: result.warnings
        });

    } catch (error) {
        console.error('🚨 ADD PRODUCT - Controller Error:', error);
        
        const statusCode = error.message.includes('обязательны') || 
                          error.message.includes('больше нуля') ||
                          error.message.includes('не найдена') ||
                          error.message.includes('не могут добавлять') ? 400 : 500;
        
        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка добавления продукта"
        });
    }
};

/**
 * ✏️ РЕДАКТИРОВАНИЕ ПРОДУКТА
 * PUT /api/partners/menu/products/:product_id
 */
export const updateProduct = async (req, res) => {
    try {
        const { user } = req;
        const { product_id } = req.params;
        const updateData = req.body;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ (включая логику добавок ресторан/магазин)
        const result = await updatePartnerProduct(user._id, product_id, updateData);

        res.status(200).json({
            result: true,
            message: "Продукт обновлен",
            product: result.product,
            business_rules: result.business_rules,
            warnings: result.warnings
        });

    } catch (error) {
        console.error('🚨 UPDATE PRODUCT - Controller Error:', error);
        
        const statusCode = error.message.includes('не найден') ? 404 :
                          error.message.includes('больше нуля') ||
                          error.message.includes('не могут изменять') ? 400 : 500;
        
        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка обновления продукта"
        });
    }
};

/**
 * 🗑️ УДАЛЕНИЕ ПРОДУКТА
 * DELETE /api/partners/menu/products/:product_id
 */
export const deleteProduct = async (req, res) => {
    try {
        const { user } = req;
        const { product_id } = req.params;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await deletePartnerProduct(user._id, product_id);

        res.status(200).json({
            result: true,
            message: "Продукт удален",
            deleted_product: result.deleted_product,
            remaining_products: result.remaining_products
        });

    } catch (error) {
        console.error('🚨 DELETE PRODUCT - Controller Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка удаления продукта"
        });
    }
};

/**
 * ================== СТАТИСТИКА МЕНЮ ==================
 * ✅ ТОЛЬКО req/res - ВСЯ ЛОГИКА В СЕРВИСАХ
 */

/**
 * 📊 ПОЛУЧЕНИЕ СТАТИСТИКИ МЕНЮ
 * GET /api/partners/menu/stats
 */
export const getMenuStats = async (req, res) => {
    try {
        const { user } = req;

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await getPartnerMenuStats(user._id);

        res.status(200).json({
            result: true,
            message: "Статистика меню получена",
            stats: result.stats,
            business_info: result.business_info
        });

    } catch (error) {
        console.error('🚨 GET MENU STATS - Controller Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка получения статистики"
        });
    }
};

/**
 * ================== ЭКСПОРТ ВСЕХ ФУНКЦИЙ ================
 */
export default {
    // Категории меню
    getMenuCategories,
    addMenuCategory,
    updateMenuCategory: updateMenuCategoryController,
    deleteMenuCategory: deleteMenuCategoryController,
    
    // Продукты
    getProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    
    // Статистика
    getMenuStats
};