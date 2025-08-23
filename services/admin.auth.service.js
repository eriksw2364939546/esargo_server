// ================ services/admin.auth.service.js (ИСПРАВЛЕННЫЙ С ОТЛАДКОЙ) ================
import { AdminUser } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';

 const createAdminAccount = async (adminData) => {
    try {
        let { full_name, email, password, role, department } = adminData;

        console.log('🔍 CREATE ADMIN ACCOUNT - Start:', {
            full_name, email, role, department
        });

        // ✅ НОВАЯ ВАЛИДАЦИЯ
        // Проверка обязательных полей
        if (!full_name || !email || !password || !role) {
            throw new Error('Обязательные поля: full_name, email, password, role');
        }

        // Валидация имени
        if (full_name.trim().length < 2) {
            throw new Error('Полное имя должно содержать минимум 2 символа');
        }

        if (full_name.length > 100) {
            throw new Error('Полное имя не должно превышать 100 символов');
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Некорректный формат email');
        }

        email = email.toLowerCase().trim();

        // Валидация пароля
        if (password.length < 8) {
            throw new Error('Пароль должен содержать минимум 8 символов');
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            throw new Error('Пароль должен содержать минимум одну заглавную букву, одну строчную букву и одну цифру');
        }

        // Валидация роли
        const allowedRoles = ['admin', 'manager', 'support', 'moderator'];
        if (!allowedRoles.includes(role)) {
            throw new Error(`Недопустимая роль. Разрешенные: ${allowedRoles.join(', ')}`);
        }

        // Валидация департамента
        const allowedDepartments = ['general', 'support', 'operations', 'finance', 'marketing', 'technical'];
        if (department && !allowedDepartments.includes(department)) {
            throw new Error(`Недопустимый департамент. Разрешенные: ${allowedDepartments.join(', ')}`);
        }

        console.log('✅ VALIDATION PASSED');

        // Проверяем существование через Meta
        const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'admin');

        if (metaInfo) {
            return { isNewAdmin: false, admin: metaInfo.admin };
        }

        // Хешируем пароль
        const hashedPassword = await hashString(password);

        // ✅ РАСШИРЕННОЕ СОЗДАНИЕ AdminUser с валидацией
        const newAdmin = new AdminUser({
            full_name: full_name.trim(),
            email: email,
            password_hash: hashedPassword,
            role: role,
            contact_info: {
                department: department || 'general',
                created_by: 'system', // можно передавать ID создателя
                creation_notes: `Админ создан с ролью ${role}`
            },
            permissions: {
                // Устанавливаем базовые разрешения по роли
                can_view_reports: ['manager', 'owner'].includes(role),
                can_manage_users: ['manager', 'owner'].includes(role),
                can_manage_partners: ['manager', 'owner'].includes(role),
                can_manage_system: role === 'owner',
                can_delete_data: role === 'owner'
            },
            security_settings: {
                require_2fa: role === 'owner', // Для owner обязательна 2FA
                session_timeout: role === 'owner' ? 4 : 8, // Часы
                allowed_ip_ranges: [], // Пустой массив = разрешен любой IP
                password_change_required: true // Требуется смена пароля при первом входе
            },
            is_active: true,
            account_status: 'active'
        });

        await newAdmin.save();

        // Создаем Meta запись
        await Meta.createForAdmin(newAdmin._id, hashMeta(email));

        console.log('✅ ADMIN CREATED WITH VALIDATION:', {
            admin_id: newAdmin._id,
            role: newAdmin.role,
            department: newAdmin.contact_info.department,
            has_permissions: !!newAdmin.permissions
        });

        return { isNewAdmin: true, admin: newAdmin };

    } catch (error) {
        console.error('🚨 CREATE ADMIN ACCOUNT ERROR:', error);
        throw error;
    }
};

 const loginAdmin = async (loginData) => {
    try {
        // 🔍 ОТЛАДКА: Проверяем что приходит
        console.log('🔍 LOGIN ADMIN - Входные данные:', {
            loginData,
            loginData_type: typeof loginData,
            has_email: !!loginData?.email,
            has_password: !!loginData?.password,
            email_value: loginData?.email,
            password_provided: !!loginData?.password
        });

        // Проверяем структуру данных
        if (!loginData || typeof loginData !== 'object') {
            throw new Error('Неверный формат данных для входа');
        }

        const { email, password } = loginData;

        // Проверяем обязательные поля
        if (!email || !password) {
            throw new Error('Email и пароль обязательны');
        }

        console.log('🔍 LOGIN ADMIN - Обработка:', {
            original_email: email,
            password_length: password ? password.length : 0
        });

        const normalizedEmail = email.toLowerCase().trim();

        console.log('🔍 LOGIN ADMIN - Поиск в базе:', {
            normalized_email: normalizedEmail,
            hashed_email: hashMeta(normalizedEmail)
        });

        const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(normalizedEmail), 'admin');

        console.log('🔍 LOGIN ADMIN - Результат поиска:', {
            metaInfo_found: !!metaInfo,
            has_admin: !!(metaInfo?.admin),
            admin_id: metaInfo?.admin?._id,
            admin_email: metaInfo?.admin?.email
        });

        if (!metaInfo || !metaInfo.admin) {
            const error = new Error('Администратор не найден');
            error.statusCode = 404;
            throw error;
        }

        if (!metaInfo.admin.is_active) {
            const error = new Error('Аккаунт деактивирован');
            error.statusCode = 403;
            throw error;
        }

        console.log('🔍 LOGIN ADMIN - Проверка пароля...');

        // ✅ ИСПРАВЛЕНО: Используем встроенный метод модели AdminUser
        const isPasswordValid = await metaInfo.admin.comparePassword(password);

        console.log('🔍 LOGIN ADMIN - Результат проверки пароля:', {
            password_valid: isPasswordValid
        });

        if (!isPasswordValid) {
            await metaInfo.admin.incrementLoginAttempts();
            
            const error = new Error('Неверный пароль');
            error.statusCode = 401;
            throw error;
        }

        // Сброс неудачных попыток и обновление активности
        await metaInfo.admin.resetLoginAttempts();
        await metaInfo.admin.recordActivity();

        console.log('🔍 LOGIN ADMIN - Генерация токена...');

        const token = generateCustomerToken({
            _id: metaInfo.admin._id,
            email: metaInfo.admin.email,
            role: 'admin',
            admin_role: metaInfo.admin.role
        }, '8h');

        console.log('🔍 LOGIN ADMIN - Токен создан:', {
            token_length: token ? token.length : 0,
            has_token: !!token
        });

        const result = {
            token,
            admin: {
                id: metaInfo.admin._id,
                email: metaInfo.admin.email,
                full_name: metaInfo.admin.full_name,
                role: metaInfo.admin.role,
                department: metaInfo.admin.contact_info?.department
            }
        };

        console.log('✅ LOGIN ADMIN - Успешно:', {
            admin_id: result.admin.id,
            admin_email: result.admin.email,
            admin_role: result.admin.role
        });

        return result;

    } catch (error) {
        console.error('🚨 LOGIN ADMIN - Ошибка:', error);
        throw error;
    }
};


export { createAdminAccount, loginAdmin }