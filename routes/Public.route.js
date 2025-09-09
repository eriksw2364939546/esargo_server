// routes/Public.route.js - ИСПРАВЛЕННЫЙ с добавлением роута /restaurants
import express from 'express';
import {
  getCatalog,
  getRestaurantById,
  getRestaurantMenu,
  searchRestaurants,
  getCategories,
  getPopularRestaurants,
  getRestaurantsByCategory
} from '../controllers/PublicController.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЙ КАТАЛОГ (без авторизации) ================

/**
 * GET /api/public/catalog - Получить список всех активных ресторанов
 * Query params:
 * - lat, lng - координаты для расчета расстояния
 * - category - фильтр по категории
 * - limit, offset - пагинация
 * - sort - сортировка (rating, distance, delivery_time)
 */
router.get('/catalog', getCatalog);

/**
 * ✅ ДОБАВЛЕНО: GET /api/public/restaurants - Алиас для /catalog
 * Для совместимости с ожиданиями фронтенда
 */
router.get('/restaurants', getCatalog);

/**
 * GET /api/public/restaurants/popular - Популярные рестораны
 */
router.get('/restaurants/popular', getPopularRestaurants);

/**
 * GET /api/public/restaurants/categories - Список категорий ресторанов
 */
router.get('/restaurants/categories', getCategories);

/**
 * GET /api/public/restaurants/category/:category - Рестораны по категории
 */
router.get('/restaurants/category/:category', getRestaurantsByCategory);

/**
 * GET /api/public/restaurants/search - Поиск ресторанов
 * Query params:
 * - q - поисковый запрос
 * - lat, lng - координаты
 * - category - категория
 */
router.get('/restaurants/search', searchRestaurants);

/**
 * GET /api/public/restaurants/:id - Детали ресторана
 */
router.get('/restaurants/:id', getRestaurantById);

/**
 * GET /api/public/restaurants/:id/menu - Меню ресторана со всеми продуктами
 */
router.get('/restaurants/:id/menu', getRestaurantMenu);

// ================ ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ================

/**
 * GET /api/public/health - Проверка работоспособности
 */
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Public catalog API working",
    available_endpoints: {
      catalog: "GET /api/public/catalog",
      restaurants: "GET /api/public/restaurants", // ✅ ДОБАВЛЕНО
      restaurant_details: "GET /api/public/restaurants/:id",
      restaurant_menu: "GET /api/public/restaurants/:id/menu",
      search: "GET /api/public/restaurants/search",
      categories: "GET /api/public/restaurants/categories",
      popular: "GET /api/public/restaurants/popular"
    },
    features: [
      "Restaurant catalog without authentication",
      "Menu browsing",
      "Search and filtering",
      "Distance calculation",
      "Category filtering"
    ],
    timestamp: new Date().toISOString()
  });
});

export default router;