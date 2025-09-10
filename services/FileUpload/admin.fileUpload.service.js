// services/FileUpload/admin.fileUpload.service.js
import { AdminUser } from '../../models/index.js';
import { validateMongoId } from '../../utils/validation.utils.js';



export const uploadAdminAvatar = async (adminId, imageData) => {
  try {
    if (!validateMongoId(adminId)) {
      throw new Error('Неверный ID администратора');
    }

    const admin = await AdminUser.findById(adminId);
    if (!admin) {
      throw new Error('Администратор не найден');
    }

    if (admin.avatar_url) {
      throw new Error('Аватар уже загружен. Используйте функцию обновления');
    }

    // Загружаем первый аватар
    admin.avatar_url = imageData.url;
    admin.updated_at = new Date();
    await admin.save();

    return {
      success: true,
      admin_id: admin._id,
      admin_name: `${admin.first_name} ${admin.last_name}`,
      email: admin.email,
      avatar_url: admin.avatar_url,
      action: 'uploaded',
      updated_at: admin.updated_at
    };

  } catch (error) {
    console.error('UPLOAD ADMIN AVATAR ERROR:', error);
    throw error;
  }
};

/**
 * ================== ОБНОВЛЕНИЕ АВАТАРА АДМИНА ==================
 */
export const updateAdminAvatar = async (adminId, imageData) => {
  try {
    if (!validateMongoId(adminId)) {
      throw new Error('Неверный ID администратора');
    }

    const admin = await AdminUser.findById(adminId);
    if (!admin) {
      throw new Error('Администратор не найден');
    }

    // Обновляем аватар
    admin.avatar_url = imageData.url;
    admin.updated_at = new Date();
    await admin.save();

    return {
      success: true,
      admin_id: admin._id,
      admin_name: `${admin.first_name} ${admin.last_name}`,
      email: admin.email,
      avatar_url: admin.avatar_url,
      updated_at: admin.updated_at
    };

  } catch (error) {
    console.error('UPDATE ADMIN AVATAR ERROR:', error);
    throw error;
  }
};

/**
 * ================== СОЗДАНИЕ АДМИНА С АВАТАРОМ ==================
 */
export const createAdminWithAvatar = async (adminData, imageData, creatorId) => {
  try {
    // Проверяем права создателя (только owner может создавать админов)
    const creator = await AdminUser.findById(creatorId);
    if (!creator || creator.role !== 'owner') {
      throw new Error('Недостаточно прав для создания администратора');
    }

    // Проверяем уникальность email
    const existingAdmin = await AdminUser.findOne({ email: adminData.email });
    if (existingAdmin) {
      throw new Error('Администратор с таким email уже существует');
    }

    // Создаем нового админа с аватаром
    const newAdmin = new AdminUser({
      first_name: adminData.first_name,
      last_name: adminData.last_name,
      email: adminData.email,
      role: adminData.role || 'admin',
      avatar_url: imageData.url,
      is_active: true,
      created_by: creatorId,
      created_at: new Date(),
      updated_at: new Date()
    });

    await newAdmin.save();

    return {
      success: true,
      admin_id: newAdmin._id,
      admin_name: `${newAdmin.first_name} ${newAdmin.last_name}`,
      email: newAdmin.email,
      role: newAdmin.role,
      avatar_url: newAdmin.avatar_url,
      created_by: creatorId,
      created_at: newAdmin.created_at
    };

  } catch (error) {
    console.error('CREATE ADMIN WITH AVATAR ERROR:', error);
    throw error;
  }
};

/**
 * ================== ПОЛУЧЕНИЕ ВСЕХ ФАЙЛОВ АДМИНА ==================
 */
export const getAdminFiles = async (adminId) => {
  try {
    if (!validateMongoId(adminId)) {
      throw new Error('Неверный ID администратора');
    }

    const admin = await AdminUser.findById(adminId).select(
      'first_name last_name email role avatar_url created_at updated_at'
    );
    
    if (!admin) {
      throw new Error('Администратор не найден');
    }

    return {
      success: true,
      admin_id: admin._id,
      admin_name: `${admin.first_name} ${admin.last_name}`,
      email: admin.email,
      role: admin.role,
      files: {
        avatar: admin.avatar_url || null
      },
      statistics: {
        has_avatar: !!admin.avatar_url,
        created_at: admin.created_at,
        updated_at: admin.updated_at
      }
    };

  } catch (error) {
    console.error('GET ADMIN FILES ERROR:', error);
    throw error;
  }
};

/**
 * ================== УДАЛЕНИЕ АВАТАРА АДМИНА ==================
 */
export const removeAdminAvatar = async (adminId, requesterId) => {
  try {
    if (!validateMongoId(adminId) || !validateMongoId(requesterId)) {
      throw new Error('Неверный ID администратора');
    }

    const admin = await AdminUser.findById(adminId);
    if (!admin) {
      throw new Error('Администратор не найден');
    }

    // Проверяем права доступа (сам админ или owner)
    const requester = await AdminUser.findById(requesterId);
    if (!requester) {
      throw new Error('Запрашивающий не найден');
    }

    const canDelete = (
      adminId === requesterId || // сам админ
      requester.role === 'owner' // или owner
    );

    if (!canDelete) {
      throw new Error('Недостаточно прав для удаления аватара');
    }

    const oldAvatarUrl = admin.avatar_url;
    admin.avatar_url = '';
    admin.updated_at = new Date();
    await admin.save();

    return {
      success: true,
      admin_id: admin._id,
      admin_name: `${admin.first_name} ${admin.last_name}`,
      old_avatar_url: oldAvatarUrl,
      updated_at: admin.updated_at
    };

  } catch (error) {
    console.error('REMOVE ADMIN AVATAR ERROR:', error);
    throw error;
  }
};

/**
 * ================== ПОЛУЧЕНИЕ ВСЕХ АДМИНОВ С АВАТАРАМИ ==================
 */
export const getAllAdminsWithAvatars = async (requesterId) => {
  try {
    // Проверяем права запрашивающего
    const requester = await AdminUser.findById(requesterId);
    if (!requester) {
      throw new Error('Запрашивающий не найден');
    }

    // Получаем всех админов
    const admins = await AdminUser.find({ is_active: true })
      .select('first_name last_name email role avatar_url created_at')
      .sort({ created_at: -1 });

    const adminsWithAvatars = admins.map(admin => ({
      admin_id: admin._id,
      admin_name: `${admin.first_name} ${admin.last_name}`,
      email: admin.email,
      role: admin.role,
      avatar_url: admin.avatar_url || null,
      has_avatar: !!admin.avatar_url,
      created_at: admin.created_at
    }));

    return {
      success: true,
      total_admins: admins.length,
      admins_with_avatars: adminsWithAvatars.filter(admin => admin.has_avatar).length,
      admins: adminsWithAvatars
    };

  } catch (error) {
    console.error('GET ALL ADMINS WITH AVATARS ERROR:', error);
    throw error;
  }
};

/**
 * ================== ВАЛИДАЦИЯ ДОСТУПА К ФАЙЛАМ АДМИНА ==================
 */
export const validateAdminFileAccess = async (adminId, requesterId) => {
  try {
    const admin = await AdminUser.findById(adminId);
    const requester = await AdminUser.findById(requesterId);
    
    if (!admin || !requester) {
      throw new Error('Администратор не найден');
    }

    // Доступ разрешен если:
    // 1. Сам админ управляет своими файлами
    // 2. Owner может управлять файлами любого админа
    const hasAccess = (
      adminId === requesterId || 
      requester.role === 'owner'
    );

    if (!hasAccess) {
      throw new Error('Доступ запрещен: недостаточно прав');
    }

    return true;

  } catch (error) {
    console.error('VALIDATE ADMIN FILE ACCESS ERROR:', error);
    throw error;
  }
};

/**
 * ================== СИСТЕМНАЯ СТАТИСТИКА ПО ФАЙЛАМ ==================
 */
export const getSystemFileStatistics = async (requesterId) => {
  try {
    // Проверяем права (только owner)
    const requester = await AdminUser.findById(requesterId);
    if (!requester || requester.role !== 'owner') {
      throw new Error('Недостаточно прав для просмотра системной статистики');
    }

    // Статистика по админам
    const totalAdmins = await AdminUser.countDocuments({ is_active: true });
    const adminsWithAvatars = await AdminUser.countDocuments({ 
      is_active: true, 
      avatar_url: { $exists: true, $ne: '' } 
    });

    return {
      success: true,
      statistics: {
        admins: {
          total: totalAdmins,
          with_avatars: adminsWithAvatars,
          without_avatars: totalAdmins - adminsWithAvatars,
          avatar_percentage: totalAdmins > 0 ? Math.round((adminsWithAvatars / totalAdmins) * 100) : 0
        }
      },
      generated_at: new Date()
    };

  } catch (error) {
    console.error('GET SYSTEM FILE STATISTICS ERROR:', error);
    throw error;
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  uploadAdminAvatar,
  updateAdminAvatar,
  createAdminWithAvatar,
  getAdminFiles,
  validateAdminFileAccess,
  getSystemFileStatistics
};