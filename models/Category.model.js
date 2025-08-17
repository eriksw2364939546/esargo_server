// models/Category.model.js (исправленный - ES6 modules)
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    enum: ['Рестораны', 'Магазины'] // ТОЛЬКО 2 категории!
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    enum: ['restaurant', 'store'], // URL-friendly версии
    index: true
  },
  
  // Отображение в интерфейсе
  display_info: {
    title_ru: {
      type: String,
      required: true,
      trim: true
    },
    title_fr: {
      type: String,
      required: true,
      trim: true
    },
    title_en: {
      type: String,
      trim: true
    },
    description_ru: {
      type: String,
      trim: true,
      maxlength: 200
    },
    description_fr: {
      type: String,
      trim: true,
      maxlength: 200
    },
    description_en: {
      type: String,
      trim: true,
      maxlength: 200
    }
  },
  
  // Иконка и изображения
  visual_assets: {
    icon_url: {
      type: String // URL иконки для меню
    },
    icon_svg: {
      type: String // SVG код иконки
    },
    banner_image_url: {
      type: String // Баннер для категории
    },
    thumbnail_url: {
      type: String // Превью для списков
    },
    color_scheme: {
      primary_color: {
        type: String,
        default: '#FF6B6B' // Основной цвет категории
      },
      secondary_color: {
        type: String,
        default: '#4ECDC4' // Дополнительный цвет
      },
      background_color: {
        type: String,
        default: '#F8F9FA' // Цвет фона
      }
    }
  },
  
  // Состояние категории
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Порядок отображения в меню
  sort_order: {
    type: Number,
    required: true,
    default: 0,
    index: true
  },
  
  // Настройки для SEO
  seo_settings: {
    meta_title: {
      type: String,
      trim: true,
      maxlength: 60
    },
    meta_description: {
      type: String,
      trim: true,
      maxlength: 160
    },
    meta_keywords: [{
      type: String,
      trim: true
    }],
    canonical_url: {
      type: String,
      trim: true
    }
  },
  
  // Статистика категории
  stats: {
    total_partners: {
      type: Number,
      default: 0
    },
    active_partners: {
      type: Number,
      default: 0
    },
    total_products: {
      type: Number,
      default: 0
    },
    total_orders: {
      type: Number,
      default: 0
    },
    total_revenue: {
      type: Number,
      default: 0
    },
    avg_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    last_stats_update: {
      type: Date,
      default: Date.now
    }
  },
  
  // Бизнес-настройки для категории
  business_settings: {
    // Настройки доставки
    delivery_settings: {
      min_order_amount: {
        type: Number,
        default: 15 // Минимальная сумма заказа
      },
      delivery_fee: {
        type: Number,
        default: 3.50 // Стандартная стоимость доставки
      },
      free_delivery_threshold: {
        type: Number,
        default: 35 // Бесплатная доставка от суммы
      },
      max_delivery_distance: {
        type: Number,
        default: 15 // Максимальное расстояние доставки в км
      },
      estimated_preparation_time: {
        type: Number,
        default: 30 // Среднее время приготовления в минутах
      }
    },
    
    // Настройки заказов
    order_settings: {
      allow_pre_orders: {
        type: Boolean,
        default: true
      },
      max_items_per_order: {
        type: Number,
        default: 50
      },
      allow_special_instructions: {
        type: Boolean,
        default: true
      }
    },
    
    // Рабочие часы по умолчанию
    default_working_hours: {
      monday: { 
        open: { type: String, default: '10:00' }, 
        close: { type: String, default: '22:00' }, 
        is_open: { type: Boolean, default: true } 
      },
      tuesday: { 
        open: { type: String, default: '10:00' }, 
        close: { type: String, default: '22:00' }, 
        is_open: { type: Boolean, default: true } 
      },
      wednesday: { 
        open: { type: String, default: '10:00' }, 
        close: { type: String, default: '22:00' }, 
        is_open: { type: Boolean, default: true } 
      },
      thursday: { 
        open: { type: String, default: '10:00' }, 
        close: { type: String, default: '22:00' }, 
        is_open: { type: Boolean, default: true } 
      },
      friday: { 
        open: { type: String, default: '10:00' }, 
        close: { type: String, default: '22:00' }, 
        is_open: { type: Boolean, default: true } 
      },
      saturday: { 
        open: { type: String, default: '10:00' }, 
        close: { type: String, default: '22:00' }, 
        is_open: { type: Boolean, default: true } 
      },
      sunday: { 
        open: { type: String, default: '10:00' }, 
        close: { type: String, default: '22:00' }, 
        is_open: { type: Boolean, default: true } 
      }
    }
  },
  
  // Особенности категории
  category_features: {
    // Поддерживает ли категория добавки к товарам
    supports_options: {
      type: Boolean,
      default: function() {
        return this.slug === 'restaurant'; // Только рестораны
      }
    },
    
    // Требует ли предварительный заказ
    requires_pre_order: {
      type: Boolean,
      default: false
    },
    
    // Поддерживает ли возрастные ограничения
    supports_age_restriction: {
      type: Boolean,
      default: function() {
        return this.slug === 'store'; // Для магазинов (алкоголь)
      }
    },
    
    // Поддерживает ли систему лояльности
    supports_loyalty: {
      type: Boolean,
      default: true
    },
    
    // Показывать ли время приготовления
    show_preparation_time: {
      type: Boolean,
      default: function() {
        return this.slug === 'restaurant';
      }
    }
  },
  
  // Популярные подкатегории для фильтрации
  popular_subcategories: [{
    name: {
      type: String,
      trim: true
    },
    slug: {
      type: String,
      trim: true
    },
    icon: {
      type: String
    },
    is_featured: {
      type: Boolean,
      default: false
    }
  }],
  
  // Информация о последнем обновлении
  last_updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  
  // Метаданные
  metadata: {
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    version: {
      type: Number,
      default: 1
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    }
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
categorySchema.index({ slug: 1 });
categorySchema.index({ is_active: 1, sort_order: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ 'stats.total_partners': -1 });
categorySchema.index({ 'stats.total_orders': -1 });

// Виртуальные поля

// Получение партнеров категории
categorySchema.virtual('partners', {
  ref: 'PartnerProfile',
  localField: 'slug',
  foreignField: 'category',
  options: { sort: { 'ratings.avg_rating': -1 } }
});

// Получение продуктов категории
categorySchema.virtual('products', {
  ref: 'Product',
  localField: 'slug',
  foreignField: 'category'
});

// Методы экземпляра

// Обновление статистики категории
categorySchema.methods.updateStats = async function() {
  const PartnerProfile = mongoose.model('PartnerProfile');
  const Product = mongoose.model('Product');
  const Order = mongoose.model('Order');
  
  // Подсчет партнеров
  const totalPartners = await PartnerProfile.countDocuments({ category: this.slug });
  const activePartners = await PartnerProfile.countDocuments({ 
    category: this.slug, 
    is_active: true,
    is_approved: true 
  });
  
  // Подсчет продуктов
  const totalProducts = await Product.countDocuments({ category: this.slug });
  
  // Получаем партнеров для подсчета заказов
  const partnerIds = await PartnerProfile.find({ category: this.slug }).distinct('_id');
  
  // Подсчет заказов и выручки
  const orderStats = await Order.aggregate([
    {
      $match: {
        partner_id: { $in: partnerIds },
        status: 'delivered'
      }
    },
    {
      $group: {
        _id: null,
        total_orders: { $sum: 1 },
        total_revenue: { $sum: '$total_price' }
      }
    }
  ]);
  
  // Подсчет среднего рейтинга
  const ratingStats = await PartnerProfile.aggregate([
    {
      $match: {
        category: this.slug,
        is_active: true,
        'ratings.total_ratings': { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        avg_rating: { $avg: '$ratings.avg_rating' }
      }
    }
  ]);
  
  // Обновляем статистику
  this.stats.total_partners = totalPartners;
  this.stats.active_partners = activePartners;
  this.stats.total_products = totalProducts;
  this.stats.total_orders = orderStats[0]?.total_orders || 0;
  this.stats.total_revenue = orderStats[0]?.total_revenue || 0;
  this.stats.avg_rating = ratingStats[0]?.avg_rating || 0;
  this.stats.last_stats_update = new Date();
  
  return this.save();
};

// Добавление подкатегории
categorySchema.methods.addSubcategory = function(name, slug, icon = null, isFeatured = false) {
  // Проверяем что подкатегория еще не существует
  const exists = this.popular_subcategories.some(sub => sub.slug === slug);
  if (exists) {
    throw new Error('Подкатегория уже существует');
  }
  
  this.popular_subcategories.push({
    name,
    slug,
    icon,
    is_featured: isFeatured
  });
  
  return this.save();
};

// Удаление подкатегории
categorySchema.methods.removeSubcategory = function(slug) {
  this.popular_subcategories = this.popular_subcategories.filter(sub => sub.slug !== slug);
  return this.save();
};

// Обновление бизнес-настроек
categorySchema.methods.updateBusinessSettings = function(newSettings) {
  Object.assign(this.business_settings, newSettings);
  this.markModified('business_settings');
  return this.save();
};

// Статические методы

// Получение активных категорий
categorySchema.statics.findActive = function() {
  return this.find({ is_active: true }).sort({ sort_order: 1 });
};

// Поиск по slug
categorySchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, is_active: true });
};

// Получение статистики всех категорий
categorySchema.statics.getAllStats = function() {
  return this.find({ is_active: true }, {
    name: 1,
    slug: 1,
    stats: 1,
    'visual_assets.color_scheme': 1
  }).sort({ sort_order: 1 });
};

// Инициализация категорий по умолчанию
categorySchema.statics.initializeDefaults = async function() {
  const existingCategories = await this.countDocuments();
  if (existingCategories > 0) {
    return; // Категории уже созданы
  }
  
  const defaultCategories = [
    {
      name: 'Рестораны',
      slug: 'restaurant',
      display_info: {
        title_ru: 'Рестораны',
        title_fr: 'Restaurants',
        title_en: 'Restaurants',
        description_ru: 'Закажите готовую еду из лучших ресторанов',
        description_fr: 'Commandez des plats préparés dans les meilleurs restaurants',
        description_en: 'Order prepared food from the best restaurants'
      },
      sort_order: 1,
      visual_assets: {
        color_scheme: {
          primary_color: '#FF6B6B',
          secondary_color: '#4ECDC4',
          background_color: '#FFF5F5'
        }
      },
      popular_subcategories: [
        { name: 'Бургеры', slug: 'burgers', is_featured: true },
        { name: 'Пицца', slug: 'pizza', is_featured: true },
        { name: 'Суши', slug: 'sushi', is_featured: true },
        { name: 'Паста', slug: 'pasta', is_featured: false },
        { name: 'Салаты', slug: 'salads', is_featured: false }
      ]
    },
    {
      name: 'Магазины',
      slug: 'store',
      display_info: {
        title_ru: 'Магазины',
        title_fr: 'Magasins',
        title_en: 'Stores',
        description_ru: 'Продукты и товары с доставкой на дом',
        description_fr: 'Produits et marchandises avec livraison à domicile',
        description_en: 'Products and goods with home delivery'
      },
      sort_order: 2,
      visual_assets: {
        color_scheme: {
          primary_color: '#4ECDC4',
          secondary_color: '#45B7B8',
          background_color: '#F0FFFF'
        }
      },
      business_settings: {
        delivery_settings: {
          estimated_preparation_time: 15 // Магазины быстрее
        }
      },
      popular_subcategories: [
        { name: 'Продукты', slug: 'groceries', is_featured: true },
        { name: 'Напитки', slug: 'beverages', is_featured: true },
        { name: 'Хлеб и выпечка', slug: 'bakery', is_featured: false },
        { name: 'Мясо и рыба', slug: 'meat-fish', is_featured: false },
        { name: 'Молочные продукты', slug: 'dairy', is_featured: false }
      ]
    }
  ];
  
  return this.insertMany(defaultCategories);
};

// Обновление всех статистик (для cron задач)
categorySchema.statics.updateAllStats = async function() {
  const categories = await this.find({ is_active: true });
  const results = [];
  
  for (const category of categories) {
    try {
      await category.updateStats();
      results.push({ 
        success: true, 
        categoryId: category._id, 
        slug: category.slug 
      });
    } catch (error) {
      results.push({ 
        success: false, 
        categoryId: category._id, 
        slug: category.slug, 
        error: error.message 
      });
    }
  }
  
  return results;
};

// Настройка виртуальных полей в JSON
categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

// 🆕 ИСПРАВЛЕНО: ES6 export
const Category = mongoose.model('Category', categorySchema);
export default Category;