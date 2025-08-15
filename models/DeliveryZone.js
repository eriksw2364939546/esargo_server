// models/DeliveryZone.js
const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema({
	zone_number: {
		type: Number,
		required: true,
		unique: true
	},
	zone_name: {
		type: String,
		required: true,
		trim: true
	},
	description: {
		type: String,
		required: true
	},
	postal_codes: [{
		type: String,
		required: true,
		uppercase: true
	}],
	base_fee: {
		type: Number,
		required: true,
		min: 0
	},
	additional_fee: {
		type: Number,
		required: true,
		min: 0,
		default: 0
	},
	max_distance_km: {
		type: Number,
		required: true
	},
	estimated_delivery_time_min: {
		type: Number,
		default: 30
	},
	is_active: {
		type: Boolean,
		default: true
	}
}, {
	timestamps: true
});

// Индекс для быстрого поиска по почтовому индексу
deliveryZoneSchema.index({ postal_codes: 1 });

// Статический метод для поиска зоны по почтовому индексу
deliveryZoneSchema.statics.findByPostalCode = function (postalCode) {
	return this.findOne({
		postal_codes: postalCode.toUpperCase(),
		is_active: true
	});
};

// Метод для расчета общей стоимости доставки
deliveryZoneSchema.methods.calculateDeliveryFee = function (restaurantCount = 1) {
	const baseFee = this.base_fee + this.additional_fee;
	const additionalRestaurantsFee = Math.max(0, restaurantCount - 1) * 5; // +5€ за каждый дополнительный ресторан

	return {
		base_zone_fee: baseFee,
		additional_restaurants_count: Math.max(0, restaurantCount - 1),
		additional_restaurants_fee: additionalRestaurantsFee,
		total_delivery_fee: baseFee + additionalRestaurantsFee
	};
};

module.exports = mongoose.model('DeliveryZone', deliveryZoneSchema);