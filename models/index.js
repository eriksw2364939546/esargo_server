// models/index.js (исправленный - ES6 modules)

// Базовые модели
export { default as User } from './User.model.js';
export { default as Meta } from './Meta.model.js';
export { default as AdminUser } from './AdminUser.model.js';

// Профили пользователей
export { default as CustomerProfile } from './CustomerProfile.model.js';
export { default as PartnerProfile } from './PartnerProfile.model.js';
export { default as CourierProfile } from './CourierProfile.model.js';

// Товары и заказы
export { default as Product } from './Product.model.js';
export { default as Order } from './Order.model.js';
export { default as Review } from './Review.model.js';
export { default as Message } from './Message.model.js';
export { default as Cart } from './Cart.model.js';

// Администрирование партнеров
export { default as InitialPartnerRequest } from './InitialPartnerRequest.model.js';
export { default as PartnerLegalInfo } from './PartnerLegalInfo.model.js';
export { default as CourierApplication } from './CourierApplication.model.js';

// Системные модели
export { default as Category } from './Category.model.js';
export { default as SystemStats } from './SystemStats.model.js';
export { default as BlockList } from './BlockList.model.js';
export { default as AdminLog } from './AdminLog.model.js';

// Импортируем модели для экспорта по умолчанию
import User from './User.model.js';
import Meta from './Meta.model.js';
import AdminUser from './AdminUser.model.js';
import CustomerProfile from './CustomerProfile.model.js';
import PartnerProfile from './PartnerProfile.model.js';
import CourierProfile from './CourierProfile.model.js';
import Product from './Product.model.js';
import Order from './Order.model.js';
import Review from './Review.model.js';
import Message from './Message.model.js';
import InitialPartnerRequest from './InitialPartnerRequest.model.js';
import PartnerLegalInfo from './PartnerLegalInfo.model.js';
import CourierApplication from './CourierApplication.model.js';
import Category from './Category.model.js';
import SystemStats from './SystemStats.model.js';
import BlockList from './BlockList.model.js';
import AdminLog from './AdminLog.model.js';

// Экспорт для совместимости (если где-то используется старый импорт)
export default {
  User,
  Meta,
  AdminUser,
  CustomerProfile,
  PartnerProfile,
  CourierProfile,
  Product,
  Order,
  Review,
  Message,
  InitialPartnerRequest,
  PartnerLegalInfo,
  CourierApplication,
  Category,
  SystemStats,
  BlockList,
  AdminLog
};