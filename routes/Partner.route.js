// routes/partner.js
const express = require('express');
const router = express.Router();
const { 
	createPartnerRequest, 
	getPartnerRequests, 
	getPartnerRequestById, 
	updatePartnerRequestStatus, 
	deletePartnerRequestById 
} = require('../controllers/PartnerController');

// Временный middleware для аутентификации (замените на ваш)
const authenticateUser = (req, res, next) => {
	const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
	
	if (!token) {
		return res.status(401).json({
			result: false,
			message: "Authorization token required"
		});
	}
	
	// Здесь должна быть проверка JWT токена
	// Пока что создаем фейкового пользователя для тестирования
	req.user = {
		_id: "507f1f77bcf86cd799439011", // Тестовый ObjectId
		email: "test@example.com",
		role: "customer"
	};
	
	next();
};

// Middleware для админов (для обновления статуса заявок)
const authenticateAdmin = (req, res, next) => {
	const token = req.headers.authorization?.split(' ')[1];
	
	if (!token) {
		return res.status(401).json({
			result: false,
			message: "Admin authorization required"
		});
	}
	
	// Фейковый админ для тестирования
	req.admin = {
		_id: "507f1f77bcf86cd799439012",
		email: "admin@example.com",
		role: "admin",
		full_name: "Test Admin"
	};
	
	next();
};

// Validation middleware для создания партнера
const validatePartnerCreation = (req, res, next) => {
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
		legal_phone,
		location
	} = req.body;

	// Проверка обязательных бизнес-полей
	if (!business_name || !category || !address || !phone || !owner_name || !owner_surname) {
		return res.status(400).json({
			result: false,
			message: "Missing business fields: business_name, category, address, phone, owner_name, owner_surname are required"
		});
	}

	// Проверка обязательных юридических полей
	if (!legal_name || !siret_number || !legal_form || !legal_address || !director_name || !iban || !bic || !legal_email || !legal_phone) {
		return res.status(400).json({
			result: false,
			message: "Missing legal fields: all legal data is required"
		});
	}

	// Проверка location (координаты)
	if (!location || !location.lat || !location.lng) {
		return res.status(400).json({
			result: false,
			message: "Location coordinates (lat, lng) are required"
		});
	}

	// Проверка категории
	if (!['restaurant', 'store'].includes(category)) {
		return res.status(400).json({
			result: false,
			message: "Category must be 'restaurant' or 'store'"
		});
	}

	// Проверка формата SIRET
	if (!/^\d{14}$/.test(siret_number)) {
		return res.status(400).json({
			result: false,
			message: "SIRET number must contain exactly 14 digits"
		});
	}

	// Проверка формата IBAN (французский)
	const ibanCleaned = iban.replace(/\s/g, '');
	if (!/^FR\d{12}[A-Z0-9]{11}\d{2}$/.test(ibanCleaned)) {
		return res.status(400).json({
			result: false,
			message: "Invalid French IBAN format"
		});
	}

	// Проверка формата BIC
	if (!/^[A-Z]{4}FR[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) {
		return res.status(400).json({
			result: false,
			message: "Invalid BIC code format"
		});
	}

	// Проверка email
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legal_email)) {
		return res.status(400).json({
			result: false,
			message: "Invalid email format"
		});
	}

	// Проверка координат
	const lat = parseFloat(location.lat);
	const lng = parseFloat(location.lng);
	
	if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		return res.status(400).json({
			result: false,
			message: "Invalid coordinates: lat must be between -90 and 90, lng between -180 and 180"
		});
	}

	next();
};

// Validation middleware для ObjectId
const validateObjectId = (req, res, next) => {
	const { id } = req.params;

	if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		return res.status(400).json({
			result: false,
			message: "Invalid ID format"
		});
	}

	next();
};

// ==================== РОУТЫ ====================

// POST /api/partners - создать заявку на регистрацию партнера
// Требует авторизации пользователя
router.post('/', authenticateUser, validatePartnerCreation, createPartnerRequest);

// GET /api/partners - получить список заявок партнеров (только для админов)
// Query params: status, category, page, limit
router.get('/', authenticateAdmin, getPartnerRequests);

// GET /api/partners/:id - получить конкретную заявку партнера
router.get('/:id', authenticateAdmin, validateObjectId, getPartnerRequestById);

// PUT /api/partners/:id/status - обновить статус заявки (только админы)
// Body: { status: 'approved' | 'rejected', rejection_reason?, admin_notes? }
router.put('/:id/status', authenticateAdmin, validateObjectId, updatePartnerRequestStatus);

// DELETE /api/partners/:id - удалить заявку партнера
router.delete('/:id', authenticateAdmin, validateObjectId, deletePartnerRequestById);

module.exports = router;