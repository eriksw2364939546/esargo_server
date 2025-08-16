// models/index.js (обновленный)
module.exports = {
  // Базовая аутентификация
  User: require('./User.model'),
  Meta: require('./Meta.model'), // ← НОВАЯ МОДЕЛЬ для безопасности

  // Профили пользователей
  CustomerProfile: require('./CustomerProfile.model'),       
  PartnerProfile: require('./PartnerProfile.model'),         
  CourierProfile: require('./CourierProfile.model'),         

  // Товары и заказы
  Product: require('./Product.model'),                       
  Order: require('./Order.model'),                           
  Review: require('./Review.model'),                         
  Message: require('./Message.model'),                       

  // Администрирование
  AdminUser: require('./AdminUser.model'),                   
  InitialPartnerRequest: require('./InitialPartnerRequest.model'), 
  PartnerLegalInfo: require('./PartnerLegalInfo.model'),     
  CourierApplication: require('./CourierApplication.model'), 
  BlockList: require('./BlockList.model'),                   
  AdminLog: require('./AdminLog.model'),                     

  // Системные модели
  Category: require('./Category.model'),                     
  SystemStats: require('./SystemStats.model')                 
};