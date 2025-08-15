// models/MenuCategory.js
const mongoose = require('mongoose');

const menuCategorySchema = new mongoose.Schema({
	restaurant_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Restaurant',
		required: true
	},
	name: {
		type: String,
		required: true,
		trim: true
	},
	description: {
		type: String
	},
	order_index: {
		type: Number,
		default: 0
	},
	is_active: {
		type: Boolean,
		default: true
	}
}, {
	timestamps: true
});

// Индекс для сортировки категорий по ресторану
menuCategorySchema.index({ restaurant_id: 1, order_index: 1 });

module.exports = mongoose.model('MenuCategory', menuCategorySchema);