// config/database.js (исправленный - ES6 modules)
import mongoose from 'mongoose';
import config from './app.js';

const connectDB = async () => {
  try {
    // 🆕 ИСПРАВЛЕНО: Убираем устаревшие параметры, используем только современные
    const options = {
      // Управление пулом соединений
      maxPoolSize: 10, // Максимальное количество соединений в пуле
      minPoolSize: 5,  // Минимальное количество соединений в пуле
      
      // Таймауты
      serverSelectionTimeoutMS: 5000, // Время ожидания выбора сервера
      socketTimeoutMS: 45000,         // Время ожидания ответа от сокета
      connectTimeoutMS: 10000,        // Время ожидания подключения
      
      // Управление буферизацией - СОВРЕМЕННЫЙ СПОСОБ
      bufferCommands: false,          // Отключаем буферизацию команд mongoose
      // bufferMaxEntries: 0,         // 🚫 УБРАНО: устаревший параметр
      
      // Heartbeat и мониторинг
      heartbeatFrequencyMS: 10000,    // Частота проверки соединения
      
      // Retry логика
      retryWrites: true,              // Автоматические повторы записи
      
      // Настройки для продакшена
      maxIdleTimeMS: 30000,           // Время до закрытия неактивного соединения
      
      // Компрессия (опционально)
      compressors: ['zlib'],          // Сжатие данных
    };

    console.log('🔌 Connecting to MongoDB...');
    console.log(`📍 URI: ${config.MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`); // Скрываем пароль в логах

    const conn = await mongoose.connect(config.MONGODB_URI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔧 Mongoose version: ${mongoose.version}`);

    // Обработка событий подключения
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    mongoose.connection.on('connecting', () => {
      console.log('🔌 MongoDB connecting...');
    });

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('👋 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during MongoDB disconnect:', error);
        process.exit(1);
      }
    });

    process.on('SIGTERM', async () => {
      try {
        await mongoose.connection.close();
        console.log('👋 MongoDB connection closed through SIGTERM');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during MongoDB disconnect:', error);
        process.exit(1);
      }
    });

    return conn;

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // Дополнительная информация для отладки
    if (error.name === 'MongooseServerSelectionError') {
      console.error('🔧 Возможные причины:');
      console.error('   - MongoDB сервер не запущен');
      console.error('   - Неправильный MONGODB_URI');
      console.error('   - Проблемы с сетью');
      console.error('   - Неправильные учетные данные');
    }
    
    console.error('🔧 Проверьте MONGODB_URI в .env файле');
    console.error('🔧 Убедитесь что MongoDB запущен и доступен');
    
    // В разработке не завершаем процесс, чтобы можно было перезапустить
    if (config.isDevelopment()) {
      console.error('⚠️ Development mode: не завершаем процесс');
      return null;
    }
    
    process.exit(1);
  }
};

// Функция для проверки состояния подключения
export const getConnectionStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    state: states[state] || 'unknown',
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    port: mongoose.connection.port
  };
};

// Функция для повторного подключения
export const reconnect = async () => {
  try {
    await mongoose.disconnect();
    await connectDB();
    console.log('🔄 MongoDB reconnected successfully');
  } catch (error) {
    console.error('❌ Reconnection failed:', error.message);
    throw error;
  }
};

export default connectDB;