// services/Partner/partner.menu.service.js - ПОЛНЫЙ СЕРВИС С ФРАНЦУЗСКОЙ ПОДДЕРЖКОЙ 🇫🇷

import { PartnerProfile, Product } from '../../models/index.js';
import mongoose from 'mongoose';

// ============ УТИЛИТЫ НОРМАЛИЗАЦИИ (БЕЗОПАСНЫЕ) ============

/**
 * Нормализация уровня острости (поддержка старого и нового формата)
 */
const normalizeSpiceLevel = (spiceLevel) => {
  if (typeof spiceLevel === 'number') {
    return spiceLevel; // Старый формат - оставляем как есть
  }
  
  if (typeof spiceLevel === 'string') {
    const spiceLevelMap = {
      // Французский → число
      'aucun': 0, 'doux': 1, 'moyen': 2, 'piquant': 3, 'très_piquant': 4, 'extrême': 5,
      // Английский → число
      'none': 0, 'mild': 1, 'medium': 2, 'hot': 3, 'very_hot': 4, 'extreme': 5,
      // Русский → число
      'нет': 0, 'слабо': 1, 'средне': 2, 'остро': 3, 'очень_остро': 4, 'экстрим': 5
    };
    
    const numericLevel = spiceLevelMap[spiceLevel.toLowerCase()];
    return numericLevel !== undefined ? numericLevel : spiceLevel; // Если не найдено, возвращаем как есть
  }
  
  return 0; // По умолчанию
};

/**
 * Нормализация аллергенов (расширяем список, не ломаем старые)
 */
const normalizeAllergens = (allergens) => {
  if (!allergens || !Array.isArray(allergens)) return [];
  
  const allergenMap = {
    // Английский → русский (для старой совместимости)
    'gluten': 'глютен',
    'eggs': 'яйца',
    'fish': 'рыба',
    'peanuts': 'арахис',
    'soy': 'соя',
    'soybeans': 'соя',
    'milk': 'молочные продукты',
    'dairy': 'молочные продукты',
    'nuts': 'орехи',
    'tree_nuts': 'орехи',
    'celery': 'сельдерей',
    'mustard': 'горчица',
    'sesame': 'кунжут',
    'sesame_seeds': 'кунжут',
    'sulfites': 'сульфиты',
    'sulfur_dioxide_and_sulfites': 'сульфиты',
    'lupin': 'люпин',
    'shellfish': 'морепродукты',
    'crustaceans': 'морепродукты',
    'mollusks': 'моллюски',
    
    // Французский → русский (основная цель - сохранить работоспособность)
    'lait': 'молочные продукты',
    'œufs': 'яйца',
    'poissons': 'рыба',
    'arachides': 'арахис',
    'soja': 'соя',
    'fruits_à_coque': 'орехи',
    'céleri': 'сельдерей',
    'moutarde': 'горчица',
    'graines_de_sésame': 'кунжут',
    'anhydride_sulfureux_et_sulfites': 'сульфиты',
    'crustacés': 'морепродукты',
    'mollusques': 'моллюски'
  };
  
  return allergens.map(allergen => {
    const lowerAllergen = allergen.toLowerCase().replace(/\s+/g, '_');
    return allergenMap[lowerAllergen] || allergen; // Если не найдено, оставляем оригинал
  }).filter((allergen, index, arr) => arr.indexOf(allergen) === index); // Убираем дубликаты
};

/**
 * Безопасная нормализация данных блюда
 */
const normalizeDishInfoSafe = (dishInfo, partnerCategory) => {
  if (!dishInfo || typeof dishInfo !== 'object') return {};
  
  const normalized = { ...dishInfo };
  
  // ✅ Нормализуем spice_level безопасно
  if (normalized.spice_level !== undefined) {
    normalized.spice_level = normalizeSpiceLevel(normalized.spice_level);
  }
  
  // ✅ Нормализуем аллергены безопасно
  if (normalized.allergens) {
    normalized.allergens = normalizeAllergens(normalized.allergens);
  }
  
  // ✅ Добавляем новые поля только если они переданы
  if (normalized.dietary_tags) {
    // Переименовываем в dietary_labels для новой модели
    normalized.dietary_labels = Array.isArray(normalized.dietary_tags) ? 
      normalized.dietary_tags : [];
    delete normalized.dietary_tags;
  }
  
  // ✅ Автоматически устанавливаем булевы флаги
  if (normalized.dietary_labels) {
    normalized.is_vegetarian = normalized.dietary_labels.includes('végétarien') || 
                             normalized.dietary_labels.includes('vegetarian') ||
                             normalized.dietary_labels.includes('вегетарианский');
    normalized.is_vegan = normalized.dietary_labels.includes('végétalien') || 
                        normalized.dietary_labels.includes('vegan') ||
                        normalized.dietary_labels.includes('веганский');
    normalized.is_halal = normalized.dietary_labels.includes('halal') ||
                        normalized.dietary_labels.includes('халяль');
  }
  
  return normalized;
};

/**
 * Определение мультиязычных полей
 */
const detectMultilingualFields = (productData) => {
  const multilingual = {};
  
  if (productData.title) {
    const title = productData.title;
    if (/[а-яё]/i.test(title)) {
      multilingual.title_ru = title;
    } else if (/[àâäçéèêëïîôùûüÿñæœ]/i.test(title)) {
      multilingual.title_fr = title;
    } else {
      multilingual.title_en = title;
    }
  }
  
  if (productData.description) {
    const description = productData.description;
    if (/[а-яё]/i.test(description)) {
      multilingual.description_ru = description;
    } else if (/[àâäçéèêëïîôùûüÿñæœ]/i.test(description)) {
      multilingual.description_fr = description;
    } else {
      multilingual.description_en = description;
    }
  }
  
  return Object.keys(multilingual).length > 0 ? multilingual : undefined;
};

/**
 * Расчет французских налогов (опционально)
 */
const calculateFrenchTaxes = (price, category, customTaxInfo) => {
  // Если налоги не указаны явно, не добавляем их
  if (!customTaxInfo?.tva_rate && !customTaxInfo?.calculate_french_taxes) {
    return undefined;
  }
  
  const tvaRate = customTaxInfo.tva_rate || (category === 'restaurant' ? 5.5 : 20);
  const priceIncludesTva = customTaxInfo.price_includes_tva !== false;
  
  return {
    tva_rate: tvaRate,
    price_includes_tva: priceIncludesTva,
    tva_amount: priceIncludesTva ? 
      price * (tvaRate / (100 + tvaRate)) : 
      price * (tvaRate / 100)
  };
};

/**
 * Валидация и обработка групп опций
 */
function validateAndProcessOptionsGroups(optionsGroups, warnings) {
  const validatedGroups = [];
  
  optionsGroups.forEach((group, groupIndex) => {
    if (!group.name || typeof group.name !== 'string') {
      warnings.push(`Группа добавок ${groupIndex + 1}: отсутствует название`);
      return;
    }

    if (!group.options || !Array.isArray(group.options) || group.options.length === 0) {
      warnings.push(`Группа "${group.name}": отсутствуют опции`);
      return;
    }

    const validatedOptions = [];
    group.options.forEach((option, optionIndex) => {
      if (!option.name || typeof option.name !== 'string') {
        warnings.push(`Опция ${optionIndex + 1} в группе "${group.name}": отсутствует название`);
        return;
      }

      if (typeof option.price !== 'number' || option.price < 0) {
        warnings.push(`Опция "${option.name}": некорректная цена`);
        return;
      }

      validatedOptions.push({
        name: option.name.trim(),
        description: option.description?.trim() || '',
        price: parseFloat(option.price),
        is_available: option.is_available !== false
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

  return validatedGroups;
}

// ============ УПРАВЛЕНИЕ КАТЕГОРИЯМИ МЕНЮ ============

/**
 * Получение всех категорий меню партнера
 * @param {string} partnerId - ID партнера
 * @returns {object} - Категории меню с статистикой
 */
const getPartnerMenuCategories = async (partnerId) => {
  try {
    if (!partnerId) {
      throw new Error('Partner ID обязателен');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Обновляем статистику продуктов для каждой категории
    await partner.updateProductStats();

    return {
      categories: partner.menu_categories,
      total_categories: partner.menu_categories.length,
      business_info: {
        business_name: partner.business_name,
        brand_name: partner.brand_name,
        category: partner.category
      }
    };

  } catch (error) {
    console.error('🚨 GET PARTNER MENU CATEGORIES ERROR:', error);
    throw error;
  }
};

/**
 * Добавление новой категории меню
 * @param {string} partnerId - ID партнера
 * @param {object} categoryData - Данные категории
 * @returns {object} - Добавленная категория
 */
const addMenuCategoryService = async (partnerId, categoryData) => {
  try {
    if (!partnerId) {
      throw new Error('Partner ID обязателен');
    }

    const { name, description, image_url, sort_order } = categoryData;

    // Валидация
    if (!name || name.trim().length === 0) {
      throw new Error('Название категории обязательно');
    }

    if (name.length > 50) {
      throw new Error('Название категории не должно превышать 50 символов');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Добавляем категорию через метод модели
    await partner.addMenuCategory({
      name: name.trim(),
      description: description?.trim() || '',
      image_url: image_url || '',
      sort_order: sort_order || partner.menu_categories.length
    });

    const addedCategory = partner.menu_categories[partner.menu_categories.length - 1];

    return {
      category: addedCategory,
      total_categories: partner.menu_categories.length
    };

  } catch (error) {
    console.error('🚨 ADD MENU CATEGORY ERROR:', error);
    throw error;
  }
};

/**
 * Обновление категории меню
 * @param {string} partnerId - ID партнера
 * @param {string} categoryId - ID категории
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Обновленная категория
 */
const updateMenuCategory = async (partnerId, categoryId, updateData) => {
  try {
    if (!partnerId || !categoryId) {
      throw new Error('Partner ID и Category ID обязательны');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Обновляем категорию через метод модели
    await partner.updateMenuCategory(categoryId, updateData);

    // Находим обновленную категорию
    const updatedCategory = partner.menu_categories.id(categoryId);
    
    if (!updatedCategory) {
      throw new Error('Категория не найдена после обновления');
    }

    return {
      category: updatedCategory
    };

  } catch (error) {
    console.error('🚨 UPDATE MENU CATEGORY ERROR:', error);
    throw error;
  }
};

/**
 * Удаление категории меню
 * @param {string} partnerId - ID партнера
 * @param {string} categoryId - ID категории
 * @returns {object} - Информация об удалении
 */
const deleteMenuCategory = async (partnerId, categoryId) => {
  try {
    if (!partnerId || !categoryId) {
      throw new Error('Partner ID и Category ID обязательны');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Проверяем есть ли продукты в этой категории
    const category = partner.menu_categories.id(categoryId);
    if (!category) {
      throw new Error('Категория не найдена');
    }

    const productsInCategory = await Product.countDocuments({ 
      partner_id: partner._id, 
      subcategory: category.slug 
    });

    if (productsInCategory > 0) {
      throw new Error(`Невозможно удалить категорию "${category.name}". В ней ${productsInCategory} товаров. Сначала переместите или удалите товары.`);
    }

    // Удаляем категорию
    await partner.removeMenuCategory(categoryId);

    return {
      remaining_categories: partner.menu_categories.length
    };

  } catch (error) {
    console.error('🚨 DELETE MENU CATEGORY ERROR:', error);
    throw error;
  }
};

// ============ УПРАВЛЕНИЕ ПРОДУКТАМИ ============

/**
 * Получение всех продуктов партнера с поддержкой французских фильтров
 * @param {string} partnerId - ID партнера
 * @param {object} filters - Фильтры
 * @returns {object} - Продукты партнера
 */
const getPartnerProducts = async (partnerId, filters = {}) => {
  try {
    if (!partnerId) {
      throw new Error('Partner ID обязателен');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // ✅ ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД С ПОДДЕРЖКОЙ ФРАНЦУЗСКИХ ФИЛЬТРОВ
    let products;
    if (Object.keys(filters).some(key => 
      ['dietary_labels', 'allergen_free', 'cuisine_type', 'spice_level_max', 'availability_time'].includes(key)
    )) {
      // Новые французские фильтры
      products = await Product.findWithFrenchFilters(partner._id, filters);
    } else {
      // Старые фильтры (совместимость)
      const { category_slug, include_inactive } = filters;
      
      if (category_slug) {
        products = await Product.findByPartnerCategory(
          partner._id, 
          category_slug, 
          include_inactive === 'true'
        );
      } else {
        products = await Product.findByPartner(
          partner._id, 
          include_inactive === 'true'
        );
      }
    }

    // Группируем по категориям
    const productsByCategory = {};
    partner.menu_categories.forEach(category => {
      const categoryProducts = products.filter(p => p.subcategory === category.slug);
      
      productsByCategory[category.slug] = {
        category_info: category,
        products: categoryProducts.map(product => {
          const productObj = product.toObject();
          
          // ✅ ДОБАВЛЯЕМ ФРАНЦУЗСКИЕ МЕТАДАННЫЕ
          return {
            ...productObj,
            // Локализованные поля
            localized_title: product.getLocalizedTitle ? 
              product.getLocalizedTitle(filters.language || 'ru') : product.title,
            display_spice_level: product.getSpiceLevelDisplay ? 
              product.getSpiceLevelDisplay(filters.language || 'ru') : product.dish_info?.spice_level,
            
            // Французская налоговая информация
            tax_calculation: product.tax_info && product.calculateTaxes ? 
              product.calculateTaxes() : undefined,
            
            // Французские особенности
            french_metadata: {
              has_multilingual: !!product.multilingual,
              has_french_allergens: product.dish_info?.allergens?.some(a => 
                ['gluten', 'lait', 'œufs'].includes(a)
              ),
              dietary_labels_count: product.dietary_labels?.length || 0
            }
          };
        })
      };
    });

    return {
      products_by_category: productsByCategory,
      total_products: products.length,
      business_info: {
        business_name: partner.business_name,
        brand_name: partner.brand_name,
        category: partner.category
      },
      french_support: {
        multilingual_enabled: true,
        tax_calculation_available: true,
        dietary_filtering_enabled: true,
        language: filters.language || 'ru'
      }
    };

  } catch (error) {
    console.error('🚨 GET PARTNER PRODUCTS ERROR:', error);
    throw error;
  }
};

/**
 * Добавление нового продукта с поддержкой французских стандартов
 * @param {string} partnerId - ID партнера
 * @param {object} productData - Данные продукта
 * @returns {object} - Созданный продукт
 */
const addPartnerProduct = async (partnerId, productData) => {
  try {
    if (!partnerId) {
      throw new Error('Partner ID обязателен');
    }

    const {
      title, description, price, discount_price, image_url,
      subcategory, preparation_time, options_groups,
      dish_info, product_info, tags, tax_info
    } = productData;

    // ✅ БАЗОВАЯ ВАЛИДАЦИЯ (как было)
    if (!title || !price || !subcategory) {
      throw new Error('Обязательные поля: title, price, subcategory');
    }

    if (price <= 0) {
      throw new Error('Цена должна быть больше нуля');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Проверяем существование категории
    const category = partner.menu_categories.find(cat => cat.slug === subcategory);
    if (!category) {
      throw new Error('Категория меню не найдена');
    }

    // ✅ БИЗНЕС-ЛОГИКА (сохраняем как было)
    let finalOptionsGroups = [];
    let validationWarnings = [];

    if (partner.category === 'restaurant') {
      if (options_groups && Array.isArray(options_groups)) {
        finalOptionsGroups = validateAndProcessOptionsGroups(options_groups, validationWarnings);
      }
    } else if (partner.category === 'store') {
      if (options_groups && options_groups.length > 0) {
        throw new Error('Магазины не могут добавлять опции к товарам. Только рестораны поддерживают добавки.');
      }
      finalOptionsGroups = [];
    }

    // Время приготовления
    let finalPreparationTime = 0;
    if (partner.category === 'restaurant') {
      finalPreparationTime = preparation_time || 15;
    }

    // ✅ БЕЗОПАСНАЯ НОРМАЛИЗАЦИЯ
    const normalizedDishInfo = normalizeDishInfoSafe(dish_info, partner.category);
    const multilingualData = detectMultilingualFields({ title, description });
    const frenchTaxInfo = calculateFrenchTaxes(price, partner.category, tax_info);

    // ✅ СОЗДАНИЕ ПРОДУКТА (с поддержкой новых полей)
    const productPayload = {
      partner_id: partner._id,
      title: title.trim(),
      description: description?.trim() || '',
      price: parseFloat(price),
      discount_price: discount_price ? parseFloat(discount_price) : null,
      image_url: image_url || '',
      category: partner.category,
      subcategory: subcategory,
      menu_category_id: category._id,
      preparation_time: finalPreparationTime,
      options_groups: finalOptionsGroups,
      
      // ✅ НОРМАЛИЗОВАННАЯ информация о блюде
      dish_info: normalizedDishInfo,
      
      // ✅ Информация о товаре (расширенная для магазинов)
      product_info: partner.category === 'store' ? {
        ...product_info,
        origin_country: product_info?.origin_country || 'France'
      } : (product_info || {}),
      
      // ✅ НОВЫЕ ПОЛЯ (только если есть данные)
      ...(multilingualData && { multilingual: multilingualData }),
      ...(frenchTaxInfo && { tax_info: frenchTaxInfo }),
      
      // ✅ Расписание доступности (только для ресторанов)
      ...(partner.category === 'restaurant' && productData.availability_schedule && {
        availability_schedule: productData.availability_schedule
      }),
      
      // ✅ Диетические метки (если переданы)
      ...(normalizedDishInfo.dietary_labels && {
        dietary_labels: normalizedDishInfo.dietary_labels
      }),
      
      // ✅ Теги (как было)
      tags: tags || [],
      last_updated_by: partnerId
    };

    const newProduct = new Product(productPayload);

    // ✅ ВАЛИДАЦИЯ (как было)
    await newProduct.validateCategory();
    await newProduct.save();

    // ✅ ОБНОВЛЕНИЕ СТАТИСТИКИ (как было)
    await partner.updateProductStats();

    return {
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
      french_features: {
        multilingual_detected: !!multilingualData,
        tax_info_added: !!frenchTaxInfo,
        allergens_normalized: normalizedDishInfo.allergens?.length || 0,
        spice_level_normalized: normalizedDishInfo.spice_level !== undefined
      },
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined
    };

  } catch (error) {
    console.error('🚨 ADD PARTNER PRODUCT ERROR:', error);
    throw error;
  }
};

/**
 * Обновление продукта с логикой добавок и французской поддержкой
 * @param {string} partnerId - ID партнера
 * @param {string} productId - ID продукта
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Обновленный продукт
 */
const updatePartnerProduct = async (partnerId, productId, updateData) => {
  try {
    if (!partnerId || !productId) {
      throw new Error('Partner ID и Product ID обязательны');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Находим продукт принадлежащий этому партнеру
    const product = await Product.findOne({ 
      _id: productId, 
      partner_id: partner._id 
    });

    if (!product) {
      throw new Error('Продукт не найден');
    }

    // Валидация изменения категории
    if (updateData.subcategory && updateData.subcategory !== product.subcategory) {
      const category = partner.menu_categories.find(cat => cat.slug === updateData.subcategory);
      if (!category) {
        throw new Error('Новая категория меню не найдена');
      }
      updateData.menu_category_id = category._id;
    }

    // Валидация цены
    if (updateData.price && updateData.price <= 0) {
      throw new Error('Цена должна быть больше нуля');
    }

    // ✅ БИЗНЕС-ЛОГИКА: Проверка добавок при обновлении
    let validationWarnings = [];

    if (updateData.options_groups !== undefined) {
      if (partner.category === 'restaurant') {
        // 🍽️ РЕСТОРАН: Разрешено обновление добавок
        if (Array.isArray(updateData.options_groups)) {
          updateData.options_groups = validateAndProcessOptionsGroups(updateData.options_groups, validationWarnings);
        }
      } else if (partner.category === 'store') {
        // 🏪 МАГАЗИН: Запрещено изменение добавок
        throw new Error('Магазины не могут изменять опции товаров. Только рестораны поддерживают добавки.');
      }
    }

    // ✅ БИЗНЕС-ЛОГИКА: Время приготовления
    if (updateData.preparation_time !== undefined) {
      if (partner.category === 'store' && updateData.preparation_time > 0) {
        validationWarnings.push('Время приготовления сброшено до 0 для магазинов');
        updateData.preparation_time = 0;
      }
    }

    // ✅ НОРМАЛИЗАЦИЯ ДАННЫХ О БЛЮДЕ
    if (updateData.dish_info) {
      updateData.dish_info = normalizeDishInfoSafe(updateData.dish_info, partner.category);
    }

    // ✅ МУЛЬТИЯЗЫЧНЫЕ ПОЛЯ
    if (updateData.title || updateData.description) {
      const multilingualData = detectMultilingualFields(updateData);
      if (multilingualData) {
        updateData.multilingual = { ...product.multilingual, ...multilingualData };
      }
    }

    // ✅ ФРАНЦУЗСКИЕ НАЛОГИ
    if (updateData.tax_info) {
      updateData.tax_info = calculateFrenchTaxes(
        updateData.price || product.price, 
        partner.category, 
        updateData.tax_info
      );
    }

    // Обновляем поля
    const allowedFields = [
      'title', 'description', 'price', 'discount_price', 'image_url',
      'subcategory', 'menu_category_id', 'preparation_time', 'options_groups',
      'dish_info', 'product_info', 'tags', 'is_active', 'is_available',
      'sort_order', 'multilingual', 'tax_info', 'availability_schedule',
      'dietary_labels'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        product[field] = updateData[field];
      }
    });

    // Обновляем кто последний раз изменил
    product.last_updated_by = partnerId;

    // Валидируем категорию если изменилась
    if (updateData.subcategory) {
      await product.validateCategory();
    }

    await product.save();

    // Обновляем статистику партнера
    await partner.updateProductStats();

    return {
      product: product,
      business_rules: {
        partner_category: partner.category,
        supports_options: partner.category === 'restaurant',
        options_groups_count: product.options_groups.length
      },
      french_features: {
        multilingual_updated: !!updateData.multilingual,
        tax_info_updated: !!updateData.tax_info,
        allergens_normalized: product.dish_info?.allergens?.length || 0
      },
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined
    };

  } catch (error) {
    console.error('🚨 UPDATE PARTNER PRODUCT ERROR:', error);
    throw error;
  }
};

/**
 * Удаление продукта партнера
 * @param {string} partnerId - ID партнера
 * @param {string} productId - ID продукта
 * @returns {object} - Информация об удалении
 */
const deletePartnerProduct = async (partnerId, productId) => {
  try {
    if (!partnerId || !productId) {
      throw new Error('Partner ID и Product ID обязательны');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Находим и удаляем продукт принадлежащий этому партнеру
    const product = await Product.findOneAndDelete({ 
      _id: productId, 
      partner_id: partner._id 
    });

    if (!product) {
      throw new Error('Продукт не найден');
    }

    // Обновляем статистику партнера
    await partner.updateProductStats();

    // Подсчитываем оставшиеся продукты
    const remainingProducts = await Product.countDocuments({ partner_id: partner._id });

    return {
      deleted_product: {
        id: product._id,
        title: product.title,
        category_slug: product.subcategory
      },
      remaining_products: remainingProducts
    };

  } catch (error) {
    console.error('🚨 DELETE PARTNER PRODUCT ERROR:', error);
    throw error;
  }
};

// ============ СТАТИСТИКА МЕНЮ ============

/**
 * Получение полной статистики меню партнера
 * @param {string} partnerId - ID партнера
 * @returns {object} - Статистика меню
 */
const getPartnerMenuStats = async (partnerId) => {
  try {
    if (!partnerId) {
      throw new Error('Partner ID обязателен');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Обновляем статистику
    await partner.updateProductStats();

    // Получаем полную статистику через метод модели
    let fullStats;
    if (typeof partner.getFullMenuStats === 'function') {
      fullStats = await partner.getFullMenuStats();
    } else {
      // Fallback если метод не найден
      const allProducts = await Product.find({ partner_id: partner._id });
      const activeProducts = allProducts.filter(p => p.is_active && p.is_available);
      
      fullStats = {
        overview: {
          total_products: allProducts.length,
          active_products: activeProducts.length,
          total_categories: partner.menu_categories.length
        },
        categories: partner.menu_categories.map(category => ({
          category: {
            id: category._id,
            name: category.name,
            slug: category.slug
          },
          products: {
            total: category.products_count || 0,
            active: category.active_products_count || 0
          }
        }))
      };
    }

    // ✅ ДОБАВЛЯЕМ ФРАНЦУЗСКИЕ МЕТРИКИ
    const frenchMetrics = await calculateFrenchMenuMetrics(partner._id);

    return {
      stats: fullStats,
      french_metrics: frenchMetrics,
      business_info: {
        business_name: partner.business_name,
        brand_name: partner.brand_name,
        category: partner.category
      }
    };

  } catch (error) {
    console.error('🚨 GET PARTNER MENU STATS ERROR:', error);
    throw error;
  }
};

/**
 * Расчет французских метрик меню
 * @param {string} partnerId - ID профиля партнера
 * @returns {object} - Французские метрики
 */
const calculateFrenchMenuMetrics = async (partnerId) => {
  try {
    const products = await Product.find({ partner_id: partnerId, is_active: true });
    
    // Подсчет по диетическим меткам
    const dietaryStats = {};
    const allergenStats = {};
    const spiceLevelStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const cuisineStats = {};
    
    let multilingualCount = 0;
    let withTaxInfoCount = 0;
    let withNutritionCount = 0;
    
    products.forEach(product => {
      // Диетические метки
      if (product.dietary_labels) {
        product.dietary_labels.forEach(label => {
          dietaryStats[label] = (dietaryStats[label] || 0) + 1;
        });
      }
      
      // Аллергены
      if (product.dish_info?.allergens) {
        product.dish_info.allergens.forEach(allergen => {
          allergenStats[allergen] = (allergenStats[allergen] || 0) + 1;
        });
      }
      
      // Уровень острости
      const spiceLevel = product.dish_info?.spice_level;
      if (typeof spiceLevel === 'number' && spiceLevel >= 0 && spiceLevel <= 5) {
        spiceLevelStats[spiceLevel]++;
      }
      
      // Тип кухни
      if (product.dish_info?.cuisine_type) {
        cuisineStats[product.dish_info.cuisine_type] = 
          (cuisineStats[product.dish_info.cuisine_type] || 0) + 1;
      }
      
      // Мультиязычность
      if (product.multilingual) {
        multilingualCount++;
      }
      
      // Налоговая информация
      if (product.tax_info) {
        withTaxInfoCount++;
      }
      
      // Пищевая ценность
      if (product.dish_info?.nutrition?.calories_per_100g) {
        withNutritionCount++;
      }
    });
    
    const totalProducts = products.length;
    
    return {
      dietary_compliance: {
        vegetarian_count: dietaryStats['végétarien'] || dietaryStats['vegetarian'] || 0,
        vegan_count: dietaryStats['végétalien'] || dietaryStats['vegan'] || 0,
        halal_count: dietaryStats['halal'] || 0,
        gluten_free_count: dietaryStats['sans_gluten'] || dietaryStats['gluten_free'] || 0,
        organic_count: dietaryStats['bio'] || dietaryStats['organic'] || 0
      },
      
      allergen_distribution: allergenStats,
      
      spice_level_distribution: spiceLevelStats,
      
      cuisine_distribution: cuisineStats,
      
      french_compliance: {
        multilingual_products: multilingualCount,
        multilingual_percentage: totalProducts > 0 ? 
          Math.round((multilingualCount / totalProducts) * 100) : 0,
        
        with_tax_info: withTaxInfoCount,
        tax_compliance_percentage: totalProducts > 0 ? 
          Math.round((withTaxInfoCount / totalProducts) * 100) : 0,
        
        with_nutrition_info: withNutritionCount,
        nutrition_compliance_percentage: totalProducts > 0 ? 
          Math.round((withNutritionCount / totalProducts) * 100) : 0
      },
      
      recommendations: generateFrenchRecommendations(totalProducts, {
        multilingualCount,
        withTaxInfoCount,
        withNutritionCount,
        allergenStats
      })
    };
    
  } catch (error) {
    console.error('🚨 CALCULATE FRENCH MENU METRICS ERROR:', error);
    return {
      error: 'Не удалось рассчитать французские метрики',
      basic_stats_only: true
    };
  }
};

/**
 * Генерация рекомендаций для французского рынка
 * @param {number} totalProducts - Общее количество продуктов
 * @param {object} stats - Статистика
 * @returns {array} - Массив рекомендаций
 */
const generateFrenchRecommendations = (totalProducts, stats) => {
  const recommendations = [];
  
  if (totalProducts === 0) {
    recommendations.push({
      type: 'critical',
      priority: 'high',
      message: 'Добавьте продукты в меню для начала работы',
      action: 'add_products'
    });
    return recommendations;
  }
  
  // Мультиязычность
  const multilingualPercentage = (stats.multilingualCount / totalProducts) * 100;
  if (multilingualPercentage < 50) {
    recommendations.push({
      type: 'localization',
      priority: 'medium',
      message: `Только ${Math.round(multilingualPercentage)}% продуктов имеют мультиязычные названия`,
      action: 'add_multilingual_titles',
      suggestion: 'Добавьте французские переводы для лучшего SEO'
    });
  }
  
  // Налоговая информация
  const taxCompliancePercentage = (stats.withTaxInfoCount / totalProducts) * 100;
  if (taxCompliancePercentage < 100) {
    recommendations.push({
      type: 'compliance',
      priority: 'high',
      message: `${totalProducts - stats.withTaxInfoCount} продуктов без налоговой информации`,
      action: 'add_tax_info',
      suggestion: 'Добавьте НДС информацию для соответствия французским стандартам'
    });
  }
  
  // Пищевая ценность
  const nutritionPercentage = (stats.withNutritionCount / totalProducts) * 100;
  if (nutritionPercentage < 30) {
    recommendations.push({
      type: 'nutrition',
      priority: 'medium',
      message: `Только ${Math.round(nutritionPercentage)}% продуктов содержат информацию о пищевой ценности`,
      action: 'add_nutrition_info',
      suggestion: 'Добавьте калорийность и пищевую ценность (рекомендуется для ресторанов)'
    });
  }
  
  // Аллергены
  const hasAllergenInfo = Object.keys(stats.allergenStats).length > 0;
  if (!hasAllergenInfo) {
    recommendations.push({
      type: 'legal',
      priority: 'critical',
      message: 'Отсутствует информация об аллергенах',
      action: 'add_allergen_info',
      suggestion: 'Обязательно укажите аллергены согласно французскому законодательству'
    });
  }
  
  return recommendations;
};

// ============ УТИЛИТЫ И ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ============

/**
 * Поиск продуктов по тексту с поддержкой мультиязычности
 * @param {string} partnerId - ID партнера
 * @param {string} searchQuery - Поисковый запрос
 * @param {object} options - Опции поиска
 * @returns {object} - Результаты поиска
 */
const searchPartnerProducts = async (partnerId, searchQuery, options = {}) => {
  try {
    if (!partnerId || !searchQuery) {
      throw new Error('Partner ID и поисковый запрос обязательны');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    const { language = 'ru', limit = 20 } = options;

    // Текстовый поиск с поддержкой мультиязычности
    const searchResults = await Product.find({
      partner_id: partner._id,
      is_active: true,
      $text: { $search: searchQuery }
    })
    .limit(limit)
    .sort({ score: { $meta: 'textScore' } });

    return {
      query: searchQuery,
      results: searchResults.map(product => ({
        ...product.toObject(),
        localized_title: product.getLocalizedTitle ? 
          product.getLocalizedTitle(language) : product.title,
        relevance_score: product.score || 0
      })),
      total_found: searchResults.length,
      search_options: {
        language,
        limit
      }
    };

  } catch (error) {
    console.error('🚨 SEARCH PARTNER PRODUCTS ERROR:', error);
    throw error;
  }
};

/**
 * Массовое обновление продуктов
 * @param {string} partnerId - ID партнера
 * @param {object} updateData - Данные для обновления
 * @param {object} filters - Фильтры для выбора продуктов
 * @returns {object} - Результат массового обновления
 */
const bulkUpdateProducts = async (partnerId, updateData, filters = {}) => {
  try {
    if (!partnerId) {
      throw new Error('Partner ID обязателен');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    // Строим фильтр для продуктов
    const productFilter = { partner_id: partner._id };
    
    if (filters.subcategory) {
      productFilter.subcategory = filters.subcategory;
    }
    
    if (filters.is_active !== undefined) {
      productFilter.is_active = filters.is_active;
    }

    // Безопасные поля для массового обновления
    const allowedFields = ['is_active', 'is_available', 'sort_order', 'tags'];
    const safeUpdateData = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        safeUpdateData[field] = updateData[field];
      }
    });

    if (Object.keys(safeUpdateData).length === 0) {
      throw new Error('Нет допустимых полей для обновления');
    }

    // Добавляем информацию о последнем обновлении
    safeUpdateData.last_updated_by = partnerId;

    // Выполняем массовое обновление
    const updateResult = await Product.updateMany(productFilter, safeUpdateData);

    // Обновляем статистику партнера
    await partner.updateProductStats();

    return {
      matched_products: updateResult.matchedCount,
      modified_products: updateResult.modifiedCount,
      update_data: safeUpdateData,
      filters_applied: filters
    };

  } catch (error) {
    console.error('🚨 BULK UPDATE PRODUCTS ERROR:', error);
    throw error;
  }
};

/**
 * Экспорт меню в различных форматах
 * @param {string} partnerId - ID партнера
 * @param {string} format - Формат экспорта (json, csv)
 * @param {object} options - Опции экспорта
 * @returns {object} - Экспортированные данные
 */
const exportPartnerMenu = async (partnerId, format = 'json', options = {}) => {
  try {
    if (!partnerId) {
      throw new Error('Partner ID обязателен');
    }

    const partner = await PartnerProfile.findOne({ user_id: partnerId });
    
    if (!partner) {
      throw new Error('Профиль партнера не найден');
    }

    const { include_inactive = false, language = 'ru' } = options;

    // Получаем все продукты
    const products = await Product.find({
      partner_id: partner._id,
      ...(include_inactive ? {} : { is_active: true, is_available: true })
    }).sort({ subcategory: 1, sort_order: 1, title: 1 });

    const exportData = {
      restaurant_info: {
        name: partner.business_name,
        brand_name: partner.brand_name,
        category: partner.category,
        total_products: products.length
      },
      categories: partner.menu_categories.map(category => ({
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        products_count: products.filter(p => p.subcategory === category.slug).length
      })),
      products: products.map(product => {
        const baseData = {
          id: product._id,
          title: product.getLocalizedTitle ? 
            product.getLocalizedTitle(language) : product.title,
          description: product.description,
          price: product.price,
          discount_price: product.discount_price,
          final_price: product.final_price,
          category: product.subcategory,
          preparation_time: product.preparation_time,
          is_active: product.is_active,
          is_available: product.is_available
        };

        // Добавляем французские поля если есть
        if (product.dish_info) {
          baseData.allergens = product.dish_info.allergens;
          baseData.spice_level = product.getSpiceLevelDisplay ? 
            product.getSpiceLevelDisplay(language) : product.dish_info.spice_level;
          baseData.is_vegetarian = product.dish_info.is_vegetarian;
          baseData.is_vegan = product.dish_info.is_vegan;
          baseData.is_halal = product.dish_info.is_halal;
        }

        if (product.dietary_labels) {
          baseData.dietary_labels = product.dietary_labels;
        }

        if (product.tax_info && product.calculateTaxes) {
          baseData.tax_calculation = product.calculateTaxes();
        }

        return baseData;
      }),
      export_info: {
        exported_at: new Date(),
        format: format,
        language: language,
        include_inactive: include_inactive,
        total_items: products.length
      }
    };

    return {
      format: format,
      data: exportData,
      filename: `${partner.business_name.replace(/\s+/g, '_')}_menu_${format}_${new Date().toISOString().split('T')[0]}`
    };

  } catch (error) {
    console.error('🚨 EXPORT PARTNER MENU ERROR:', error);
    throw error;
  }
};

// ============ ЭКСПОРТ ВСЕХ ФУНКЦИЙ ============

export {
  // Управление категориями
  getPartnerMenuCategories,
  addMenuCategoryService,
  updateMenuCategory,
  deleteMenuCategory,
  
  // Управление продуктами
  getPartnerProducts,
  addPartnerProduct,
  updatePartnerProduct,
  deletePartnerProduct,
  
  // Статистика
  getPartnerMenuStats,
  calculateFrenchMenuMetrics,
  
  // Дополнительные функции
  searchPartnerProducts,
  bulkUpdateProducts,
  exportPartnerMenu,
  
  // Утилиты нормализации (для других модулей)
  normalizeSpiceLevel,
  normalizeAllergens,
  normalizeDishInfoSafe,
  detectMultilingualFields,
  calculateFrenchTaxes,
  validateAndProcessOptionsGroups
};