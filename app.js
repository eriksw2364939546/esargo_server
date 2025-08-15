require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('./config/app');
const connectDB = require('./config/database');

const { requestLogger, startupLogger } = require('./middleware/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const routes = require('./routes');

const app = express();

connectDB();

app.set('trust proxy', 1);

if (config.HELMET_ENABLED) {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
}

const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Слишком много запросов с этого IP, попробуйте позже',
    retry_after: Math.ceil(config.RATE_LIMIT_WINDOW / 1000 / 60) + ' минут',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Правильная CORS настройка с обработкой ошибки
app.use(
  cors({
    origin: function (origin, callback) {
      // Разрешаем запросы без origin (например Postman)
      if (!origin) return callback(null, true);

      if (config.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(
          new Error(`CORS policy: Origin ${origin} not allowed`)
        );
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(compression());

app.use(
  express.json({
    limit: config.REQUEST_LIMIT,
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: config.REQUEST_LIMIT,
  })
);

app.use(mongoSanitize());

app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Сервер работает нормально',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
  });
});

app.use(config.API_PREFIX, routes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Агрегатора Армянских Ресторанов',
    version: '1.0.0',
    environment: config.NODE_ENV,
    endpoints: {
      health: '/health',
      api: config.API_PREFIX,
      restaurants: `${config.API_PREFIX}/restaurants`,
      menu: `${config.API_PREFIX}/menu`,
      examples: {
        restaurant_list: `${config.API_PREFIX}/api/restaurants`,
        restaurant_detail: `${config.API_PREFIX}/restaurants/:id`,
        restaurant_menu: `${config.API_PREFIX}/menu/restaurant/:id`,
        menu_search: `${config.API_PREFIX}/menu/search?q=хоровац`,
        menu_item: `${config.API_PREFIX}/menu/item/:id`,
        cart_add: `${config.API_PREFIX}/cart/add`,
        cart_get: `${config.API_PREFIX}/cart/:sessionId`,
        cart_delivery: `${config.API_PREFIX}/cart/calculate-delivery`,
        order_create: `${config.API_PREFIX}/orders`,
        order_track: `${config.API_PREFIX}/orders/track/:phone`,
        order_detail: `${config.API_PREFIX}/orders/:id`,
      },
      docs: 'Coming soon...',
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('*', notFound);

app.use(errorHandler);

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Получен сигнал ${signal}. Начинаем graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error('❌ Ошибка при закрытии сервера:', err);
      process.exit(1);
    }

    console.log('✅ HTTP сервер закрыт');

    require('mongoose').connection.close(() => {
      console.log('✅ MongoDB соединение закрыто');
      console.log('👋 Graceful shutdown завершен');
      process.exit(0);
    });
  });
};

const PORT = config.PORT;
const server = app.listen(PORT, () => {
  startupLogger(PORT, config.NODE_ENV);
});

process.on('unhandledRejection', (err, promise) => {
  console.log('💥 Unhandled Promise Rejection:', err.message);
  console.log('🛑 Закрываем сервер...');
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.log('💥 Uncaught Exception:', err.message);
  console.log('🛑 Закрываем сервер...');
  process.exit(1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
