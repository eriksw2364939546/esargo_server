// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerProfile',
    required: true,
    index: true
  },
  partner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerProfile',
    required: true,
    index: true
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true, // Один отзыв на заказ
    index: true
  },
  
  // ТОЛЬКО рейтинг (без комментариев!)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: function(value) {
        return Number.isInteger(value);
      },
      message: 'Рейтинг должен быть целым числом от 1 до 5'
    }
  },
  
  // Дополнительные данные для аналитики
  review_data: {
    // Время между доставкой и отзывом
    review_delay_hours: {
      type: Number,
      min: 0
    },
    
    // Заказанные товары (для анализа связи рейтинга с товарами)
    ordered_items: [{
      product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      product_title: {
        type: String,
        trim: true
      },
      quantity: {
        type: Number,
        min: 1
      }
    }],
    
    // Информация о доставке для анализа
    delivery_info: {
      actual_delivery_time: {
        type: Number // в минутах
      },
      was_on_time: {
        type: Boolean
      },
      courier_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourierProfile'
      }
    }
  },
  
  // Статус отзыва
  status: {
    type: String,
    enum: ['active', 'hidden', 'disputed'],
    default: 'active',
    index: true
  },
  
  // Модерация отзыва
  moderation: {
    is_verified: {
      type: Boolean,
      default: true // Автоматически верифицированы так как только рейтинг
    },
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    verified_at: {
      type: Date,
      default: Date.now
    },
    hide_reason: {
      type: String,
      enum: ['fake_review', 'inappropriate_rating', 'spam', 'admin_decision']
    },
    hidden_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    hidden_at: {
      type: Date
    }
  },
  
  // Реакция партнера на отзыв
  partner_response: {
    has_response: {
      type: Boolean,
      default: false
    },
    response_text: {
      type: String,
      trim: true,
      maxlength: 300
    },
    responded_at: {
      type: Date
    },
    responded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Полезность отзыва (лайки от других пользователей)
  helpfulness: {
    helpful_count: {
      type: Number,
      default: 0
    },
    not_helpful_count: {
      type: Number,
      default: 0
    },
    voted_by: [{
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerProfile'
      },
      vote: {
        type: String,
        enum: ['helpful', 'not_helpful']
      },
      voted_at: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Метаданные
  source: {
    type: String,
    enum: ['web', 'mobile_app', 'email_link'],
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
reviewSchema.index({ customer_id: 1, partner_id: 1 });
reviewSchema.index({ partner_id: 1, status: 1, rating: -1 });
reviewSchema.index({ order_id: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ status: 1 });

// Составной индекс для поиска отзывов партнера
reviewSchema.index({ 
  partner_id: 1, 
  status: 1, 
  'moderation.is_verified': 1,
  createdAt: -1 
});

// Индекс для модерации
reviewSchema.index({ 
  'moderation.is_verified': 1,
  status: 1,
  createdAt: -1 
});

// Методы экземпляра

// Скрытие отзыва модератором
reviewSchema.methods.hideReview = function(reason, hiddenBy) {
  this.status = 'hidden';
  this.moderation.hide_reason = reason;
  this.moderation.hidden_by = hiddenBy;
  this.moderation.hidden_at = new Date();
  
  return this.save();
};

// Восстановление отзыва
reviewSchema.methods.restoreReview = function() {
  this.status = 'active';
  this.moderation.hide_reason = undefined;
  this.moderation.hidden_by = undefined;
  this.moderation.hidden_at = undefined;
  
  return this.save();
};

// Добавление ответа партнера
reviewSchema.methods.addPartnerResponse = function(responseText, respondedBy) {
  this.partner_response.has_response = true;
  this.partner_response.response_text = responseText;
  this.partner_response.responded_at = new Date();
  this.partner_response.responded_by = respondedBy;
  
  return this.save();
};

// Удаление ответа партнера
reviewSchema.methods.removePartnerResponse = function() {
  this.partner_response.has_response = false;
  this.partner_response.response_text = undefined;
  this.partner_response.responded_at = undefined;
  this.partner_response.responded_by = undefined;
  
  return this.save();
};

// Голосование за полезность отзыва
reviewSchema.methods.voteHelpfulness = function(userId, vote) {
  // Проверяем не голосовал ли уже этот пользователь
  const existingVote = this.helpfulness.voted_by.find(v => v.user_id.equals(userId));
  
  if (existingVote) {
    // Если голос изменился, обновляем счетчики
    if (existingVote.vote !== vote) {
      if (existingVote.vote === 'helpful') {
        this.helpfulness.helpful_count--;
      } else {
        this.helpfulness.not_helpful_count--;
      }
      
      if (vote === 'helpful') {
        this.helpfulness.helpful_count++;
      } else {
        this.helpfulness.not_helpful_count++;
      }
      
      existingVote.vote = vote;
      existingVote.voted_at = new Date();
    }
  } else {
    // Новый голос
    this.helpfulness.voted_by.push({
      user_id: userId,
      vote: vote,
      voted_at: new Date()
    });
    
    if (vote === 'helpful') {
      this.helpfulness.helpful_count++;
    } else {
      this.helpfulness.not_helpful_count++;
    }
  }
  
  return this.save();
};

// Удаление голоса пользователя
reviewSchema.methods.removeVote = function(userId) {
  const voteIndex = this.helpfulness.voted_by.findIndex(v => v.user_id.equals(userId));
  
  if (voteIndex !== -1) {
    const vote = this.helpfulness.voted_by[voteIndex];
    
    if (vote.vote === 'helpful') {
      this.helpfulness.helpful_count--;
    } else {
      this.helpfulness.not_helpful_count--;
    }
    
    this.helpfulness.voted_by.splice(voteIndex, 1);
  }
  
  return this.save();
};

// Расчет задержки между доставкой и отзывом
reviewSchema.methods.calculateReviewDelay = function(deliveredAt) {
  if (deliveredAt) {
    const delayMs = this.createdAt - deliveredAt;
    this.review_data.review_delay_hours = Math.round(delayMs / (1000 * 60 * 60 * 1000));
  }
  
  return this.save();
};

// Статические методы

// Поиск отзывов партнера
reviewSchema.statics.findByPartner = function(partnerId, includeHidden = false) {
  const filter = { partner_id: partnerId };
  if (!includeHidden) {
    filter.status = 'active';
    filter['moderation.is_verified'] = true;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

// Поиск отзывов клиента
reviewSchema.statics.findByCustomer = function(customerId) {
  return this.find({ customer_id: customerId }).sort({ createdAt: -1 });
};

// Расчет среднего рейтинга партнера
reviewSchema.statics.calculatePartnerRating = async function(partnerId) {
  const result = await this.aggregate([
    {
      $match: { 
        partner_id: new mongoose.Types.ObjectId(partnerId),
        status: 'active',
        'moderation.is_verified': true
      }
    },
    {
      $group: {
        _id: null,
        avg_rating: { $avg: '$rating' },
        total_reviews: { $sum: 1 },
        rating_distribution: {
          $push: '$rating'
        }
      }
    }
  ]);
  
  if (result.length > 0) {
    const stats = result[0];
    
    // Подсчитываем распределение рейтингов
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats.rating_distribution.forEach(rating => {
      distribution[rating]++;
    });
    
    return {
      avg_rating: Math.round(stats.avg_rating * 10) / 10, // округляем до 1 знака
      total_reviews: stats.total_reviews,
      rating_distribution: distribution
    };
  }
  
  return {
    avg_rating: 0,
    total_reviews: 0,
    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };
};

// Получение статистики отзывов за период
reviewSchema.statics.getStatsForPeriod = function(startDate, endDate, partnerId = null) {
  const filter = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'active',
    'moderation.is_verified': true
  };
  
  if (partnerId) {
    filter.partner_id = partnerId;
  }
  
  return this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 },
        avg_rating: { $avg: '$rating' },
        ratings: { $push: '$rating' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Поиск отзывов требующих модерации
reviewSchema.statics.findPendingModeration = function() {
  return this.find({
    'moderation.is_verified': false
  }).sort({ createdAt: 1 });
};

// Поиск лучших отзывов (высокий рейтинг + полезность)
reviewSchema.statics.findTopReviews = function(partnerId, limit = 10) {
  return this.find({
    partner_id: partnerId,
    status: 'active',
    'moderation.is_verified': true,
    rating: { $gte: 4 }
  })
  .sort({ 
    rating: -1, 
    'helpfulness.helpful_count': -1,
    createdAt: -1 
  })
  .limit(limit);
};

// Поиск проблемных отзывов (низкий рейтинг)
reviewSchema.statics.findLowRatingReviews = function(partnerId, threshold = 2) {
  return this.find({
    partner_id: partnerId,
    status: 'active',
    'moderation.is_verified': true,
    rating: { $lte: threshold }
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Review', reviewSchema);