// controllers/FileUpload/CommonFileController.js - Общие файловые операции
import {
  getUploadStatistics,
  cleanupOldFiles,
  getDirectorySize,
  safeDeleteFile,
  ensureDirectoryStructure
} from '../../services/FileUpload/common.fileUpload.service.js';

/**
 * ================== ОБЩАЯ СТАТИСТИКА ЗАГРУЗОК ==================
 */
export const getUploadStats = async (req, res) => {
  try {
    const { user } = req;

    // Проверка прав (только админы и owner)
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для просмотра статистики"
      });
    }

    // Получаем статистику
    const result = await getUploadStatistics();

    res.status(200).json({
      result: true,
      message: "Общая статистика загрузок получена",
      data: result
    });

  } catch (error) {
    console.error('🚨 GET UPLOAD STATS Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статистики загрузок",
      error: error.message
    });
  }
};

/**
 * ================== РАЗМЕР КОНКРЕТНОЙ ПАПКИ ==================
 */
export const getFolderSize = async (req, res) => {
  try {
    const { user } = req;
    const { directory } = req.params;

    // Проверка прав (только админы и owner)
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для просмотра размера папок"
      });
    }

    // Валидация разрешенных папок (безопасность)
    const allowedDirectories = [
      'uploads/partners/partnersImage',
      'uploads/partners/menusImage',
      'uploads/partners/documentsImage',
      'uploads/couriers/avatarsImage',
      'uploads/couriers/documentsPdf',
      'uploads/admins/avatarsImage'
    ];

    if (!allowedDirectories.includes(directory)) {
      return res.status(400).json({
        result: false,
        message: "Недопустимая папка для просмотра"
      });
    }

    // Получаем размер папки
    const result = await getDirectorySize(directory);

    if (!result.success) {
      return res.status(404).json({
        result: false,
        message: result.reason === 'directory_not_found' ? 'Папка не найдена' : 'Ошибка получения размера'
      });
    }

    res.status(200).json({
      result: true,
      message: "Размер папки получен",
      data: result
    });

  } catch (error) {
    console.error('🚨 GET FOLDER SIZE Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения размера папки",
      error: error.message
    });
  }
};

/**
 * ================== ОЧИСТКА СТАРЫХ ФАЙЛОВ ==================
 */
export const cleanupFiles = async (req, res) => {
  try {
    const { user } = req;
    const { directory } = req.params;
    const { max_age_days = 30 } = req.body;

    // Проверка прав (только owner)
    if (user.role !== 'owner') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав: только owner может выполнять очистку файлов"
      });
    }

    // Валидация возраста файлов
    const maxAge = parseInt(max_age_days);
    if (isNaN(maxAge) || maxAge < 1 || maxAge > 365) {
      return res.status(400).json({
        result: false,
        message: "Возраст файлов должен быть от 1 до 365 дней"
      });
    }

    // Валидация разрешенных папок
    const allowedDirectories = [
      'uploads/partners/partnersImage',
      'uploads/partners/menusImage',
      'uploads/partners/documentsImage',
      'uploads/couriers/avatarsImage',
      'uploads/couriers/documentsPdf',
      'uploads/admins/avatarsImage'
    ];

    if (!allowedDirectories.includes(directory)) {
      return res.status(400).json({
        result: false,
        message: "Недопустимая папка для очистки"
      });
    }

    // Выполняем очистку
    const result = await cleanupOldFiles(directory, maxAge);

    if (!result.success) {
      return res.status(404).json({
        result: false,
        message: result.reason === 'directory_not_found' ? 'Папка не найдена' : 'Ошибка очистки'
      });
    }

    res.status(200).json({
      result: true,
      message: `Очистка завершена: удалено ${result.cleanup_summary.files_deleted} файлов`,
      data: result
    });

  } catch (error) {
    console.error('🚨 CLEANUP FILES Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка очистки файлов",
      error: error.message
    });
  }
};

/**
 * ================== СОЗДАНИЕ СТРУКТУРЫ ПАПОК ==================
 */
export const createDirectoryStructure = async (req, res) => {
  try {
    const { user } = req;

    // Проверка прав (только owner)
    if (user.role !== 'owner') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав: только owner может создавать структуру папок"
      });
    }

    // Создаем все необходимые папки
    const directories = [
      'uploads/partners/partnersImage',
      'uploads/partners/menusImage',
      'uploads/partners/documentsImage',
      'uploads/couriers/avatarsImage',
      'uploads/couriers/documentsPdf',
      'uploads/admins/avatarsImage'
    ];

    const result = await ensureDirectoryStructure(directories);

    if (!result.success) {
      return res.status(500).json({
        result: false,
        message: "Ошибка создания структуры папок",
        error: result.error
      });
    }

    res.status(200).json({
      result: true,
      message: "Структура папок проверена/создана",
      data: result
    });

  } catch (error) {
    console.error('🚨 CREATE DIRECTORY STRUCTURE Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка создания структуры папок",
      error: error.message
    });
  }
};

/**
 * ================== УДАЛЕНИЕ КОНКРЕТНОГО ФАЙЛА ==================
 */
export const deleteSpecificFile = async (req, res) => {
  try {
    const { user, deletedFile } = req;

    // Проверка прав (только админы и owner)
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для удаления файлов"
      });
    }

    if (!deletedFile) {
      return res.status(400).json({
        result: false,
        message: "Файл не был удален из файловой системы"
      });
    }

    res.status(200).json({
      result: true,
      message: "Файл успешно удален",
      data: {
        deleted_file: deletedFile,
        deleted_by: user._id,
        deleted_at: new Date()
      }
    });

  } catch (error) {
    console.error('🚨 DELETE SPECIFIC FILE Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка удаления файла",
      error: error.message
    });
  }
};

/**
 * ================== ПРОВЕРКА СОСТОЯНИЯ ФАЙЛОВОЙ СИСТЕМЫ ==================
 */
export const getSystemHealth = async (req, res) => {
  try {
    const { user } = req;

    // Проверка прав (только owner)
    if (user.role !== 'owner') {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для проверки состояния системы"
      });
    }

    // Получаем статистику всех папок
    const uploadStats = await getUploadStatistics();
    
    if (!uploadStats.success) {
      return res.status(500).json({
        result: false,
        message: "Ошибка получения статистики файловой системы"
      });
    }

    // Анализируем состояние (для UberEats-масштаба)
    const stats = uploadStats.upload_statistics;
    const health = {
      status: 'healthy',
      warnings: [],
      recommendations: []
    };

    // Проверяем размер (предупреждение если >10GB)
    if (stats.total_size_mb > 10000) {
      health.warnings.push('Общий размер файлов превышает 10GB');
      health.recommendations.push('Рассмотрите возможность миграции на облачное хранилище');
    }

    // Проверяем количество файлов (предупреждение если >50,000)
    if (stats.total_files > 50000) {
      health.warnings.push('Количество файлов превышает 50,000');
      health.recommendations.push('Рекомендуется настроить автоматическую очистку старых файлов');
    }

    if (health.warnings.length > 0) {
      health.status = 'warning';
    }

    res.status(200).json({
      result: true,
      message: "Состояние файловой системы получено",
      data: {
        health,
        statistics: stats,
        checked_at: new Date()
      }
    });

  } catch (error) {
    console.error('🚨 GET SYSTEM HEALTH Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка проверки состояния файловой системы",
      error: error.message
    });
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  getUploadStats,
  getFolderSize,
  cleanupFiles,
  createDirectoryStructure,
  deleteSpecificFile,
  getSystemHealth
};