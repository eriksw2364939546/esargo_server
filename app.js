// app.js (исправленный - ES6 modules)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import config from './config/app.js';
import connectDB from './config/database.js';
import { requestLogger, startupLogger } from './middleware/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import initOwnerAccount from './services/initOwner.service.js';
import { initTestPartner } from './services/partner.auth.service.js';

const app = express();


connectDB().then(() => {
  initOwnerAccount(); 
  initTestPartner();
});

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

app.use(
  cors({
    origin: function (origin, callback) {
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
    version: process.env.npm_package_version || '2.0.0',
    environment: config.NODE_ENV,
  });
});

// Используем роуты
app.use(config.API_PREFIX, routes);

// Главная страница
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ESARGO API Server - Агрегатор Армянских Ресторанов',
    version: '2.0.0',
    environment: config.NODE_ENV,
    architecture: 'Service Layer + Meta Security Model',
    endpoints: {
      health: '/health',
      api_base: config.API_PREFIX,
      customers: config.API_PREFIX + '/customers',
      partners: config.API_PREFIX + '/partners',
      admin: config.API_PREFIX + '/admin'
    },
    timestamp: new Date().toISOString()
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  startupLogger(`🚀 Server running on port ${PORT}`);
  startupLogger(`📱 Environment: ${config.NODE_ENV}`);
  startupLogger(`🔗 API Base: ${config.API_PREFIX}`);
});

export default app;