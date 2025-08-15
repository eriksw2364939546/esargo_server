// routes/restaurants.js
const express = require('express');
const router = express.Router();
const {
	getAllRestaurants,
	getRestaurantById,
	getRestaurantByIdName,
	searchRestaurants,
	getRestaurantsByPostalCode
} = require('../controllers/restaurantController');

// Validation middleware
const validateObjectId = (req, res, next) => {
	const { id } = req.params;

	if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный ID ресторана'
		});
	}

	next();
};

// GET /api/restaurants - получить список всех ресторанов с фильтрацией
// Query params: page, limit, cuisine_type, postal_code, min_rating, sort_by
router.get('/', getAllRestaurants);

// GET /api/restaurants/search - поиск ресторанов по названию/кухне
// Query params: q (required), page, limit, postal_code, cuisine_type
router.get('/search', searchRestaurants);

// GET /api/restaurants/by-postal-code/:code - рестораны по почтовому индексу
// Query params: page, limit, cuisine_type, sort_by
router.get('/by-postal-code/:code', getRestaurantsByPostalCode);

// GET /api/restaurants/by-name/:id_name - получить ресторан по id_name
// Query params: include_menu (default: true)
router.get('/by-name/:id_name', getRestaurantByIdName);

// GET /api/restaurants/:id - получить конкретный ресторан с меню
// Query params: include_menu (default: true)
router.get('/:id', validateObjectId, getRestaurantById);

module.exports = router;