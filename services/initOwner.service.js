// services/initOwner.service.js - СОЗДАНИЕ ПЕРВОГО OWNER АДМИНИСТРАТОРА ПРИ ЗАПУСКЕ 🎯
import { AdminUser } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';

/**
 * 🚀 ИНИЦИАЛИЗАЦИЯ OWNER АККАУНТА ПРИ ЗАПУСКЕ СЕРВЕРА
 * Аналогично вашему примеру из другого проекта
 */
const initOwnerAccount = async () => {
  try {
    // 🔍 Проверяем существует ли уже owner
    const existingOwner = await AdminUser.findOne({ role: "owner" });

    if (existingOwner) {
      console.log("🎯 Owner already exists:", {
        id: existingOwner._id,
        email: existingOwner.email,
        full_name: existingOwner.full_name,
        created_at: existingOwner.createdAt
      });
      return;
    }

    // 📋 Данные по умолчанию для первого owner'а
    const defaultOwnerData = {
      password: "admin",
      email: "admin@admin.com",
      full_name: "System Owner",
      department: "administration"
    };

    console.log("🚀 Creating first Owner account...", {
      email: defaultOwnerData.email,
      password: defaultOwnerData.password,
      full_name: defaultOwnerData.full_name
    });

    // 🔐 Хешируем пароль
    const hashedPassword = await hashString(defaultOwnerData.password);

    // 👤 Создаем нового администратора с ролью owner
    const newOwner = new AdminUser({
      full_name: defaultOwnerData.full_name,
      email: defaultOwnerData.email,
      password_hash: hashedPassword,
      role: "owner", // 🎯 ОСНОВНОЕ: только роль, без permissions
      contact_info: {
        department: defaultOwnerData.department,
        position: "System Administrator",
        phone: null
      },
      is_active: true,
      created_by: null // Первый админ создается без ссылки
      // 🗑️ УДАЛЕНО: permissions - используется role-based подход
    });

    await newOwner.save();

    // 🔗 Создаем Meta запись для безопасного поиска
    const newMetaInfo = await Meta.createForAdmin(newOwner._id, hashMeta(defaultOwnerData.email));

    console.log("🎉 Owner was created successfully!", {
      id: newOwner._id,
      email: defaultOwnerData.email,
      password: defaultOwnerData.password,
      full_name: newOwner.full_name,
      role: newOwner.role,
      meta_id: newMetaInfo._id
    });

    console.log("🔑 Owner Login Credentials:");
    console.log(`   📧 Email: ${defaultOwnerData.email}`);
    console.log(`   🔒 Password: ${defaultOwnerData.password}`);
    console.log(`   🌐 Login URL: POST /api/admin/login`);
    console.log("⚠️  ВАЖНО: Измените пароль после первого входа!");

  } catch (error) {
    console.error("🚨 Error initializing Owner account:", error);
    
    // 🔍 Детализированная ошибка для отладки
    if (error.code === 11000) {
      console.error("❌ Duplicate key error - возможно email уже используется");
    } else if (error.name === 'ValidationError') {
      console.error("❌ Validation error:", error.message);
    } else {
      console.error("❌ Unknown error:", error.message);
    }
  }
};

export default initOwnerAccount;