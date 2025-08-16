// config/database.js (исправленный - ES6 modules)
import mongoose from 'mongoose';
import config from './app.js';

const connectDB = async () => {
  try {
    const options = {
      // Убираем deprecated опции
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      
      // Современные опции
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering
    };

    const conn = await mongoose.connect(config.MONGODB_URI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Обработка событий подключения
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
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

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('🔧 Check your MONGODB_URI in .env file');
    process.exit(1);
  }
};

export default connectDB;