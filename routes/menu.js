// routes/menu.js
const express = require('express');
const router = express.Router();
const {
	getRestaurantMenu,
	getRestaurantCategories,
	getMenuItemById,
	searchMenuItems
} = require('../controllers/menuController');

// Validation middleware для ObjectId
const validateObjectId = (req, res, next) => {
	const { id } = req.params;

	if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный ID'
		});
	}

	next();
};

// Validation middleware для поисковых запросов
const validateSearchQuery = (req, res, next) => {
	const { q } = req.query;

	if (q && q.trim().length < 2) {
		return res.status(400).json({
			success: false,
			message: 'Поисковый запрос должен содержать минимум 2 символа'
		});
	}

	next();
};

// GET /api/menu/search - поиск блюд по названию/ингредиентам
// Query params: q (required), restaurant_id, category, max_price, vegetarian_only, vegan_only, exclude_allergens, page, limit
router.get('/search', validateSearchQuery, searchMenuItems);

// GET /api/menu/item/:id - получить детали конкретного блюда
// Возвращает блюдо с информацией о ресторане и похожими блюдами
router.get('/item/:id', validateObjectId, getMenuItemById);

// GET /api/menu/restaurant/:id - получить полное меню ресторана
// Query params: include_unavailable, vegetarian_only, vegan_only, exclude_allergens
router.get('/restaurant/:id', validateObjectId, getRestaurantMenu);

// GET /api/menu/restaurant/:id/categories - получить только категории меню ресторана
// Возвращает категории с количеством блюд в каждой
router.get('/restaurant/:id/categories', validateObjectId, getRestaurantCategories);

module.exports = router;