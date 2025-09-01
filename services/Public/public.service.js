// services/Public/public.service.js - ЗАВЕРШЕННЫЙ публичный сервис каталога
import { PartnerProfile, Product, Category } from '../../models/index.js';
import mongoose from 'mongoose';

/**
 * 🏪 ПОЛУЧИТЬ КАТАЛОГ РЕСТОРАНОВ (публичный доступ)
 * Основная функция для главной страницы приложения
 */
export const getPublicRestaurantCatalog = async (filters = {}) => {
  try {
    const {
      category = null,
      search = null,
      lat = null,
      lng = null,
      radius = 10, // км
      sort_by = 'popular', // popular, rating, distance, newest
      is_open_now = null,
      min_rating = null,
      delivery_fee_max = null,
      limit = 20,
      offset = 0
    } = filters;

    console.log('🏪 GET PUBLIC CATALOG:', {
      category,
      search: search ? search.substring(0, 20) : null,
      coordinates: lat && lng ? `${lat},${lng}` : null,
      sort_by,
      filters_count: Object.keys(filters).length
    });

    // Базовый фильтр - только активные и одобренные рестораны
    let mongoFilter = {
      is_active: true,
      is_approved: true,
      profile_status: 'approved'
    };

    // Фильтр по категории
    if (category && category !== 'all') {
      mongoFilter.category = category;
    }

    // Поиск по тексту (название ресторана, описание, кухня)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      mongoFilter.$or = [
        { business_name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { cuisine_types: { $in: [searchRegex] } },
        { 'business_info.tags': { $in: [searchRegex] } }
      ];
    }

    // Фильтр по рейтингу
    if (min_rating && min_rating > 0) {
      mongoFilter['ratings.average_rating'] = { $gte: parseFloat(min_rating) };
    }

    // Фильтр по максимальной стоимости доставки
    if (delivery_fee_max !== null && delivery_fee_max >= 0) {
      mongoFilter['delivery_info.delivery_fee'] = { $lte: parseFloat(delivery_fee_max) };
    }

    // Фильтр по времени работы (если ресторан сейчас открыт)
    if (is_open_now === true || is_open_now === 'true') {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM формат

      mongoFilter[`working_hours.${currentDay}.is_open`] = true;
      mongoFilter.$expr = {
        $and: [
          { $lte: [`$working_hours.${currentDay}.open_time`, currentTime] },
          { $gte: [`$working_hours.${currentDay}.close_time`, currentTime] }
        ]
      };
    }

    // Геофильтр (если указаны координаты)
    if (lat && lng && radius > 0) {
      const radiusInDegrees = radius / 111; // Примерное преобразование км в градусы
      
      mongoFilter['location.coordinates'] = {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radius / 6378.1] // Радиус Земли в км
        }
      };
    }

    // Сортировка
    let sortOptions = {};
    switch (sort_by) {
      case 'rating':
        sortOptions = { 'ratings.average_rating': -1, 'ratings.total_reviews': -1 };
        break;
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'distance':
        if (lat && lng) {
          // MongoDB $near сортировка по расстоянию
          sortOptions = { location: { $near: [parseFloat(lng), parseFloat(lat)] } };
        } else {
          sortOptions = { 'ratings.average_rating': -1 }; // Фоллбэк на рейтинг
        }
        break;
      case 'popular':
      default:
        sortOptions = { 'ratings.total_orders': -1, 'ratings.average_rating': -1 };
        break;
    }

    // Выполняем запрос с пагинацией
    const restaurants = await PartnerProfile.find(mongoFilter)
      .select({
        business_name: 1,
        category: 1,
        cuisine_types: 1,
        description: 1,
        avatar_image: 1,
        cover_image: 1,
        location: 1,
        ratings: 1,
        delivery_info: 1,
        working_hours: 1,
        'business_info.tags': 1,
        is_featured: 1,
        createdAt: 1
      })
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean(); // Для лучшей производительности

    // Получаем общее количество для пагинации
    const total = await PartnerProfile.countDocuments(mongoFilter);

    // Обогащаем данные дополнительной информацией
    const enrichedRestaurants = await Promise.all(
      restaurants.map(async (restaurant) => {
        // Расчет расстояния если указаны координаты пользователя
        let distance = null;
        if (lat && lng && restaurant.location?.coordinates) {
          distance = calculateDistance(
            lat, lng,
            restaurant.location.coordinates[1],
            restaurant.location.coordinates[0]
          );
        }

        // Получаем популярные товары ресторана (топ-3)
        const popularProducts = await Product.find({
          partner_id: restaurant._id,
          is_active: true,
          is_available: true
        })
        .select('title price image_url category')
        .sort({ order_count: -1 })
        .limit(3)
        .lean();

        // Определяем статус работы
        const isOpenNow = checkRestaurantOpenNow(restaurant.working_hours);

        // Расчетное время доставки
        const estimatedDeliveryTime = calculateEstimatedDelivery(
          distance,
          restaurant.delivery_info
        );

        return {
          id: restaurant._id,
          name: restaurant.business_name,
          category: restaurant.category,
          cuisine_types: restaurant.cuisine_types || [],
          description: restaurant.description,
          avatar_image: restaurant.avatar_image,
          cover_image: restaurant.cover_image,
          tags: restaurant.business_info?.tags || [],
          
          // Геолокация
          location: {
            address: restaurant.location?.address,
            coordinates: restaurant.location?.coordinates,
            distance: distance ? `${distance.toFixed(1)} км` : null
          },
          
          // Рейтинги и отзывы
          ratings: {
            average_rating: restaurant.ratings?.average_rating || 0,
            total_reviews: restaurant.ratings?.total_reviews || 0,
            total_orders: restaurant.ratings?.total_orders || 0
          },
          
          // Информация о доставке
          delivery_info: {
            fee: restaurant.delivery_info?.delivery_fee || 0,
            min_order: restaurant.delivery_info?.min_order_amount || 0,
            estimated_time: estimatedDeliveryTime,
            free_delivery_from: restaurant.delivery_info?.free_delivery_from || null
          },
          
          // Статус работы
          is_open_now: isOpenNow,
          is_featured: restaurant.is_featured || false,
          
          // Популярные товары
          popular_items: popularProducts.map(product => ({
            id: product._id,
            title: product.title,
            price: product.price,
            image_url: product.image_url,
            category: product.category
          }))
        };
      })
    );

    console.log('✅ PUBLIC CATALOG SUCCESS:', {
      restaurants_found: restaurants.length,
      total_available: total,
      has_coordinates: !!(lat && lng),
      applied_filters: Object.keys(filters).length
    });

    return {
      restaurants: enrichedRestaurants,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + restaurants.length) < total,
        total_pages: Math.ceil(total / parseInt(limit)),
        current_page: Math.floor(parseInt(offset) / parseInt(limit)) + 1
      },
      filters_applied: {
        category,
        search,
        location: lat && lng ? { lat, lng, radius } : null,
        sort_by,
        min_rating,
        delivery_fee_max,
        is_open_now
      }
    };

  } catch (error) {
    console.error('🚨 GET PUBLIC CATALOG ERROR:', error);
    throw new Error('Ошибка получения каталога ресторанов');
  }
};

/**
 * 🍴 ПОЛУЧИТЬ ДЕТАЛИ РЕСТОРАНА (публичный доступ)
 */
export const getPublicRestaurantDetails = async (restaurantId) => {
  try {
    console.log('🍴 GET RESTAURANT DETAILS:', { restaurantId });

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error('Некорректный ID ресторана');
    }

    // Получаем детальную информацию о ресторане
    const restaurant = await PartnerProfile.findOne({
      _id: restaurantId,
      is_active: true,
      is_approved: true,
      profile_status: 'approved'
    }).lean();

    if (!restaurant) {
      throw new Error('Ресторан не найден или недоступен');
    }

    // Получаем статистику товаров
    const productsStats = await Product.aggregate([
      { $match: { partner_id: new mongoose.Types.ObjectId(restaurantId), is_active: true } },
      {
        $group: {
          _id: null,
          total_products: { $sum: 1 },
          available_products: { $sum: { $cond: ['$is_available', 1, 0] } },
          avg_price: { $avg: '$price' },
          min_price: { $min: '$price' },
          max_price: { $max: '$price' }
        }
      }
    ]);

    // Получаем последние отзывы
    const recentReviews = await mongoose.model('Review').find({
      partner_id: restaurantId
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('customer_id', 'username profile_image')
    .lean();

    // Статус работы
    const isOpenNow = checkRestaurantOpenNow(restaurant.working_hours);

    const stats = productsStats[0] || {
      total_products: 0,
      available_products: 0,
      avg_price: 0,
      min_price: 0,
      max_price: 0
    };

    console.log('✅ RESTAURANT DETAILS SUCCESS:', {
      restaurant_name: restaurant.business_name,
      products_count: stats.total_products,
      reviews_count: recentReviews.length
    });

    return {
      id: restaurant._id,
      name: restaurant.business_name,
      category: restaurant.category,
      cuisine_types: restaurant.cuisine_types || [],
      description: restaurant.description,
      
      // Изображения
      avatar_image: restaurant.avatar_image,
      cover_image: restaurant.cover_image,
      gallery: restaurant.gallery || [],
      
      // Контакты и адрес
      contact_info: {
        phone: restaurant.contact_info?.phone,
        email: restaurant.contact_info?.email,
        website: restaurant.contact_info?.website
      },
      
      location: {
        address: restaurant.location?.address,
        coordinates: restaurant.location?.coordinates,
        zone: restaurant.location?.zone
      },
      
      // Время работы
      working_hours: restaurant.working_hours,
      is_open_now: isOpenNow,
      
      // Рейтинги и статистика
      ratings: {
        average_rating: restaurant.ratings?.average_rating || 0,
        total_reviews: restaurant.ratings?.total_reviews || 0,
        total_orders: restaurant.ratings?.total_orders || 0,
        rating_breakdown: restaurant.ratings?.rating_breakdown || {}
      },
      
      // Информация о доставке
      delivery_info: {
        fee: restaurant.delivery_info?.delivery_fee || 0,
        min_order: restaurant.delivery_info?.min_order_amount || 0,
        max_distance: restaurant.delivery_info?.max_delivery_distance || 10,
        estimated_time: restaurant.delivery_info?.estimated_delivery_time || '30-45',
        free_delivery_from: restaurant.delivery_info?.free_delivery_from || null,
        delivery_zones: restaurant.delivery_info?.delivery_zones || []
      },
      
      // Статистика товаров
      menu_stats: {
        total_products: stats.total_products,
        available_products: stats.available_products,
        price_range: stats.min_price && stats.max_price ? 
          `${stats.min_price}₽ - ${stats.max_price}₽` : null,
        average_price: stats.avg_price ? `${stats.avg_price.toFixed(0)}₽` : null
      },
      
      // Последние отзывы
      recent_reviews: recentReviews.map(review => ({
        id: review._id,
        customer_name: review.customer_id?.username || 'Аноним',
        customer_avatar: review.customer_id?.profile_image,
        rating: review.rating,
        comment: review.comment,
        created_at: review.createdAt,
        photos: review.photos || []
      })),
      
      // Дополнительная информация
      business_info: {
        registration_year: restaurant.business_info?.registration_year,
        tags: restaurant.business_info?.tags || [],
        special_features: restaurant.business_info?.special_features || []
      },
      
      is_featured: restaurant.is_featured || false,
      created_at: restaurant.createdAt
    };

  } catch (error) {
    console.error('🚨 GET RESTAURANT DETAILS ERROR:', error);
    
    if (error.message.includes('найден') || error.message.includes('Некорректный')) {
      throw error;
    }
    
    throw new Error('Ошибка получения информации о ресторане');
  }
};

/**
 * 📋 ПОЛУЧИТЬ МЕНЮ РЕСТОРАНА (публичный доступ)
 */
export const getPublicRestaurantMenu = async (restaurantId, filters = {}) => {
  try {
    const {
      category = null,
      search = null,
      sort_by = 'default', // default, price_asc, price_desc, popular, name
      is_available_only = true,
      limit = 50,
      offset = 0
    } = filters;

    console.log('📋 GET RESTAURANT MENU:', {
      restaurantId,
      category,
      search: search ? search.substring(0, 20) : null,
      sort_by
    });

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error('Некорректный ID ресторана');
    }

    // Проверяем существование и доступность ресторана
    const restaurant = await PartnerProfile.findOne({
      _id: restaurantId,
      is_active: true,
      is_approved: true
    }).lean();

    if (!restaurant) {
      throw new Error('Ресторан не найден или недоступен');
    }

    // Базовый фильтр для продуктов
    let productFilter = {
      partner_id: new mongoose.Types.ObjectId(restaurantId),
      is_active: true
    };

    // Показывать только доступные товары
    if (is_available_only) {
      productFilter.is_available = true;
    }

    // Фильтр по категории товаров
    if (category && category !== 'all') {
      productFilter.category = category;
    }

    // Поиск по названию товара
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      productFilter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { tags: { $in: [searchRegex] } }
      ];
    }

    // Сортировка
    let sortOptions = {};
    switch (sort_by) {
      case 'price_asc':
        sortOptions = { price: 1 };
        break;
      case 'price_desc':
        sortOptions = { price: -1 };
        break;
      case 'popular':
        sortOptions = { order_count: -1, rating: -1 };
        break;
      case 'name':
        sortOptions = { title: 1 };
        break;
      case 'default':
      default:
        sortOptions = { display_order: 1, createdAt: -1 };
        break;
    }

    // Получаем продукты
    const products = await Product.find(productFilter)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Общее количество для пагинации
    const total = await Product.countDocuments(productFilter);

    // Получаем категории товаров этого ресторана
    const categories = await Product.distinct('category', {
      partner_id: new mongoose.Types.ObjectId(restaurantId),
      is_active: true,
      is_available: true
    });

    // Группируем товары по категориям
    const menuByCategories = categories.map(categoryName => {
      const categoryProducts = products.filter(product => product.category === categoryName);
      
      return {
        category_name: categoryName,
        products_count: categoryProducts.length,
        products: categoryProducts.map(product => ({
          id: product._id,
          title: product.title,
          description: product.description,
          price: product.price,
          old_price: product.old_price,
          image_url: product.image_url,
          category: product.category,
          is_available: product.is_available,
          estimated_cooking_time: product.estimated_cooking_time,
          
          // Опции товара (размеры, добавки)
          options: product.options || [],
          
          // Рейтинг и популярность
          rating: product.rating || 0,
          order_count: product.order_count || 0,
          
          // Теги и метки
          tags: product.tags || [],
          is_spicy: product.is_spicy || false,
          is_vegetarian: product.is_vegetarian || false,
          is_new: product.is_new || false,
          is_popular: product.is_popular || false,
          
          // Пищевая ценность
          nutritional_info: product.nutritional_info || null
        }))
      };
    }).filter(category => category.products.length > 0);

    console.log('✅ RESTAURANT MENU SUCCESS:', {
      restaurant_name: restaurant.business_name,
      categories_count: categories.length,
      products_count: products.length,
      total_products: total
    });

    return {
      restaurant: {
        id: restaurant._id,
        name: restaurant.business_name,
        category: restaurant.category,
        is_open_now: checkRestaurantOpenNow(restaurant.working_hours),
        delivery_info: restaurant.delivery_info
      },
      
      menu: {
        categories_count: categories.length,
        total_products: total,
        available_products: products.length,
        categories: menuByCategories
      },
      
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + products.length) < total,
        current_page: Math.floor(parseInt(offset) / parseInt(limit)) + 1
      },
      
      filters_applied: {
        category,
        search,
        sort_by,
        is_available_only
      }
    };

  } catch (error) {
    console.error('🚨 GET RESTAURANT MENU ERROR:', error);
    
    if (error.message.includes('найден') || error.message.includes('Некорректный')) {
      throw error;
    }
    
    throw new Error('Ошибка получения меню ресторана');
  }
};

/**
 * 🔍 ПОИСК РЕСТОРАНОВ И БЛЮД
 */
export const searchPublicContent = async (searchQuery, filters = {}) => {
  try {
    const {
      search_type = 'all', // all, restaurants, dishes
      lat = null,
      lng = null,
      radius = 10,
      limit = 20
    } = filters;

    console.log('🔍 PUBLIC SEARCH:', {
      query: searchQuery.substring(0, 30),
      search_type,
      has_location: !!(lat && lng)
    });

    if (!searchQuery || searchQuery.trim().length < 2) {
      throw new Error('Запрос должен содержать минимум 2 символа');
    }

    const searchRegex = new RegExp(searchQuery.trim(), 'i');
    const results = {
      restaurants: [],
      dishes: [],
      total_found: 0
    };

    // Поиск ресторанов
    if (search_type === 'all' || search_type === 'restaurants') {
      let restaurantFilter = {
        is_active: true,
        is_approved: true,
        $or: [
          { business_name: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { cuisine_types: { $in: [searchRegex] } }
        ]
      };

      // Геофильтр для ресторанов
      if (lat && lng && radius > 0) {
        restaurantFilter['location.coordinates'] = {
          $geoWithin: {
            $centerSphere: [[parseFloat(lng), parseFloat(lat)], radius / 6378.1]
          }
        };
      }

      const restaurants = await PartnerProfile.find(restaurantFilter)
        .select('business_name category description avatar_image ratings delivery_info location')
        .sort({ 'ratings.average_rating': -1 })
        .limit(parseInt(limit))
        .lean();

      results.restaurants = restaurants.map(restaurant => ({
        id: restaurant._id,
        name: restaurant.business_name,
        category: restaurant.category,
        description: restaurant.description,
        avatar_image: restaurant.avatar_image,
        rating: restaurant.ratings?.average_rating || 0,
        delivery_fee: restaurant.delivery_info?.delivery_fee || 0,
        type: 'restaurant'
      }));
    }

    // Поиск блюд
    if (search_type === 'all' || search_type === 'dishes') {
      const dishesAggregation = await Product.aggregate([
        {
          $match: {
            is_active: true,
            is_available: true,
            $or: [
              { title: searchRegex },
              { description: searchRegex },
              { category: searchRegex },
              { tags: { $in: [searchRegex] } }
            ]
          }
        },
        {
          $lookup: {
            from: 'partnerprofiles',
            localField: 'partner_id',
            foreignField: '_id',
            as: 'restaurant'
          }
        },
        {
          $unwind: '$restaurant'
        },
        {
          $match: {
            'restaurant.is_active': true,
            'restaurant.is_approved': true
          }
        },
        {
          $project: {
            title: 1,
            description: 1,
            price: 1,
            image_url: 1,
            category: 1,
            rating: 1,
            restaurant_id: '$restaurant._id',
            restaurant_name: '$restaurant.business_name',
            restaurant_category: '$restaurant.category',
            restaurant_avatar: '$restaurant.avatar_image'
          }
        },
        {
          $sort: { rating: -1, order_count: -1 }
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      results.dishes = dishesAggregation.map(dish => ({
        id: dish._id,
        title: dish.title,
        description: dish.description,
        price: dish.price,
        image_url: dish.image_url,
        category: dish.category,
        rating: dish.rating || 0,
        restaurant: {
          id: dish.restaurant_id,
          name: dish.restaurant_name,
          category: dish.restaurant_category,
          avatar_image: dish.restaurant_avatar
        },
        type: 'dish'
      }));
    }

    results.total_found = results.restaurants.length + results.dishes.length;

    console.log('✅ PUBLIC SEARCH SUCCESS:', {
      restaurants_found: results.restaurants.length,
      dishes_found: results.dishes.length,
      total_found: results.total_found
    });

    return results;

  } catch (error) {
    console.error('🚨 PUBLIC SEARCH ERROR:', error);
    throw new Error('Ошибка поиска');
  }
};

/**
 * 📂 ПОЛУЧИТЬ КАТЕГОРИИ РЕСТОРАНОВ
 */
export const getPublicRestaurantCategories = async () => {
  try {
    console.log('📂 GET RESTAURANT CATEGORIES');

    // Получаем все уникальные категории активных ресторанов
    const categoriesAggregation = await PartnerProfile.aggregate([
      {
        $match: {
          is_active: true,
          is_approved: true,
          profile_status: 'approved'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avg_rating: { $avg: '$ratings.average_rating' },
          total_orders: { $sum: '$ratings.total_orders' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const categories = categoriesAggregation.map(cat => ({
      name: cat._id,
      restaurants_count: cat.count,
      average_rating: cat.avg_rating ? parseFloat(cat.avg_rating.toFixed(1)) : 0,
      total_orders: cat.total_orders || 0,
      // Добавляем эмодзи для категорий
      emoji: getCategoryEmoji(cat._id)
    }));

    console.log('✅ CATEGORIES SUCCESS:', {
      categories_count: categories.length,
      total_restaurants: categoriesAggregation.reduce((sum, cat) => sum + cat.count, 0)
    });

    return {
      categories,
      total_categories: categories.length,
      total_restaurants: categoriesAggregation.reduce((sum, cat) => sum + cat.count, 0)
    };

  } catch (error) {
    console.error('🚨 GET CATEGORIES ERROR:', error);
    throw new Error('Ошибка получения категорий');
  }
};

/**
 * ⭐ ПОЛУЧИТЬ ПОПУЛЯРНЫЕ РЕСТОРАНЫ
 */
export const getPopularRestaurants = async (limit = 10) => {
  try {
    console.log('⭐ GET POPULAR RESTAURANTS:', { limit });

    const popularRestaurants = await PartnerProfile.find({
      is_active: true,
      is_approved: true,
      profile_status: 'approved'
    })
    .select('business_name category cuisine_types avatar_image ratings delivery_info is_featured')
    .sort({ 
      'ratings.total_orders': -1,
      'ratings.average_rating': -1,
      is_featured: -1
    })
    .limit(parseInt(limit))
    .lean();

    const results = popularRestaurants.map(restaurant => ({
      id: restaurant._id,
      name: restaurant.business_name,
      category: restaurant.category,
      cuisine_types: restaurant.cuisine_types || [],
      avatar_image: restaurant.avatar_image,
      rating: restaurant.ratings?.average_rating || 0,
      total_orders: restaurant.ratings?.total_orders || 0,
      total_reviews: restaurant.ratings?.total_reviews || 0,
      delivery_fee: restaurant.delivery_info?.delivery_fee || 0,
      is_featured: restaurant.is_featured || false
    }));

    console.log('✅ POPULAR RESTAURANTS SUCCESS:', {
      restaurants_found: results.length
    });

    return {
      restaurants: results,
      total: results.length
    };

  } catch (error) {
    console.error('🚨 GET POPULAR RESTAURANTS ERROR:', error);
    throw new Error('Ошибка получения популярных ресторанов');
  }
};

// ================ УТИЛИТАРНЫЕ ФУНКЦИИ ================

/**
 * 📍 РАСЧЕТ РАССТОЯНИЯ МЕЖДУ ДВУМЯ ТОЧКАМИ
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 🕒 ПРОВЕРКА РАБОТАЕТ ЛИ РЕСТОРАН СЕЙЧАС
 */
const checkRestaurantOpenNow = (workingHours) => {
  if (!workingHours) return false;
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM формат
  
  const todayHours = workingHours[currentDay];
  if (!todayHours || !todayHours.is_open) {
    return false;
  }
  
  const openTime = todayHours.open_time;
  const closeTime = todayHours.close_time;
  
  if (!openTime || !closeTime) return false;
  
  // Сравниваем время (простое строковое сравнение работает для HH:MM)
  return currentTime >= openTime && currentTime <= closeTime;
};

/**
 * 🚚 РАСЧЕТ ВРЕМЕНИ ДОСТАВКИ
 */
const calculateEstimatedDelivery = (distance, deliveryInfo) => {
  const baseTime = 25; // Базовое время приготовления
  let deliveryTime = 15; // Базовое время доставки
  
  if (distance) {
    deliveryTime += Math.ceil(distance * 2); // 2 минуты на км
  }
  
  const totalTime = baseTime + deliveryTime;
  const minTime = Math.max(totalTime - 10, 20);
  const maxTime = totalTime + 15;
  
  return `${minTime}-${maxTime} мин`;
};

/**
 * 🎭 ПОЛУЧИТЬ ЭМОДЗИ ДЛЯ КАТЕГОРИИ
 */
const getCategoryEmoji = (category) => {
  const emojiMap = {
    'Пицца': '🍕',
    'Суши': '🍣',
    'Бургеры': '🍔',
    'Итальянская кухня': '🍝',
    'Азиатская кухня': '🥢',
    'Русская кухня': '🥟',
    'Десерты': '🍰',
    'Кофе': '☕',
    'Завтраки': '🥞',
    'Здоровое питание': '🥗',
    'Шашлык': '🍖',
    'Морепродукты': '🦐',
    'Вегетарианское': '🌱',
    'Фастфуд': '🌮',
    'Китайская кухня': '🥡',
    'Японская кухня': '🍱',
    'Грузинская кухня': '🫓',
    'Мексиканская кухня': '🌯',
    'Индийская кухня': '🍛',
    'Выпечка': '🥖'
  };
  
  return emojiMap[category] || '🍽️';
};