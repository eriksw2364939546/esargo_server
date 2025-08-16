// indexForModels.js
module.exports = {
  // Базовая аутентификация
  User: require('./User.model'),

  // Профили пользователей
  CustomerProfile: require('./CustomerProfile.model'),       // Профиль покупателя
  PartnerProfile: require('./PartnerProfile.model'),         // Профиль ресторана/магазина
  CourierProfile: require('./CourierProfile.model'),         // Профиль курьера

  // Товары и заказы
  Product: require('./Product.model'),                       // Товары/блюда
  Order: require('./Order.model'),                           // Заказы (один партнер)
  Review: require('./Review.model'),                         // Отзывы (только рейтинг)
  Message: require('./Message.model'),                       // Чат по заказам

  // Администрирование
  AdminUser: require('./AdminUser.model'),                   // Администраторы
  InitialPartnerRequest: require('./InitialPartnerRequest.model'), // Первичные заявки партнёров
  PartnerLegalInfo: require('./PartnerLegalInfo.model'),     // Юридические данные партнёров
  CourierApplication: require('./CourierApplication.model'), // Заявки курьеров
  BlockList: require('./BlockList.model'),                   // Блокировки пользователей
  AdminLog: require('./AdminLog.model'),                     // Логи действий админов

  // Системные модели
  Category: require('./Category.model'),                     // Категории (рестораны/магазины)
  SystemStats: require('./SystemStats.model')                 // Статистика для dashboard
};
