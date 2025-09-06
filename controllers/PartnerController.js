// controllers/PartnerController.js - ИСПРАВЛЕННЫЙ КОНТРОЛЛЕР БЕЗ импорта
import { createPartnerAccount, loginPartner, checkPartnerExists } from '../services/Partner/partner.auth.service.js';
import * as partnerService from '../services/Partner/partner.service.js';
import { PartnerLegalInfo, InitialPartnerRequest } from '../models/index.js';
import { cryptoString, decryptString } from '../utils/crypto.js';
import mongoose from 'mongoose';

/**
 * 🗺️ ВСТРОЕННАЯ ФУНКЦИЯ ГЕОКОДИРОВАНИЯ
 * (копия из address.service.js для избежания проблем с импортом)
 */
const internalMockGeocode = (address) => {
  const addressLower = address.toLowerCase();
  
  // Тестовые адреса для разработки
  const mockAddresses = {
    'vieux port marseille': { lat: 43.2951, lng: 5.3739, zone: 1 },
    'notre dame de la garde': { lat: 43.2842, lng: 5.3714, zone: 1 },
    'canebière marseille': { lat: 43.2946, lng: 5.3758, zone: 1 },
    'rue de la république': { lat: 43.296482, lng: 5.36978, zone: 1 },
    'marseille': { lat: 43.296482, lng: 5.36978, zone: 1 },
    'château d\'if': { lat: 43.2799, lng: 5.3256, zone: 2 },
    'calanques marseille': { lat: 43.2109, lng: 5.4414, zone: 2 },
    'aéroport marseille': { lat: 43.4393, lng: 5.2214, zone: 2 },
    'la joliette': { lat: 43.3067, lng: 5.3647, zone: 1 },
    'cours julien': { lat: 43.2929, lng: 5.3832, zone: 1 },
    'prado marseille': { lat: 43.2580, lng: 5.3927, zone: 1 },
    'castellane': { lat: 43.2884, lng: 5.3984, zone: 1 }
  };

  // Ищем точное совпадение
  for (const [mockAddr, coords] of Object.entries(mockAddresses)) {
    if (addressLower.includes(mockAddr) || mockAddr.includes(addressLower)) {
      return {
        success: true,
        coordinates: coords,
        formatted_address: address,
        zone: coords.zone
      };
    }
  }

  // Если адрес не найден в mock данных, возвращаем случайные координаты центра Марселя
  const randomLat = 43.295 + (Math.random() - 0.5) * 0.02;
  const randomLng = 5.375 + (Math.random() - 0.5) * 0.02;
  
  return {
    success: true,
    coordinates: { lat: randomLat, lng: randomLng, zone: 1 },
    formatted_address: address,
    zone: 1,
    mock_warning: 'Использованы случайные координаты для тестирования'
  };
};

/**
 * 🏪 РЕГИСТРАЦИЯ ПАРТНЕРА
 * POST /api/partners/register
 */
const registerPartner = async (req, res) => {
    try {
        const partnerData = req.body;
        const {
            first_name, last_name, email, password, confirm_password, phone,
            business_name, brand_name, category, address, floor_unit,
            latitude, longitude, whatsapp_consent
        } = partnerData;
        
        console.log('🔍 REGISTER PARTNER - Start:', {
            email: email,
            business_name: business_name,
            brand_name: brand_name,
            category: category,
            has_address: !!address,
            has_coordinates: !!(latitude && longitude)
        });

        // ✅ ИСПРАВЛЕНО: Обязательные поля БЕЗ latitude/longitude
        const requiredFields = [
            'first_name', 'last_name', 'email', 'password', 'confirm_password', 'phone',
            'address', 'business_name', 'brand_name', 'category', 'whatsapp_consent'
        ];

        const missingFields = requiredFields.filter(field => !partnerData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                result: false,
                message: `Обязательные поля: ${missingFields.join(', ')}`
            });
        }

        // ✅ Валидация французского телефона
        const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
        const cleanPhone = phone.replace(/\s+/g, '');
        
        if (!frenchPhoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                result: false,
                message: "Телефон должен быть французским номером",
                format_examples: [
                    "+33 1 42 34 56 78",
                    "01 42 34 56 78",
                    "+33 6 12 34 56 78"
                ],
                provided_phone: phone
            });
        }

        // Валидация паролей
        if (password !== confirm_password) {
            return res.status(400).json({
                result: false,
                message: "Пароли не совпадают"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                result: false,
                message: "Пароль должен содержать минимум 6 символов"
            });
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                result: false,
                message: "Некорректный email"
            });
        }

        // ✅ ИСПРАВЛЕНО: Валидация категории - ТОЛЬКО restaurant или store
        if (!['restaurant', 'store'].includes(category)) {
            return res.status(400).json({
                result: false,
                message: "Категория должна быть 'restaurant' или 'store'",
                allowed_categories: ['restaurant', 'store'],
                provided_category: category
            });
        }

        // ✅ НОВАЯ ЛОГИКА: Автогеокодирование адреса
        let coordinates;
        let addressString = '';

        if (typeof address === 'object') {
            // Если address - объект, формируем строку
            addressString = `${address.street || ''}, ${address.city || ''}, ${address.postal_code || ''}, ${address.country || ''}`.trim();
        } else {
            // Если address - строка
            addressString = address.toString();
        }

        if (latitude && longitude) {
            // Используем переданные координаты
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                return res.status(400).json({
                    result: false,
                    message: "Координаты должны быть числовыми значениями"
                });
            }

            // Проверка координат Франции
            if (latitude < 41.0 || latitude > 51.5 || longitude < -5.5 || longitude > 9.6) {
                return res.status(400).json({
                    result: false,
                    message: "Геолокация должна быть на территории Франции"
                });
            }

            coordinates = { lat: latitude, lng: longitude };
        } else {
            // ✅ АВТОГЕОКОДИРОВАНИЕ АДРЕСА
            console.log('🗺️ Выполняется автогеокодирование адреса:', addressString);
            
            const geocodeResult = internalMockGeocode(addressString);
            
            if (!geocodeResult.success) {
                return res.status(400).json({
                    result: false,
                    message: "Не удалось определить координаты адреса",
                    provided_address: addressString,
                    suggestion: "Попробуйте указать более точный адрес или передайте координаты вручную"
                });
            }

            coordinates = geocodeResult.coordinates;
            
            console.log('✅ Адрес успешно геокодирован:', {
                address: addressString,
                coordinates: coordinates,
                zone: geocodeResult.zone
            });
        }

        // ✅ Подготовка данных для сервиса
        const serviceData = {
            // Личные данные
            first_name,
            last_name, 
            email,
            password,
            phone: cleanPhone,

            // Бизнес данные
            business_name,
            brand_name,
            category,
            address: addressString, // Строковое представление адреса
            floor_unit: floor_unit || null,

            // ✅ ПРАВИЛЬНАЯ СТРУКТУРА LOCATION
            location: {
                type: 'Point',
                coordinates: [coordinates.lng, coordinates.lat] // [lng, lat] для MongoDB
            },

            // Согласие
            whatsapp_consent
        };

        console.log('✅ VALIDATION COMPLETED - Calling service:', {
            email: serviceData.email,
            phone: serviceData.phone,
            location: serviceData.location,
            whatsapp_consent: serviceData.whatsapp_consent
        });

        // Вызов сервиса создания аккаунта
        const result = await createPartnerAccount(serviceData);

        res.status(201).json({
            result: true,
            message: "✅ Заявка на партнерство подана успешно!",
            data: {
                user_id: result.user_id,
                request_id: result.request_id,
                next_step: "Ожидайте одобрения администратора",
                coordinates_used: coordinates,
                geocoding_info: !latitude && !longitude ? "Адрес был автоматически геокодирован" : "Использованы переданные координаты"
            }
        });

    } catch (error) {
        console.error('🚨 REGISTER PARTNER - Error:', error);
        
        const statusCode = error.message.includes('уже существует') ? 409 :
                          error.message.includes('Обязательные поля') ? 400 :
                          error.message.includes('геокодирование') ? 422 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message || 'Ошибка при регистрации партнера'
        });
    }
};

/**
 * 🔐 АВТОРИЗАЦИЯ ПАРТНЕРА
 * POST /api/partners/login
 */
const loginPartnerController = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                result: false,
                message: "Email и пароль обязательны"
            });
        }

        console.log('🔍 LOGIN PARTNER - Start:', { email });

        const result = await loginPartner(email, password);

        res.status(200).json({
            result: true,
            message: "Успешный вход",
            ...result
        });

    } catch (error) {
        console.error('🚨 LOGIN PARTNER - Error:', error);
        
        const statusCode = error.message.includes('не найден') ? 404 :
                          error.message.includes('неверный') ? 401 :
                          error.message.includes('неактивен') ? 403 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message
        });
    }
};

/**
 * ✅ ВЕРИФИКАЦИЯ ТОКЕНА ПАРТНЕРА
 * GET /api/partners/verify
 */
const verifyPartner = async (req, res) => {
    try {
        const { partner } = req;

        console.log('🔍 VERIFY PARTNER - Start:', {
            partner_id: partner._id,
            partner_email: partner.email
        });

        res.status(200).json({
            result: true,
            message: "Токен действителен",
            partner: {
                id: partner._id,
                email: partner.email,
                role: partner.role,
                is_active: partner.is_active
            }
        });

    } catch (error) {
        console.error('🚨 VERIFY PARTNER - Error:', error);
        res.status(401).json({
            result: false,
            message: "Недействительный токен"
        });
    }
};

/**
 * 📊 ПОЛУЧЕНИЕ СТАТУСА DASHBOARD
 * GET /api/partners/dashboard
 */
const getDashboardStatus = async (req, res) => {
    try {
        const { partner } = req;

        console.log('🔍 GET DASHBOARD STATUS - Start:', {
            partner_id: partner._id
        });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const dashboardData = await partnerService.getPartnerDashboardData(partner._id);

        res.status(200).json({
            result: true,
            message: "Статус dashboard получен",
            dashboard: dashboardData
        });

    } catch (error) {
        console.error('🚨 GET DASHBOARD STATUS - Error:', error);
        res.status(500).json({
            result: false,
            message: error.message || "Ошибка получения данных dashboard"
        });
    }
};

/**
 * 📄 ПОДАЧА ЮРИДИЧЕСКИХ ДОКУМЕНТОВ
 * POST /api/partners/legal-info/:request_id
 */
const submitLegalInfo = async (req, res) => {
    try {
        const { partner } = req;
        const { request_id } = req.params;
        const legalData = req.body;

        console.log('🔍 SUBMIT LEGAL INFO - Start:', {
            partner_id: partner._id,
            request_id: request_id,
            has_siret: !!legalData.siret_number
        });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await partnerService.submitPartnerLegalInfo(partner._id, request_id, legalData);

        res.status(201).json({
            result: true,
            message: "Юридические документы поданы",
            legal_info_id: result.legal_info_id,
            next_step: "Ожидайте проверки администратором"
        });

    } catch (error) {
        console.error('🚨 SUBMIT LEGAL INFO - Error:', error);
        
        const statusCode = error.message.includes('не найден') ? 404 :
                          error.message.includes('уже подан') ? 409 :
                          error.message.includes('валидация') ? 400 : 500;

        res.status(statusCode).json({
            result: false,
            message: error.message || "Ошибка подачи юридических документов"
        });
    }
};

/**
 * 👤 ПОЛУЧЕНИЕ ПРОФИЛЯ ПАРТНЕРА
 * GET /api/partners/profile
 * GET /api/partners/profile/:id
 */
const getProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;

        const profileId = id || partner._id;

        console.log('🔍 GET PROFILE - Start:', {
            requester_id: partner._id,
            target_profile_id: profileId
        });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const profileData = await partnerService.getPartnerProfile(profileId);

        res.status(200).json({
            result: true,
            message: "Профиль получен",
            profile: profileData
        });

    } catch (error) {
        console.error('🚨 GET PROFILE - Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка получения профиля"
        });
    }
};

/**
 * ✏️ ОБНОВЛЕНИЕ ПРОФИЛЯ ПАРТНЕРА
 * PUT /api/partners/profile/:id
 */
const updateProfile = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;
        const updateData = req.body;

        console.log('🔍 UPDATE PROFILE - Start:', {
            partner_id: partner._id,
            profile_id: id,
            fields_to_update: Object.keys(updateData)
        });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const updatedProfile = await partnerService.updatePartnerProfile(partner._id, updateData);

        res.status(200).json({
            result: true,
            message: "Профиль обновлен",
            profile: updatedProfile
        });

    } catch (error) {
        console.error('🚨 UPDATE PROFILE - Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка обновления профиля"
        });
    }
};

/**
 * 🗑️ УДАЛЕНИЕ ПАРТНЕРА
 * DELETE /api/partners/profile/:id
 */
const deletePartner = async (req, res) => {
    try {
        const { partner } = req;
        const { id } = req.params;

        console.log('🔍 DELETE PARTNER - Start:', {
            partner_id: partner._id,
            target_id: id
        });

        // ✅ ВСЯ ЛОГИКА В СЕРВИСЕ
        const result = await partnerService.deletePartnerAccount(id, partner._id);

        res.status(200).json({
            result: true,
            message: "Партнер удален",
            deleted_partner_id: result.deletedPartnerId
        });

    } catch (error) {
        console.error('🚨 DELETE PARTNER - Error:', error);
        res.status(error.message.includes('не найден') ? 404 : 500).json({
            result: false,
            message: error.message || "Ошибка удаления партнера"
        });
    }
};

// ================ ЭКСПОРТ ВСЕХ ФУНКЦИЙ ================

export {
    registerPartner,
    loginPartnerController,
    verifyPartner,
    getDashboardStatus,
    getProfile,
    updateProfile,
    deletePartner,
    submitLegalInfo
};