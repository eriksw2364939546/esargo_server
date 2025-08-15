// models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
	menu_item_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'MenuItem',
		required: true
	},
	name: {
		type: String,
		required: true
	},
	price: {
		type: Number,
		required: true
	},
	quantity: {
		type: Number,
		required: true,
		min: 1
	},
	total_price: {
		type: Number,
		required: true
	},
	notes: {
		type: String
	}
});

const restaurantOrderSchema = new mongoose.Schema({
	restaurant_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Restaurant',
		required: true
	},
	restaurant_order_number: {
		type: String,
		required: true
	},
	items: [orderItemSchema],
	subtotal: {
		type: Number,
		required: true
	},
	status: {
		type: String,
		enum: ['новый', 'принят', 'готовится', 'готов', 'в доставке', 'выполнен', 'отменен'],
		default: 'новый'
	},
	estimated_prep_time: {
		type: Number, // в минутах
		default: 30
	},
	notes_from_restaurant: {
		type: String
	}
});

const orderSchema = new mongoose.Schema({
	order_number: {
		type: String,
		required: true,
		unique: true
	},
	user_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	session_id: {
		type: String,
		required: true
	},
	restaurants: [restaurantOrderSchema],
	customer_info: {
		name: { type: String, required: true },
		phone: { type: String, required: true },
		email: { type: String }
	},
	delivery_address: {
		street: { type: String, required: true },
		city: { type: String, required: true },
		postal_code: { type: String, required: true },
		apartment: String,
		floor: String,
		entrance: String,
		intercom: String
	},
	delivery_info: {
		zone_number: { type: Number, required: true },
		zone_name: { type: String, required: true },
		base_zone_fee: { type: Number, required: true },
		additional_restaurants_fee: { type: Number, required: true },
		total_delivery_fee: { type: Number, required: true },
		estimated_delivery_time: Date
	},
	delivery_time_preference: {
		type: String, // "ASAP" или конкретное время "19:30"
		default: "ASAP"
	},
	payment_method: {
		type: String,
		enum: ['наличные', 'карта', 'онлайн'],
		required: true
	},
	payment_status: {
		type: String,
		enum: ['ожидание', 'оплачен', 'отклонен'],
		default: 'ожидание'
	},
	totals: {
		items_total: { type: Number, required: true },
		delivery_fee: { type: Number, required: true },
		grand_total: { type: Number, required: true }
	},
	overall_status: {
		type: String,
		enum: ['новый', 'обрабатывается', 'готовится', 'в доставке', 'выполнен', 'отменен'],
		default: 'новый'
	},
	notes: {
		type: String
	},
	tracking_updates: [{
		status: String,
		message: String,
		timestamp: { type: Date, default: Date.now },
		restaurant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }
	}]
}, {
	timestamps: true
});

// Индекс для поиска заказов по номеру
orderSchema.index({ order_number: 1 });

// Индекс для поиска заказов по телефону (для гостевого трекинга)
orderSchema.index({ 'customer_info.phone': 1, createdAt: -1 });

// Индекс для поиска заказов ресторана
orderSchema.index({ 'restaurants.restaurant_id': 1, 'restaurants.status': 1, createdAt: -1 });

// Статический метод для генерации номера заказа
orderSchema.statics.generateOrderNumber = async function () {
	const date = new Date();
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	const prefix = `ORD-${year}${month}${day}`;

	// Находим последний заказ за сегодня
	const lastOrder = await this.findOne({
		order_number: { $regex: `^${prefix}` }
	}).sort({ order_number: -1 });

	let sequence = 1;
	if (lastOrder) {
		const lastSequence = parseInt(lastOrder.order_number.slice(-4));
		sequence = lastSequence + 1;
	}

	return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

// Статический метод для генерации номера заказа ресторана
orderSchema.statics.generateRestaurantOrderNumber = function (restaurantIndex) {
	const timestamp = Date.now().toString(36).toUpperCase();
	return `REST-${restaurantIndex + 1}-${timestamp}`;
};

// Метод для обновления общего статуса заказа
orderSchema.methods.updateOverallStatus = function () {
	const restaurantStatuses = this.restaurants.map(r => r.status);

	if (restaurantStatuses.every(status => status === 'выполнен')) {
		this.overall_status = 'выполнен';
	} else if (restaurantStatuses.some(status => status === 'отменен')) {
		this.overall_status = 'отменен';
	} else if (restaurantStatuses.some(status => ['в доставке', 'готов'].includes(status))) {
		this.overall_status = 'в доставке';
	} else if (restaurantStatuses.some(status => status === 'готовится')) {
		this.overall_status = 'готовится';
	} else if (restaurantStatuses.some(status => status === 'принят')) {
		this.overall_status = 'обрабатывается';
	}

	return this.overall_status;
};

// Метод для добавления обновления трекинга
orderSchema.methods.addTrackingUpdate = function (status, message, restaurantId = null) {
	this.tracking_updates.push({
		status,
		message,
		restaurant_id: restaurantId,
		timestamp: new Date()
	});
};

module.exports = mongoose.model('Order', orderSchema);