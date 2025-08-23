// controllers/PartnerMenuController.js - ЗАВЕРШЕННОЕ УПРАВЛЕНИЕ МЕНЮ И ПРОДУКТАМИ 🍽️
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
      options_groups, // ⚠️ Только для ресторанов
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

    // Валидация обязательных полей (логика не тронута)
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

    // Проверяем существование категории (логика не тронута)
    const category = partner.menu_categories.find(cat => cat.slug === subcategory);
    if (!category) {
      return res.status(400).json({
        result: false,
        message: "Категория меню не найдена"
      });
    }

    // ✅ НОВАЯ ЛОГИКА: Проверка добавок в зависимости от категории партнера
    let finalOptionsGroups = [];
    let validationWarnings = [];

    if (partner.category === 'restaurant') {
      // 🍽️ РЕСТОРАН: Разрешены добавки
      if (options_groups && Array.isArray(options_groups)) {
        // Валидация структуры добавок
        const validatedGroups = [];
        
        options_groups.forEach((group, groupIndex) => {
          if (!group.name || typeof group.name !== 'string') {
            validationWarnings.push(`Группа добавок ${groupIndex + 1}: отсутствует название`);
            return;
          }

          if (!group.options || !Array.isArray(group.options) || group.options.length === 0) {
            validationWarnings.push(`Группа "${group.name}": отсутствуют опции`);
            return;
          }

          // Валидация опций в группе
          const validatedOptions = [];
          group.options.forEach((option, optionIndex) => {
            if (!option.name || typeof option.name !== 'string') {
              validationWarnings.push(`Опция ${optionIndex + 1} в группе "${group.name}": отсутствует название`);
              return;
            }

            if (typeof option.price !== 'number' || option.price < 0) {
              validationWarnings.push(`Опция "${option.name}": некорректная цена`);
              return;
            }

            validatedOptions.push({
              name: option.name.trim(),
              price: parseFloat(option.price),
              is_available: option.is_available !== false // по умолчанию true
            });
          });

          if (validatedOptions.length > 0) {
            validatedGroups.push({
              name: group.name.trim(),
              description: group.description?.trim() || '',
              required: Boolean(group.required),
              multiple_choice: Boolean(group.multiple_choice),
              max_selections: parseInt(group.max_selections) || 1,
              options: validatedOptions
            });
          }
        });

        finalOptionsGroups = validatedGroups;
        
        console.log('🍽️ RESTAURANT - Options groups processed:', {
          input_groups: options_groups.length,
          validated_groups: finalOptionsGroups.length,
          warnings: validationWarnings.length
        });
      }
      
    } else if (partner.category === 'store') {
      // 🏪 МАГАЗИН: Добавки запрещены
      if (options_groups && options_groups.length > 0) {
        return res.status(400).json({
          result: false,
          message: "Магазины не могут добавлять опции к товарам",
          business_rule: "Только рестораны поддерживают добавки к блюдам",
          partner_category: partner.category
        });
      }
      
      finalOptionsGroups = []; // Принудительно пустой массив
      
      console.log('🏪 STORE - No options allowed:', {
        partner_category: partner.category,
        options_blocked: true
      });
    }

    // ✅ ЛОГИКА ВРЕМЕНИ ПРИГОТОВЛЕНИЯ В ЗАВИСИМОСТИ ОТ КАТЕГОРИИ
    let finalPreparationTime = 0;
    
    if (partner.category === 'restaurant') {
      // Рестораны: время приготовления важно
      finalPreparationTime = preparation_time || 15; // по умолчанию 15 минут
    } else if (partner.category === 'store') {
      // Магазины: время не важно (товар готов)
      finalPreparationTime = 0;
      if (preparation_time && preparation_time > 0) {
        validationWarnings.push('Время приготовления игнорируется для магазинов');
      }
    }

    // ✅ СОЗДАЕМ ПРОДУКТ С ПРАВИЛЬНОЙ ЛОГИКОЙ
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
      
      // ✅ ВРЕМЯ ПРИГОТОВЛЕНИЯ: зависит от категории
      preparation_time: finalPreparationTime,
      
      // ✅ ДОБАВКИ: только для ресторанов
      options_groups: finalOptionsGroups,
      
      // Дополнительная информация (зависит от категории)
      dish_info: partner.category === 'restaurant' ? (dish_info || {}) : {},
      product_info: partner.category === 'store' ? (product_info || {}) : {},
      
      tags: tags || [],
      last_updated_by: user._id
    });

    // Валидируем принадлежность к категории партнера (логика не тронута)
    await newProduct.validateCategory();
    
    await newProduct.save();

    // Обновляем статистику партнера (логика не тронута)
    await partner.updateProductStats();

    console.log('✅ PRODUCT CREATED:', {
      partner_category: partner.category,
      has_options: finalOptionsGroups.length > 0,
      preparation_time: finalPreparationTime,
      warnings_count: validationWarnings.length
    });

    // ✅ ОТВЕТ С ИНФОРМАЦИЕЙ О КАТЕГОРИИ
    res.status(201).json({
      result: true,
      message: "Продукт добавлен",
      product: newProduct,
      category_info: {
        name: category.name,
        slug: category.slug
      },
      business_rules: {
        partner_category: partner.category,
        supports_options: partner.category === 'restaurant',
        supports_preparation_time: partner.category === 'restaurant',
        options_groups_count: finalOptionsGroups.length,
        preparation_time: finalPreparationTime
      },
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined
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

    // Находим продукт принадлежащий этому партнеру (логика не тронута)
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

    // Валидация изменения категории (логика не тронута)
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

    // Валидация цены (логика не тронута)
    if (updateData.price && updateData.price <= 0) {
      return res.status(400).json({
        result: false,
        message: "Цена должна быть больше нуля"
      });
    }

    // ✅ НОВАЯ ЛОГИКА: Проверка добавок при обновлении
    let validationWarnings = [];

    if (updateData.options_groups !== undefined) {
      if (partner.category === 'restaurant') {
        // 🍽️ РЕСТОРАН: Разрешено обновление добавок
        if (Array.isArray(updateData.options_groups)) {
          // Валидация структуры (аналогично addProduct)
          const validatedGroups = [];
          
          updateData.options_groups.forEach((group, groupIndex) => {
            if (!group.name || typeof group.name !== 'string') {
              validationWarnings.push(`Группа добавок ${groupIndex + 1}: отсутствует название`);
              return;
            }

            if (!group.options || !Array.isArray(group.options)) {
              validationWarnings.push(`Группа "${group.name}": отсутствуют опции`);
              return;
            }

            const validatedOptions = group.options
              .filter(option => option.name && typeof option.name === 'string' && typeof option.price === 'number')
              .map(option => ({
                name: option.name.trim(),
                price: parseFloat(option.price),
                is_available: option.is_available !== false
              }));

            if (validatedOptions.length > 0) {
              validatedGroups.push({
                name: group.name.trim(),
                description: group.description?.trim() || '',
                required: Boolean(group.required),
                multiple_choice: Boolean(group.multiple_choice),
                max_selections: parseInt(group.max_selections) || 1,
                options: validatedOptions
              });
            }
          });

          updateData.options_groups = validatedGroups;
          
          console.log('🍽️ RESTAURANT UPDATE - Options groups validated:', {
            input_groups: updateData.options_groups.length,
            validated_groups: validatedGroups.length
          });
        }
        
      } else if (partner.category === 'store') {
        // 🏪 МАГАЗИН: Запрещено добавление добавок
        return res.status(400).json({
          result: false,
          message: "Магазины не могут изменять опции товаров",
          business_rule: "Только рестораны поддерживают добавки",
          partner_category: partner.category
        });
      }
    }

    // ✅ ЛОГИКА ВРЕМЕНИ ПРИГОТОВЛЕНИЯ
    if (updateData.preparation_time !== undefined) {
      if (partner.category === 'store' && updateData.preparation_time > 0) {
        validationWarnings.push('Время приготовления сброшено до 0 для магазинов');
        updateData.preparation_time = 0;
      }
    }

    // Обновляем поля (логика расширена)
    const allowedFields = [
      'title', 'description', 'price', 'discount_price', 'image_url',
      'subcategory', 'menu_category_id', 'preparation_time', 'options_groups',
      'dish_info', 'product_info', 'tags', 'is_active', 'is_available',
      'sort_order'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        product[field] = updateData[field];
      }
    });

    // Обновляем кто последний раз изменил (логика не тронута)
    product.last_updated_by = user._id;

    // Валидируем категорию если изменилась (логика не тронута)
    if (updateData.subcategory) {
      await product.validateCategory();
    }

    await product.save();

    // Обновляем статистику партнера (логика не тронута)
    await partner.updateProductStats();

    console.log('✅ PRODUCT UPDATED:', {
      partner_category: partner.category,
      has_options: product.options_groups.length > 0,
      warnings_count: validationWarnings.length
    });

    res.status(200).json({
      result: true,
      message: "Продукт обновлен",
      product: product,
      business_rules: {
        partner_category: partner.category,
        supports_options: partner.category === 'restaurant',
        options_groups_count: product.options_groups.length
      },
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined
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

    // Находим и удаляем продукт принадлежащий этому партнеру
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

// ================ СТАТИСТИКА МЕНЮ ================

/**
 * 📊 ПОЛУЧЕНИЕ СТАТИСТИКИ МЕНЮ
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

    // Получаем продукты для анализа
    const allProducts = await Product.findByPartner(partner._id, true);
    const activeProducts = allProducts.filter(p => p.is_active && p.is_available);

    // Статистика по категориям
    const categoryStats = partner.menu_categories.map(category => {
      const categoryProducts = allProducts.filter(p => p.subcategory === category.slug);
      const activeCategoryProducts = categoryProducts.filter(p => p.is_active && p.is_available);
      
      return {
        category: {
          id: category._id,
          name: category.name,
          slug: category.slug
        },
        products_count: {
          total: categoryProducts.length,
          active: activeCategoryProducts.length,
          inactive: categoryProducts.length - activeCategoryProducts.length
        },
        avg_price: categoryProducts.length > 0 
          ? (categoryProducts.reduce((sum, p) => sum + p.final_price, 0) / categoryProducts.length).toFixed(2)
          : 0,
        has_discounts: categoryProducts.some(p => p.discount_price > 0)
      };
    });

    // Общая статистика
    const stats = {
      overview: {
        total_categories: partner.menu_categories.length,
        total_products: allProducts.length,
        active_products: activeProducts.length,
        inactive_products: allProducts.length - activeProducts.length
      },
      pricing: {
        avg_price: activeProducts.length > 0 
          ? (activeProducts.reduce((sum, p) => sum + p.final_price, 0) / activeProducts.length).toFixed(2)
          : 0,
        min_price: activeProducts.length > 0 
          ? Math.min(...activeProducts.map(p => p.final_price)).toFixed(2)
          : 0,
        max_price: activeProducts.length > 0 
          ? Math.max(...activeProducts.map(p => p.final_price)).toFixed(2)
          : 0,
        products_with_discounts: allProducts.filter(p => p.discount_price > 0).length
      },
      categories: categoryStats,
      last_updated: new Date()
    };

    res.status(200).json({
      result: true,
      message: "Статистика меню получена",
      stats: stats,
      business_info: {
        business_name: partner.business_name,
        category: partner.category
      }
    });

  } catch (error) {
    console.error('Get menu stats error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статистики"
    });
  }
};

// ================ ЭКСПОРТ ВСЕХ ФУНКЦИЙ ================
export default {
  // Категории меню
  getMenuCategories,
  addMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  
  // Продукты
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  
  // Статистика
  getMenuStats
};