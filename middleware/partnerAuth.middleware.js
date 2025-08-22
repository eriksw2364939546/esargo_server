// ================ middleware/partnerAuth.middleware.js (ПО АРХИТЕКТУРЕ ADMINAUTH) ================
import jwt from "jsonwebtoken";
import Meta from "../models/Meta.model.js";
import { InitialPartnerRequest, PartnerProfile } from "../models/index.js";

/**
 * Декодирование и проверка токена партнера (аналог adminAuth)
 */
const decodeToken = async (token) => {
    try {
        console.log('🔍 DECODING PARTNER TOKEN...');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { user_id, _id, role } = decoded;
        const partnerId = user_id || _id;

        if (role !== "partner") {
            return { 
                message: "Access denied! Not a partner account!", 
                result: false, 
                status: 403 
            };
        }

        // Ищем через Meta с populate (как в adminAuth)
        const metaInfo = await Meta.findOne({
            partner: partnerId,
            role: "partner"
        }).populate("partner");

        if (!metaInfo || !metaInfo.partner) {
            return { 
                message: "Access denied! Partner not found!", 
                result: false, 
                status: 404 
            };
        }

        const partner = metaInfo.partner;

        // Проверяем активность
        if (!metaInfo.is_active || !partner.is_active) {
            return {
                message: "Access denied! Account is inactive!",
                result: false,
                status: 403
            };
        }

        // Проверяем блокировку
        if (metaInfo.isAccountLocked && metaInfo.isAccountLocked()) {
            return {
                message: "Access denied! Account is locked!",
                result: false,
                status: 423
            };
        }

        return { 
            message: "Access approved!", 
            result: true, 
            partner: partner,
            metaInfo: metaInfo
        };

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { message: "Access denied! Token expired!", result: false, status: 401 };
        } else if (err.name === 'JsonWebTokenError') {
            return { message: "Access denied! Token invalid!", result: false, status: 401 };
        } else {
            return { message: "Access denied! Token error!", result: false, status: 401 };
        }
    }
};

/**
 * Базовая проверка токена партнера (аналог checkAdminToken)
 */
const checkPartnerToken = async (req, res, next) => {
    try {
        console.log('🔍 CHECK PARTNER TOKEN - START');
        
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        // Добавляем данные в req (как в adminAuth)
        req.partner = data.partner;
        req.user = data.partner;
        req.metaInfo = data.metaInfo;

        console.log('✅ TOKEN VERIFIED');
        next();

    } catch (error) {
        console.error('🚨 CHECK PARTNER TOKEN ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * Проверка статуса партнера (аналог checkAccessByGroup)
 * ✅ ПРАВА ПРОВЕРЯЮТСЯ В MIDDLEWARE
 */
const checkPartnerStatus = (requiredStatuses) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK PARTNER STATUS:', requiredStatuses);
            
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];

            if (!token) {
                return res.status(401).json({ 
                    message: "Access denied! Token required!", 
                    result: false 
                });
            }

            // Сначала проверяем токен
            const data = await decodeToken(token);
            if (!data.result) {
                return res.status(data.status).json({
                    message: data.message,
                    result: false
                });
            }

            const partner = data.partner;

            // ✅ ПРОВЕРКА ПРАВ В MIDDLEWARE - получаем заявку
            const partnerRequest = await InitialPartnerRequest.findOne({ 
                user_id: partner._id 
            });

            if (!partnerRequest) {
                return res.status(404).json({
                    message: "Partner request not found!",
                    result: false
                });
            }

            // ✅ ПРОВЕРКА СТАТУСА В MIDDLEWARE (аналог проверки ролей в adminAuth)
            if (!requiredStatuses.includes(partnerRequest.status)) {
                return res.status(403).json({
                    message: `Access denied! Required status: ${requiredStatuses.join(' or ')}. Current: ${partnerRequest.status}`,
                    result: false
                });
            }

            console.log('✅ STATUS CHECK PASSED');
            req.partner = partner;
            req.user = partner;
            req.metaInfo = data.metaInfo;
            req.partnerRequest = partnerRequest;

            next();

        } catch (error) {
            console.error('🚨 STATUS CHECK ERROR:', error);
            res.status(500).json({ 
                message: "Access denied! Server error!", 
                result: false, 
                error: error.message 
            });
        }
    };
};

/**
 * Проверка наличия профиля партнера (права в middleware)
 * ✅ ПРАВА ПРОВЕРЯЮТСЯ В MIDDLEWARE
 */
const requirePartnerProfile = async (req, res, next) => {
    try {
        console.log('🔍 REQUIRE PARTNER PROFILE');
        
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        // Проверяем токен
        const data = await decodeToken(token);
        if (!data.result) {
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        const partner = data.partner;

        // ✅ ПРОВЕРКА ПРАВ В MIDDLEWARE - проверяем наличие профиля
        const partnerProfile = await PartnerProfile.findOne({ 
            user_id: partner._id 
        });

        if (!partnerProfile) {
            return res.status(404).json({
                message: "Partner profile not found! Profile must be created first.",
                result: false
            });
        }

        console.log('✅ PROFILE CHECK PASSED');
        req.partner = partner;
        req.user = partner;
        req.metaInfo = data.metaInfo;
        req.partnerProfile = partnerProfile;

        next();

    } catch (error) {
        console.error('🚨 PROFILE CHECK ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * Проверка прав на редактирование профиля (аналог проверки в CustomerController)
 * ✅ ПРАВА ПРОВЕРЯЮТСЯ В MIDDLEWARE
 */
const checkProfileAccess = async (req, res, next) => {
    try {
        console.log('🔍 CHECK PROFILE ACCESS');
        
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        const partner = data.partner;
        const { id } = req.params;

        // ✅ ПРОВЕРКА ПРАВ В MIDDLEWARE - партнер может редактировать только свой профиль
        const partnerProfile = await PartnerProfile.findById(id);
        
        if (!partnerProfile) {
            return res.status(404).json({
                message: "Profile not found!",
                result: false
            });
        }

        if (partnerProfile.user_id.toString() !== partner._id.toString()) {
            return res.status(403).json({
                message: "Access denied! You can only edit your own profile.",
                result: false
            });
        }

        console.log('✅ PROFILE ACCESS GRANTED');
        req.partner = partner;
        req.user = partner;
        req.metaInfo = data.metaInfo;
        req.partnerProfile = partnerProfile;

        next();

    } catch (error) {
        console.error('🚨 PROFILE ACCESS ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * Проверка типа партнера (restaurant или store)
 */
const checkPartnerType = (allowedTypes) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK PARTNER TYPE:', allowedTypes);
            
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];

            if (!token) {
                return res.status(401).json({ 
                    message: "Access denied! Token required!", 
                    result: false 
                });
            }

            const data = await decodeToken(token);
            if (!data.result) {
                return res.status(data.status).json({
                    message: data.message,
                    result: false
                });
            }

            // ✅ ПРОВЕРКА ТИПА В MIDDLEWARE
            const partnerRequest = await InitialPartnerRequest.findOne({ 
                user_id: data.partner._id 
            }).select('business_data.category');

            if (!partnerRequest) {
                return res.status(404).json({
                    message: "Partner request not found!",
                    result: false
                });
            }

            const partnerType = partnerRequest.business_data?.category;

            if (!allowedTypes.includes(partnerType)) {
                return res.status(403).json({
                    message: `Access denied! Required type: ${allowedTypes.join(' or ')}`,
                    result: false
                });
            }

            req.partner = data.partner;
            req.user = data.partner;
            req.metaInfo = data.metaInfo;
            req.partnerType = partnerType;

            console.log('✅ PARTNER TYPE CHECK PASSED:', partnerType);
            next();

        } catch (error) {
            console.error('🚨 TYPE CHECK ERROR:', error);
            res.status(500).json({ 
                message: "Access denied! Server error!", 
                result: false, 
                error: error.message 
            });
        }
    };
};

export { 
    checkPartnerToken, 
    checkPartnerStatus, 
    requirePartnerProfile,
    checkProfileAccess,
    checkPartnerType
};