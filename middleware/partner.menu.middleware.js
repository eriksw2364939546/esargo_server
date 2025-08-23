// ================ middleware/partner.menu.middleware.js (НОВЫЙ MIDDLEWARE) ================
import { PartnerProfile, Product } from '../models/index.js';

/**
 * Проверка прав на управление меню
 * Только партнеры с созданным профилем
 */
 const requireMenuAccess = async (req, res, next) => {
    try {
        const { user } = req;

        console.log('🔍 REQUIRE MENU ACCESS:', {
            user_id: user._id,
            user_role: user.role
        });

        // Проверка роли
        if (!user || user.role !== 'partner') {
            return res.status(403).json({
                result: false,
                message: "Доступ только для партнеров"
            });
        }

        // Проверяем существование профиля
        const partner = await PartnerProfile.findOne({ user_id: user._id });
        
        if (!partner) {
            return res.status(404).json({
                result: false,
                message: "Профиль партнера не найден. Создайте профиль сначала."
            });
        }

        // Проверяем статус профиля
        if (!partner.is_approved) {
            return res.status(403).json({
                result: false,
                message: "Профиль не одобрен администратором",
                current_status: partner.approval_status
            });
        }

        console.log('✅ MENU ACCESS GRANTED');
        req.partner = user;
        req.partnerProfile = partner;

        next();

    } catch (error) {
        console.error('🚨 REQUIRE MENU ACCESS ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка проверки доступа к меню"
        });
    }
};

/**
 * Валидация данных категории меню
 */
 const validateMenuCategoryData = (req, res, next) => {
    try {
        const { name, description, image_url, sort_order } = req.body;

        console.log('🔍 VALIDATE MENU CATEGORY DATA:', {
            has_name: !!name,
            name_length: name ? name.length : 0
        });

        // Валидация названия
        if (req.method === 'POST') {
            // При создании название обязательно
            if (!name || name.trim().length === 0) {
                return res.status(400).json({
                    result: false,
                    message: "Название категории обязательно"
                });
            }
        }

        if (name && name.length > 50) {
            return res.status(400).json({
                result: false,
                message: "Название категории не должно превышать 50 символов"
            });
        }

        if (description && description.length > 200) {
            return res.status(400).json({
                result: false,
                message: "Описание категории не должно превышать 200 символов"
            });
        }

        if (image_url && typeof image_url !== 'string') {
            return res.status(400).json({
                result: false,
                message: "URL изображения должен быть строкой"
            });
        }

        if (sort_order !== undefined && (typeof sort_order !== 'number' || sort_order < 0)) {
            return res.status(400).json({
                result: false,
                message: "Порядок сортировки должен быть положительным числом"
            });
        }

        console.log('✅ MENU CATEGORY DATA VALIDATED');
        next();

    } catch (error) {
        console.error('🚨 VALIDATE MENU CATEGORY DATA ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка валидации данных категории"
        });
    }
};

/**
 * Валидация данных продукта с логикой ресторан/магазин
 */
 const validateProductData = async (req, res, next) => {
    try {
        const { user } = req;
        const { 
            title, price, subcategory, options_groups, 
            preparation_time, discount_price 
        } = req.body;

        console.log('🔍 VALIDATE PRODUCT DATA:', {
            has_title: !!title,
            has_price: !!price,
            has_options: !!options_groups,
            options_count: options_groups ? options_groups.length : 0
        });

        // Валидация обязательных полей
        if (req.method === 'POST') {
            const requiredFields = ['title', 'price', 'subcategory'];
            const missingFields = requiredFields.filter(field => !req.body[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({
                    result: false,
                    message: `Обязательные поля: ${missingFields.join(', ')}`
                });
            }
        }

        // Валидация цены
        if (price !== undefined) {
            if (typeof price !== 'number' || price <= 0) {
                return res.status(400).json({
                    result: false,
                    message: "Цена должна быть положительным числом"
                });
            }
        }

        // Валидация скидочной цены
        if (discount_price !== undefined && discount_price !== null) {
            if (typeof discount_price !== 'number' || discount_price < 0) {
                return res.status(400).json({
                    result: false,
                    message: "Скидочная цена должна быть неотрицательным числом"
                });
            }
            
            if (price && discount_price >= price) {
                return res.status(400).json({
                    result: false,
                    message: "Скидочная цена должна быть меньше обычной цены"
                });
            }
        }

        // Валидация времени приготовления
        if (preparation_time !== undefined) {
            if (typeof preparation_time !== 'number' || preparation_time < 0) {
                return res.status(400).json({
                    result: false,
                    message: "Время приготовления должно быть неотрицательным числом"
                });
            }
        }

        // ✅ ВАЛИДАЦИЯ ДОБАВОК В ЗАВИСИМОСТИ ОТ КАТЕГОРИИ ПАРТНЕРА
        if (options_groups !== undefined) {
            // Получаем профиль партнера для проверки категории
            const partnerProfile = await PartnerProfile.findOne({ user_id: user._id });
            
            if (partnerProfile) {
                if (partnerProfile.category === 'store' && options_groups && options_groups.length > 0) {
                    return res.status(400).json({
                        result: false,
                        message: "Магазины не могут добавлять опции к товарам",
                        business_rule: "Только рестораны поддерживают добавки к блюдам",
                        partner_category: partnerProfile.category
                    });
                }

                if (partnerProfile.category === 'restaurant' && options_groups && Array.isArray(options_groups)) {
                    // Валидация структуры добавок для ресторанов
                    for (let i = 0; i < options_groups.length; i++) {
                        const group = options_groups[i];
                        
                        if (!group.name || typeof group.name !== 'string') {
                            return res.status(400).json({
                                result: false,
                                message: `Группа добавок ${i + 1}: отсутствует название`
                            });
                        }

                        if (!group.options || !Array.isArray(group.options) || group.options.length === 0) {
                            return res.status(400).json({
                                result: false,
                                message: `Группа "${group.name}": должна содержать минимум одну опцию`
                            });
                        }

                        // Валидация опций
                        for (let j = 0; j < group.options.length; j++) {
                            const option = group.options[j];
                            
                            if (!option.name || typeof option.name !== 'string') {
                                return res.status(400).json({
                                    result: false,
                                    message: `Опция ${j + 1} в группе "${group.name}": отсутствует название`
                                });
                            }

                            if (typeof option.price !== 'number' || option.price < 0) {
                                return res.status(400).json({
                                    result: false,
                                    message: `Опция "${option.name}": цена должна быть неотрицательным числом`
                                });
                            }
                        }
                    }
                }
            }
        }

        console.log('✅ PRODUCT DATA VALIDATED');
        next();

    } catch (error) {
        console.error('🚨 VALIDATE PRODUCT DATA ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка валидации данных продукта"
        });
    }
};

/**
 * Проверка прав на управление конкретной категорией
 */
 const checkCategoryOwnership = async (req, res, next) => {
    try {
        const { user } = req;
        const { category_id } = req.params;

        console.log('🔍 CHECK CATEGORY OWNERSHIP:', {
            user_id: user._id,
            category_id: category_id
        });

        const partner = await PartnerProfile.findOne({ user_id: user._id });
        
        if (!partner) {
            return res.status(404).json({
                result: false,
                message: "Профиль партнера не найден"
            });
        }

        // Проверяем принадлежность категории
        const category = partner.menu_categories.id(category_id);
        
        if (!category) {
            return res.status(404).json({
                result: false,
                message: "Категория не найдена или не принадлежит вашему заведению"
            });
        }

        console.log('✅ CATEGORY OWNERSHIP VERIFIED');
        req.partner = user;
        req.partnerProfile = partner;
        req.menuCategory = category;

        next();

    } catch (error) {
        console.error('🚨 CHECK CATEGORY OWNERSHIP ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка проверки прав на категорию"
        });
    }
};

/**
 * Проверка прав на управление конкретным продуктом
 */
 const checkProductOwnership = async (req, res, next) => {
    try {
        const { user } = req;
        const { product_id } = req.params;

        console.log('🔍 CHECK PRODUCT OWNERSHIP:', {
            user_id: user._id,
            product_id: product_id
        });

        const partner = await PartnerProfile.findOne({ user_id: user._id });
        
        if (!partner) {
            return res.status(404).json({
                result: false,
                message: "Профиль партнера не найден"
            });
        }

        // Проверяем принадлежность продукта
        const product = await Product.findOne({
            _id: product_id,
            partner_id: partner._id
        });
        
        if (!product) {
            return res.status(404).json({
                result: false,
                message: "Продукт не найден или не принадлежит вашему заведению"
            });
        }

        console.log('✅ PRODUCT OWNERSHIP VERIFIED');
        req.partner = user;
        req.partnerProfile = partner;
        req.product = product;

        next();

    } catch (error) {
        console.error('🚨 CHECK PRODUCT OWNERSHIP ERROR:', error);
        res.status(500).json({
            result: false,
            message: "Ошибка проверки прав на продукт"
        });
    }
};

export {
    requireMenuAccess,
    validateMenuCategoryData,
    validateProductData,
    checkCategoryOwnership,
    checkProductOwnership
}