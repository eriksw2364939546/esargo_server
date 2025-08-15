// models/Restaurant.js
const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},
	description: {
		type: String,
		required: true
	},
	longDescription: {
		type: String,
		required: true
	},
	address: {
		type: String,
		required: true
	},
	phone: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	},
	website: {
		type: String
	},
	images: [{
		type: String
	}],
	cuisine_types: [{
		type: String,
		enum: ["Булочная", "Кондитерская", "Ресторан", "Брассери", "Блинная", "Фастфуд", "Супермаркет", "Продуктовый", "Сырная лавка", "Мясная лавка", "Рыбная лавка", "Магазин игрушек", "Книжный", "Парфюмерия", "Аптека", "Одежда", "Секонд-хенд", "Зоомагазин", "Винный магазин"
]
	}],
	location: {
		type: {
			type: String,
			enum: ['Point'],
			default: 'Point'
		},
		coordinates: {
			type: [Number], // [longitude, latitude]
			required: true
		}
	},
	working_hours: {
		monday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
		tuesday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
		wednesday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
		thursday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
		friday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
		saturday: { open: String, close: String, is_closed: { type: Boolean, default: false } },
		sunday: { open: String, close: String, is_closed: { type: Boolean, default: false } }
	},
	rating: {
		type: Number,
		default: 0,
		min: 0,
		max: 5
	},
	reviews_count: {
		type: Number,
		default: 0
	},
	delivery_postal_codes: [{
		type: String,
		required: true
	}],
	delivery_fee: {
		type: Number,
		required: true,
		min: 0
	},
	min_order_amount: {
		type: Number,
		required: true,
		min: 0
	},
	owner_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	status: {
		type: String,
		enum: ['active', 'pending', 'rejected'],
		default: 'active'
	},
	is_active: {
		type: Boolean,
		default: true
	},
	approved_by: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	approved_at: {
		type: Date
	}
}, {
	timestamps: true
});

// Индекс для геопоиска
restaurantSchema.index({ location: '2dsphere' });

// Индекс для текстового поиска
restaurantSchema.index({
	name: 'text',
	description: 'text',
	longDescription: 'text'
});

module.exports = mongoose.model('Restaurant', restaurantSchema);