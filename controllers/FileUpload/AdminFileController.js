// controllers/FileUpload/AdminFileController.js
import {
  uploadAdminAvatar,
  updateAdminAvatar,
  createAdminWithAvatar,
  removeAdminAvatar, // ДОБАВЛЕН ИМПОРТ
  getAdminFiles,
  validateAdminFileAccess,
  getSystemFileStatistics
} from '../../services/FileUpload/admin.fileUpload.service.js';

/**
 * ================== ЗАГРУЗКА АВАТАРА АДМИНА ==================
 */
export const uploadAvatar = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { admin_id } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Файл аватара не загружен"
      });
    }

    if (uploadedFiles.length > 1) {
      return res.status(400).json({
        result: false,
        message: "Можно загрузить только один аватар"
      });
    }

    // Проверяем доступ (сам админ или owner)
    await validateAdminFileAccess(admin_id, user._id);

    // Загружаем аватар
    const result = await uploadAdminAvatar(admin_id, uploadedFiles[0]);

    res.status(201).json({
      result: true,
      message: "Аватар администратора успешно загружен",
      data: result
    });

  } catch (error) {
    console.error('🚨 UPLOAD ADMIN AVATAR Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') || error.message.includes('прав') ? 403 :
                      error.message.includes('уже загружен') ? 409 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка загрузки аватара администратора"
    });
  }
};

/**
 * ================== ОБНОВЛЕНИЕ АВАТАРА АДМИНА ==================
 */
export const updateAvatar = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { admin_id } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Файл аватара не загружен"
      });
    }

    // Проверяем доступ
    await validateAdminFileAccess(admin_id, user._id);

    // Обновляем аватар
    const result = await updateAdminAvatar(admin_id, uploadedFiles[0]);

    res.status(200).json({
      result: true,
      message: "Аватар администратора успешно обновлен",
      data: result
    });

  } catch (error) {
    console.error('🚨 UPDATE ADMIN AVATAR Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') || error.message.includes('прав') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка обновления аватара администратора"
    });
  }
};

/**
 * ================== СОЗДАНИЕ АДМИНА С АВАТАРОМ (ТОЛЬКО OWNER) ==================
 */
export const createWithAvatar = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { first_name, last_name, email, role = 'admin' } = req.body;

    // Проверка роли (только owner может создавать админов)
    if (user.role !== 'owner') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав: только owner может создавать администраторов"
      });
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Файл аватара не загружен"
      });
    }

    const adminData = { first_name, last_name, email, role };

    // Создаем админа с аватаром
    const result = await createAdminWithAvatar(adminData, uploadedFiles[0], user._id);

    res.status(201).json({
      result: true,
      message: "Администратор с аватаром успешно создан",
      data: result
    });

  } catch (error) {
    console.error('🚨 CREATE ADMIN WITH AVATAR Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('прав') ? 403 :
                      error.message.includes('существует') ? 409 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка создания администратора с аватаром"
    });
  }
};

/**
 * ================== УДАЛЕНИЕ АВАТАРА АДМИНА ==================
 */
export const removeAvatar = async (req, res) => {
  try {
    const { user, deletedFile } = req;
    const { admin_id } = req.params;

    if (!deletedFile) {
      return res.status(400).json({
        result: false,
        message: "Файл не был удален из файловой системы"
      });
    }

    // Проверяем доступ (сам админ или owner)
    await validateAdminFileAccess(admin_id, user._id);

    // Используем сервис для удаления аватара из базы данных
    const result = await removeAdminAvatar(admin_id, user._id);

    res.status(200).json({
      result: true,
      message: "Аватар администратора успешно удален",
      data: {
        ...result,
        deleted_file: deletedFile
      }
    });

  } catch (error) {
    console.error('🚨 REMOVE ADMIN AVATAR Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') || error.message.includes('прав') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка удаления аватара администратора"
    });
  }
};

/**
 * ================== ПОЛУЧЕНИЕ ФАЙЛОВ АДМИНА ==================
 */
export const getFiles = async (req, res) => {
  try {
    const { user } = req;
    const { admin_id } = req.params;

    // Проверяем доступ
    await validateAdminFileAccess(admin_id, user._id);

    // Получаем файлы
    const result = await getAdminFiles(admin_id);

    res.status(200).json({
      result: true,
      message: "Файлы администратора получены",
      data: result
    });

  } catch (error) {
    console.error('🚨 GET ADMIN FILES Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') || error.message.includes('прав') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения файлов администратора"
    });
  }
};

/**
 * ================== СИСТЕМНАЯ СТАТИСТИКА ФАЙЛОВ (ТОЛЬКО OWNER) ==================
 */
export const getSystemStatistics = async (req, res) => {
  try {
    const { user } = req;

    // Проверка прав (только owner)
    if (user.role !== 'owner') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав: только owner может просматривать системную статистику"
      });
    }

    // Получаем статистику
    const result = await getSystemFileStatistics(user._id);

    res.status(200).json({
      result: true,
      message: "Системная статистика файлов получена",
      data: result
    });

  } catch (error) {
    console.error('🚨 GET SYSTEM STATISTICS Controller Error:', error);
    
    const statusCode = error.message.includes('прав') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения системной статистики"
    });
  }
};

/**
 * ================== ПОЛУЧЕНИЕ СПИСКА ФАЙЛОВ ПО ТИПУ ==================
 */
export const getFilesList = async (req, res) => {
  try {
    const { user, filesList } = req;

    // Проверка прав (только админы)
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав"
      });
    }

    if (!filesList) {
      return res.status(400).json({
        result: false,
        message: "Список файлов не получен"
      });
    }

    res.status(200).json({
      result: true,
      message: "Список файлов получен",
      data: filesList
    });

  } catch (error) {
    console.error('🚨 GET ADMIN FILES LIST Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения списка файлов"
    });
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  uploadAvatar,
  updateAvatar,
  createAdminWithAvatar: createWithAvatar,
  removeAvatar, // ДОБАВЛЕНА ФУНКЦИЯ
  getFiles,
  getSystemStatistics,
  getFilesList
};