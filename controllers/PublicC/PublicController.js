// controllers/PublicController.js - Публичные контроллеры для каталога
import { 
  getPublicCatalog,
  getRestaurantDetails,
  getPublicRestaurantMenu,
  searchPublicRestaurants,
  getRestaurantCategories,
  getPopularRestaurantsList,
  getRestaurantsByCategory as getRestaurantsByCategoryService
} from '../services/Public/public.service.js';

/**
 * 🏪 ПОЛУЧИТЬ КАТАЛОГ РЕСТОРАНОВ
 * GET /api/public/catalog
 */
 const getCatalog = async (req, res) => {
  try {
    const {
      lat,
      lng,
      category,
      limit = 20,
      offset = 0,
      sort = 'rating', // rating, distance, delivery_time
      radius = 10 // радиус поиска в км
    } = req.query;

    console.log('📍 GET CATALOG:', { lat, lng, category, sort, limit });

    const result = await getPublicCatalog({
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      category,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
      radius: parseFloat(radius)
    });

    res.status(200).json({
      result: true,
      message: "Каталог ресторанов получен",
      restaurants: result.restaurants,
      total: result.total,
      filters_applied: result.filters,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: result.total > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('🚨 GET CATALOG Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения каталога"
    });
  }
};

/**
 * 🏆 ПОПУЛЯРНЫЕ РЕСТОРАНЫ
 * GET /api/public/restaurants/popular
 */
 const getPopularRestaurants = async (req, res) => {
  try {
    const { lat, lng, limit = 10 } = req.query;

    const result = await getPopularRestaurantsList({
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      limit: parseInt(limit)
    });

    res.status(200).json({
      result: true,
      message: "Популярные рестораны получены",
      restaurants: result.restaurants,
      criteria: "Сортировка по рейтингу и количеству заказов"
    });

  } catch (error) {
    console.error('🚨 GET POPULAR RESTAURANTS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения популярных ресторанов"
    });
  }
};

/**
 * 📂 КАТЕГОРИИ РЕСТОРАНОВ
 * GET /api/public/restaurants/categories
 */
 const getCategories = async (req, res) => {
  try {
    const result = await getRestaurantCategories();

    res.status(200).json({
      result: true,
      message: "Категории ресторанов получены",
      categories: result.categories,
      total: result.total
    });

  } catch (error) {
    console.error('🚨 GET CATEGORIES Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения категорий"
    });
  }
};

/**
 * 🏷️ РЕСТОРАНЫ ПО КАТЕГОРИИ
 * GET /api/public/restaurants/category/:category
 */
 const getRestaurantsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { lat, lng, limit = 20, offset = 0 } = req.query;

    const result = await getRestaurantsByCategoryService({
      category,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: `Рестораны категории "${category}" получены`,
      restaurants: result.restaurants,
      category: result.categoryInfo,
      total: result.total
    });

  } catch (error) {
    console.error('🚨 GET RESTAURANTS BY CATEGORY Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения ресторанов по категории"
    });
  }
};

/**
 * 🔍 ПОИСК РЕСТОРАНОВ
 * GET /api/public/restaurants/search
 */
 const searchRestaurants = async (req, res) => {
  try {
    const {
      q, // поисковый запрос
      lat,
      lng,
      category,
      limit = 20,
      offset = 0
    } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        result: false,
        message: "Поисковый запрос не может быть пустым"
      });
    }

    const result = await searchPublicRestaurants({
      query: q.trim(),
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      category,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: "Поиск завершен",
      restaurants: result.restaurants,
      query: q.trim(),
      total: result.total,
      search_in: result.searchFields
    });

  } catch (error) {
    console.error('🚨 SEARCH RESTAURANTS Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка поиска ресторанов"
    });
  }
};

/**
 * 🏪 ДЕТАЛИ РЕСТОРАНА
 * GET /api/public/restaurants/:id
 */
 const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.query;

    console.log('🔍 GET RESTAURANT DETAILS:', { id, lat, lng });

    const result = await getRestaurantDetails({
      restaurantId: id,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null
    });

    res.status(200).json({
      result: true,
      message: "Детали ресторана получены",
      restaurant: result.restaurant,
      distance: result.distance,
      estimated_delivery: result.estimatedDelivery
    });

  } catch (error) {
    console.error('🚨 GET RESTAURANT BY ID Error:', error);
    
    if (error.message.includes('не найден')) {
      return res.status(404).json({
        result: false,
        message: error.message
      });
    }

    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения деталей ресторана"
    });
  }
};

/**
 * 📋 МЕНЮ РЕСТОРАНА
 * GET /api/public/restaurants/:id/menu
 */
 const getRestaurantMenu = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🍽️ GET RESTAURANT MENU:', { id });

    const result = await getPublicRestaurantMenu(id);

    res.status(200).json({
      result: true,
      message: "Меню ресторана получено",
      restaurant: {
        id: result.restaurant._id,
        name: result.restaurant.business_name,
        category: result.restaurant.category,
        working_hours: result.restaurant.working_hours,
        is_open: result.isOpen
      },
      menu: {
        categories: result.menu.categories,
        total_products: result.menu.totalProducts,
        total_categories: result.menu.totalCategories
      }
    });

  } catch (error) {
    console.error('🚨 GET RESTAURANT MENU Error:', error);
    
    if (error.message.includes('не найден')) {
      return res.status(404).json({
        result: false,
        message: error.message
      });
    }

    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения меню ресторана"
    });
  }
};

export { getCatalog,
         getPopularRestaurants,
         getCategories,
         getRestaurantsByCategory,
         searchRestaurants,
         getRestaurantById,
         getRestaurantMenu
       }