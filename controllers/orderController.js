// controllers/orderController.js
const { Order, CartSession, Restaurant, MenuItem, DeliveryZone } = require('../models');

// Создать заказ из корзины
const createOrder = async (req, res) => {
	try {
		const {
			session_id,
			customer_info,
			delivery_address,
			payment_method,
			delivery_time_preference = 'ASAP',
			notes = ''
		} = req.body;

		// Валидация обязательных полей
		if (!session_id || !customer_info || !delivery_address || !payment_method) {
			return res.status(400).json({
				success: false,
				message: 'Все обязательные поля должны быть заполнены'
			});
		}

		if (!customer_info.name || !customer_info.phone) {
			return res.status(400).json({
				success: false,
				message: 'Имя и телефон клиента обязательны'
			});
		}

		if (!delivery_address.street || !delivery_address.city || !delivery_address.postal_code) {
			return res.status(400).json({
				success: false,
				message: 'Адрес доставки должен содержать улицу, город и почтовый индекс'
			});
		}

		// Получаем корзину
		const cart = await CartSession.findOne({ session_id })
			.populate({
				path: 'restaurants.restaurant_id',
				select: 'name is_active status min_order_amount'
			})
			.populate({
				path: 'restaurants.items.menu_item_id',
				select: 'name price discount_price is_available'
			});

		if (!cart || cart.restaurants.length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Корзина пуста'
			});
		}

		// Проверяем доставку
		if (!cart.delivery_calculation) {
			return res.status(400).json({
				success: false,
				message: 'Необходимо рассчитать стоимость доставки'
			});
		}

		// Валидация корзины
		const validationErrors = [];

		for (let restaurantCart of cart.restaurants) {
			// Проверяем активность ресторана
			if (!restaurantCart.restaurant_id.is_active || restaurantCart.restaurant_id.status !== 'active') {
				validationErrors.push(`Ресторан "${restaurantCart.restaurant_id.name}" временно недоступен`);
				continue;
			}

			// Проверяем минимальную сумму заказа
			if (restaurantCart.subtotal < restaurantCart.restaurant_id.min_order_amount) {
				validationErrors.push(
					`Минимальная сумма заказа в ресторане "${restaurantCart.restaurant_id.name}" составляет ${restaurantCart.restaurant_id.min_order_amount}€`
				);
			}

			// Проверяем доступность блюд
			for (let item of restaurantCart.items) {
				if (!item.menu_item_id.is_available) {
					validationErrors.push(`Блюдо "${item.menu_item_id.name}" больше недоступно`);
				}

				// Проверяем корректность цены
				const currentPrice = item.menu_item_id.discount_price || item.menu_item_id.price;
				if (Math.abs(item.price - currentPrice) > 0.01) {
					validationErrors.push(`Цена блюда "${item.menu_item_id.name}" изменилась`);
				}
			}
		}

		if (validationErrors.length > 0) {
			return res.status(400).json({
				success: false,
				message: 'Ошибки валидации заказа',
				errors: validationErrors
			});
		}

		// Генерируем номер заказа
		const orderNumber = await Order.generateOrderNumber();

		// Создаем структуру заказа
		const orderData = {
			order_number: orderNumber,
			session_id,
			customer_info: {
				name: customer_info.name.trim(),
				phone: customer_info.phone.trim(),
				email: customer_info.email ? customer_info.email.trim() : undefined
			},
			delivery_address,
			delivery_info: {
				zone_number: cart.delivery_calculation.zone_number,
				zone_name: cart.delivery_calculation.zone_name,
				base_zone_fee: cart.delivery_calculation.base_zone_fee,
				additional_restaurants_fee: cart.delivery_calculation.additional_restaurants_fee,
				total_delivery_fee: cart.delivery_calculation.total_delivery_fee
			},
			delivery_time_preference,
			payment_method,
			totals: cart.totals,
			notes,
			restaurants: cart.restaurants.map((restaurantCart, index) => ({
				restaurant_id: restaurantCart.restaurant_id._id,
				restaurant_order_number: Order.generateRestaurantOrderNumber(index),
				items: restaurantCart.items.map(item => ({
					menu_item_id: item.menu_item_id._id,
					name: item.menu_item_id.name,
					price: item.price,
					quantity: item.quantity,
					total_price: item.total_price,
					notes: item.notes
				})),
				subtotal: restaurantCart.subtotal,
				status: 'новый'
			})),
			overall_status: 'новый'
		};

		// Рассчитываем предполагаемое время доставки
		const deliveryZone = await DeliveryZone.findOne({ zone_number: cart.delivery_calculation.zone_number });
		if (deliveryZone) {
			const maxPrepTime = Math.max(...orderData.restaurants.map(r => r.estimated_prep_time || 30));
			const estimatedTime = new Date();
			estimatedTime.setMinutes(estimatedTime.getMinutes() + maxPrepTime + deliveryZone.estimated_delivery_time_min);
			orderData.delivery_info.estimated_delivery_time = estimatedTime;
		}

		// Создаем заказ
		const order = new Order(orderData);

		// Добавляем первое обновление трекинга
		order.addTrackingUpdate('новый', 'Заказ создан и отправлен в рестораны');

		await order.save();

		// Очищаем корзину
		await CartSession.deleteOne({ session_id });

		// Получаем полную информацию о заказе для ответа
		const fullOrder = await Order.findById(order._id)
			.populate('restaurants.restaurant_id', 'name address phone images')
			.lean();

		res.status(201).json({
			success: true,
			message: 'Заказ успешно создан',
			data: {
				order: fullOrder,
				tracking_info: {
					order_number: orderNumber,
					tracking_phone: customer_info.phone,
					estimated_delivery: orderData.delivery_info.estimated_delivery_time
				}
			}
		});

	} catch (error) {
		console.error('Error in createOrder:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при создании заказа',
			error: error.message
		});
	}
};

// Получить детали заказа
const getOrderById = async (req, res) => {
	try {
		const { id } = req.params;

		const order = await Order.findById(id)
			.populate('restaurants.restaurant_id', 'name address phone images working_hours')
			.populate('restaurants.items.menu_item_id', 'images category')
			.lean();

		if (!order) {
			return res.status(404).json({
				success: false,
				message: 'Заказ не найден'
			});
		}

		// Добавляем дополнительную информацию
		const enhancedOrder = {
			...order,
			summary: {
				total_restaurants: order.restaurants.length,
				total_items: order.restaurants.reduce((sum, r) => sum + r.items.length, 0),
				total_quantity: order.restaurants.reduce((sum, r) =>
					sum + r.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
				)
			}
		};

		res.json({
			success: true,
			data: {
				order: enhancedOrder
			}
		});

	} catch (error) {
		console.error('Error in getOrderById:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении заказа',
			error: error.message
		});
	}
};

// Отслеживание заказов по телефону (для гостей)
const trackOrdersByPhone = async (req, res) => {
	try {
		const { phone } = req.params;
		const { limit = 10, page = 1 } = req.query;

		if (!phone) {
			return res.status(400).json({
				success: false,
				message: 'Номер телефона обязателен'
			});
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);

		const orders = await Order.find({
			'customer_info.phone': phone
		})
			.populate('restaurants.restaurant_id', 'name images')
			.select('-restaurants.items.menu_item_id -tracking_updates')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		const total = await Order.countDocuments({
			'customer_info.phone': phone
		});

		const ordersWithSummary = orders.map(order => ({
			...order,
			summary: {
				restaurants_names: order.restaurants.map(r => r.restaurant_id.name),
				total_items: order.restaurants.reduce((sum, r) => sum + r.items.length, 0)
			}
		}));

		res.json({
			success: true,
			data: {
				orders: ordersWithSummary,
				pagination: {
					current_page: parseInt(page),
					total_pages: Math.ceil(total / parseInt(limit)),
					total_orders: total,
					orders_per_page: parseInt(limit)
				}
			}
		});

	} catch (error) {
		console.error('Error in trackOrdersByPhone:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при поиске заказов',
			error: error.message
		});
	}
};

// Получить заказы ресторана
const getRestaurantOrders = async (req, res) => {
	try {
		const { restaurantId } = req.params;
		const {
			status,
			date_from,
			date_to,
			limit = 20,
			page = 1
		} = req.query;

		// Построение фильтра
		const matchFilter = {
			'restaurants.restaurant_id': restaurantId
		};

		if (status) {
			matchFilter['restaurants.status'] = status;
		}

		if (date_from || date_to) {
			matchFilter.createdAt = {};
			if (date_from) matchFilter.createdAt.$gte = new Date(date_from);
			if (date_to) matchFilter.createdAt.$lte = new Date(date_to);
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Агрегация для получения только заказов с данным рестораном
		const orders = await Order.aggregate([
			{ $match: matchFilter },
			{
				$project: {
					order_number: 1,
					customer_info: 1,
					delivery_address: 1,
					delivery_info: 1,
					payment_method: 1,
					overall_status: 1,
					createdAt: 1,
					restaurant: {
						$filter: {
							input: '$restaurants',
							cond: { $eq: ['$$this.restaurant_id', restaurantId] }
						}
					}
				}
			},
			{ $unwind: '$restaurant' },
			{ $sort: { createdAt: -1 } },
			{ $skip: skip },
			{ $limit: parseInt(limit) }
		]);

		const total = await Order.countDocuments(matchFilter);

		res.json({
			success: true,
			data: {
				orders,
				pagination: {
					current_page: parseInt(page),
					total_pages: Math.ceil(total / parseInt(limit)),
					total_orders: total,
					orders_per_page: parseInt(limit)
				}
			}
		});

	} catch (error) {
		console.error('Error in getRestaurantOrders:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении заказов ресторана',
			error: error.message
		});
	}
};

// Обновить статус заказа ресторана
const updateOrderStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { restaurant_id, status, notes, estimated_prep_time } = req.body;

		if (!restaurant_id || !status) {
			return res.status(400).json({
				success: false,
				message: 'restaurant_id и status обязательны'
			});
		}

		const validStatuses = ['новый', 'принят', 'готовится', 'готов', 'в доставке', 'выполнен', 'отменен'];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({
				success: false,
				message: 'Некорректный статус'
			});
		}

		const order = await Order.findById(id);
		if (!order) {
			return res.status(404).json({
				success: false,
				message: 'Заказ не найден'
			});
		}

		// Находим ресторан в заказе
		const restaurantOrder = order.restaurants.find(
			r => r.restaurant_id.toString() === restaurant_id
		);

		if (!restaurantOrder) {
			return res.status(404).json({
				success: false,
				message: 'Ресторан не найден в этом заказе'
			});
		}

		// Обновляем статус
		restaurantOrder.status = status;
		if (notes) restaurantOrder.notes_from_restaurant = notes;
		if (estimated_prep_time) restaurantOrder.estimated_prep_time = estimated_prep_time;

		// Добавляем обновление трекинга
		const statusMessages = {
			'принят': 'Заказ принят рестораном',
			'готовится': 'Заказ готовится',
			'готов': 'Заказ готов к выдаче',
			'в доставке': 'Заказ передан курьеру',
			'выполнен': 'Заказ доставлен',
			'отменен': 'Заказ отменен рестораном'
		};

		order.addTrackingUpdate(
			status,
			statusMessages[status] || `Статус изменен на: ${status}`,
			restaurant_id
		);

		// Обновляем общий статус заказа
		order.updateOverallStatus();

		await order.save();

		res.json({
			success: true,
			message: 'Статус заказа обновлен',
			data: {
				order_id: id,
				restaurant_order_number: restaurantOrder.restaurant_order_number,
				new_status: status,
				overall_status: order.overall_status
			}
		});

	} catch (error) {
		console.error('Error in updateOrderStatus:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при обновлении статуса заказа',
			error: error.message
		});
	}
};

module.exports = {
	createOrder,
	getOrderById,
	trackOrdersByPhone,
	getRestaurantOrders,
	updateOrderStatus
};