// services/FileUpload/partner.fileUpload.service.js
import { PartnerProfile } from '../../models/index.js';
import { validateMongoId } from '../../utils/validation.utils.js';

/**
 * ================== ЗАГРУЗКА ОБЛОЖКИ ПАРТНЕРА ==================
 */
export const uploadPartnerCoverImage = async (partnerId, imageData) => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    if (profile.cover_image_url) {
      throw new Error('Обложка уже загружена. Используйте функцию обновления');
    }

    // Загружаем первую обложку
    profile.cover_image_url = imageData.url;
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      business_name: profile.business_name,
      cover_image_url: profile.cover_image_url,
      action: 'uploaded',
      updated_at: new Date()
    };

  } catch (error) {
    console.error('UPLOAD PARTNER COVER IMAGE ERROR:', error);
    throw error;
  }
};

/**
 * ================== ОБНОВЛЕНИЕ ОБЛОЖКИ ПАРТНЕРА ==================
 */
export const updatePartnerCoverImage = async (partnerId, imageData) => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Обновляем обложку
    profile.cover_image_url = imageData.url;
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      business_name: profile.business_name,
      cover_image_url: profile.cover_image_url,
      updated_at: new Date()
    };

  } catch (error) {
    console.error('UPDATE PARTNER COVER IMAGE ERROR:', error);
    throw error;
  }
};

/**
 * ================== ДОБАВЛЕНИЕ ИЗОБРАЖЕНИЙ В ГАЛЕРЕЮ ==================
 */
export const addPartnerGalleryImages = async (partnerId, imagesData) => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Создаем записи для галереи
    const galleryImages = imagesData.map(imageData => ({
      url: imageData.url,
      filename: imageData.filename,
      original_name: imageData.originalName,
      size: imageData.size,
      uploaded_at: new Date(),
      type: 'gallery_image'
    }));

    // Добавляем изображения в галерею
    if (!profile.gallery) {
      profile.gallery = [];
    }

    profile.gallery.push(...galleryImages);
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      business_name: profile.business_name,
      uploaded_images: galleryImages.length,
      total_gallery_images: profile.gallery.length,
      new_images: galleryImages
    };

  } catch (error) {
    console.error('ADD PARTNER GALLERY IMAGES ERROR:', error);
    throw error;
  }
};

/**
 * ================== ДОБАВЛЕНИЕ ИЗОБРАЖЕНИЯ БЛЮДА/ТОВАРА ==================
 */
export const addMenuItemImage = async (partnerId, imageData, menuItemId) => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Создаем запись изображения блюда
    const menuImage = {
      url: imageData.url,
      filename: imageData.filename,
      original_name: imageData.originalName,
      size: imageData.size,
      uploaded_at: new Date(),
      type: 'menu_item_image',
      menu_item_id: menuItemId || null
    };

    // Добавляем в галерею (с пометкой что это блюдо)
    if (!profile.gallery) {
      profile.gallery = [];
    }

    profile.gallery.push(menuImage);
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      business_name: profile.business_name,
      menu_image: menuImage,
      total_gallery_images: profile.gallery.length
    };

  } catch (error) {
    console.error('ADD MENU ITEM IMAGE ERROR:', error);
    throw error;
  }
};

/**
 * ================== СОХРАНЕНИЕ ДОКУМЕНТОВ ПАРТНЕРА ==================
 */
export const savePartnerDocuments = async (partnerId, documentsData) => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Создаем записи документов
    const documentRecords = documentsData.map(docData => ({
      type: docData.documentType || 'legal_document',
      url: docData.url,
      filename: docData.filename,
      original_name: docData.originalName,
      size: docData.size,
      uploaded_at: new Date(),
      status: 'pending_review'
    }));

    // ✅ ИСПРАВЛЕНО: Используем additional_documents
    if (!profile.additional_documents) {
      profile.additional_documents = [];
    }
    
    profile.additional_documents.push(...documentRecords);
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      business_name: profile.business_name,
      uploaded_documents: documentRecords.length,
      total_documents: profile.additional_documents.length,
      documents: documentRecords
    };

  } catch (error) {
    console.error('SAVE PARTNER DOCUMENTS ERROR:', error);
    throw error;
  }
};

/**
 * ================== УДАЛЕНИЕ ИЗОБРАЖЕНИЯ ИЗ ГАЛЕРЕИ ==================
 */
export const removePartnerGalleryImage = async (partnerId, imageUrl) => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Найдем и удалим изображение из галереи
    const imageIndex = profile.gallery.findIndex(item => item.url === imageUrl);
    if (imageIndex === -1) {
      throw new Error('Изображение не найдено в галерее');
    }

    const removedImage = profile.gallery[imageIndex];
    profile.gallery.splice(imageIndex, 1);
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      removed_image: removedImage,
      remaining_images: profile.gallery.length
    };

  } catch (error) {
    console.error('REMOVE PARTNER GALLERY IMAGE ERROR:', error);
    throw error;
  }
};

/**
 * ================== ПОЛУЧЕНИЕ ВСЕХ ФАЙЛОВ ПАРТНЕРА ==================
 */
export const getPartnerFiles = async (partnerId) => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId).select(
      'business_name cover_image_url gallery additional_documents'
    );
    
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    return {
      success: true,
      profile_id: profile._id,
      business_name: profile.business_name,
      files: {
        cover_image: profile.cover_image_url || null,
        gallery: profile.gallery || [],
        additional_documents: profile.additional_documents || []
      },
      statistics: {
        total_gallery_images: profile.gallery?.length || 0,
        total_additional_documents: profile.additional_documents?.length || 0,
        has_cover_image: !!profile.cover_image_url
      }
    };

  } catch (error) {
    console.error('GET PARTNER FILES ERROR:', error);
    throw error;
  }
};

/**
 * ================== ВАЛИДАЦИЯ ДОСТУПА К ФАЙЛАМ ПАРТНЕРА ==================
 */
export const validatePartnerFileAccess = async (partnerId, userId) => {
  try {
    const profile = await PartnerProfile.findById(partnerId).select('user_id');
    
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    if (profile.user_id.toString() !== userId.toString()) {
      throw new Error('Доступ запрещен: можно управлять только своими файлами');
    }

    return true;

  } catch (error) {
    console.error('VALIDATE PARTNER FILE ACCESS ERROR:', error);
    throw error;
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  uploadPartnerCoverImage,
  updatePartnerCoverImage,
  addPartnerGalleryImages,
  addMenuItemImage,
  savePartnerDocuments,
  removePartnerGalleryImage,
  getPartnerFiles,
  validatePartnerFileAccess
};