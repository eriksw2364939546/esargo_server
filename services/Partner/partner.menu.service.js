// ================ services/Partner/partner.menu.service.js - ПОЛНЫЙ СЕРВИС ================
import { PartnerProfile, Product } from '../../models/index.js';
import mongoose from 'mongoose';

// ============ УТИЛИТЫ ДЛЯ ОБРАБОТКИ ДАННЫХ ============

/**
 * Валидация и обработка групп добавок для ресторанов
 * ✅ ТОЛЬКО БИЗНЕС-ЛОГИКА, БЕЗ ВАЛИДАЦИИ (уже в middleware)
 * @param {Array} optionsGroups - Массив групп добавок
 * @returns {Array} - Обработанные группы добавок
 */
const processRestaurantOptions = (optionsGroups) => {
    return optionsGroups.map(group => ({
        name: group.name.trim(),
        description: group.description?.trim() || '',
        required: group.required || false,
        multiple_choice: group.multiple_choice || false,
        max_selections: group.max_selections || 1,
        options: group.options.map(option => ({
            name: option.name.trim(),
            price: parseFloat(option.price),
            is_available: option.is_available !== false
        }))
    }));
};

/**
 * Обработка информации об упаковке для магазинов
 * ✅ ТОЛЬКО БИЗНЕС-ЛОГИКА
 * @param {Object} productInfo - Информация о продукте
 * @param {string} partnerCountry - Страна партнера
 * @returns {Object} - Обработанная информация об упаковке
 */
const processStorePackaging = (productInfo, partnerCountry = 'France') => {
    const processed = { ...productInfo };
    
    // Устанавливаем страну происхождения по умолчанию
    if (!processed.origin_country) {
        processed.origin_country = partnerCountry;
    }
    
    // Нормализуем числовые значения
    if (processed.weight_grams) {
        processed.weight_grams = parseFloat(processed.weight_grams);
    }
    if (processed.volume_ml) {
        processed.volume_ml = parseFloat(processed.volume_ml);
    }
    if (processed.unit_count) {
        processed.unit_count = parseInt(processed.unit_count);
    }
    
    // Добавляем метаданные упаковки
    processed.packaging_metadata = {
        has_weight: !!processed.weight_grams,
        has_volume: !!processed.volume_ml,
        has_barcode: !!(processed.barcode_ean13 || processed.barcode_ean8),
        unit_type: processed.weight_grams ? 'weight' : processed.volume_ml ? 'volume' : 'count'
    };
    
    return processed;
};

/**
 * Нормализация информации о блюде для ресторанов
 * @param {Object} dishInfo - Информация о блюде
 * @returns {Object} - Нормализованная информация
 */
const processDishInfo = (dishInfo = {}) => {
    const processed = { ...dishInfo };
    
    // Нормализация аллергенов
    if (processed.allergens && Array.isArray(processed.allergens)) {
        processed.allergens = processed.allergens.filter(allergen => 
            typeof allergen === 'string' && allergen.trim().length > 0
        );
    }
    
    // Нормализация ингредиентов
    if (processed.ingredients && Array.isArray(processed.ingredients)) {
        processed.ingredients = processed.ingredients
            .filter(ingredient => typeof ingredient === 'string' && ingredient.trim().length > 0)
            .map(ingredient => ingredient.trim());
    }
    
    // Нормализация уровня острости
    if (processed.spice_level !== undefined) {
        if (typeof processed.spice_level === 'string') {
            const spiceLevelMap = {
                'нет': 0, 'слабо': 1, 'средне': 2, 'остро': 3, 'очень остро': 4, 'экстрим': 5,
                'none': 0, 'mild': 1, 'medium': 2, 'hot': 3, 'very hot': 4, 'extreme': 5,
                'aucun': 0, 'doux': 1, 'moyen': 2, 'piquant': 3, 'très piquant': 4, 'extrême': 5
            };
            processed.spice_level = spiceLevelMap[processed.spice_level.toLowerCase()] || 0;
        }
    }
    
    return processed;
};

// ============ УПРАВЛЕНИЕ КАТЕГОРИЯМИ МЕНЮ ============

/**
 * Получение всех категорий меню партнера
 * @param {string} partnerId - ID пользователя партнера
 * @returns {object} - Категории меню с дополнительной информацией
 */
const getPartnerMenuCategories = async (partnerId) => {
    try {
        if (!partnerId) {
            throw new Error('Partner ID обязателен');
        }

        console.log('🔍 GET PARTNER MENU CATEGORIES:', { partnerId });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Обновляем статистику продуктов для каждой категории
        await partner.updateProductStats();

        console.log('✅ CATEGORIES FOUND:', {
            total_categories: partner.menu_categories.length,
            business_name: partner.business_name,
            category: partner.category
        });

        return {
            categories: partner.menu_categories,
            total_categories: partner.menu_categories.length,
            business_info: {
                business_name: partner.business_name,
                brand_name: partner.brand_name,
                category: partner.category,
                supports_options: partner.category === 'restaurant',
                supports_packaging: partner.category === 'store'
            }
        };

    } catch (error) {
        console.error('🚨 GET PARTNER MENU CATEGORIES ERROR:', error);
        throw error;
    }
};

/**
 * Добавление новой категории меню
 * ✅ ИСПРАВЛЕНО: Прямое добавление в массив menu_categories
 * @param {string} partnerId - ID пользователя партнера
 * @param {object} categoryData - Данные категории
 * @returns {object} - Добавленная категория
 */
const addMenuCategoryService = async (partnerId, categoryData) => {
    try {
        if (!partnerId) {
            throw new Error('Partner ID обязателен');
        }

        console.log('🔍 ADD MENU CATEGORY:', { 
            partnerId, 
            categoryName: categoryData.name 
        });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Проверяем, не существует ли уже категория с таким именем
        const existingCategory = partner.menu_categories.find(
            cat => cat.name.toLowerCase() === categoryData.name.toLowerCase().trim()
        );

        if (existingCategory) {
            throw new Error(`Категория "${categoryData.name}" уже существует`);
        }

        // ✅ ИСПРАВЛЕНО: Создаем slug с поддержкой кириллицы
        const createSlug = (name) => {
            // Словарь транслитерации русских букв
            const cyrillicToLatin = {
                'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
                'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
                'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
                'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
                'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
            };

            return name
                .toLowerCase()
                .trim()
                .split('')
                .map(char => cyrillicToLatin[char] || char)  // Транслитерация
                .join('')
                .replace(/[^a-z0-9\s-]/g, '')               // Удаляем все кроме букв, цифр, пробелов и дефисов
                .replace(/\s+/g, '-')                       // Пробелы в дефисы
                .replace(/-+/g, '-')                        // Убираем повторяющиеся дефисы
                .replace(/^-+|-+$/g, '');                   // Убираем дефисы в начале и конце
        };

        // ✅ ИСПРАВЛЕНО: Прямое добавление в массив menu_categories
        const categoryName = categoryData.name.trim();
        const categorySlug = createSlug(categoryName);
        
        // Проверяем, что slug не пустой
        if (!categorySlug) {
            throw new Error('Невозможно создать slug из названия категории');
        }

        // Проверяем уникальность slug
        const existingSlug = partner.menu_categories.find(cat => cat.slug === categorySlug);
        if (existingSlug) {
            throw new Error(`Категория с таким названием уже существует (slug: ${categorySlug})`);
        }

        const newCategory = {
            name: categoryName,
            slug: categorySlug,
            description: categoryData.description?.trim() || '',
            image_url: categoryData.image_url || '',
            sort_order: categoryData.sort_order !== undefined ? 
                categoryData.sort_order : partner.menu_categories.length,
            is_active: true,
            products_count: 0,
            created_at: new Date(),
            updated_at: new Date()
        };

        console.log('🔍 CREATING CATEGORY:', {
            name: newCategory.name,
            slug: newCategory.slug,
            slug_length: newCategory.slug.length
        });

        // Добавляем в массив
        partner.menu_categories.push(newCategory);
        
        // Сохраняем партнера
        await partner.save();

        // Получаем добавленную категорию (последний элемент)
        const addedCategory = partner.menu_categories[partner.menu_categories.length - 1];

        console.log('✅ CATEGORY ADDED:', {
            category_id: addedCategory._id,
            category_name: addedCategory.name,
            category_slug: addedCategory.slug,
            total_categories: partner.menu_categories.length
        });

        return {
            category: {
                id: addedCategory._id,
                name: addedCategory.name,
                slug: addedCategory.slug,
                description: addedCategory.description,
                image_url: addedCategory.image_url,
                sort_order: addedCategory.sort_order,
                is_active: addedCategory.is_active,
                products_count: addedCategory.products_count,
                created_at: addedCategory.created_at
            },
            total_categories: partner.menu_categories.length
        };

    } catch (error) {
        console.error('🚨 ADD MENU CATEGORY ERROR:', error);
        throw error;
    }
};

/**
 * Обновление категории меню
 * ✅ УБРАНА ВАЛИДАЦИЯ - ТОЛЬКО БИЗНЕС-ЛОГИКА
 * @param {string} partnerId - ID пользователя партнера
 * @param {string} categoryId - ID категории
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Обновленная категория
 */
const updateMenuCategory = async (partnerId, categoryId, updateData) => {
    try {
        if (!partnerId || !categoryId) {
            throw new Error('Partner ID и Category ID обязательны');
        }

        console.log('🔍 UPDATE MENU CATEGORY:', { 
            partnerId, 
            categoryId,
            updateData: Object.keys(updateData)
        });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Подготавливаем данные для обновления
        const processedUpdateData = {};
        if (updateData.name) processedUpdateData.name = updateData.name.trim();
        if (updateData.description !== undefined) processedUpdateData.description = updateData.description.trim();
        if (updateData.image_url !== undefined) processedUpdateData.image_url = updateData.image_url;
        if (updateData.sort_order !== undefined) processedUpdateData.sort_order = updateData.sort_order;

        // Обновляем категорию через метод модели
        await partner.updateMenuCategory(categoryId, processedUpdateData);

        // Находим обновленную категорию
        const updatedCategory = partner.menu_categories.id(categoryId);
        
        if (!updatedCategory) {
            throw new Error('Категория не найдена после обновления');
        }

        console.log('✅ CATEGORY UPDATED:', {
            category_id: updatedCategory._id,
            category_name: updatedCategory.name
        });

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
 * @param {string} partnerId - ID пользователя партнера
 * @param {string} categoryId - ID категории
 * @returns {object} - Информация об удалении
 */
const deleteMenuCategory = async (partnerId, categoryId) => {
    try {
        if (!partnerId || !categoryId) {
            throw new Error('Partner ID и Category ID обязательны');
        }

        console.log('🔍 DELETE MENU CATEGORY:', { partnerId, categoryId });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
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

        console.log('✅ CATEGORY DELETED:', {
            deleted_category: category.name,
            remaining_categories: partner.menu_categories.length
        });

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
 * Получение всех продуктов партнера с фильтрацией
 * @param {string} partnerId - ID пользователя партнера
 * @param {object} filters - Фильтры для поиска
 * @returns {object} - Продукты партнера сгруппированные по категориям
 */
const getPartnerProducts = async (partnerId, filters = {}) => {
    try {
        if (!partnerId) {
            throw new Error('Partner ID обязателен');
        }

        console.log('🔍 GET PARTNER PRODUCTS:', { 
            partnerId, 
            filters: Object.keys(filters) 
        });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Получаем продукты с фильтрами
        const { category_slug, include_inactive } = filters;
        let products;
        
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

        // Группируем по категориям
        const productsByCategory = {};
        partner.menu_categories.forEach(category => {
            const categoryProducts = products.filter(p => p.subcategory === category.slug);
            
            productsByCategory[category.slug] = {
                category_info: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    image_url: category.image_url,
                    sort_order: category.sort_order,
                    products_count: categoryProducts.length
                },
                products: categoryProducts.map(product => ({
                    ...product.getDisplayInfo(),
                    business_type: partner.category,
                    supports_options: partner.category === 'restaurant' && product.options_groups.length > 0,
                    has_packaging_info: partner.category === 'store' && !!product.product_info
                }))
            };
        });

        console.log('✅ PRODUCTS FOUND:', {
            total_products: products.length,
            categories_with_products: Object.keys(productsByCategory).filter(
                key => productsByCategory[key].products.length > 0
            ).length
        });

        return {
            products_by_category: productsByCategory,
            total_products: products.length,
            active_products: products.filter(p => p.is_active && p.is_available).length,
            business_info: {
                business_name: partner.business_name,
                brand_name: partner.brand_name,
                category: partner.category,
                supports_options: partner.category === 'restaurant',
                supports_packaging: partner.category === 'store'
            }
        };

    } catch (error) {
        console.error('🚨 GET PARTNER PRODUCTS ERROR:', error);
        throw error;
    }
};

/**
 * Добавление нового продукта с учетом типа заведения
 * ✅ УБРАНА ВАЛИДАЦИЯ - ТОЛЬКО БИЗНЕС-ЛОГИКА
 * @param {string} partnerId - ID пользователя партнера
 * @param {object} productData - Данные продукта
 * @returns {object} - Созданный продукт с дополнительной информацией
 */
const addPartnerProduct = async (partnerId, productData) => {
    try {
        if (!partnerId) {
            throw new Error('Partner ID обязателен');
        }

        const {
            title, description, price, discount_price, image_url,
            subcategory, preparation_time, options_groups,
            dish_info, product_info, tags
        } = productData;

        console.log('🔍 ADD PARTNER PRODUCT:', { 
            partnerId, 
            title,
            partner_type: 'detecting...'
        });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        console.log('🔍 PARTNER TYPE DETECTED:', { 
            partner_category: partner.category,
            business_name: partner.business_name
        });

        // Проверяем существование категории
        const category = partner.menu_categories.find(cat => cat.slug === subcategory);
        if (!category) {
    // Дополнительная отладочная информация
    console.log('🔍 CATEGORY SEARCH DEBUG:', {
        looking_for_slug: subcategory,
        available_categories: partner.menu_categories.map(cat => ({
            name: cat.name,
            slug: cat.slug || 'NO_SLUG',
            id: cat._id
        }))
    });
    throw new Error(`Категория с slug "${subcategory}" не найдена`);
        }

        // ✅ БИЗНЕС-ЛОГИКА: Обработка по типу заведения
        let finalOptionsGroups = [];
        let finalProductInfo = {};
        let finalDishInfo = {};
        let finalPreparationTime = 0;

        if (partner.category === 'restaurant') {
            // 🍽️ РЕСТОРАН: Обрабатываем добавки и информацию о блюде
            console.log('🍽️ PROCESSING RESTAURANT PRODUCT');
            
            if (options_groups && Array.isArray(options_groups) && options_groups.length > 0) {
                finalOptionsGroups = processRestaurantOptions(options_groups);
                console.log('✅ OPTIONS PROCESSED:', { groups_count: finalOptionsGroups.length });
            }
            
            finalPreparationTime = preparation_time || 15;
            finalDishInfo = processDishInfo(dish_info);
            
        } else if (partner.category === 'store') {
            // 🏪 МАГАЗИН: Обрабатываем упаковку
            console.log('🏪 PROCESSING STORE PRODUCT');
            
            finalOptionsGroups = []; // Никаких добавок для магазинов
            finalPreparationTime = 0; // Нет времени приготовления
            finalProductInfo = processStorePackaging(
                product_info || {}, 
                partner.address || 'France'
            );
            
            console.log('✅ PACKAGING PROCESSED:', finalProductInfo.packaging_metadata);
        }

        // ✅ СОЗДАНИЕ ПРОДУКТА
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
            tags: tags || [],
            last_updated_by: new mongoose.Types.ObjectId(partnerId)
        };

        // Добавляем специфичную информацию в зависимости от типа заведения
        if (partner.category === 'restaurant') {
            productPayload.dish_info = finalDishInfo;
        } else if (partner.category === 'store') {
            productPayload.product_info = finalProductInfo;
        }

        const newProduct = new Product(productPayload);

        // Валидация принадлежности к партнеру и сохранение
        await newProduct.validateCategory();
        await newProduct.save();

        // Обновление статистики партнера
        await partner.updateProductStats();

        console.log('✅ PRODUCT CREATED:', {
            product_id: newProduct._id,
            title: newProduct.title,
            category: newProduct.category,
            subcategory: newProduct.subcategory,
            has_options: finalOptionsGroups.length > 0,
            preparation_time: finalPreparationTime
        });

        return {
            product: newProduct.getDisplayInfo(),
            category_info: {
                id: category._id,
                name: category.name,
                slug: category.slug
            },
            business_rules: {
                partner_category: partner.category,
                supports_options: partner.category === 'restaurant',
                supports_packaging: partner.category === 'store',
                options_groups_count: finalOptionsGroups.length,
                preparation_time: finalPreparationTime,
                has_packaging_info: partner.category === 'store' && !!finalProductInfo.packaging_metadata
            }
        };

    } catch (error) {
        console.error('🚨 ADD PARTNER PRODUCT ERROR:', error);
        throw error;
    }
};

/**
 * Обновление продукта с учетом типа заведения
 * ✅ УБРАНА ВАЛИДАЦИЯ - ТОЛЬКО БИЗНЕС-ЛОГИКА
 * @param {string} partnerId - ID пользователя партнера
 * @param {string} productId - ID продукта
 * @param {object} updateData - Данные для обновления
 * @returns {object} - Обновленный продукт
 */
const updatePartnerProduct = async (partnerId, productId, updateData) => {
    try {
        if (!partnerId || !productId) {
            throw new Error('Partner ID и Product ID обязательны');
        }

        console.log('🔍 UPDATE PARTNER PRODUCT:', { 
            partnerId, 
            productId,
            fields_to_update: Object.keys(updateData)
        });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Находим продукт принадлежащий этому партнеру
        const product = await Product.findOne({ 
            _id: new mongoose.Types.ObjectId(productId), 
            partner_id: partner._id 
        });

        if (!product) {
            throw new Error('Продукт не найден');
        }

        console.log('🔍 CURRENT PRODUCT:', {
            title: product.title,
            category: product.category,
            current_options: product.options_groups.length
        });

        // Валидация изменения категории
        if (updateData.subcategory && updateData.subcategory !== product.subcategory) {
            const category = partner.menu_categories.find(cat => cat.slug === updateData.subcategory);
            if (!category) {
                throw new Error('Новая категория меню не найдена');
            }
            updateData.menu_category_id = category._id;
        }

        // ✅ БИЗНЕС-ЛОГИКА: Обработка по типу заведения
        if (updateData.options_groups !== undefined) {
            if (partner.category === 'restaurant') {
                // 🍽️ РЕСТОРАН: Обновляем добавки
                console.log('🍽️ UPDATING RESTAURANT OPTIONS');
                if (Array.isArray(updateData.options_groups)) {
                    updateData.options_groups = processRestaurantOptions(updateData.options_groups);
                    console.log('✅ OPTIONS UPDATED:', { groups_count: updateData.options_groups.length });
                }
            } else if (partner.category === 'store') {
                // 🏪 МАГАЗИН: Запрещаем добавки
                throw new Error('Магазины не могут изменять опции товаров. Только рестораны поддерживают добавки.');
            }
        }

        // Обработка информации о продукте/блюде
        if (partner.category === 'restaurant' && updateData.dish_info) {
            console.log('🍽️ UPDATING DISH INFO');
            updateData.dish_info = processDishInfo({
                ...product.dish_info,
                ...updateData.dish_info
            });
        }

        if (partner.category === 'store' && updateData.product_info) {
            console.log('🏪 UPDATING PRODUCT INFO');
            updateData.product_info = processStorePackaging(
                { ...product.product_info, ...updateData.product_info },
                partner.address || 'France'
            );
        }

        // Нормализуем основные поля
        if (updateData.title) updateData.title = updateData.title.trim();
        if (updateData.description !== undefined) updateData.description = updateData.description.trim();
        if (updateData.price) updateData.price = parseFloat(updateData.price);
        if (updateData.discount_price) updateData.discount_price = parseFloat(updateData.discount_price);

        // Обновляем продукт
        updateData.last_updated_by = new mongoose.Types.ObjectId(partnerId);
        
        Object.assign(product, updateData);
        await product.save();

        // Обновляем статистику партнера
        await partner.updateProductStats();

        console.log('✅ PRODUCT UPDATED:', {
            product_id: product._id,
            title: product.title,
            has_options: product.options_groups.length > 0
        });

        return {
            product: product.getDisplayInfo(),
            business_rules: {
                partner_category: partner.category,
                supports_options: partner.category === 'restaurant',
                supports_packaging: partner.category === 'store',
                options_groups_count: product.options_groups.length,
                has_packaging_info: partner.category === 'store' && !!product.product_info
            }
        };

    } catch (error) {
        console.error('🚨 UPDATE PARTNER PRODUCT ERROR:', error);
        throw error;
    }
};

/**
 * Удаление продукта партнера
 * @param {string} partnerId - ID пользователя партнера
 * @param {string} productId - ID продукта
 * @returns {object} - Информация об удалении
 */
const deletePartnerProduct = async (partnerId, productId) => {
    try {
        if (!partnerId || !productId) {
            throw new Error('Partner ID и Product ID обязательны');
        }

        console.log('🔍 DELETE PARTNER PRODUCT:', { partnerId, productId });

        // ✅ ИСПРАВЛЕНО: Правильный поиск по user_id
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Находим и удаляем продукт принадлежащий этому партнеру
        const product = await Product.findOneAndDelete({ 
            _id: new mongoose.Types.ObjectId(productId), 
            partner_id: partner._id 
        });

        if (!product) {
            throw new Error('Продукт не найден');
        }

        // Обновляем статистику партнера
        await partner.updateProductStats();

        // Подсчитываем оставшиеся продукты
        const remainingProducts = await Product.countDocuments({ 
            partner_id: partner._id 
        });

        console.log('✅ PRODUCT DELETED:', {
            deleted_title: product.title,
            deleted_category: product.subcategory,
            remaining_products: remainingProducts
        });

        return {
            deleted_product: {
                id: product._id,
                title: product.title,
                category_slug: product.subcategory,
                business_type: product.category
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
 * @param {string} partnerId - ID пользователя партнера
 * @returns {object} - Полная статистика меню
 */
const getPartnerMenuStats = async (partnerId) => {
    try {
        if (!partnerId) {
            throw new Error('Partner ID обязателен');
        }

        console.log('🔍 GET PARTNER MENU STATS:', { partnerId });

        // Находим профиль партнера
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Получаем все продукты партнера
        const allProducts = await Product.find({ 
            partner_id: partner._id 
        });

        const activeProducts = allProducts.filter(p => p.is_active && p.is_available);
        const inactiveProducts = allProducts.filter(p => !p.is_active || !p.is_available);

        // Статистика по категориям
        const categoryStats = partner.menu_categories.map(category => {
            const categoryProducts = allProducts.filter(p => p.subcategory === category.slug);
            const activeCategoryProducts = activeProducts.filter(p => p.subcategory === category.slug);

            return {
                category: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description
                },
                products: {
                    total: categoryProducts.length,
                    active: activeCategoryProducts.length,
                    inactive: categoryProducts.length - activeCategoryProducts.length
                },
                pricing: {
                    avg_price: activeCategoryProducts.length > 0 
                        ? (activeCategoryProducts.reduce((sum, p) => sum + p.final_price, 0) / activeCategoryProducts.length).toFixed(2) 
                        : 0,
                    min_price: activeCategoryProducts.length > 0 
                        ? Math.min(...activeCategoryProducts.map(p => p.final_price)).toFixed(2) 
                        : 0,
                    max_price: activeCategoryProducts.length > 0 
                        ? Math.max(...activeCategoryProducts.map(p => p.final_price)).toFixed(2) 
                        : 0
                },
                features: {
                    has_discounts: categoryProducts.some(p => p.discount_price && p.discount_price > 0),
                    has_options: categoryProducts.some(p => p.options_groups && p.options_groups.length > 0),
                    avg_preparation_time: partner.category === 'restaurant' && categoryProducts.length > 0 
                        ? Math.round(categoryProducts.reduce((sum, p) => sum + (p.preparation_time || 0), 0) / categoryProducts.length) 
                        : 0
                }
            };
        });

        // Общая статистика
        const avgPrice = activeProducts.length > 0 
            ? activeProducts.reduce((sum, p) => sum + p.final_price, 0) / activeProducts.length 
            : 0;

        const minPrice = activeProducts.length > 0 
            ? Math.min(...activeProducts.map(p => p.final_price)) 
            : 0;

        const maxPrice = activeProducts.length > 0 
            ? Math.max(...activeProducts.map(p => p.final_price)) 
            : 0;

        const statsResult = {
            overview: {
                total_categories: partner.menu_categories.length,
                total_products: allProducts.length,
                active_products: activeProducts.length,
                inactive_products: inactiveProducts.length,
                completion_percentage: partner.menu_categories.length > 0 
                    ? Math.round((partner.menu_categories.filter(cat => 
                        allProducts.some(p => p.subcategory === cat.slug)
                      ).length / partner.menu_categories.length) * 100)
                    : 0
            },
            pricing: {
                avg_price: avgPrice.toFixed(2),
                min_price: minPrice.toFixed(2),
                max_price: maxPrice.toFixed(2),
                products_with_discounts: allProducts.filter(p => p.discount_price && p.discount_price > 0).length,
                discount_percentage: allProducts.length > 0 
                    ? Math.round((allProducts.filter(p => p.discount_price && p.discount_price > 0).length / allProducts.length) * 100)
                    : 0
            },
            categories: categoryStats,
            business_info: {
                business_name: partner.business_name,
                category: partner.category,
                is_approved: partner.is_approved,
                is_active: partner.is_active,
                content_status: partner.content_status
            },
            last_updated: new Date()
        };

        console.log('✅ STATS GENERATED:', {
            total_categories: statsResult.overview.total_categories,
            total_products: statsResult.overview.total_products,
            completion_percentage: statsResult.overview.completion_percentage
        });

        return statsResult;

    } catch (error) {
        console.error('🚨 GET PARTNER MENU STATS ERROR:', error);
        throw error;
    }
};

// ============ ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ============

/**
 * Валидация совместимости продукта с категорией партнера
 * @param {string} partnerCategory - Категория партнера (restaurant/store)
 * @param {object} productData - Данные продукта
 * @returns {object} - Результат валидации с предупреждениями
 */
const validateProductCompatibility = (partnerCategory, productData) => {
    const warnings = [];
    const recommendations = [];

    if (partnerCategory === 'restaurant') {
        // Проверки для ресторана
        if (!productData.preparation_time || productData.preparation_time < 5) {
            recommendations.push('Рекомендуется указать реальное время приготовления (минимум 5 минут)');
        }

        if (!productData.options_groups || productData.options_groups.length === 0) {
            recommendations.push('Рассмотрите возможность добавления опций (размер порции, соусы, гарниры)');
        }

        if (productData.product_info && Object.keys(productData.product_info).length > 0) {
            warnings.push('Информация об упаковке обычно не используется для ресторанных блюд');
        }

    } else if (partnerCategory === 'store') {
        // Проверки для магазина
        if (productData.preparation_time && productData.preparation_time > 0) {
            warnings.push('Время приготовления не применимо для товаров магазина');
        }

        if (productData.options_groups && productData.options_groups.length > 0) {
            warnings.push('Опции (добавки) не поддерживаются для товаров магазина');
        }

        if (!productData.product_info || !productData.product_info.weight_grams && !productData.product_info.volume_ml) {
            recommendations.push('Рекомендуется указать вес или объём товара');
        }

        if (productData.product_info && !productData.product_info.origin_country) {
            recommendations.push('Рекомендуется указать страну происхождения товара');
        }
    }

    return {
        is_compatible: warnings.length === 0,
        warnings,
        recommendations,
        partner_category: partnerCategory
    };
};

/**
 * Получение рекомендаций по улучшению меню
 * @param {string} partnerId - ID пользователя партнера
 * @returns {object} - Рекомендации по улучшению
 */
const getMenuRecommendations = async (partnerId) => {
    try {
        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        const products = await Product.findByPartner(partner._id, true);
        const recommendations = [];

        // Общие рекомендации
        if (partner.menu_categories.length < 3) {
            recommendations.push({
                type: 'categories',
                priority: 'high',
                message: `У вас ${partner.menu_categories.length} категорий. Рекомендуется создать минимум 3-4 категории для лучшей организации меню.`
            });
        }

        if (products.length < 5) {
            recommendations.push({
                type: 'products',
                priority: 'high',
                message: `У вас ${products.length} товаров. Добавьте больше продуктов для привлечения клиентов.`
            });
        }

        // Рекомендации по типу заведения
        if (partner.category === 'restaurant') {
            const productsWithoutOptions = products.filter(p => !p.options_groups || p.options_groups.length === 0);
            if (productsWithoutOptions.length > products.length * 0.7) {
                recommendations.push({
                    type: 'options',
                    priority: 'medium',
                    message: 'Большинство блюд не имеют опций. Добавьте варианты размеров, соусов или гарниров для увеличения среднего чека.'
                });
            }

            const productsWithoutPreparationTime = products.filter(p => !p.preparation_time || p.preparation_time === 0);
            if (productsWithoutPreparationTime.length > 0) {
                recommendations.push({
                    type: 'preparation_time',
                    priority: 'low',
                    message: `${productsWithoutPreparationTime.length} блюд не имеют времени приготовления. Это поможет клиентам планировать заказы.`
                });
            }

        } else if (partner.category === 'store') {
            const productsWithoutPackaging = products.filter(p => 
                !p.product_info || 
                (!p.product_info.weight_grams && !p.product_info.volume_ml && !p.product_info.unit_count)
            );
            
            if (productsWithoutPackaging.length > 0) {
                recommendations.push({
                    type: 'packaging',
                    priority: 'medium',
                    message: `${productsWithoutPackaging.length} товаров не имеют информации об упаковке. Добавьте вес, объём или количество.`
                });
            }

            const productsWithoutBarcode = products.filter(p => 
                !p.product_info || 
                (!p.product_info.barcode_ean13 && !p.product_info.barcode_ean8)
            );
            
            if (productsWithoutBarcode.length > products.length * 0.5) {
                recommendations.push({
                    type: 'barcodes',
                    priority: 'low',
                    message: 'Рассмотрите возможность добавления штрих-кодов для товаров. Это упростит инвентаризацию.'
                });
            }
        }

        // Ценовые рекомендации
        if (products.length > 0) {
            const productsWithDiscounts = products.filter(p => p.discount_price && p.discount_price > 0);
            if (productsWithDiscounts.length === 0) {
                recommendations.push({
                    type: 'pricing',
                    priority: 'low',
                    message: 'Рассмотрите возможность добавления акционных цен для некоторых товаров.'
                });
            }
        }

        return {
            total_recommendations: recommendations.length,
            recommendations: recommendations.sort((a, b) => {
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }),
            menu_completeness: {
                categories: partner.menu_categories.length,
                products: products.length,
                active_products: products.filter(p => p.is_active && p.is_available).length,
                completion_score: Math.min(100, 
                    (partner.menu_categories.length * 10) + 
                    (products.length * 5) + 
                    (products.filter(p => p.is_active && p.is_available).length * 2)
                )
            }
        };

    } catch (error) {
        console.error('🚨 GET MENU RECOMMENDATIONS ERROR:', error);
        throw error;
    }
};

/**
 * Массовое обновление статуса продуктов
 * @param {string} partnerId - ID пользователя партнера
 * @param {Array} productIds - Массив ID продуктов
 * @param {object} statusUpdate - Статус для обновления
 * @returns {object} - Результат массового обновления
 */
const bulkUpdateProductStatus = async (partnerId, productIds, statusUpdate) => {
    try {
        if (!partnerId || !productIds || !Array.isArray(productIds)) {
            throw new Error('Partner ID и массив Product IDs обязательны');
        }

        console.log('🔍 BULK UPDATE PRODUCT STATUS:', { 
            partnerId, 
            products_count: productIds.length,
            status_update: statusUpdate 
        });

        const partner = await PartnerProfile.findOne({ 
            user_id: new mongoose.Types.ObjectId(partnerId) 
        });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
        }

        // Конвертируем ID в ObjectId
        const objectIds = productIds.map(id => new mongoose.Types.ObjectId(id));

        // Обновляем продукты принадлежащие этому партнеру
        const updateResult = await Product.updateMany(
            { 
                _id: { $in: objectIds },
                partner_id: partner._id 
            },
            { 
                ...statusUpdate,
                last_updated_by: new mongoose.Types.ObjectId(partnerId)
            }
        );

        // Обновляем статистику партнера
        await partner.updateProductStats();

        console.log('✅ BULK UPDATE COMPLETED:', {
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount
        });

        return {
            matched_products: updateResult.matchedCount,
            updated_products: updateResult.modifiedCount,
            status_update: statusUpdate
        };

    } catch (error) {
        console.error('🚨 BULK UPDATE PRODUCT STATUS ERROR:', error);
        throw error;
    }
};

// ============ ЭКСПОРТ ВСЕХ ФУНКЦИЙ ============

export {
    // Основные функции категорий
    getPartnerMenuCategories,
    addMenuCategoryService,
    updateMenuCategory,
    deleteMenuCategory,
    
    // Основные функции продуктов
    getPartnerProducts,
    addPartnerProduct,
    updatePartnerProduct,
    deletePartnerProduct,
    
    // Статистика и аналитика
    getPartnerMenuStats,
    getMenuRecommendations,
    
    // Утилиты
    validateProductCompatibility,
    bulkUpdateProductStatus,
    
    // Внутренние утилиты (для тестирования)
    processRestaurantOptions,
    processStorePackaging,
    processDishInfo
};