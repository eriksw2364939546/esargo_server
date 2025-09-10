// services/FileUpload/common.fileUpload.service.js - Общие функции для работы с файлами
import fs from 'fs';
import path from 'path';

/**
 * ================== ОБЩИЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ФАЙЛАМИ ==================
 */

/**
 * Проверка существования файла
 */
export const checkFileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Безопасное удаление файла
 */
export const safeDeleteFile = async (filePath) => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    
    const exists = await checkFileExists(fullPath);
    if (!exists) {
      console.warn(`Файл не найден для удаления: ${fullPath}`);
      return { success: false, reason: 'file_not_found' };
    }

    await fs.promises.unlink(fullPath);
    console.log(`✅ Файл успешно удален: ${fullPath}`);
    
    return { success: true, deleted_path: fullPath };

  } catch (error) {
    console.error('SAFE DELETE FILE ERROR:', error);
    return { success: false, reason: 'delete_error', error: error.message };
  }
};

/**
 * Получение информации о файле
 */
export const getFileInfo = async (filePath) => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const stats = await fs.promises.stat(fullPath);
    
    return {
      success: true,
      info: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        is_file: stats.isFile(),
        is_directory: stats.isDirectory(),
        extension: path.extname(fullPath),
        filename: path.basename(fullPath)
      }
    };

  } catch (error) {
    console.error('GET FILE INFO ERROR:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Создание структуры папок если они не существуют
 */
export const ensureDirectoryStructure = async (directories) => {
  try {
    const results = [];
    
    for (const dir of directories) {
      const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
      
      if (!fs.existsSync(fullPath)) {
        await fs.promises.mkdir(fullPath, { recursive: true });
        results.push({ directory: dir, created: true });
        console.log(`📁 Created directory: ${fullPath}`);
      } else {
        results.push({ directory: dir, created: false, exists: true });
      }
    }

    return { success: true, results };

  } catch (error) {
    console.error('ENSURE DIRECTORY STRUCTURE ERROR:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ================== ОЧИСТКА СТАРЫХ ФАЙЛОВ (ДЛЯ UBERЕATS-МАСШТАБА) ==================
 */
export const cleanupOldFiles = async (directory, maxAgeInDays = 30) => {
  try {
    const fullPath = path.isAbsolute(directory) ? directory : path.join(process.cwd(), directory);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, reason: 'directory_not_found' };
    }

    const files = await fs.promises.readdir(fullPath);
    const maxAge = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);
    
    const deletedFiles = [];
    const errors = [];
    let totalSizeFreed = 0;

    for (const file of files) {
      try {
        const filePath = path.join(fullPath, file);
        const stats = await fs.promises.stat(filePath);
        
        // Примеры старых файлов в UberEats-подобной системе:
        // - Удаленные аватары курьеров (>30 дней)
        // - Старые обложки ресторанов при обновлении (>30 дней)
        // - Неиспользуемые фото блюд (>90 дней)
        // - Временные файлы загрузки (>1 день)
        if (stats.mtime.getTime() < maxAge) {
          await fs.promises.unlink(filePath);
          totalSizeFreed += stats.size;
          deletedFiles.push({
            filename: file,
            size: stats.size,
            size_mb: Math.round(stats.size / (1024 * 1024) * 100) / 100,
            modified: stats.mtime
          });
        }
      } catch (error) {
        errors.push({ filename: file, error: error.message });
      }
    }

    return {
      success: true,
      cleanup_summary: {
        directory: directory,
        max_age_days: maxAgeInDays,
        files_deleted: deletedFiles.length,
        total_size_freed_mb: Math.round(totalSizeFreed / (1024 * 1024) * 100) / 100,
        total_size_freed_gb: Math.round(totalSizeFreed / (1024 * 1024 * 1024) * 100) / 100,
        errors_count: errors.length,
        deleted_files: deletedFiles,
        errors: errors,
        estimated_savings: `Освобождено ${Math.round(totalSizeFreed / (1024 * 1024))} MB дискового пространства`
      }
    };

  } catch (error) {
    console.error('CLEANUP OLD FILES ERROR:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Получение размера папки
 */
export const getDirectorySize = async (directory) => {
  try {
    const fullPath = path.isAbsolute(directory) ? directory : path.join(process.cwd(), directory);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, reason: 'directory_not_found' };
    }

    let totalSize = 0;
    let fileCount = 0;

    const calculateSize = async (dir) => {
      const files = await fs.promises.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isDirectory()) {
          await calculateSize(filePath);
        } else {
          totalSize += stats.size;
          fileCount++;
        }
      }
    };

    await calculateSize(fullPath);

    return {
      success: true,
      directory_info: {
        path: directory,
        total_size_bytes: totalSize,
        total_size_mb: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        file_count: fileCount
      }
    };

  } catch (error) {
    console.error('GET DIRECTORY SIZE ERROR:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Валидация размера файла
 */
export const validateFileSize = (fileSize, maxSizeInMB = 5) => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  
  return {
    is_valid: fileSize <= maxSizeInBytes,
    file_size_mb: Math.round(fileSize / (1024 * 1024) * 100) / 100,
    max_size_mb: maxSizeInMB,
    exceeds_limit: fileSize > maxSizeInBytes
  };
};

/**
 * Валидация типа файла
 */
export const validateFileType = (filename, allowedExtensions = []) => {
  const extension = path.extname(filename).toLowerCase();
  const isAllowed = allowedExtensions.length === 0 || allowedExtensions.includes(extension);
  
  return {
    is_valid: isAllowed,
    file_extension: extension,
    allowed_extensions: allowedExtensions,
    filename: filename
  };
};

/**
 * Генерация уникального имени файла
 */
export const generateUniqueFilename = (originalFilename, prefix = '', suffix = '') => {
  const extension = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, extension);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  const uniqueName = `${prefix}${baseName}-${timestamp}-${random}${suffix}${extension}`;
  
  return {
    unique_filename: uniqueName,
    original_filename: originalFilename,
    timestamp: timestamp,
    random_suffix: random
  };
};

/**
 * Получение статистики по всем загрузкам
 */
export const getUploadStatistics = async () => {
  try {
    const uploadDirs = [
      'uploads/partners/partnersImage',
      'uploads/partners/menusImage', 
      'uploads/partners/documentsImage',
      'uploads/couriers/avatarsImage',
      'uploads/couriers/documentsPdf',
      'uploads/admins/avatarsImage'
    ];

    const statistics = {};
    let totalFiles = 0;
    let totalSizeBytes = 0;

    for (const dir of uploadDirs) {
      const dirStats = await getDirectorySize(dir);
      
      if (dirStats.success) {
        statistics[dir] = dirStats.directory_info;
        totalFiles += dirStats.directory_info.file_count;
        totalSizeBytes += dirStats.directory_info.total_size_bytes;
      } else {
        statistics[dir] = { error: dirStats.reason || 'unknown_error' };
      }
    }

    return {
      success: true,
      upload_statistics: {
        total_files: totalFiles,
        total_size_bytes: totalSizeBytes,
        total_size_mb: Math.round(totalSizeBytes / (1024 * 1024) * 100) / 100,
        directories: statistics,
        generated_at: new Date()
      }
    };

  } catch (error) {
    console.error('GET UPLOAD STATISTICS ERROR:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Создание резервной копии файла
 */
export const createFileBackup = async (filePath, backupDir = 'backups') => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const backupPath = path.join(process.cwd(), backupDir);
    
    // Создаем папку бэкапов если не существует
    if (!fs.existsSync(backupPath)) {
      await fs.promises.mkdir(backupPath, { recursive: true });
    }

    const filename = path.basename(fullPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${timestamp}-${filename}`;
    const backupFullPath = path.join(backupPath, backupFilename);

    await fs.promises.copyFile(fullPath, backupFullPath);

    return {
      success: true,
      backup_info: {
        original_file: filePath,
        backup_file: backupFullPath,
        backup_filename: backupFilename,
        created_at: new Date()
      }
    };

  } catch (error) {
    console.error('CREATE FILE BACKUP ERROR:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  checkFileExists,
  safeDeleteFile,
  getFileInfo,
  ensureDirectoryStructure,
  cleanupOldFiles,
  getDirectorySize,
  validateFileSize,
  validateFileType,
  generateUniqueFilename,
  getUploadStatistics,
  createFileBackup
};