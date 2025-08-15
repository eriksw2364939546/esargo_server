const mongoose = require('mongoose');

const connectDB = async () => {
	try {
		const conn = await mongoose.connect(process.env.MONGODB_URI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		console.log(`🎉 MongoDB подключен: ${conn.connection.host}`);

		// Обработка событий подключения
		mongoose.connection.on('error', (err) => {
			console.error('❌ MongoDB ошибка:', err);
		});

		// Graceful shutdown при завершении приложения
		process.on('SIGINT', async () => {
			await mongoose.connection.close();
			process.exit(0);
		});

	} catch (error) {
		console.error('💥 Ошибка подключения к MongoDB:', error.message);
		process.exit(1);
	}
};

module.exports = connectDB;