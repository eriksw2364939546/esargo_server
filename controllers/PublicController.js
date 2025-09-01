// controllers/PublicController.js - Контроллеры публичного каталога
import {
  getPublicRestaurantCatalog,
  getPublicRestaurantDetails,
  getPublicRestaurantMenu,
  searchPublicContent,
  getPublicRestaurantCategories,
  getPopularRestaurants as getPopularRestaurantsService  // ✅ ИСПРАВЛЕНО: переименовали импорт
} from '../services/Public/public.service.js';

/**
 * 🏪 ПОЛУЧИТЬ КАТАЛОГ РЕСТОРАНОВ
 * GET /api/public/catalog
 */
const getCatalog = async (req, res) => {
  try {
    const {
      category,
      search,
      lat,
      lng,
      radius = 10,
      sort_by = 'popular',
      is_open_now,
      min_rating,
      delivery_fee_max,
      limit = 20,
      offset = 0
    } = req.query;

    console.log('🏪 GET PUBLIC CATALOG:', {
      category,
      search,
      coordinates: lat && lng ? `${lat},${lng}` : null,
      limit,
      offset
    });

    const result = await getPublicRestaurantCatalog({
      category,
      search,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      radius: parseInt(radius),
      sort_by,
      is_open_now: is_open_now === 'true',
      min_rating: min_rating ? parseFloat(min_rating) : null,
      delivery_fee_max: delivery_fee_max ? parseFloat(delivery_fee_max) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: "Каталог ресторанов получен успешно",
      data: result.restaurants,
      pagination: result.pagination,
      filters: result.filters_applied,
      total_found: result.pagination.total
    });

  } catch (error) {
    console.error('🚨 GET CATALOG Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения каталога ресторанов"
    });
  }
};

/**
 * 🍴 ПОЛУЧИТЬ ДЕТАЛИ РЕСТОРАНА
 * GET /api/public/restaurants/:id
 */
const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🍴 GET RESTAURANT DETAILS:', { restaurantId: id });

    const restaurant = await getPublicRestaurantDetails(id);

    res.status(200).json({
      result: true,
      message: "Информация о ресторане получена успешно",
      restaurant
    });

  } catch (error) {
    console.error('🚨 GET RESTAURANT Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;
    
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения информации о ресторане"
    });
  }
};

/**
 * 📋 ПОЛУЧИТЬ МЕНЮ РЕСТОРАНА
 * GET /api/public/restaurants/:id/menu
 */
const getRestaurantMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category,
      search,
      sort_by = 'default',
      is_available_only = 'true',
      limit = 50,
      offset = 0
    } = req.query;

    console.log('📋 GET RESTAURANT MENU:', {
      restaurantId: id,
      category,
      search,
      sort_by
    });

    const result = await getPublicRestaurantMenu(id, {
      category,
      search,
      sort_by,
      is_available_only: is_available_only === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: "Меню ресторана получено успешно",
      restaurant: result.restaurant,
      menu: result.menu,
      pagination: result.pagination,
      filters: result.filters_applied
    });

  } catch (error) {
    console.error('🚨 GET MENU Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 : 500;
    
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения меню ресторана"
    });
  }
};

/**
 * 🔍 ПОИСК РЕСТОРАНОВ И БЛЮД
 * GET /api/public/restaurants/search
 */
const searchRestaurants = async (req, res) => {
  try {
    const {
      q: query,
      search_type = 'all',
      lat,
      lng,
      radius = 10,
      limit = 20
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        result: false,
        message: "Поисковый запрос должен содержать минимум 2 символа"
      });
    }

    console.log('🔍 SEARCH RESTAURANTS:', {
      query: query.substring(0, 20),
      search_type,
      has_location: !!(lat && lng)
    });

    const result = await searchPublicContent(query, {
      search_type,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      radius: parseInt(radius),
      limit: parseInt(limit)
    });

    res.status(200).json({
      result: true,
      message: `Найдено результатов: ${result.total_found}`,
      query,
      search_results: {
        restaurants: result.restaurants,
        dishes: result.dishes,
        total_found: result.total_found
      }
    });

  } catch (error) {
    console.error('🚨 SEARCH Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка поиска"
    });
  }
};

/**
 * 📂 ПОЛУЧИТЬ КАТЕГОРИИ РЕСТОРАНОВ
 * GET /api/public/restaurants/categories
 */
const getCategories = async (req, res) => {
  try {
    console.log('📂 GET CATEGORIES');

    const result = await getPublicRestaurantCategories();

    res.status(200).json({
      result: true,
      message: "Категории ресторанов получены успешно",
      categories: result.categories,
      total_categories: result.total_categories,
      total_restaurants: result.total_restaurants
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
 * ⭐ ПОЛУЧИТЬ ПОПУЛЯРНЫЕ РЕСТОРАНЫ
 * GET /api/public/restaurants/popular
 */
const getPopularRestaurants = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log('⭐ GET POPULAR RESTAURANTS');

    // ✅ ИСПРАВЛЕНО: используем переименованный сервис
    const result = await getPopularRestaurantsService(parseInt(limit));

    res.status(200).json({
      result: true,
      message: "Популярные рестораны получены успешно",
      restaurants: result.restaurants,
      total: result.total
    });

  } catch (error) {
    console.error('🚨 GET POPULAR Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения популярных ресторанов"
    });
  }
};

/**
 * 🏷️ ПОЛУЧИТЬ РЕСТОРАНЫ ПО КАТЕГОРИИ
 * GET /api/public/restaurants/category/:category
 */
const getRestaurantsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const {
      lat,
      lng,
      radius = 10,
      sort_by = 'popular',
      limit = 20,
      offset = 0
    } = req.query;

    console.log('🏷️ GET RESTAURANTS BY CATEGORY:', { category });

    const result = await getPublicRestaurantCatalog({
      category,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      radius: parseInt(radius),
      sort_by,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      result: true,
      message: `Рестораны категории "${category}" получены успешно`,
      category,
      restaurants: result.restaurants,
      pagination: result.pagination,
      total_found: result.pagination.total
    });

  } catch (error) {
    console.error('🚨 GET BY CATEGORY Error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка получения ресторанов по категории"
    });
  }
};

export {
  getCatalog,
  getRestaurantById,
  getRestaurantMenu,
  searchRestaurants,
  getCategories,
  getPopularRestaurants,
  getRestaurantsByCategory
};