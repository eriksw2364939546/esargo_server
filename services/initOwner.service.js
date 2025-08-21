// ================ services/initOwner.service.js (ИСПРАВЛЕННЫЙ) ================
import { AdminUser } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';

const initOwnerAccount = async () => {
    try {
        console.log("🔍 Проверяем существующего Owner'а...");
        
        const existingOwner = await AdminUser.findOne({ role: "owner" });

        if (existingOwner) {
            console.log("🎯 Owner уже существует:", {
                id: existingOwner._id,
                email: existingOwner.email,
                full_name: existingOwner.full_name
            });
            return;
        }

        console.log("🆕 Создаем нового Owner'а...");

        const defaultOwnerData = {
            password: "admin123",  // ✅ ИСПРАВЛЕНО: минимум 6 символов
            email: "admin@admin.com",
            full_name: "System Owner"
        };

        const newOwner = new AdminUser({
            full_name: defaultOwnerData.full_name,
            email: defaultOwnerData.email,
            password_hash: defaultOwnerData.password,  // ✅ НЕ хешируем здесь - модель сделает это сама!
            role: "owner",
            contact_info: {
                department: "general"  // ✅ ИСПРАВЛЕНО: используем валидное значение enum
            },
            is_active: true
        });

        // Автоматически даем Owner'у все права
        const permissions = newOwner.permissions;
        Object.keys(permissions).forEach(section => {
            Object.keys(permissions[section]).forEach(action => {
                permissions[section][action] = true;
            });
        });

        await newOwner.save();
        
        console.log("✅ Owner создан в базе данных");

        // Создаем Meta запись для Owner'а
        await Meta.createForAdmin(newOwner._id, hashMeta(defaultOwnerData.email));
        
        console.log("✅ Meta запись создана");

        console.log("🎉 Owner успешно создан:", {
            email: defaultOwnerData.email,
            password: defaultOwnerData.password,
            full_name: defaultOwnerData.full_name,
            role: "owner",
            department: "general",
            id: newOwner._id
        });

        console.log("🔑 Данные для входа в админку:");
        console.log("   Email: admin@admin.com");
        console.log("   Password: admin");

    } catch (error) {
        console.error("🚨 Ошибка при создании Owner'а:", error);
        
        // Детальная информация об ошибке для отладки
        if (error.name === 'ValidationError') {
            console.error("🔍 Детали ошибки валидации:");
            Object.keys(error.errors).forEach(field => {
                console.error(`   ${field}: ${error.errors[field].message}`);
            });
        }
    }
};

export default initOwnerAccount;