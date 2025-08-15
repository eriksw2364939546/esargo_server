// middleware/logger.js

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

// Функция для получения User Agent
const getUserAgent = (req) => {
	return req.headers['user-agent'] || 'unknown';
};

// Функция для получения Referer
const getReferer = (req) => {
	return req.headers['referer'] || req.headers['referrer'] || 'direct';
};

// Функция для форматирования размера ответа
const formatBytes = (bytes) => {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Функция для получения цвета статуса
const getStatusColor = (status) => {
	if (status >= 200 && status < 300) return '\x1b[32m'; // Зеленый
	if (status >= 300 && status < 400) return '\x1b[33m'; // Желтый
	if (status >= 400 && status < 500) return '\x1b[31m'; // Красный
	if (status >= 500) return '\x1b[35m'; // Пурпурный
	return '\x1b[0m'; // Сброс цвета
};

// Основной logger middleware
const requestLogger = (req, res, next) => {
	const start = Date.now();
	const startTime = new Date().toISOString();

	// Получаем информацию о запросе
	const clientIP = getClientIP(req);
	const userAgent = getUserAgent(req);
	const referer = getReferer(req);
	const method = req.method;
	const url = req.originalUrl || req.url;
	const protocol = req.protocol;
	const host = req.get('host');
	const fullUrl = `${protocol}://${host}${url}`;

	// Логируем входящий запрос
	console.log('\n' + '='.repeat(80));
	console.log(`📥 ВХОДЯЩИЙ ЗАПРОС [${startTime}]`);
	console.log('='.repeat(80));
	console.log(`🔗 ${method} ${fullUrl}`);
	console.log(`🌐 IP: ${clientIP}`);
	console.log(`📱 User-Agent: ${userAgent}`);
	console.log(`🔗 Referer: ${referer}`);

	// Логируем параметры запроса если есть
	if (Object.keys(req.query).length > 0) {
		console.log(`❓ Query Params:`, req.query);
	}

	if (Object.keys(req.params).length > 0) {
		console.log(`📋 Route Params:`, req.params);
	}

	// Логируем тело запроса для POST/PUT/PATCH (но не пароли)
	if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
		const bodyCopy = { ...req.body };
		// Скрываем пароли и токены
		if (bodyCopy.password) bodyCopy.password = '***';
		if (bodyCopy.token) bodyCopy.token = '***';
		if (bodyCopy.access_token) bodyCopy.access_token = '***';
		console.log(`📦 Request Body:`, bodyCopy);
	}

	// Логируем важные заголовки
	const importantHeaders = {
		'content-type': req.headers['content-type'],
		'authorization': req.headers['authorization'] ? '***' : undefined,
		'accept': req.headers['accept'],
		'accept-language': req.headers['accept-language']
	};

	const filteredHeaders = Object.fromEntries(
		Object.entries(importantHeaders).filter(([_, value]) => value !== undefined)
	);

	if (Object.keys(filteredHeaders).length > 0) {
		console.log(`📋 Headers:`, filteredHeaders);
	}

	// Перехватываем ответ
	const originalSend = res.send;
	let responseBody;

	res.send = function (body) {
		responseBody = body;
		return originalSend.call(this, body);
	};

	// Логируем ответ когда запрос завершается
	res.on('finish', () => {
		const duration = Date.now() - start;
		const endTime = new Date().toISOString();
		const status = res.statusCode;
		const statusColor = getStatusColor(status);
		const contentLength = res.get('content-length');
		const responseSize = contentLength ? formatBytes(parseInt(contentLength)) : 'unknown';

		console.log('\n' + '-'.repeat(80));
		console.log(`📤 ИСХОДЯЩИЙ ОТВЕТ [${endTime}]`);
		console.log('-'.repeat(80));
		console.log(`${statusColor}📊 Status: ${status}\x1b[0m`);
		console.log(`⏱️  Duration: ${duration}ms`);
		console.log(`📏 Size: ${responseSize}`);

		// Логируем ответ только для ошибок или если включен debug режим
		if (status >= 400 || process.env.LOG_RESPONSE_BODY === 'true') {
			try {
				const parsedResponse = typeof responseBody === 'string'
					? JSON.parse(responseBody)
					: responseBody;

				// Ограничиваем размер логируемого ответа
				const responseToLog = JSON.stringify(parsedResponse).length > 1000
					? JSON.stringify(parsedResponse).substring(0, 1000) + '...[truncated]'
					: parsedResponse;

				console.log(`📦 Response:`, responseToLog);
			} catch (e) {
				console.log(`📦 Response: [не удалось распарсить JSON]`);
			}
		}

		// Цветовая индикация производительности
		let performanceIcon = '🟢';
		if (duration > 1000) performanceIcon = '🔴';
		else if (duration > 500) performanceIcon = '🟡';

		console.log(`${performanceIcon} Performance: ${duration}ms`);
		console.log('='.repeat(80) + '\n');
	});

	// Логируем ошибки
	res.on('error', (error) => {
		console.log('\n' + '❌'.repeat(40));
		console.log(`🚨 ОШИБКА ОТВЕТА [${new Date().toISOString()}]`);
		console.log('❌'.repeat(40));
		console.log(`🔗 ${method} ${fullUrl}`);
		console.log(`🌐 IP: ${clientIP}`);
		console.log(`💥 Error:`, error.message);
		console.log('❌'.repeat(40) + '\n');
	});

	next();
};

// Middleware для логирования ошибок приложения
const errorLogger = (err, req, res, next) => {
	const timestamp = new Date().toISOString();
	const clientIP = getClientIP(req);
	const userAgent = getUserAgent(req);
	const method = req.method;
	const url = req.originalUrl || req.url;

	console.log('\n' + '🚨'.repeat(40));
	console.log(`💥 APPLICATION ERROR [${timestamp}]`);
	console.log('🚨'.repeat(40));
	console.log(`🔗 ${method} ${url}`);
	console.log(`🌐 IP: ${clientIP}`);
	console.log(`📱 User-Agent: ${userAgent}`);
	console.log(`❌ Error Name: ${err.name}`);
	console.log(`💬 Error Message: ${err.message}`);
	console.log(`📊 Status Code: ${err.statusCode || 500}`);

	if (process.env.NODE_ENV === 'development') {
		console.log(`📚 Stack Trace:`);
		console.log(err.stack);
	}

	console.log('🚨'.repeat(40) + '\n');

	next(err);
};

// Middleware для логирования запуска сервера
const startupLogger = (port, env) => {
	console.log('\n' + '🚀'.repeat(50));
	console.log('🎉 СЕРВЕР ЗАПУЩЕН УСПЕШНО!');
	console.log('🚀'.repeat(50));
	console.log(`🌐 Порт: ${port}`);
	console.log(`⚙️  Окружение: ${env}`);
	console.log(`🕐 Время запуска: ${new Date().toISOString()}`);
	console.log(`🔗 Local URL: http://localhost:${port}`);
	console.log(`📋 Health Check: http://localhost:${port}/api/health`);
	console.log(`📚 API Docs: http://localhost:${port}/api/restaurants`);
	console.log('🚀'.repeat(50) + '\n');
};

module.exports = {
	requestLogger,
	errorLogger,
	startupLogger
};