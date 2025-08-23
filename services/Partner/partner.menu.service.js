// ================ services/Partner/partner.menu.service.js (НОВЫЙ СЕРВИСНЫЙ СЛОЙ) ================
import { PartnerProfile, Product } from '../../models/index.js';
import mongoose from 'mongoose';

/**
 * ================== БИЗНЕС-ЛОГИКА УПРАВЛЕНИЯ МЕНЮ ==================
 */

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
 const addMenuCategory = async (partnerId, categoryData) => {
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
        await partner.updateMenuCategory(categoryId, {
            name: updateData.name?.trim(),
            description: updateData.description?.trim(),
            image_url: updateData.image_url,
            sort_order: updateData.sort_order,
            is_active: updateData.is_active
        });

        const updatedCategory = partner.menu_categories.id(categoryId);

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
 * @returns {object} - Результат удаления
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
            throw new Error(`Нельзя удалить категорию. В ней ${productsInCategory} товаров. Сначала переместите или удалите товары.`);
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

/**
 * ================== УПРАВЛЕНИЕ ПРОДУКТАМИ ==================
 */

/**
 * Получение всех продуктов партнера
 * @param {string} partnerId - ID партнера
 * @param {object} filters - Фильтры (category_slug, include_inactive)
 * @returns {object} - Продукты партнера
 */
 const getPartnerProducts = async (partnerId, filters = {}) => {
    try {
        if (!partnerId) {
            throw new Error('Partner ID обязателен');
        }

        const { category_slug, include_inactive } = filters;

        const partner = await PartnerProfile.findOne({ user_id: partnerId });
        
        if (!partner) {
            throw new Error('Профиль партнера не найден');
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

        return {
            products_by_category: productsByCategory,
            total_products: products.length,
            business_info: {
                business_name: partner.business_name,
                brand_name: partner.brand_name,
                category: partner.category
            }
        };

    } catch (error) {
        console.error('🚨 GET PARTNER PRODUCTS ERROR:', error);
        throw error;
    }
};

/**
 * Добавление нового продукта с логикой добавок
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
            dish_info, product_info, tags
        } = productData;

        // Валидация обязательных полей
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

        // ✅ БИЗНЕС-ЛОГИКА: Обработка добавок в зависимости от категории партнера
        let finalOptionsGroups = [];
        let validationWarnings = [];

        if (partner.category === 'restaurant') {
            // 🍽️ РЕСТОРАН: Разрешены добавки
            if (options_groups && Array.isArray(options_groups)) {
                finalOptionsGroups = validateAndProcessOptionsGroups(options_groups, validationWarnings);
            }
        } else if (partner.category === 'store') {
            // 🏪 МАГАЗИН: Добавки запрещены
            if (options_groups && options_groups.length > 0) {
                throw new Error('Магазины не могут добавлять опции к товарам. Только рестораны поддерживают добавки к блюдам.');
            }
            finalOptionsGroups = [];
        }

        // ✅ БИЗНЕС-ЛОГИКА: Время приготовления в зависимости от категории
        let finalPreparationTime = 0;
        if (partner.category === 'restaurant') {
            finalPreparationTime = preparation_time || 15; // по умолчанию 15 минут
        } else if (partner.category === 'store') {
            finalPreparationTime = 0; // товар готов
        }

        // Создаем новый продукт
        const newProduct = new Product({
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
            dish_info: partner.category === 'restaurant' ? (dish_info || {}) : {},
            product_info: partner.category === 'store' ? (product_info || {}) : {},
            tags: tags || [],
            last_updated_by: partnerId
        });

        // Валидируем принадлежность к категории партнера
        await newProduct.validateCategory();
        
        await newProduct.save();

        // Обновляем статистику партнера
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
            warnings: validationWarnings.length > 0 ? validationWarnings : undefined
        };

    } catch (error) {
        console.error('🚨 ADD PARTNER PRODUCT ERROR:', error);
        throw error;
    }
};

/**
 * Обновление продукта с логикой добавок
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

        // Обновляем поля
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
            warnings: validationWarnings.length > 0 ? validationWarnings : undefined
        };

    } catch (error) {
        console.error('🚨 UPDATE PARTNER PRODUCT ERROR:', error);
        throw error;
    }
};

/**
 * Удаление продукта
 * @param {string} partnerId - ID партнера
 * @param {string} productId - ID продукта
 * @returns {object} - Результат удаления
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

        // Находим и удаляем продукт
        const product = await Product.findOneAndDelete({ 
            _id: productId, 
            partner_id: partner._id 
        });

        if (!product) {
            throw new Error('Продукт не найден');
        }

        // Обновляем статистику партнера
        await partner.updateProductStats();

        return {
            deleted_product: {
                id: product._id,
                title: product.title,
                category: product.subcategory
            },
            remaining_products: await Product.countDocuments({ partner_id: partner._id })
        };

    } catch (error) {
        console.error('🚨 DELETE PARTNER PRODUCT ERROR:', error);
        throw error;
    }
};

/**
 * Получение статистики меню партнера
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
        const fullStats = await partner.getFullMenuStats();

        return {
            stats: fullStats,
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
 * ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================
 */

/**
 * Валидация и обработка групп добавок
 * @param {array} optionsGroups - Массив групп добавок
 * @param {array} warnings - Массив предупреждений
 * @returns {array} - Валидированные группы
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

        // Валидация опций в группе
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

    return validatedGroups;
}


export { getPartnerMenuCategories
       , addMenuCategory
       , updateMenuCategory
       , deleteMenuCategory
       , getPartnerProducts
       , addPartnerProduct
       , updatePartnerProduct
       , deletePartnerProduct
       , getPartnerMenuStats}