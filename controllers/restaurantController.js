// controllers/restaurantController.js
const { Restaurant, MenuItem, MenuCategory } = require('../models');

// Получить список всех ресторанов с фильтрацией
const getAllRestaurants = async (req, res) => {
	try {
		const {
			page = 1,
			limit = 12,
			cuisine_type,
			postal_code,
			min_rating,
			sort_by = 'name'
		} = req.query;

		// Построение фильтра
		const filter = { is_active: true, status: 'active' };

		if (cuisine_type) {
			filter.cuisine_types = { $in: [cuisine_type] };
		}

		if (postal_code) {
			filter.delivery_postal_codes = { $in: [postal_code] };
		}

		if (min_rating) {
			filter.rating = { $gte: parseFloat(min_rating) };
		}

		// Определение сортировки
		let sortOptions = {};
		switch (sort_by) {
			case 'rating':
				sortOptions = { rating: -1, reviews_count: -1 };
				break;
			case 'delivery_fee':
				sortOptions = { delivery_fee: 1 };
				break;
			case 'min_order':
				sortOptions = { min_order_amount: 1 };
				break;
			default:
				sortOptions = { name: 1 };
		}

		// Пагинация
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Запрос к базе
		const restaurants = await Restaurant.find(filter)
			.select('-__v -approved_by -approved_at')
			.sort(sortOptions)
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		// Подсчет общего количества для пагинации
		const total = await Restaurant.countDocuments(filter);
		const totalPages = Math.ceil(total / parseInt(limit));

		res.json({
			success: true,
			data: {
				restaurants,
				pagination: {
					current_page: parseInt(page),
					total_pages: totalPages,
					total_items: total,
					items_per_page: parseInt(limit),
					has_next: parseInt(page) < totalPages,
					has_prev: parseInt(page) > 1
				}
			}
		});

	} catch (error) {
		console.error('Error in getAllRestaurants:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении списка ресторанов',
			error: error.message
		});
	}
};

// Получить конкретный ресторан с меню
const getRestaurantById = async (req, res) => {
	try {
		const { id } = req.params;
		const { include_menu = 'true' } = req.query;

		// Поиск ресторана
		const restaurant = await Restaurant.findOne({
			_id: id,
			is_active: true,
			status: 'active'
		}).select('-__v').lean();

		if (!restaurant) {
			return res.status(404).json({
				success: false,
				message: 'Ресторан не найден'
			});
		}

		let result = { restaurant };

		// Добавление меню если запрошено
		if (include_menu === 'true') {
			// Получаем категории меню
			const categories = await MenuCategory.find({
				restaurant_id: id,
				is_active: true
			}).sort({ order_index: 1 }).lean();

			// Получаем все блюда ресторана
			const menuItems = await MenuItem.find({
				restaurant_id: id,
				is_available: true
			}).select('-__v').lean();

			// Группируем блюда по категориям
			const menuByCategory = categories.map(category => ({
				...category,
				items: menuItems.filter(item => item.category === category.name)
			}));

			// Добавляем блюда без категории (если есть)
			const uncategorizedItems = menuItems.filter(item =>
				!categories.some(cat => cat.name === item.category)
			);

			if (uncategorizedItems.length > 0) {
				menuByCategory.push({
					name: 'Другое',
					description: 'Прочие блюда',
					items: uncategorizedItems
				});
			}

			result.menu = menuByCategory;
			result.total_menu_items = menuItems.length;
		}

		res.json({
			success: true,
			data: result
		});

	} catch (error) {
		console.error('Error in getRestaurantById:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении ресторана',
			error: error.message
		});
	}
};

// Получить ресторан по id_name
const getRestaurantByIdName = async (req, res) => {
	try {
		const { id_name } = req.params;
		const { include_menu = 'true' } = req.query;

		// Поиск ресторана по id_name
		const restaurant = await Restaurant.findOne({
			id_name: id_name,
			is_active: true,
			status: 'active'
		}).select('-__v').lean();

		if (!restaurant) {
			return res.status(404).json({
				success: false,
				message: 'Ресторан не найден'
			});
		}

		let result = { restaurant };

		// Добавление меню если запрошено
		if (include_menu === 'true') {
			// Получаем категории меню
			const categories = await MenuCategory.find({
				restaurant_id: restaurant._id,
				is_active: true
			}).sort({ order_index: 1 }).lean();

			// Получаем все блюда ресторана
			const menuItems = await MenuItem.find({
				restaurant_id: restaurant._id,
				is_available: true
			}).select('-__v').lean();

			// Группируем блюда по категориям
			const menuByCategory = categories.map(category => ({
				...category,
				items: menuItems.filter(item => item.category === category.name)
			}));

			// Добавляем блюда без категории (если есть)
			const uncategorizedItems = menuItems.filter(item =>
				!categories.some(cat => cat.name === item.category)
			);

			if (uncategorizedItems.length > 0) {
				menuByCategory.push({
					name: 'Другое',
					description: 'Прочие блюда',
					items: uncategorizedItems
				});
			}

			result.menu = menuByCategory;
			result.total_menu_items = menuItems.length;
		}

		res.json({
			success: true,
			data: result
		});

	} catch (error) {
		console.error('Error in getRestaurantByIdName:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении ресторана по имени',
			error: error.message
		});
	}
};

// Поиск ресторанов по названию/кухне
const searchRestaurants = async (req, res) => {
	try {
		const {
			q,
			page = 1,
			limit = 12,
			postal_code,
			cuisine_type
		} = req.query;

		if (!q || q.trim().length < 2) {
			return res.status(400).json({
				success: false,
				message: 'Поисковый запрос должен содержать минимум 2 символа'
			});
		}

		// Построение фильтра
		const filter = {
			is_active: true,
			status: 'active',
			$text: { $search: q.trim() }
		};

		if (postal_code) {
			filter.delivery_postal_codes = { $in: [postal_code] };
		}

		if (cuisine_type) {
			filter.cuisine_types = { $in: [cuisine_type] };
		}

		// Пагинация
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Поиск с релевантностью
		const restaurants = await Restaurant.find(filter, {
			score: { $meta: 'textScore' }
		})
			.select('-__v -approved_by -approved_at')
			.sort({ score: { $meta: 'textScore' }, rating: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		const total = await Restaurant.countDocuments(filter);
		const totalPages = Math.ceil(total / parseInt(limit));

		res.json({
			success: true,
			data: {
				restaurants,
				search_query: q,
				pagination: {
					current_page: parseInt(page),
					total_pages: totalPages,
					total_items: total,
					items_per_page: parseInt(limit),
					has_next: parseInt(page) < totalPages,
					has_prev: parseInt(page) > 1
				}
			}
		});

	} catch (error) {
		console.error('Error in searchRestaurants:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при поиске ресторанов',
			error: error.message
		});
	}
};

// Получить рестораны по почтовому индексу
const getRestaurantsByPostalCode = async (req, res) => {
	try {
		const { code } = req.params;
		const {
			page = 1,
			limit = 12,
			cuisine_type,
			sort_by = 'delivery_fee'
		} = req.query;

		if (!code || code.length < 3) {
			return res.status(400).json({
				success: false,
				message: 'Некорректный почтовый индекс'
			});
		}

		// Построение фильтра
		const filter = {
			is_active: true,
			status: 'active',
			delivery_postal_codes: { $in: [code.toUpperCase()] }
		};

		if (cuisine_type) {
			filter.cuisine_types = { $in: [cuisine_type] };
		}

		// Определение сортировки
		let sortOptions = {};
		switch (sort_by) {
			case 'rating':
				sortOptions = { rating: -1, reviews_count: -1 };
				break;
			case 'min_order':
				sortOptions = { min_order_amount: 1 };
				break;
			case 'name':
				sortOptions = { name: 1 };
				break;
			default:
				sortOptions = { delivery_fee: 1 };
		}

		// Пагинация
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Запрос к базе
		const restaurants = await Restaurant.find(filter)
			.select('-__v -approved_by -approved_at')
			.sort(sortOptions)
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		const total = await Restaurant.countDocuments(filter);
		const totalPages = Math.ceil(total / parseInt(limit));

		// Добавляем информацию о доставке
		const restaurantsWithDelivery = restaurants.map(restaurant => ({
			...restaurant,
			delivers_to_area: true,
			postal_code: code.toUpperCase()
		}));

		res.json({
			success: true,
			data: {
				restaurants: restaurantsWithDelivery,
				postal_code: code.toUpperCase(),
				pagination: {
					current_page: parseInt(page),
					total_pages: totalPages,
					total_items: total,
					items_per_page: parseInt(limit),
					has_next: parseInt(page) < totalPages,
					has_prev: parseInt(page) > 1
				}
			}
		});

	} catch (error) {
		console.error('Error in getRestaurantsByPostalCode:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении ресторанов по почтовому индексу',
			error: error.message
		});
	}
};

module.exports = {
	getAllRestaurants,
	getRestaurantById,
	getRestaurantByIdName,
	searchRestaurants,
	getRestaurantsByPostalCode
};