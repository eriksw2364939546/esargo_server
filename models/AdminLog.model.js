// models/AdminLog.model.js (исправленный - ES6 modules)
import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true,
    index: true
  },
  
  // Тип действия
  action: {
    type: String,
    required: true,
    enum: [
      // Действия с партнерами
      'partner_request_approved',
      'partner_request_rejected',
      'partner_profile_updated',
      'partner_blocked',
      'partner_unblocked',
      'partner_deleted',
      
      // Действия с курьерами
      'courier_application_approved',
      'courier_application_rejected',
      'courier_profile_updated',
      'courier_blocked',
      'courier_unblocked',
      'courier_deleted',
      
      // Действия с клиентами
      'customer_blocked',
      'customer_unblocked',
      'customer_profile_updated',
      'customer_deleted',
      
      // Действия с заказами
      'order_cancelled_by_admin',
      'order_status_changed',
      'order_refunded',
      'order_dispute_resolved',
      
      // Действия с отзывами
      'review_hidden',
      'review_restored',
      'review_deleted',
      'review_flagged',
      
      // Действия с сообщениями
      'message_hidden',
      'message_deleted',
      'message_flagged',
      'chat_moderated',
      
      // Действия с блокировками
      'user_blocked',
      'user_unblocked',
      'block_appeal_reviewed',
      'block_modified',
      
      // Системные действия
      'category_created',
      'category_updated',
      'category_deleted',
      'system_settings_updated',
      
      // Действия с админами
      'admin_created',
      'admin_updated',
      'admin_permissions_changed',
      'admin_blocked',
      'admin_deleted',
      
      // Действия с продуктами
      'product_flagged',
      'product_unflagged',
      'product_deleted',
      
      // Безопасность
      'login_attempt',
      'login_success',
      'login_failed',
      'password_changed',
      'permissions_escalated',
      
      // Другие действия
      'data_exported',
      'bulk_operation',
      'maintenance_mode',
      'other'
    ],
    index: true
  },
  
  // Целевой объект действия
  target_type: {
    type: String,
    required: true,
    enum: [
      'User',
      'CustomerProfile', 
      'PartnerProfile',
      'CourierProfile',
      'PartnerRequest',
      'CourierApplication',
      'Order',
      'Product',
      'Review',
      'Message',
      'BlockList',
      'Category',
      'AdminUser',
      'System'
    ],
    index: true
  },
  target_id: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  target_name: {
    type: String,
    trim: true // Название объекта для удобства поиска
  },
  
  // Детали действия
  details: {
    // Описание действия
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    
    // Причина действия
    reason: {
      type: String,
      trim: true,
      maxlength: 300
    },
    
    // Старые значения (до изменения)
    old_values: {
      type: mongoose.Schema.Types.Mixed
    },
    
    // Новые значения (после изменения)
    new_values: {
      type: mongoose.Schema.Types.Mixed
    },
    
    // Дополнительные метаданные
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  
  // Результат действия
  result: {
    status: {
      type: String,
      enum: ['success', 'failed', 'partial'],
      default: 'success',
      index: true
    },
    error_message: {
      type: String,
      trim: true
    },
    affected_count: {
      type: Number,
      default: 1 // Количество затронутых объектов
    }
  },
  
  // Контекст выполнения
  context: {
    // IP адрес
    ip_address: {
      type: String,
      index: true
    },
    
    // User Agent
    user_agent: {
      type: String
    },
    
    // Источник действия
    source: {
      type: String,
      enum: ['web_admin', 'api', 'system', 'mobile_admin', 'automated'],
      default: 'web_admin'
    },
    
    // Сессия админа
    session_id: {
      type: String
    },
    
    // Время выполнения действия (в миллисекундах)
    execution_time: {
      type: Number
    },
    
    // Связанные объекты
    related_objects: [{
      type: {
        type: String,
        enum: [
          'User', 'CustomerProfile', 'PartnerProfile', 'CourierProfile',
          'Order', 'Product', 'Review', 'Message', 'BlockList'
        ]
      },
      id: {
        type: mongoose.Schema.Types.ObjectId
      },
      name: {
        type: String,
        trim: true
      }
    }]
  },
  
  // Уровень важности
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  // Категоризация для отчетов
  category: {
    type: String,
    enum: [
      'user_management',
      'content_moderation', 
      'order_management',
      'security',
      'system_administration',
      'data_management',
      'business_operations'
    ],
    index: true
  },
  
  // Флаги
  flags: {
    // Требует ли действие уведомления других админов
    requires_notification: {
      type: Boolean,
      default: false
    },
    
    // Чувствительное действие (требует дополнительного логирования)
    sensitive: {
      type: Boolean,
      default: false
    },
    
    // Действие выполнено автоматически
    automated: {
      type: Boolean,
      default: false
    },
    
    // Массовое действие
    bulk_operation: {
      type: Boolean,
      default: false
    },
    
    // Действие было отменено
    reversed: {
      type: Boolean,
      default: false
    }
  },
  
  // Информация об отмене действия
  reversal_info: {
    reversed_at: {
      type: Date
    },
    reversed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reversal_reason: {
      type: String,
      trim: true
    },
    reversal_log_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminLog' // Ссылка на лог записи об отмене
    }
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
adminLogSchema.index({ admin_id: 1, createdAt: -1 });
adminLogSchema.index({ action: 1, createdAt: -1 });
adminLogSchema.index({ target_type: 1, target_id: 1 });
adminLogSchema.index({ category: 1, severity: 1 });
adminLogSchema.index({ 'result.status': 1 });
adminLogSchema.index({ 'context.ip_address': 1 });
adminLogSchema.index({ createdAt: -1 });

// Составной индекс для отчетов
adminLogSchema.index({ 
  category: 1, 
  action: 1, 
  'result.status': 1,
  createdAt: -1 
});

// Индекс для поиска по дате и админу
adminLogSchema.index({ 
  admin_id: 1, 
  createdAt: -1,
  category: 1 
});

// Индекс для чувствительных действий
adminLogSchema.index({ 
  'flags.sensitive': 1,
  severity: 1,
  createdAt: -1 
});

// Методы экземпляра

// Отмена действия
adminLogSchema.methods.reverse = function(reversedBy, reason) {
  this.flags.reversed = true;
  this.reversal_info.reversed_at = new Date();
  this.reversal_info.reversed_by = reversedBy;
  this.reversal_info.reversal_reason = reason;
  
  return this.save();
};

// Добавление связанного объекта
adminLogSchema.methods.addRelatedObject = function(type, id, name) {
  this.context.related_objects.push({ type, id, name });
  return this.save();
};

// Обновление результата
adminLogSchema.methods.updateResult = function(status, errorMessage = null, affectedCount = 1) {
  this.result.status = status;
  this.result.error_message = errorMessage;
  this.result.affected_count = affectedCount;
  
  return this.save();
};

// Статические методы

// Создание лога
adminLogSchema.statics.createLog = function(logData) {
  // Автоматическое определение категории по действию
  if (!logData.category) {
    logData.category = this.getCategoryByAction(logData.action);
  }
  
  // Автоматическое определение уровня важности
  if (!logData.severity) {
    logData.severity = this.getSeverityByAction(logData.action);
  }
  
  return this.create(logData);
};

// Определение категории по действию
adminLogSchema.statics.getCategoryByAction = function(action) {
  const categoryMap = {
    'partner_request_approved': 'user_management',
    'partner_request_rejected': 'user_management',
    'courier_application_approved': 'user_management',
    'courier_application_rejected': 'user_management',
    'customer_blocked': 'user_management',
    'review_hidden': 'content_moderation',
    'message_deleted': 'content_moderation',
    'order_cancelled_by_admin': 'order_management',
    'order_refunded': 'order_management',
    'login_failed': 'security',
    'permissions_escalated': 'security',
    'system_settings_updated': 'system_administration',
    'data_exported': 'data_management'
  };
  
  return categoryMap[action] || 'business_operations';
};

// Определение уровня важности по действию
adminLogSchema.statics.getSeverityByAction = function(action) {
  const criticalActions = [
    'admin_deleted', 'system_settings_updated', 'permissions_escalated',
    'data_exported', 'maintenance_mode'
  ];
  
  const highActions = [
    'partner_deleted', 'courier_deleted', 'customer_deleted',
    'order_refunded', 'admin_created', 'admin_permissions_changed'
  ];
  
  const lowActions = [
    'login_success', 'review_flagged', 'message_flagged'
  ];
  
  if (criticalActions.includes(action)) return 'critical';
  if (highActions.includes(action)) return 'high';
  if (lowActions.includes(action)) return 'low';
  
  return 'medium';
};

// Поиск логов админа
adminLogSchema.statics.findByAdmin = function(adminId, limit = 100) {
  return this.find({ admin_id: adminId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Поиск логов по действию
adminLogSchema.statics.findByAction = function(action, limit = 100) {
  return this.find({ action })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Поиск логов по целевому объекту
adminLogSchema.statics.findByTarget = function(targetType, targetId) {
  return this.find({ 
    target_type: targetType, 
    target_id: targetId 
  }).sort({ createdAt: -1 });
};

// Поиск логов по категории
adminLogSchema.statics.findByCategory = function(category, limit = 100) {
  return this.find({ category })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Поиск чувствительных действий
adminLogSchema.statics.findSensitive = function(limit = 100) {
  return this.find({ 'flags.sensitive': true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Поиск неудачных действий
adminLogSchema.statics.findFailed = function(limit = 100) {
  return this.find({ 'result.status': 'failed' })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Статистика активности админов
adminLogSchema.statics.getAdminActivityStats = function(period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$admin_id',
        total_actions: { $sum: 1 },
        successful_actions: {
          $sum: { $cond: [{ $eq: ['$result.status', 'success'] }, 1, 0] }
        },
        failed_actions: {
          $sum: { $cond: [{ $eq: ['$result.status', 'failed'] }, 1, 0] }
        },
        categories: { $addToSet: '$category' },
        last_activity: { $max: '$createdAt' },
        sensitive_actions: {
          $sum: { $cond: ['$flags.sensitive', 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: 'adminusers',
        localField: '_id',
        foreignField: '_id',
        as: 'admin_info'
      }
    },
    {
      $unwind: '$admin_info'
    },
    {
      $project: {
        admin_name: '$admin_info.full_name',
        admin_email: '$admin_info.email',
        total_actions: 1,
        successful_actions: 1,
        failed_actions: 1,
        success_rate: {
          $multiply: [
            { $divide: ['$successful_actions', '$total_actions'] },
            100
          ]
        },
        categories: 1,
        last_activity: 1,
        sensitive_actions: 1
      }
    },
    {
      $sort: { total_actions: -1 }
    }
  ]);
};

// Статистика по действиям
adminLogSchema.statics.getActionStats = function(period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          action: '$action',
          category: '$category',
          severity: '$severity'
        },
        count: { $sum: 1 },
        success_count: {
          $sum: { $cond: [{ $eq: ['$result.status', 'success'] }, 1, 0] }
        },
        unique_admins: { $addToSet: '$admin_id' },
        avg_execution_time: { $avg: '$context.execution_time' }
      }
    },
    {
      $project: {
        action: '$_id.action',
        category: '$_id.category',
        severity: '$_id.severity',
        count: 1,
        success_rate: {
          $multiply: [
            { $divide: ['$success_count', '$count'] },
            100
          ]
        },
        unique_admins_count: { $size: '$unique_admins' },
        avg_execution_time: { $round: ['$avg_execution_time', 2] }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Очистка старых логов
adminLogSchema.statics.cleanOldLogs = function(daysOld = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  // Не удаляем чувствительные логи и критические действия
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    'flags.sensitive': false,
    severity: { $nin: ['critical', 'high'] }
  });
};

// 🆕 ИСПРАВЛЕНО: ES6 export
const AdminLog = mongoose.model('AdminLog', adminLogSchema);
export default AdminLog;