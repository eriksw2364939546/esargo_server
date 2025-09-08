// utils/address.utils.js - ЦЕНТРАЛИЗОВАННАЯ УТИЛИТА ГЕОКОДИРОВАНИЯ

/**
 * ================== MOCK ГЕОКОДИРОВАНИЕ ==================
 * Единственное место для геокодирования в системе
 */
export const mockGeocode = (address) => {
    if (!address || typeof address !== 'string') {
        return {
            success: false,
            error: 'Адрес не указан'
        };
    }

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
 * ================== РАСЧЕТ РАССТОЯНИЯ ==================
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

/**
 * ================== ОПРЕДЕЛЕНИЕ ЗОНЫ ДОСТАВКИ ==================
 */
export const getDeliveryZone = (distance) => {
    if (distance <= 5) return 1;
    if (distance <= 10) return 2;
    return null; // Доставка невозможна
};

/**
 * ================== ВАЛИДАЦИЯ КООРДИНАТ ==================
 */
export const validateCoordinates = (lat, lng) => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    return !isNaN(latitude) && 
           !isNaN(longitude) && 
           latitude >= -90 && 
           latitude <= 90 && 
           longitude >= -180 && 
           longitude <= 180;
};