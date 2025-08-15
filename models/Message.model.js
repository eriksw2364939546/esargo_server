// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true // Привязка к заказу
  },
  
  // Отправитель сообщения
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  sender_role: {
    type: String,
    required: true,
    enum: ['customer', 'courier', 'partner', 'admin', 'system'],
    index: true
  },
  
  // Получатель сообщения
  receiver_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  receiver_role: {
    type: String,
    required: true,
    enum: ['customer', 'courier', 'partner', 'admin', 'support'],
    index: true
  },
  
  // Содержимое сообщения
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  
  // Тип сообщения
  message_type: {
    type: String,
    required: true,
    enum: [
      'text',           // Обычное текстовое сообщение
      'system',         // Системное сообщение (автоматическое)
      'image',          // Изображение
      'location',       // Геолокация
      'order_update',   // Обновление статуса заказа
      'notification'    // Уведомление
    ],
    default: 'text',
    index: true
  },
  
  // Дополнительные данные в зависимости от типа сообщения
  message_data: {
    // Для изображений
    image_url: {
      type: String
    },
    image_thumbnail_url: {
      type: String
    },
    
    // Для геолокации
    location: {
      lat: {
        type: Number
      },
      lng: {
        type: Number
      },
      address: {
        type: String,
        trim: true
      }
    },
    
    // Для системных сообщений об обновлении заказа
    order_update: {
      old_status: {
        type: String,
        enum: [
          'pending', 'accepted', 'preparing', 'ready', 
          'picked_up', 'on_the_way', 'delivered', 'cancelled'
        ]
      },
      new_status: {
        type: String,
        enum: [
          'pending', 'accepted', 'preparing', 'ready', 
          'picked_up', 'on_the_way', 'delivered', 'cancelled'
        ]
      },
      estimated_time: {
        type: String // "15 минут", "Скоро"
      }
    },
    
    // Для уведомлений
    notification_data: {
      title: {
        type: String,
        trim: true
      },
      action_url: {
        type: String
      },
      priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
      }
    }
  },
  
  // Статус прочтения
  is_read: {
    type: Boolean,
    default: false,
    index: true
  },
  read_at: {
    type: Date
  },
  
  // Статус доставки (для мобильных приложений)
  delivery_status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending',
    index: true
  },
  delivered_at: {
    type: Date
  },
  
  // Редактирование сообщения
  is_edited: {
    type: Boolean,
    default: false
  },
  edited_at: {
    type: Date
  },
  original_content: {
    type: String // Сохраняем оригинал при редактировании
  },
  
  // Удаление сообщения
  is_deleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deleted_at: {
    type: Date
  },
  deleted_by: {
    type: mongoose.Schema.Types.ObjectId
  },
  delete_reason: {
    type: String,
    enum: ['user_request', 'admin_moderation', 'spam', 'inappropriate'],
  },
  
  // Модерация сообщения
  moderation: {
    is_flagged: {
      type: Boolean,
      default: false,
      index: true
    },
    flagged_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    flagged_reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'offensive', 'harassment']
    },
    flagged_at: {
      type: Date
    },
    is_reviewed: {
      type: Boolean,
      default: false
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reviewed_at: {
      type: Date
    },
    review_action: {
      type: String,
      enum: ['approved', 'hidden', 'deleted', 'warning_sent']
    }
  },
  
  // Ответ на сообщение
  reply_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Реакции на сообщение (эмодзи)
  reactions: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    user_role: {
      type: String,
      required: true,
      enum: ['customer', 'courier', 'partner', 'admin']
    },
    emoji: {
      type: String,
      required: true,
      maxlength: 2
    },
    reacted_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Метаданные
  source: {
    type: String,
    enum: ['web', 'mobile_app', 'system'],
    default: 'web'
  },
  ip_address: {
    type: String
  },
  user_agent: {
    type: String
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
messageSchema.index({ order_id: 1, createdAt: -1 });
messageSchema.index({ sender_id: 1, sender_role: 1 });
messageSchema.index({ receiver_id: 1, receiver_role: 1 });
messageSchema.index({ is_read: 1, receiver_id: 1 });
messageSchema.index({ message_type: 1 });
messageSchema.index({ delivery_status: 1 });
messageSchema.index({ is_deleted: 1 });

// Составной индекс для чата заказа
messageSchema.index({ 
  order_id: 1, 
  is_deleted: 1,
  createdAt: 1 
});

// Индекс для непрочитанных сообщений
messageSchema.index({ 
  receiver_id: 1, 
  is_read: 1,
  is_deleted: 1,
  createdAt: -1 
});

// Индекс для модерации
messageSchema.index({ 
  'moderation.is_flagged': 1,
  'moderation.is_reviewed': 1,
  createdAt: -1 
});

// Методы экземпляра

// Отметка сообщения как прочитанное
messageSchema.methods.markAsRead = function() {
  if (!this.is_read) {
    this.is_read = true;
    this.read_at = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Редактирование сообщения
messageSchema.methods.editContent = function(newContent) {
  if (this.message_type !== 'text') {
    throw new Error('Можно редактировать только текстовые сообщения');
  }
  
  this.original_content = this.content;
  this.content = newContent;
  this.is_edited = true;
  this.edited_at = new Date();
  
  return this.save();
};

// Удаление сообщения
messageSchema.methods.deleteMessage = function(deletedBy, reason = 'user_request') {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.deleted_by = deletedBy;
  this.delete_reason = reason;
  
  return this.save();
};

// Восстановление сообщения
messageSchema.methods.restoreMessage = function() {
  this.is_deleted = false;
  this.deleted_at = undefined;
  this.deleted_by = undefined;
  this.delete_reason = undefined;
  
  return this.save();
};

// Пометка как спам
messageSchema.methods.flagAsSpam = function(flaggedBy, reason = 'spam') {
  this.moderation.is_flagged = true;
  this.moderation.flagged_by = flaggedBy;
  this.moderation.flagged_reason = reason;
  this.moderation.flagged_at = new Date();
  
  return this.save();
};

// Модерация сообщения
messageSchema.methods.moderateMessage = function(reviewedBy, action) {
  this.moderation.is_reviewed = true;
  this.moderation.reviewed_by = reviewedBy;
  this.moderation.reviewed_at = new Date();
  this.moderation.review_action = action;
  
  if (action === 'deleted' || action === 'hidden') {
    this.is_deleted = true;
    this.deleted_at = new Date();
    this.delete_reason = 'admin_moderation';
  }
  
  return this.save();
};

// Добавление реакции
messageSchema.methods.addReaction = function(userId, userRole, emoji) {
  // Проверяем есть ли уже реакция от этого пользователя
  const existingReactionIndex = this.reactions.findIndex(r => 
    r.user_id.equals(userId) && r.emoji === emoji
  );
  
  if (existingReactionIndex !== -1) {
    // Удаляем существующую реакцию (toggle)
    this.reactions.splice(existingReactionIndex, 1);
  } else {
    // Удаляем другие реакции этого пользователя
    this.reactions = this.reactions.filter(r => !r.user_id.equals(userId));
    
    // Добавляем новую реакцию
    this.reactions.push({
      user_id: userId,
      user_role: userRole,
      emoji: emoji,
      reacted_at: new Date()
    });
  }
  
  return this.save();
};

// Удаление реакции
messageSchema.methods.removeReaction = function(userId, emoji = null) {
  if (emoji) {
    this.reactions = this.reactions.filter(r => 
      !(r.user_id.equals(userId) && r.emoji === emoji)
    );
  } else {
    // Удаляем все реакции пользователя
    this.reactions = this.reactions.filter(r => !r.user_id.equals(userId));
  }
  
  return this.save();
};

// Статические методы

// Получение чата заказа
messageSchema.statics.getChatByOrder = function(orderId, includeDeleted = false) {
  const filter = { order_id: orderId };
  if (!includeDeleted) {
    filter.is_deleted = false;
  }
  return this.find(filter).sort({ createdAt: 1 });
};

// Получение непрочитанных сообщений пользователя
messageSchema.statics.getUnreadMessages = function(userId, userRole) {
  return this.find({
    receiver_id: userId,
    receiver_role: userRole,
    is_read: false,
    is_deleted: false
  }).sort({ createdAt: -1 });
};

// Подсчет непрочитанных сообщений
messageSchema.statics.countUnreadMessages = function(userId, userRole) {
  return this.countDocuments({
    receiver_id: userId,
    receiver_role: userRole,
    is_read: false,
    is_deleted: false
  });
};

// Отметка всех сообщений чата как прочитанные
messageSchema.statics.markChatAsRead = function(orderId, userId, userRole) {
  return this.updateMany({
    order_id: orderId,
    receiver_id: userId,
    receiver_role: userRole,
    is_read: false,
    is_deleted: false
  }, {
    $set: {
      is_read: true,
      read_at: new Date()
    }
  });
};

// Создание системного сообщения
messageSchema.statics.createSystemMessage = function(orderId, receiverId, receiverRole, content, messageData = {}) {
  return this.create({
    order_id: orderId,
    sender_id: new mongoose.Types.ObjectId(), // Системный отправитель
    sender_role: 'system',
    receiver_id: receiverId,
    receiver_role: receiverRole,
    content: content,
    message_type: 'system',
    message_data: messageData,
    delivery_status: 'delivered',
    delivered_at: new Date(),
    source: 'system'
  });
};

// Создание сообщения об обновлении заказа
messageSchema.statics.createOrderUpdateMessage = function(orderId, receiverId, receiverRole, oldStatus, newStatus, estimatedTime = null) {
  const statusMessages = {
    'accepted': 'Ваш заказ принят в обработку',
    'preparing': 'Ваш заказ готовится',
    'ready': 'Ваш заказ готов и ожидает курьера',
    'picked_up': 'Курьер забрал ваш заказ',
    'on_the_way': 'Курьер направляется к вам',
    'delivered': 'Ваш заказ доставлен',
    'cancelled': 'Ваш заказ отменен'
  };
  
  return this.createSystemMessage(
    orderId,
    receiverId,
    receiverRole,
    statusMessages[newStatus] || `Статус заказа изменен на ${newStatus}`,
    {
      order_update: {
        old_status: oldStatus,
        new_status: newStatus,
        estimated_time: estimatedTime
      }
    }
  );
};

// Поиск сообщений требующих модерации
messageSchema.statics.findPendingModeration = function() {
  return this.find({
    'moderation.is_flagged': true,
    'moderation.is_reviewed': false,
    is_deleted: false
  }).sort({ 'moderation.flagged_at': 1 });
};

// Получение статистики сообщений за период
messageSchema.statics.getStatsForPeriod = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        is_deleted: false
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        total_messages: { $sum: 1 },
        text_messages: {
          $sum: { $cond: [{ $eq: ['$message_type', 'text'] }, 1, 0] }
        },
        system_messages: {
          $sum: { $cond: [{ $eq: ['$message_type', 'system'] }, 1, 0] }
        },
        flagged_messages: {
          $sum: { $cond: ['$moderation.is_flagged', 1, 0] }
        },
        by_role: {
          $push: '$sender_role'
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Поиск активных чатов
messageSchema.statics.findActiveChats = function(userId, userRole, limit = 20) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { sender_id: userId, sender_role: userRole },
          { receiver_id: userId, receiver_role: userRole }
        ],
        is_deleted: false
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$order_id',
        last_message: { $first: '$ROOT' },
        unread_count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiver_id', userId] },
                  { $eq: ['$receiver_role', userRole] },
                  { $eq: ['$is_read', false] }
                ]
              },
              1,
              0
            ]
          }
        },
        total_messages: { $sum: 1 }
      }
    },
    {
      $sort: { 'last_message.createdAt': -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: '_id',
        as: 'order'
      }
    },
    {
      $unwind: '$order'
    }
  ]);
};

// Очистка старых сообщений (для cron задач)
messageSchema.statics.cleanOldMessages = function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    is_deleted: true
  });
};

// Очистка старых системных сообщений
messageSchema.statics.cleanOldSystemMessages = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    message_type: 'system'
  });
};

module.exports = mongoose.model('Message', messageSchema);