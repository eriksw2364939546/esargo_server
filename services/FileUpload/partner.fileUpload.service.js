// services/FileUpload/partner.fileUpload.service.js
import { PartnerProfile, Product } from '../../models/index.js';
import { validateMongoId } from '../../utils/validation.utils.js';
import mongoose from 'mongoose';


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
    console.error('UPLOAD PARTNER COVER ERROR:', error);
    throw error;
  }
};

/**
 * ================== ОБНОВЛЕНИЕ ОБЛОЖКИ РЕСТОРАНА/МАГАЗИНА ==================
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
    console.error('UPDATE PARTNER COVER ERROR:', error);
    throw error;
  }
};

/**
 * ================== ДОБАВЛЕНИЕ ИЗОБРАЖЕНИЙ В ГАЛЕРЕЮ ==================
 */
export const addPartnerGalleryImages = async (partnerId, imagesData, imageType = 'other') => {
  try {
    if (!validateMongoId(partnerId)) {
      throw new Error('Неверный ID партнера');
    }

    const profile = await PartnerProfile.findById(partnerId);
    if (!profile) {
      throw new Error('Профиль партнера не найден');
    }

    // Проверяем лимит галереи (максимум 20 изображений)
    if (profile.gallery.length + imagesData.length > 20) {
      throw new Error(`Превышен лимит галереи. Максимум 20 изображений. Текущее количество: ${profile.gallery.length}`);
    }

    // Добавляем изображения в галерею
    const newGalleryItems = imagesData.map(imageData => ({
      url: imageData.url,
      title: imageData.originalName || '',
      description: '',
      type: imageType, // 'interior', 'exterior', 'food', 'staff', 'other'
      uploaded_at: new Date()
    }));

    profile.gallery.push(...newGalleryItems);
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      business_name: profile.business_name,
      added_images: newGalleryItems.length,
      total_gallery_images: profile.gallery.length,
      new_images: newGalleryItems
    };

  } catch (error) {
    console.error('ADD PARTNER GALLERY ERROR:', error);
    throw error;
  }
};

/**
 * ================== ДОБАВЛЕНИЕ ФОТО К ПРОДУКТУ МЕНЮ ==================
 */
export const addMenuItemImage = async (productId, imageData) => {
  try {
    if (!validateMongoId(productId)) {
      throw new Error('Неверный ID продукта');
    }

    const product = await Product.findById(productId).populate('partner_id', 'business_name');
    if (!product) {
      throw new Error('Продукт не найден');
    }

    // Обновляем изображение продукта
    product.image_url = imageData.url;
    await product.save();

    return {
      success: true,
      product_id: product._id,
      product_name: product.name,
      partner_name: product.partner_id.business_name,
      image_url: product.image_url,
      updated_at: new Date()
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

    // Сохраняем документы (можно расширить модель PartnerProfile или создать отдельную модель)
    // Пока сохраняем в поле documents (если оно есть) или создаем временное решение
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
        additional_documents: profile.additional_documents || [] // ✅ ИСПРАВЛЕНО
      },
      statistics: {
        total_gallery_images: profile.gallery?.length || 0,
        total_additional_documents: profile.additional_documents?.length || 0, // ✅ ИСПРАВЛЕНО
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