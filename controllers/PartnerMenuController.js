// controllers/PartnerMenuController.js - УПРАВЛЕНИЕ МЕНЮ И ПРОДУКТАМИ 🍽️
import { PartnerProfile, Product } from '../models/index.js';

// ================ УПРАВЛЕНИЕ КАТЕГОРИЯМИ МЕНЮ ================

/**
 * 📋 ПОЛУЧЕНИЕ ВСЕХ КАТЕГОРИЙ МЕНЮ ПАРТНЕРА
 * GET /api/partners/menu/categories
 */
export const getMenuCategories = async (req, res) => {
  try {
    const { user } = req;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    // Обновляем статистику продуктов для каждой категории
    await partner.updateProductStats();

    res.status(200).json({
      result: true,
      message: "Категории меню получены",
      categories: partner.menu_categories,
      total_categories: partner.menu_categories.length,
      business_info: {
        business_name: partner.business_name,
        category: partner.category
      }
    });

  } catch (error) {
    console.error('Get menu categories error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения категорий меню"
    });
  }
};

/**
 * ➕ ДОБАВЛЕНИЕ НОВОЙ КАТЕГОРИИ МЕНЮ
 * POST /api/partners/menu/categories
 */
export const addMenuCategory = async (req, res) => {
  try {
    const { user } = req;
    const { name, description, image_url, sort_order } = req.body;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    // Валидация
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        result: false,
        message: "Название категории обязательно"
      });
    }

    if (name.length > 50) {
      return res.status(400).json({
        result: false,
        message: "Название категории не должно превышать 50 символов"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    // Добавляем категорию через метод модели
    await partner.addMenuCategory({
      name: name.trim(),
      description: description?.trim() || '',
      image_url: image_url || '',
      sort_order: sort_order || partner.menu_categories.length
    });

    res.status(201).json({
      result: true,
      message: "Категория меню добавлена",
      category: partner.menu_categories[partner.menu_categories.length - 1],
      total_categories: partner.menu_categories.length
    });

  } catch (error) {
    console.error('Add menu category error:', error);
    
    if (error.message === 'Категория с таким названием уже существует') {
      return res.status(400).json({
        result: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка добавления категории"
    });
  }
};

/**
 * ✏️ РЕДАКТИРОВАНИЕ КАТЕГОРИИ МЕНЮ
 * PUT /api/partners/menu/categories/:category_id
 */
export const updateMenuCategory = async (req, res) => {
  try {
    const { user } = req;
    const { category_id } = req.params;
    const { name, description, image_url, sort_order, is_active } = req.body;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    // Обновляем категорию через метод модели
    await partner.updateMenuCategory(category_id, {
      name: name?.trim(),
      description: description?.trim(),
      image_url,
      sort_order,
      is_active
    });

    const updatedCategory = partner.menu_categories.id(category_id);

    res.status(200).json({
      result: true,
      message: "Категория обновлена",
      category: updatedCategory
    });

  } catch (error) {
    console.error('Update menu category error:', error);
    
    if (error.message === 'Категория не найдена') {
      return res.status(404).json({
        result: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка обновления категории"
    });
  }
};

/**
 * 🗑️ УДАЛЕНИЕ КАТЕГОРИИ МЕНЮ
 * DELETE /api/partners/menu/categories/:category_id
 */
export const deleteMenuCategory = async (req, res) => {
  try {
    const { user } = req;
    const { category_id } = req.params;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    // Проверяем есть ли продукты в этой категории
    const category = partner.menu_categories.id(category_id);
    if (!category) {
      return res.status(404).json({
        result: false,
        message: "Категория не найдена"
      });
    }

    const productsInCategory = await Product.countDocuments({
      partner_id: partner._id,
      subcategory: category.slug
    });

    if (productsInCategory > 0) {
      return res.status(400).json({
        result: false,
        message: `Нельзя удалить категорию. В ней ${productsInCategory} товаров. Сначала переместите или удалите товары.`
      });
    }

    // Удаляем категорию
    await partner.removeMenuCategory(category_id);

    res.status(200).json({
      result: true,
      message: "Категория удалена",
      remaining_categories: partner.menu_categories.length
    });

  } catch (error) {
    console.error('Delete menu category error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка удаления категории"
    });
  }
};

// ================ УПРАВЛЕНИЕ ПРОДУКТАМИ/БЛЮДАМИ ================

/**
 * 📋 ПОЛУЧЕНИЕ ВСЕХ ПРОДУКТОВ ПАРТНЕРА
 * GET /api/partners/menu/products
 */
export const getProducts = async (req, res) => {
  try {
    const { user } = req;
    const { category_slug, include_inactive } = req.query;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    let products;
    if (category_slug) {
      // Продукты конкретной категории
      products = await Product.findByPartnerCategory(
        partner._id, 
        category_slug, 
        include_inactive === 'true'
      );
    } else {
      // Все продукты партнера
      products = await Product.findByPartner(
        partner._id, 
        include_inactive === 'true'
      );
    }

    // Группируем по категориям для удобства
    const productsByCategory = {};
    partner.menu_categories.forEach(category => {
      productsByCategory[category.slug] = {
        category_info: category,
        products: products.filter(p => p.subcategory === category.slug)
      };
    });

    res.status(200).json({
      result: true,
      message: "Продукты получены",
      products_by_category: productsByCategory,
      total_products: products.length,
      business_info: {
        business_name: partner.business_name,
        category: partner.category
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения продуктов"
    });
  }
};

/**
 * ➕ ДОБАВЛЕНИЕ НОВОГО ПРОДУКТА/БЛЮДА
 * POST /api/partners/menu/products
 */
export const addProduct = async (req, res) => {
  try {
    const { user } = req;
    const {
      title,
      description,
      price,
      discount_price,
      image_url,
      subcategory, // slug категории меню
      preparation_time,
      options_groups,
      dish_info,
      product_info,
      tags
    } = req.body;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    // Валидация обязательных полей
    const requiredFields = { title, price, subcategory };
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: `Обязательные поля: ${missingFields.join(', ')}`
      });
    }

    if (price <= 0) {
      return res.status(400).json({
        result: false,
        message: "Цена должна быть больше нуля"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    // Проверяем существование категории
    const category = partner.menu_categories.find(cat => cat.slug === subcategory);
    if (!category) {
      return res.status(400).json({
        result: false,
        message: "Категория меню не найдена"
      });
    }

    // Создаем новый продукт
    const newProduct = new Product({
      partner_id: partner._id,
      title: title.trim(),
      description: description?.trim() || '',
      price: parseFloat(price),
      discount_price: discount_price ? parseFloat(discount_price) : null,
      image_url: image_url || '',
      category: partner.category, // restaurant/store
      subcategory: subcategory,
      menu_category_id: category._id,
      preparation_time: preparation_time || (partner.category === 'restaurant' ? 15 : 0),
      options_groups: options_groups || [],
      dish_info: dish_info || {},
      product_info: product_info || {},
      tags: tags || [],
      last_updated_by: user._id
    });

    // Валидируем принадлежность к категории партнера
    await newProduct.validateCategory();
    
    await newProduct.save();

    // Обновляем статистику партнера
    await partner.updateProductStats();

    res.status(201).json({
      result: true,
      message: "Продукт добавлен",
      product: newProduct,
      category_info: {
        name: category.name,
        slug: category.slug
      }
    });

  } catch (error) {
    console.error('Add product error:', error);
    
    if (error.message.includes('категории')) {
      return res.status(400).json({
        result: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      result: false,
      message: "Ошибка добавления продукта"
    });
  }
};

/**
 * ✏️ РЕДАКТИРОВАНИЕ ПРОДУКТА
 * PUT /api/partners/menu/products/:product_id
 */
export const updateProduct = async (req, res) => {
  try {
    const { user } = req;
    const { product_id } = req.params;
    const updateData = req.body;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const product = await Product.findOne({
      _id: product_id,
      partner_id: partner._id
    });

    if (!product) {
      return res.status(404).json({
        result: false,
        message: "Продукт не найден"
      });
    }

    // Если меняется категория, проверяем что она существует
    if (updateData.subcategory && updateData.subcategory !== product.subcategory) {
      const category = partner.menu_categories.find(cat => cat.slug === updateData.subcategory);
      if (!category) {
        return res.status(400).json({
          result: false,
          message: "Новая категория меню не найдена"
        });
      }
      updateData.menu_category_id = category._id;
    }

    // Обновляем продукт
    Object.assign(product, {
      ...updateData,
      last_updated_by: user._id
    });

    await product.save();

    // Обновляем статистику если менялась категория
    if (updateData.subcategory) {
      await partner.updateProductStats();
    }

    res.status(200).json({
      result: true,
      message: "Продукт обновлен",
      product: product
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка обновления продукта"
    });
  }
};

/**
 * 🗑️ УДАЛЕНИЕ ПРОДУКТА
 * DELETE /api/partners/menu/products/:product_id
 */
export const deleteProduct = async (req, res) => {
  try {
    const { user } = req;
    const { product_id } = req.params;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    const product = await Product.findOneAndDelete({
      _id: product_id,
      partner_id: partner._id
    });

    if (!product) {
      return res.status(404).json({
        result: false,
        message: "Продукт не найден"
      });
    }

    // Обновляем статистику партнера
    await partner.updateProductStats();

    res.status(200).json({
      result: true,
      message: "Продукт удален",
      deleted_product: {
        id: product._id,
        title: product.title,
        category: product.subcategory
      }
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка удаления продукта"
    });
  }
};

// ================ ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * 📊 СТАТИСТИКА МЕНЮ
 * GET /api/partners/menu/stats
 */
export const getMenuStats = async (req, res) => {
  try {
    const { user } = req;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ только для партнеров"
      });
    }

    const partner = await PartnerProfile.findOne({ user_id: user._id });
    
    if (!partner) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    // Обновляем статистику
    await partner.updateProductStats();

    const categoryStats = await Promise.all(
      partner.menu_categories.map(async (category) => {
        const totalProducts = await Product.countDocuments({
          partner_id: partner._id,
          subcategory: category.slug
        });
        
        const activeProducts = await Product.countDocuments({
          partner_id: partner._id,
          subcategory: category.slug,
          is_active: true,
          is_available: true
        });

        return {
          category_name: category.name,
          category_slug: category.slug,
          total_products: totalProducts,
          active_products: activeProducts,
          inactive_products: totalProducts - activeProducts
        };
      })
    );

    res.status(200).json({
      result: true,
      message: "Статистика меню получена",
      overall_stats: {
        total_categories: partner.stats.total_categories,
        total_products: partner.stats.total_products,
        active_products: partner.stats.active_products,
        content_ready: partner.isContentReady()
      },
      category_stats: categoryStats
    });

  } catch (error) {
    console.error('Get menu stats error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статистики"
    });
  }
};