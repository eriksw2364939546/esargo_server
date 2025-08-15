// routes/restaurants.js
const express = require('express');
const router = express.Router();
const {
	getAllRestaurants,
	getRestaurantById,
	getRestaurantByIdName,
	searchRestaurants,
	getRestaurantsByPostalCode,
	createRestaurantRequest  // Новая функция
} = require('../controllers/restaurantController');

// Validation middleware для ObjectId
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

// Validation middleware для создания ресторана
const validateRestaurantCreation = (req, res, next) => {
	const {
		business_name,
		category,
		address,
		phone,
		owner_name,
		owner_surname,
		legal_name,
		siret_number,
		legal_form,
		legal_address,
		director_name,
		iban,
		bic,
		legal_email,
		legal_phone
	} = req.body;

	// Проверка обязательных бизнес-полей
	if (!business_name || !category || !address || !phone || !owner_name || !owner_surname) {
		return res.status(400).json({
			success: false,
			message: 'Поля business_name, category, address, phone, owner_name, owner_surname обязательны'
		});
	}

	// Проверка обязательных юридических полей
	if (!legal_name || !siret_number || !legal_form || !legal_address || !director_name || !iban || !bic || !legal_email || !legal_phone) {
		return res.status(400).json({
			success: false,
			message: 'Все юридические поля обязательны для заполнения'
		});
	}

	// Проверка категории
	if (!['restaurant', 'store'].includes(category)) {
		return res.status(400).json({
			success: false,
			message: 'Категория должна быть restaurant или store'
		});
	}

	// Проверка формата SIRET
	if (!/^\d{14}$/.test(siret_number)) {
		return res.status(400).json({
			success: false,
			message: 'SIRET номер должен содержать 14 цифр'
		});
	}

	// Проверка формата IBAN
	if (!/^FR\d{12}\w{11}\d{2}$/.test(iban.replace(/\s/g, ''))) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный формат французского IBAN'
		});
	}

	// Проверка формата BIC
	if (!/^[A-Z]{4}FR[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный формат BIC кода'
		});
	}

	// Проверка email
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legal_email)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный формат email'
		});
	}

	next();
};

// POST /api/restaurants - создать заявку на регистрацию ресторана/магазина
// Body: { business_name, category, description, address, location, phone, owner_name, owner_surname, working_hours, legal_name, siret_number, legal_form, tva_number, legal_address, director_name, iban, bic, legal_email, legal_phone }
router.post('/', validateRestaurantCreation, createRestaurantRequest);

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