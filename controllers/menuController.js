// controllers/menuController.js
const { Restaurant, MenuItem, MenuCategory } = require('../models');

// Получить полное меню ресторана с категориями
const getRestaurantMenu = async (req, res) => {
	try {
		const { id } = req.params;
		const {
			include_unavailable = 'false',
			vegetarian_only = 'false',
			vegan_only = 'false',
			exclude_allergens
		} = req.query;

		// Проверка существования ресторана
		const restaurant = await Restaurant.findOne({
			_id: id,
			is_active: true,
			status: 'active'
		}).select('name description images').lean();

		if (!restaurant) {
			return res.status(404).json({
				success: false,
				message: 'Ресторан не найден'
			});
		}

		// Построение фильтра для блюд
		const itemsFilter = {
			restaurant_id: id
		};

		// Включать ли недоступные блюда
		if (include_unavailable === 'false') {
			itemsFilter.is_available = true;
		}

		// Фильтр по диетическим предпочтениям
		if (vegetarian_only === 'true') {
			itemsFilter.is_vegetarian = true;
		}

		if (vegan_only === 'true') {
			itemsFilter.is_vegan = true;
		}

		// Фильтр по аллергенам (исключить блюда с определенными аллергенами)
		if (exclude_allergens) {
			const allergensArray = exclude_allergens.split(',').map(a => a.trim());
			itemsFilter.allergens = { $nin: allergensArray };
		}

		// Получаем категории меню
		const categories = await MenuCategory.find({
			restaurant_id: id,
			is_active: true
		}).sort({ order_index: 1 }).lean();

		// Получаем все блюда ресторана с фильтрами
		const menuItems = await MenuItem.find(itemsFilter)
			.select('-__v')
			.lean();

		// Группируем блюда по категориям
		const menuByCategory = categories.map(category => {
			const categoryItems = menuItems.filter(item => item.category === category.name);

			return {
				_id: category._id,
				name: category.name,
				description: category.description,
				order_index: category.order_index,
				items_count: categoryItems.length,
				items: categoryItems.map(item => ({
					...item,
					// Вычисляем финальную цену (с учетом скидки)
					final_price: item.discount_price || item.price,
					has_discount: !!item.discount_price,
					discount_percentage: item.discount_price
						? Math.round(((item.price - item.discount_price) / item.price) * 100)
						: 0
				}))
			};
		});

		// Добавляем блюда без категории (если есть)
		const categorizedItemNames = categories.map(cat => cat.name);
		const uncategorizedItems = menuItems.filter(item =>
			!categorizedItemNames.includes(item.category)
		);

		if (uncategorizedItems.length > 0) {
			menuByCategory.push({
				name: 'Другое',
				description: 'Прочие блюда',
				order_index: 999,
				items_count: uncategorizedItems.length,
				items: uncategorizedItems.map(item => ({
					...item,
					final_price: item.discount_price || item.price,
					has_discount: !!item.discount_price,
					discount_percentage: item.discount_price
						? Math.round(((item.price - item.discount_price) / item.price) * 100)
						: 0
				}))
			});
		}

		// Фильтруем категории которые имеют блюда
		const nonEmptyCategories = menuByCategory.filter(cat => cat.items_count > 0);

		// Статистика меню
		const menuStats = {
			total_categories: nonEmptyCategories.length,
			total_items: menuItems.length,
			vegetarian_items: menuItems.filter(item => item.is_vegetarian).length,
			vegan_items: menuItems.filter(item => item.is_vegan).length,
			spicy_items: menuItems.filter(item => item.is_spicy).length,
			price_range: {
				min: Math.min(...menuItems.map(item => item.discount_price || item.price)),
				max: Math.max(...menuItems.map(item => item.discount_price || item.price))
			}
		};

		res.json({
			success: true,
			data: {
				restaurant,
				menu: nonEmptyCategories,
				stats: menuStats,
				filters_applied: {
					include_unavailable: include_unavailable === 'true',
					vegetarian_only: vegetarian_only === 'true',
					vegan_only: vegan_only === 'true',
					excluded_allergens: exclude_allergens ? exclude_allergens.split(',') : []
				}
			}
		});

	} catch (error) {
		console.error('Error in getRestaurantMenu:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении меню ресторана',
			error: error.message
		});
	}
};

// Получить только категории меню ресторана
const getRestaurantCategories = async (req, res) => {
	try {
		const { id } = req.params;

		// Проверка существования ресторана
		const restaurant = await Restaurant.findOne({
			_id: id,
			is_active: true,
			status: 'active'
		}).select('name').lean();

		if (!restaurant) {
			return res.status(404).json({
				success: false,
				message: 'Ресторан не найден'
			});
		}

		// Получаем категории с количеством блюд в каждой
		const categories = await MenuCategory.aggregate([
			{
				$match: {
					restaurant_id: id,
					is_active: true
				}
			},
			{
				$lookup: {
					from: 'menuitems',
					let: { categoryName: '$name', restaurantId: '$restaurant_id' },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ['$restaurant_id', '$$restaurantId'] },
										{ $eq: ['$category', '$$categoryName'] },
										{ $eq: ['$is_available', true] }
									]
								}
							}
						}
					],
					as: 'items'
				}
			},
			{
				$addFields: {
					items_count: { $size: '$items' }
				}
			},
			{
				$project: {
					name: 1,
					description: 1,
					order_index: 1,
					items_count: 1
				}
			},
			{
				$sort: { order_index: 1 }
			}
		]);

		res.json({
			success: true,
			data: {
				restaurant_id: id,
				restaurant_name: restaurant.name,
				categories,
				total_categories: categories.length
			}
		});

	} catch (error) {
		console.error('Error in getRestaurantCategories:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении категорий меню',
			error: error.message
		});
	}
};

// Получить детали конкретного блюда
const getMenuItemById = async (req, res) => {
	try {
		const { id } = req.params;

		const menuItem = await MenuItem.findById(id)
			.populate('restaurant_id', 'name description address phone is_active status')
			.select('-__v')
			.lean();

		if (!menuItem) {
			return res.status(404).json({
				success: false,
				message: 'Блюдо не найдено'
			});
		}

		const restaurantAvailable =
			menuItem.restaurant_id?.is_active && menuItem.restaurant_id?.status === 'active';

		const enhancedMenuItem = {
			...menuItem,
			final_price: menuItem.discount_price || menuItem.price,
			has_discount: !!menuItem.discount_price,
			discount_percentage: menuItem.discount_price
				? Math.round(((menuItem.price - menuItem.discount_price) / menuItem.price) * 100)
				: 0,
			dietary_info: {
				is_vegetarian: menuItem.is_vegetarian,
				is_vegan: menuItem.is_vegan,
				is_spicy: menuItem.is_spicy,
				allergens: menuItem.allergens
			},
			restaurant_available: restaurantAvailable
		};

		const similarItems = await MenuItem.find({
			restaurant_id: menuItem.restaurant_id._id,
			category: menuItem.category,
			_id: { $ne: id },
			is_available: true
		})
			.select('name price discount_price images is_vegetarian is_vegan is_spicy')
			.limit(4)
			.lean();

		res.json({
			success: true,
			data: {
				item: enhancedMenuItem,
				similar_items: similarItems.map(item => ({
					...item,
					final_price: item.discount_price || item.price,
					has_discount: !!item.discount_price
				}))
			}
		});
	} catch (error) {
		console.error('Error in getMenuItemById:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении блюда',
			error: error.message
		});
	}
};


// Поиск блюд по названию/ингредиентам
const searchMenuItems = async (req, res) => {
	try {
		const {
			q,
			restaurant_id,
			category,
			max_price,
			vegetarian_only = 'false',
			vegan_only = 'false',
			exclude_allergens,
			page = 1,
			limit = 20
		} = req.query;

		if (!q || q.trim().length < 2) {
			return res.status(400).json({
				success: false,
				message: 'Поисковый запрос должен содержать минимум 2 символа'
			});
		}

		// Построение фильтра
		const filter = {
			is_available: true,
			$text: { $search: q.trim() }
		};

		if (restaurant_id) {
			filter.restaurant_id = restaurant_id;
		}

		if (category) {
			filter.category = category;
		}

		if (max_price) {
			filter.$or = [
				{ discount_price: { $lte: parseFloat(max_price) } },
				{
					$and: [
						{ discount_price: { $exists: false } },
						{ price: { $lte: parseFloat(max_price) } }
					]
				}
			];
		}

		if (vegetarian_only === 'true') {
			filter.is_vegetarian = true;
		}

		if (vegan_only === 'true') {
			filter.is_vegan = true;
		}

		if (exclude_allergens) {
			const allergensArray = exclude_allergens.split(',').map(a => a.trim());
			filter.allergens = { $nin: allergensArray };
		}

		// Пагинация
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Поиск с релевантностью
		const menuItems = await MenuItem.find(filter, {
			score: { $meta: 'textScore' }
		})
			.populate('restaurant_id', 'name address delivery_fee min_order_amount')
			.sort({ score: { $meta: 'textScore' }, price: 1 })
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		const total = await MenuItem.countDocuments(filter);
		const totalPages = Math.ceil(total / parseInt(limit));

		// Обогащаем результаты
		const enhancedResults = menuItems.map(item => ({
			...item,
			final_price: item.discount_price || item.price,
			has_discount: !!item.discount_price,
			discount_percentage: item.discount_price
				? Math.round(((item.price - item.discount_price) / item.price) * 100)
				: 0
		}));

		res.json({
			success: true,
			data: {
				items: enhancedResults,
				search_query: q,
				filters_applied: {
					restaurant_id,
					category,
					max_price,
					vegetarian_only: vegetarian_only === 'true',
					vegan_only: vegan_only === 'true',
					excluded_allergens: exclude_allergens ? exclude_allergens.split(',') : []
				},
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
		console.error('Error in searchMenuItems:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при поиске блюд',
			error: error.message
		});
	}
};

module.exports = {
	getRestaurantMenu,
	getRestaurantCategories,
	getMenuItemById,
	searchMenuItems
};