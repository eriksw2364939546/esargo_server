// models/CartSession.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
	menu_item_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'MenuItem',
		required: true
	},
	restaurant_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Restaurant',
		required: true
	},
	quantity: {
		type: Number,
		required: true,
		min: 1
	},
	price: {
		type: Number,
		required: true
	},
	total_price: {
		type: Number,
		required: true
	},
	notes: {
		type: String // Особые пожелания к блюду
	}
});

const restaurantCartSchema = new mongoose.Schema({
	restaurant_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Restaurant',
		required: true
	},
	items: [cartItemSchema],
	subtotal: {
		type: Number,
		required: true,
		default: 0
	}
});

const cartSessionSchema = new mongoose.Schema({
	user_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	session_id: {
		type: String,
		required: true,
		unique: true
	},
	restaurants: [restaurantCartSchema],
	delivery_postal_code: {
		type: String,
		uppercase: true
	},
	delivery_calculation: {
		zone_number: Number,
		zone_name: String,
		base_zone_fee: Number,
		additional_restaurants_count: Number,
		additional_restaurants_fee: Number,
		total_delivery_fee: Number
	},
	totals: {
		items_total: {
			type: Number,
			default: 0
		},
		delivery_fee: {
			type: Number,
			default: 0
		},
		grand_total: {
			type: Number,
			default: 0
		}
	},
	expires_at: {
		type: Date,
		default: Date.now,
		expires: 24 * 60 * 60 // 24 часа в секундах
	}
}, {
	timestamps: true
});

// Индекс для поиска корзины пользователя
cartSessionSchema.index({ user_id: 1 });

// Индекс для поиска корзины по session_id
cartSessionSchema.index({ session_id: 1 });

// Метод для подсчета общей суммы товаров
cartSessionSchema.methods.calculateItemsTotal = function () {
	this.totals.items_total = this.restaurants.reduce((total, restaurant) => {
		restaurant.subtotal = restaurant.items.reduce((subtotal, item) => {
			return subtotal + item.total_price;
		}, 0);
		return total + restaurant.subtotal;
	}, 0);

	return this.totals.items_total;
};

// Метод для подсчета итоговой суммы
cartSessionSchema.methods.calculateGrandTotal = function () {
	this.calculateItemsTotal();
	this.totals.grand_total = this.totals.items_total + (this.totals.delivery_fee || 0);
	return this.totals.grand_total;
};

// Метод для получения общего количества товаров
cartSessionSchema.methods.getTotalItemsCount = function () {
	return this.restaurants.reduce((total, restaurant) => {
		return total + restaurant.items.reduce((count, item) => count + item.quantity, 0);
	}, 0);
};

// Метод для получения количества ресторанов
cartSessionSchema.methods.getRestaurantsCount = function () {
	return this.restaurants.length;
};

module.exports = mongoose.model('CartSession', cartSessionSchema);