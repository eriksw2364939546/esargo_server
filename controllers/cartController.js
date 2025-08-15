// controllers/cartController.js
const { CartSession, MenuItem, Restaurant, DeliveryZone } = require('../models');
const { v4: uuidv4 } = require('uuid');

// Добавить товар в корзину
const addToCart = async (req, res) => {
	try {
		const {
			session_id,
			menu_item_id,
			quantity = 1,
			notes = ''
		} = req.body;

		if (!session_id || !menu_item_id) {
			return res.status(400).json({
				success: false,
				message: 'session_id и menu_item_id обязательны'
			});
		}

		if (quantity < 1) {
			return res.status(400).json({
				success: false,
				message: 'Количество должно быть больше 0'
			});
		}

		// Получаем информацию о блюде
		const menuItem = await MenuItem.findById(menu_item_id)
			.populate('restaurant_id', 'name is_active status')
			.lean();

		if (!menuItem) {
			return res.status(404).json({
				success: false,
				message: 'Блюдо не найдено'
			});
		}

		if (!menuItem.is_available) {
			return res.status(400).json({
				success: false,
				message: 'Блюдо временно недоступно'
			});
		}

		if (!menuItem.restaurant_id.is_active || menuItem.restaurant_id.status !== 'active') {
			return res.status(400).json({
				success: false,
				message: 'Ресторан временно недоступен'
			});
		}

		const finalPrice = menuItem.discount_price || menuItem.price;
		const totalPrice = finalPrice * quantity;

		// Ищем существующую корзину или создаем новую
		let cart = await CartSession.findOne({ session_id });

		if (!cart) {
			cart = new CartSession({
				session_id,
				restaurants: [],
				totals: {
					items_total: 0,
					delivery_fee: 0,
					grand_total: 0
				}
			});
		}

		// Ищем ресторан в корзине
		let restaurantCart = cart.restaurants.find(
			r => r.restaurant_id.toString() === menuItem.restaurant_id._id.toString()
		);

		if (!restaurantCart) {
			// Добавляем новый ресторан в корзину
			restaurantCart = {
				restaurant_id: menuItem.restaurant_id._id,
				items: [],
				subtotal: 0
			};
			cart.restaurants.push(restaurantCart);
		}

		// Проверяем есть ли уже такое блюдо в корзине ресторана
		const existingItemIndex = restaurantCart.items.findIndex(
			item => item.menu_item_id.toString() === menu_item_id
		);

		if (existingItemIndex >= 0) {
			// Обновляем существующий товар
			restaurantCart.items[existingItemIndex].quantity += quantity;
			restaurantCart.items[existingItemIndex].total_price =
				restaurantCart.items[existingItemIndex].quantity * finalPrice;
			restaurantCart.items[existingItemIndex].notes = notes;
		} else {
			// Добавляем новый товар
			restaurantCart.items.push({
				menu_item_id,
				restaurant_id: menuItem.restaurant_id._id,
				quantity,
				price: finalPrice,
				total_price: totalPrice,
				notes
			});
		}

		// Пересчитываем суммы
		cart.calculateGrandTotal();

		// Сохраняем корзину
		await cart.save();

		// Получаем обновленную корзину с населенными данными
		const updatedCart = await getPopulatedCart(session_id);

		res.json({
			success: true,
			message: 'Товар добавлен в корзину',
			data: {
				cart: updatedCart,
				added_item: {
					menu_item_id,
					name: menuItem.name,
					restaurant_name: menuItem.restaurant_id.name,
					quantity,
					price: finalPrice,
					total_price: totalPrice
				}
			}
		});

	} catch (error) {
		console.error('Error in addToCart:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при добавлении товара в корзину',
			error: error.message
		});
	}
};

// Получить корзину
const getCart = async (req, res) => {
	try {
		const { sessionId } = req.params;

		if (!sessionId) {
			return res.status(400).json({
				success: false,
				message: 'session_id обязателен'
			});
		}

		const cart = await getPopulatedCart(sessionId);

		if (!cart) {
			return res.json({
				success: true,
				data: {
					cart: {
						session_id: sessionId,
						restaurants: [],
						totals: {
							items_total: 0,
							delivery_fee: 0,
							grand_total: 0
						},
						items_count: 0,
						restaurants_count: 0
					}
				}
			});
		}

		res.json({
			success: true,
			data: {
				cart: {
					...cart,
					items_count: cart.getTotalItemsCount(),
					restaurants_count: cart.getRestaurantsCount()
				}
			}
		});

	} catch (error) {
		console.error('Error in getCart:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при получении корзины',
			error: error.message
		});
	}
};

// Обновить количество товара
const updateCartItem = async (req, res) => {
	try {
		const { itemId } = req.params;
		const { session_id, quantity, notes } = req.body;

		if (!session_id) {
			return res.status(400).json({
				success: false,
				message: 'session_id обязателен'
			});
		}

		if (quantity < 1) {
			return res.status(400).json({
				success: false,
				message: 'Количество должно быть больше 0'
			});
		}

		const cart = await CartSession.findOne({ session_id });

		if (!cart) {
			return res.status(404).json({
				success: false,
				message: 'Корзина не найдена'
			});
		}

		// Ищем товар во всех ресторанах
		let itemFound = false;
		let restaurantCart, itemIndex;

		for (let restaurant of cart.restaurants) {
			itemIndex = restaurant.items.findIndex(
				item => item._id.toString() === itemId
			);
			if (itemIndex >= 0) {
				restaurantCart = restaurant;
				itemFound = true;
				break;
			}
		}

		if (!itemFound) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден в корзине'
			});
		}

		// Обновляем товар
		const item = restaurantCart.items[itemIndex];
		item.quantity = quantity;
		item.total_price = item.price * quantity;
		if (notes !== undefined) {
			item.notes = notes;
		}

		// Пересчитываем суммы
		cart.calculateGrandTotal();

		await cart.save();

		const updatedCart = await getPopulatedCart(session_id);

		res.json({
			success: true,
			message: 'Товар обновлен',
			data: {
				cart: updatedCart
			}
		});

	} catch (error) {
		console.error('Error in updateCartItem:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при обновлении товара',
			error: error.message
		});
	}
};

// Удалить товар из корзины
const removeCartItem = async (req, res) => {
	try {
		const { itemId } = req.params;
		const { session_id } = req.body;

		if (!session_id) {
			return res.status(400).json({
				success: false,
				message: 'session_id обязателен'
			});
		}

		const cart = await CartSession.findOne({ session_id });

		if (!cart) {
			return res.status(404).json({
				success: false,
				message: 'Корзина не найдена'
			});
		}

		// Ищем и удаляем товар
		let itemRemoved = false;
		let removedItem = null;

		for (let i = 0; i < cart.restaurants.length; i++) {
			const restaurant = cart.restaurants[i];
			const itemIndex = restaurant.items.findIndex(
				item => item._id.toString() === itemId
			);

			if (itemIndex >= 0) {
				removedItem = restaurant.items[itemIndex];
				restaurant.items.splice(itemIndex, 1);
				itemRemoved = true;

				// Если в ресторане не осталось товаров, удаляем ресторан
				if (restaurant.items.length === 0) {
					cart.restaurants.splice(i, 1);
				}
				break;
			}
		}

		if (!itemRemoved) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден в корзине'
			});
		}

		// Пересчитываем суммы
		cart.calculateGrandTotal();

		await cart.save();

		const updatedCart = await getPopulatedCart(session_id);

		res.json({
			success: true,
			message: 'Товар удален из корзины',
			data: {
				cart: updatedCart,
				removed_item: removedItem
			}
		});

	} catch (error) {
		console.error('Error in removeCartItem:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при удалении товара',
			error: error.message
		});
	}
};

// Очистить корзину
const clearCart = async (req, res) => {
	try {
		const { sessionId } = req.params;

		const result = await CartSession.deleteOne({ session_id: sessionId });

		if (result.deletedCount === 0) {
			return res.status(404).json({
				success: false,
				message: 'Корзина не найдена'
			});
		}

		res.json({
			success: true,
			message: 'Корзина очищена'
		});

	} catch (error) {
		console.error('Error in clearCart:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при очистке корзины',
			error: error.message
		});
	}
};

// Расчет стоимости доставки
const calculateDelivery = async (req, res) => {
	try {
		const { session_id, postal_code } = req.body;

		if (!session_id || !postal_code) {
			return res.status(400).json({
				success: false,
				message: 'session_id и postal_code обязательны'
			});
		}

		const cart = await CartSession.findOne({ session_id });

		if (!cart || cart.restaurants.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'Корзина пуста'
			});
		}

		// Ищем зону доставки
		const deliveryZone = await DeliveryZone.findByPostalCode(postal_code);

		if (!deliveryZone) {
			return res.status(400).json({
				success: false,
				message: 'Доставка в данный район недоступна'
			});
		}

		// Рассчитываем стоимость доставки
		const restaurantCount = cart.getRestaurantsCount();
		const deliveryCalculation = deliveryZone.calculateDeliveryFee(restaurantCount);

		// Обновляем корзину
		cart.delivery_postal_code = postal_code.toUpperCase();
		cart.delivery_calculation = {
			zone_number: deliveryZone.zone_number,
			zone_name: deliveryZone.zone_name,
			...deliveryCalculation
		};
		cart.totals.delivery_fee = deliveryCalculation.total_delivery_fee;
		cart.calculateGrandTotal();

		await cart.save();

		res.json({
			success: true,
			message: 'Стоимость доставки рассчитана',
			data: {
				delivery_info: {
					postal_code: postal_code.toUpperCase(),
					zone: {
						number: deliveryZone.zone_number,
						name: deliveryZone.zone_name,
						description: deliveryZone.description,
						estimated_time: deliveryZone.estimated_delivery_time_min
					},
					calculation: deliveryCalculation
				},
				totals: cart.totals
			}
		});

	} catch (error) {
		console.error('Error in calculateDelivery:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при расчете доставки',
			error: error.message
		});
	}
};

// Вспомогательная функция для получения корзины с населенными данными
const getPopulatedCart = async (sessionId) => {
	const cart = await CartSession.findOne({ session_id: sessionId })
		.populate({
			path: 'restaurants.restaurant_id',
			select: 'name description images address phone delivery_fee min_order_amount'
		})
		.populate({
			path: 'restaurants.items.menu_item_id',
			select: 'name description images price discount_price category is_vegetarian is_vegan is_spicy allergens'
		})
		.lean();

	return cart;
};

// Валидация корзины перед заказом
const validateCart = async (req, res) => {
	try {
		const { session_id } = req.body;

		if (!session_id) {
			return res.status(400).json({
				success: false,
				message: 'session_id обязателен'
			});
		}

		const cart = await getPopulatedCart(session_id);

		if (!cart || cart.restaurants.length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Корзина пуста'
			});
		}

		const validationErrors = [];
		const unavailableItems = [];

		// Проверяем каждый ресторан и товар
		for (let restaurant of cart.restaurants) {
			// Проверяем активность ресторана
			if (!restaurant.restaurant_id.is_active) {
				validationErrors.push(`Ресторан "${restaurant.restaurant_id.name}" временно недоступен`);
				continue;
			}

			// Проверяем доступность товаров
			for (let item of restaurant.items) {
				if (!item.menu_item_id.is_available) {
					unavailableItems.push({
						name: item.menu_item_id.name,
						restaurant: restaurant.restaurant_id.name
					});
				}
			}
		}

		if (unavailableItems.length > 0) {
			validationErrors.push(`Следующие блюда больше недоступны: ${unavailableItems.map(item => `${item.name} (${item.restaurant})`).join(', ')}`);
		}

		// Проверяем есть ли расчет доставки
		if (!cart.delivery_calculation) {
			validationErrors.push('Необходимо указать адрес доставки для расчета стоимости');
		}

		const isValid = validationErrors.length === 0;

		res.json({
			success: true,
			data: {
				is_valid: isValid,
				errors: validationErrors,
				unavailable_items: unavailableItems,
				cart_summary: {
					restaurants_count: cart.restaurants.length,
					items_count: cart.restaurants.reduce((count, r) => count + r.items.length, 0),
					totals: cart.totals
				}
			}
		});

	} catch (error) {
		console.error('Error in validateCart:', error);
		res.status(500).json({
			success: false,
			message: 'Ошибка при валидации корзины',
			error: error.message
		});
	}
};

module.exports = {
	addToCart,
	getCart,
	updateCartItem,
	removeCartItem,
	clearCart,
	calculateDelivery,
	validateCart
};