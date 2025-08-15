// middleware/errorHandler.js
const { errorLogger } = require('./logger');

// Функция для получения IP адреса клиента
const getClientIP = (req) => {
	return req.headers['x-forwarded-for'] ||
		req.headers['x-real-ip'] ||
		req.connection?.remoteAddress ||
		req.socket?.remoteAddress ||
		(req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
		req.ip ||
		'unknown';
};

// Middleware для обработки ошибок валидации MongoDB
const handleValidationError = (error) => {
	const errors = {};

	if (error.errors) {
		Object.keys(error.errors).forEach(key => {
			errors[key] = error.errors[key].message;
		});
	}

	return {
		success: false,
		message: 'Ошибка валидации данных',
		errors
	};
};

// Middleware для обработки ошибок дублирования
const handleDuplicateError = (error) => {
	const field = Object.keys(error.keyValue)[0];
	const value = error.keyValue[field];

	return {
		success: false,
		message: `${field} '${value}' уже существует`,
		field,
		value
	};
};

// Middleware для обработки ошибок ObjectId
const handleCastError = (error) => {
	return {
		success: false,
		message: 'Некорректный формат ID',
		path: error.path,
		value: error.value
	};
};

// Основной обработчик ошибок
const errorHandler = (err, req, res, next) => {
	// Используем errorLogger для детального логирования
	errorLogger(err, req, res, () => { });

	let error = { ...err };
	error.message = err.message;

	// Mongoose validation error
	if (err.name === 'ValidationError') {
		const response = handleValidationError(err);
		return res.status(400).json(response);
	}

	// Mongoose duplicate key error
	if (err.code === 11000) {
		const response = handleDuplicateError(err);
		return res.status(400).json(response);
	}

	// Mongoose bad ObjectId
	if (err.name === 'CastError') {
		const response = handleCastError(err);
		return res.status(400).json(response);
	}

	// JWT errors
	if (err.name === 'JsonWebTokenError') {
		return res.status(401).json({
			success: false,
			message: 'Недействительный токен'
		});
	}

	if (err.name === 'TokenExpiredError') {
		return res.status(401).json({
			success: false,
			message: 'Токен истек'
		});
	}

	// Rate limiting errors
	if (err.message && err.message.includes('Too many requests')) {
		return res.status(429).json({
			success: false,
			message: 'Слишком много запросов, попробуйте позже'
		});
	}

	// Multer file upload errors
	if (err.code === 'LIMIT_FILE_SIZE') {
		return res.status(400).json({
			success: false,
			message: 'Файл слишком большой'
		});
	}

	if (err.code === 'LIMIT_UNEXPECTED_FILE') {
		return res.status(400).json({
			success: false,
			message: 'Неожиданный тип файла'
		});
	}

	// MongoDB connection errors
	if (err.name === 'MongooseError' || err.name === 'MongoError') {
		console.error('🔴 Database connection error:', err.message);
		return res.status(503).json({
			success: false,
			message: 'Ошибка подключения к базе данных'
		});
	}

	// Network errors
	if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
		return res.status(503).json({
			success: false,
			message: 'Сервис временно недоступен'
		});
	}

	// Default error response
	const statusCode = err.statusCode || err.status || 500;
	const response = {
		success: false,
		message: err.message || 'Внутренняя ошибка сервера',
		error_code: err.code || 'INTERNAL_ERROR',
		timestamp: new Date().toISOString(),
		path: req.originalUrl,
		method: req.method,
		ip: getClientIP(req)
	};

	// Добавляем stack trace только в development
	if (process.env.NODE_ENV === 'development') {
		response.stack = err.stack;
		response.details = {
			name: err.name,
			statusCode: err.statusCode,
			isOperational: err.isOperational || false
		};
	}

	res.status(statusCode).json(response);
};

// Middleware для обработки несуществующих маршрутов
const notFound = (req, res, next) => {
	const timestamp = new Date().toISOString();
	const clientIP = getClientIP(req);
	const method = req.method;
	const url = req.originalUrl;

	// Логируем 404 ошибки
	console.log('\n' + '⚠️'.repeat(40));
	console.log(`🔍 404 NOT FOUND [${timestamp}]`);
	console.log('⚠️'.repeat(40));
	console.log(`🔗 ${method} ${url}`);
	console.log(`🌐 IP: ${clientIP}`);
	console.log(`📱 User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
	console.log(`🔗 Referer: ${req.headers['referer'] || 'direct'}`);
	console.log('⚠️'.repeat(40) + '\n');

	const error = new Error(`Маршрут ${url} не найден`);
	error.statusCode = 404;
	error.code = 'ROUTE_NOT_FOUND';
	next(error);
};

// Middleware для обработки async ошибок
const asyncHandler = (fn) => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware для создания кастомных ошибок
class AppError extends Error {
	constructor(message, statusCode, code = 'APP_ERROR', isOperational = true) {
		super(message);
		this.statusCode = statusCode;
		this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
		this.code = code;
		this.isOperational = isOperational;

		Error.captureStackTrace(this, this.constructor);
	}
}

// Функция для создания стандартных ошибок
const createError = {
	badRequest: (message = 'Неверный запрос', code = 'BAD_REQUEST') =>
		new AppError(message, 400, code),

	unauthorized: (message = 'Неавторизован', code = 'UNAUTHORIZED') =>
		new AppError(message, 401, code),

	forbidden: (message = 'Доступ запрещен', code = 'FORBIDDEN') =>
		new AppError(message, 403, code),

	notFound: (message = 'Не найдено', code = 'NOT_FOUND') =>
		new AppError(message, 404, code),

	conflict: (message = 'Конфликт данных', code = 'CONFLICT') =>
		new AppError(message, 409, code),

	validationError: (message = 'Ошибка валидации', code = 'VALIDATION_ERROR') =>
		new AppError(message, 422, code),

	tooManyRequests: (message = 'Слишком много запросов', code = 'TOO_MANY_REQUESTS') =>
		new AppError(message, 429, code),

	internal: (message = 'Внутренняя ошибка сервера', code = 'INTERNAL_ERROR') =>
		new AppError(message, 500, code),

	serviceUnavailable: (message = 'Сервис недоступен', code = 'SERVICE_UNAVAILABLE') =>
		new AppError(message, 503, code)
};

module.exports = {
	errorHandler,
	notFound,
	asyncHandler,
	AppError,
	createError
};