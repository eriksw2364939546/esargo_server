// models/BlockList.model.js (исправленный - ES6 modules)
import mongoose from 'mongoose';

const blockListSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  user_role: {
    type: String,
    required: true,
    enum: ['customer', 'courier', 'partner'],
    index: true
  },
  
  // Информация о блокировке
  block_info: {
    reason: {
      type: String,
      required: true,
      enum: [
        'violation_terms',        // Нарушение условий использования
        'fraud_activity',         // Мошенническая деятельность
        'fake_orders',           // Ложные заказы
        'inappropriate_behavior', // Неподобающее поведение
        'payment_issues',        // Проблемы с оплатой
        'delivery_violations',   // Нарушения при доставке
        'spam_activity',         // Спам активность
        'identity_fraud',        // Поддельные данные
        'repeated_cancellations', // Множественные отмены
        'poor_service_quality',  // Плохое качество обслуживания
        'safety_violations',     // Нарушения безопасности
        'admin_decision',        // Решение администрации
        'legal_issues',          // Юридические проблемы
        'other'                  // Другая причина
      ]
    },
    details: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    severity: {
      type: String,
      required: true,
      enum: ['warning', 'temporary', 'permanent'],
      default: 'temporary'
    }
  },
  
  // Кто заблокировал
  blocked_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true,
    index: true
  },
  blocked_at: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Статус блокировки
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Информация о разблокировке
  unblock_info: {
    unblocked_at: {
      type: Date
    },
    unblocked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    unblock_reason: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // Длительность блокировки
  duration: {
    duration_days: {
      type: Number,
      min: 0
    },
    block_until: {
      type: Date
    },
    auto_unblock: {
      type: Boolean,
      default: true
    }
  },
  
  // Связанные данные
  related_data: {
    order_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }],
    report_ids: [{
      type: mongoose.Schema.Types.ObjectId
    }],
    complaints: [{
      complainant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      complainant_role: {
        type: String,
        enum: ['customer', 'courier', 'partner', 'admin']
      },
      complaint_text: {
        type: String,
        trim: true,
        maxlength: 500
      },
      complaint_date: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Отправка уведомлений
  notification_sent: {
    email_sent: {
      type: Boolean,
      default: false
    },
    sms_sent: {
      type: Boolean,
      default: false
    },
    push_sent: {
      type: Boolean,
      default: false
    },
    notification_date: {
      type: Date
    }
  },
  
  // Апелляция
  appeal: {
    has_appeal: {
      type: Boolean,
      default: false
    },
    appeal_text: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    appeal_date: {
      type: Date
    },
    appeal_status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    appeal_reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    appeal_reviewed_at: {
      type: Date
    },
    appeal_response: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // История изменений
  history: [{
    action: {
      type: String,
      enum: ['blocked', 'unblocked', 'modified', 'appeal_submitted', 'appeal_reviewed'],
      required: true
    },
    performed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true
    },
    performed_at: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    old_values: {
      type: mongoose.Schema.Types.Mixed // Старые значения при изменении
    },
    new_values: {
      type: mongoose.Schema.Types.Mixed // Новые значения при изменении
    }
  }],
  
  // Повторные нарушения
  repeat_offence: {
    is_repeat: {
      type: Boolean,
      default: false
    },
    previous_blocks_count: {
      type: Number,
      default: 0
    },
    escalation_level: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    }
  },
  
  // Метаданные
  source: {
    type: String,
    enum: ['manual', 'automated', 'report_based'],
    default: 'manual'
  },
  ip_address: {
    type: String
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
blockListSchema.index({ user_id: 1, user_role: 1 });
blockListSchema.index({ is_active: 1, blocked_at: -1 });
blockListSchema.index({ 'block_info.reason': 1 });
blockListSchema.index({ 'block_info.severity': 1 });
blockListSchema.index({ blocked_by: 1, blocked_at: -1 });
blockListSchema.index({ 'duration.block_until': 1, 'duration.auto_unblock': 1 });
blockListSchema.index({ 'appeal.appeal_status': 1 });

// Составной индекс для активных блокировок
blockListSchema.index({ 
  is_active: 1, 
  user_role: 1,
  'block_info.severity': 1,
  blocked_at: -1 
});

// Индекс для автоматической разблокировки
blockListSchema.index({ 
  'duration.auto_unblock': 1,
  'duration.block_until': 1,
  is_active: 1
});

// Методы экземпляра

// Разблокировка пользователя
blockListSchema.methods.unblock = function(unblockedBy, reason = '') {
  this.is_active = false;
  this.unblock_info.unblocked_at = new Date();
  this.unblock_info.unblocked_by = unblockedBy;
  this.unblock_info.unblock_reason = reason;
  
  // Добавляем в историю
  this.history.push({
    action: 'unblocked',
    performed_by: unblockedBy,
    notes: reason
  });
  
  return this.save();
};

// Подача апелляции
blockListSchema.methods.submitAppeal = function(appealText) {
  this.appeal.has_appeal = true;
  this.appeal.appeal_text = appealText;
  this.appeal.appeal_date = new Date();
  this.appeal.appeal_status = 'pending';
  
  // Добавляем в историю
  this.history.push({
    action: 'appeal_submitted',
    performed_by: this.user_id,
    notes: 'Пользователь подал апелляцию'
  });
  
  return this.save();
};

// Рассмотрение апелляции
blockListSchema.methods.reviewAppeal = function(adminId, status, response = '') {
  this.appeal.appeal_status = status;
  this.appeal.appeal_reviewed_by = adminId;
  this.appeal.appeal_reviewed_at = new Date();
  this.appeal.appeal_response = response;
  
  // Если апелляция одобрена, разблокируем пользователя
  if (status === 'approved') {
    this.unblock(adminId, 'Апелляция одобрена');
  }
  
  // Добавляем в историю
  this.history.push({
    action: 'appeal_reviewed',
    performed_by: adminId,
    notes: `Апелляция ${status === 'approved' ? 'одобрена' : 'отклонена'}: ${response}`
  });
  
  return this.save();
};

// Изменение блокировки
blockListSchema.methods.modify = function(adminId, changes, notes = '') {
  const oldValues = {
    reason: this.block_info.reason,
    severity: this.block_info.severity,
    block_until: this.duration.block_until
  };
  
  // Применяем изменения
  if (changes.reason) this.block_info.reason = changes.reason;
  if (changes.severity) this.block_info.severity = changes.severity;
  if (changes.details) this.block_info.details = changes.details;
  if (changes.block_until) this.duration.block_until = changes.block_until;
  if (changes.duration_days) this.duration.duration_days = changes.duration_days;
  
  // Добавляем в историю
  this.history.push({
    action: 'modified',
    performed_by: adminId,
    notes: notes,
    old_values: oldValues,
    new_values: changes
  });
  
  return this.save();
};

// Добавление жалобы
blockListSchema.methods.addComplaint = function(complainantId, complainantRole, complaintText) {
  this.related_data.complaints.push({
    complainant_id: complainantId,
    complainant_role: complainantRole,
    complaint_text: complaintText,
    complaint_date: new Date()
  });
  
  return this.save();
};

// Проверка истек ли срок блокировки
blockListSchema.methods.isExpired = function() {
  if (!this.duration.block_until || !this.is_active) {
    return false;
  }
  return new Date() > this.duration.block_until;
};

// Отправка уведомления
blockListSchema.methods.sendNotification = function(channels = ['email']) {
  channels.forEach(channel => {
    switch(channel) {
      case 'email':
        this.notification_sent.email_sent = true;
        break;
      case 'sms':
        this.notification_sent.sms_sent = true;
        break;
      case 'push':
        this.notification_sent.push_sent = true;
        break;
    }
  });
  
  this.notification_sent.notification_date = new Date();
  return this.save();
};

// Статические методы

// Создание новой блокировки
blockListSchema.statics.createBlock = async function(userId, userRole, reason, details, adminId, options = {}) {
  // Проверяем предыдущие блокировки
  const previousBlocks = await this.countDocuments({ user_id: userId, user_role: userRole });
  
  const blockData = {
    user_id: userId,
    user_role: userRole,
    block_info: {
      reason,
      details,
      severity: options.severity || 'temporary'
    },
    blocked_by: adminId,
    blocked_at: new Date(),
    duration: {
      duration_days: options.duration_days,
      block_until: options.block_until,
      auto_unblock: options.auto_unblock !== false
    },
    repeat_offence: {
      is_repeat: previousBlocks > 0,
      previous_blocks_count: previousBlocks,
      escalation_level: Math.min(previousBlocks + 1, 5)
    },
    related_data: {
      order_ids: options.order_ids || [],
      report_ids: options.report_ids || []
    },
    source: options.source || 'manual',
    ip_address: options.ip_address,
    history: [{
      action: 'blocked',
      performed_by: adminId,
      performed_at: new Date(),
      notes: details
    }]
  };
  
  // Вычисляем срок блокировки если не указан
  if (!blockData.duration.block_until && blockData.duration.duration_days) {
    const blockUntil = new Date();
    blockUntil.setDate(blockUntil.getDate() + blockData.duration.duration_days);
    blockData.duration.block_until = blockUntil;
  }
  
  return this.create(blockData);
};

// Получение активных блокировок
blockListSchema.statics.findActiveBlocks = function(filters = {}) {
  const query = { is_active: true, ...filters };
  return this.find(query)
    .populate('user_id', 'email')
    .populate('blocked_by', 'email first_name last_name')
    .sort({ blocked_at: -1 });
};

// Получение истекших блокировок для автоматической разблокировки
blockListSchema.statics.findExpiredBlocks = function() {
  return this.find({
    is_active: true,
    'duration.auto_unblock': true,
    'duration.block_until': { $lt: new Date() }
  });
};

// Статистика блокировок
blockListSchema.statics.getBlockingStats = function(period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  return this.aggregate([
    {
      $match: {
        blocked_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          user_role: '$user_role',
          reason: '$block_info.reason'
        },
        count: { $sum: 1 },
        active_count: { $sum: { $cond: ['$is_active', 1, 0] } }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Поиск повторных нарушителей
blockListSchema.statics.findRepeatOffenders = function(minBlocks = 3) {
  return this.aggregate([
    {
      $group: {
        _id: { user_id: '$user_id', user_role: '$user_role' },
        blocks_count: { $sum: 1 },
        active_blocks: { $sum: { $cond: ['$is_active', 1, 0] } },
        latest_block: { $max: '$blocked_at' },
        reasons: { $push: '$block_info.reason' }
      }
    },
    {
      $match: {
        blocks_count: { $gte: minBlocks }
      }
    },
    {
      $sort: { blocks_count: -1, latest_block: -1 }
    }
  ]);
};

// Получение трендов блокировок
blockListSchema.statics.getBlockingTrends = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        blocked_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$blocked_at' } },
          user_role: '$user_role'
        },
        blocks_count: { $sum: 1 },
        reasons: { $push: '$block_info.reason' }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ]);
};

// Проверка заблокирован ли пользователь
blockListSchema.statics.isUserBlocked = async function(userId, userRole) {
  const activeBlock = await this.findOne({
    user_id: userId,
    user_role: userRole,
    is_active: true
  });
  
  if (!activeBlock) {
    return { blocked: false };
  }
  
  // Проверяем не истек ли срок
  if (activeBlock.isExpired()) {
    if (activeBlock.duration.auto_unblock) {
      await activeBlock.unblock(null, 'Автоматическая разблокировка по истечении срока');
      return { blocked: false };
    }
  }
  
  return {
    blocked: true,
    reason: activeBlock.block_info.reason,
    details: activeBlock.block_info.details,
    severity: activeBlock.block_info.severity,
    blocked_at: activeBlock.blocked_at,
    block_until: activeBlock.duration.block_until,
    can_appeal: !activeBlock.appeal.has_appeal
  };
};

// 🆕 ИСПРАВЛЕНО: ES6 export
const BlockList = mongoose.model('BlockList', blockListSchema);
export default BlockList;