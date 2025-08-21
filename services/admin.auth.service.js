// ================ services/admin.auth.service.js (ИСПРАВЛЕННЫЙ С ОТЛАДКОЙ) ================
import { AdminUser } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';

export const createAdminAccount = async (adminData) => {
    try {
        let { full_name, email, password, role, department } = adminData;

        if (!full_name || !email || !password || !role) {
            throw new Error('Missing required fields');
        }

        email = email.toLowerCase().trim();

        const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'admin');

        if (metaInfo) {
            return { isNewAdmin: false, admin: metaInfo.admin };
        }

        const hashedPassword = await hashString(password);

        const newAdmin = new AdminUser({
            full_name,
            email,
            password_hash: hashedPassword,
            role,
            contact_info: {
                department: department || 'general'
            },
            is_active: true
        });

        await newAdmin.save();
        await Meta.createForAdmin(newAdmin._id, hashMeta(email));

        return { isNewAdmin: true, admin: newAdmin };

    } catch (error) {
        throw error;
    }
};

export const loginAdmin = async (loginData) => {
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