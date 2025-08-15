// models/index.js
const Restaurant = require('./Restaurant');
const MenuItem = require('./MenuItem');
const MenuCategory = require('./MenuCategory');
const Order = require('./Order');
const User = require('./User');
const Review = require('./Review');
const PostalCode = require('./PostalCode');
const CartSession = require('./CartSession');
const Promotion = require('./Promotion');
const RestaurantApplication = require('./RestaurantApplication');
const RestaurantOwner = require('./RestaurantOwner');
const AdminLog = require('./AdminLog');
const DeliveryZone = require('./DeliveryZone');

module.exports = {
	Restaurant,
	MenuItem,
	MenuCategory,
	Order,
	User,
	Review,
	PostalCode,
	CartSession,
	Promotion,
	RestaurantApplication,
	RestaurantOwner,
	AdminLog,
	DeliveryZone
};