// ================ controllers/AdminController.js (ИСПРАВЛЕННЫЙ) ================
import { createAdminAccount, loginAdmin } from "../services/admin.auth.service.js";
import { AdminUser } from "../models/index.js";
import Meta from "../models/Meta.model.js";
import mongoose from "mongoose";

const createAdmin = async (req, res) => {
    try {
        const adminData = req.body;
        const requester = req.admin;

        if (!["owner", "manager"].includes(requester.role)) {
            return res.status(403).json({
                message: "Access denied: Insufficient permissions",
                result: false
            });
        }

        // Проверка допустимых ролей
        const allowedRoles = ['admin', 'support', 'moderator'];
        if (requester.role === 'owner') {
            allowedRoles.push('manager');
        }

        if (!allowedRoles.includes(adminData.role)) {
            return res.status(400).json({
                message: `Invalid role. Allowed: ${allowedRoles.join(', ')}`,
                result: false
            });
        }

        const newAdminData = await createAdminAccount(adminData);

        if (!newAdminData.isNewAdmin) {
            return res.status(400).json({ 
                message: "This admin already exists", 
                result: false 
            });
        }

        res.status(201).json({ 
            message: "Admin was created!", 
            result: true,
            admin: newAdminData.admin
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            message: "Failed to create admin", 
            result: false, 
            error: error.message 
        });
    }
};

const loginAdminController = async (req, res) => {
    try {
        // 🔍 ОТЛАДКА: Проверяем что приходит в контроллер
        console.log('🔍 LOGIN CONTROLLER - Входящий запрос:', {
            method: req.method,
            url: req.url,
            content_type: req.headers['content-type'],
            body: req.body,
            body_type: typeof req.body,
            body_keys: req.body ? Object.keys(req.body) : 'NO_BODY',
            raw_body: req.rawBody ? req.rawBody.toString() : 'NO_RAW_BODY'
        });

        // Проверяем что body не пустой
        if (!req.body || Object.keys(req.body).length === 0) {
            console.error('🚨 ОШИБКА: req.body пустой!');
            return res.status(400).json({
                message: "Тело запроса пустое. Проверьте Content-Type: application/json",
                result: false,
                received_content_type: req.headers['content-type'],
                received_body: req.body
            });
        }

        const { token, admin } = await loginAdmin(req.body);
        res.status(200).json({ 
            message: "Login successful", 
            result: true, 
            token,
            admin
        });
    } catch (error) {
        console.error('🚨 LOGIN CONTROLLER - Ошибка:', error);
        res.status(error.statusCode || 500).json({ 
            message: "Failed to login admin", 
            result: false, 
            error: error.message 
        });
    }
};

const verifyAdmin = async (req, res) => {
    try {
        const { admin } = req;

        if (!admin) return res.status(404).json({ 
            message: "Admin is not defined!", 
            result: false 
        });

        const adminWithProfile = await AdminUser.findById(admin._id).select('-password_hash');

        if (!adminWithProfile) {
            return res.status(404).json({ 
                message: "Admin not found", 
                result: false 
            });
        }

        res.status(200).json({ 
            message: "Admin verified successfully", 
            result: true, 
            admin: adminWithProfile 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            message: "Failed to verify admin", 
            result: false, 
            error: error.message 
        });
    }
};

const editAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const requester = req.admin;

        console.log('🔍 EDIT ADMIN - Start:', {
            admin_id: id,
            requester_role: requester.role,
            update_fields: Object.keys(updateData)
        });

        if (!["owner", "manager"].includes(requester.role)) {
            return res.status(403).json({
                message: "Access denied: Insufficient permissions",
                result: false
            });
        }

        const admin = await AdminUser.findById(id);
        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
                result: false
            });
        }

        // Проверка прав на редактирование
        if (admin.role === 'owner' && requester.role !== 'owner') {
            return res.status(403).json({
                message: "Cannot modify owner account",
                result: false
            });
        }

        // Manager не может редактировать других Manager'ов
        if (admin.role === 'manager' && requester.role !== 'owner') {
            return res.status(403).json({
                message: "Only owner can modify manager accounts",
                result: false
            });
        }

        // ✅ РАСШИРЕНО: Обработка разных типов обновлений
        let processedUpdateData = { ...updateData };
        
        // 🔐 Обработка пароля отдельно
        if (updateData.password) {
            admin.password_hash = updateData.password; // Модель автоматически хеширует
            delete processedUpdateData.password;
            await admin.save();
            console.log('🔒 Password updated for admin:', id);
        }

        // 🎯 Обработка разрешений отдельно
        if (updateData.permissions) {
            // Дополнительная проверка прав для изменения разрешений
            if (admin.role === 'owner') {
                return res.status(403).json({
                    message: "Cannot modify owner permissions",
                    result: false
                });
            }

            // Manager не может менять разрешения других Manager'ов
            if (admin.role === 'manager' && requester.role !== 'owner') {
                return res.status(403).json({
                    message: "Only owner can modify manager permissions",
                    result: false
                });
            }

            try {
                await admin.updatePermissions(updateData.permissions);
                console.log('🎯 Permissions updated for admin:', id);
            } catch (permError) {
                return res.status(400).json({
                    message: `Failed to update permissions: ${permError.message}`,
                    result: false
                });
            }
            
            delete processedUpdateData.permissions;
        }

        // 🏷️ Обработка смены роли (только Owner может менять роли)
        if (updateData.role && requester.role !== 'owner') {
            return res.status(403).json({
                message: "Only owner can change admin roles",
                result: false
            });
        }

        // 📧 Проверка уникальности email при его изменении
        if (updateData.email && updateData.email !== admin.email) {
            const existingAdmin = await AdminUser.findOne({ 
                email: updateData.email.toLowerCase().trim(),
                _id: { $ne: id }
            });
            
            if (existingAdmin) {
                return res.status(400).json({
                    message: "Email already exists",
                    result: false
                });
            }
        }

        // 🔄 Обновляем остальные поля
        const updatedAdmin = await AdminUser.findByIdAndUpdate(
            id, 
            processedUpdateData, 
            { new: true, runValidators: true }
        ).select('-password_hash');

        // 📊 Логирование изменений
        const changedFields = Object.keys(updateData);
        console.log('✅ EDIT ADMIN - Success:', {
            admin_id: updatedAdmin._id,
            changed_fields: changedFields,
            updated_by: requester.role
        });

        res.status(200).json({
            message: "Admin updated successfully",
            result: true,
            admin: updatedAdmin,
            updated_fields: changedFields
        });

    } catch (error) {
        console.error('🚨 EDIT ADMIN - Error:', error);
        res.status(500).json({
            message: "Failed to update admin",
            result: false,
            error: error.message
        });
    }
};

const deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const requester = req.admin;

        console.log('🔍 DELETE ADMIN - Start:', {
            admin_id: id,
            requester_role: requester.role
        });

        if (requester.role !== 'owner') {
            return res.status(403).json({
                message: "Access denied: Only owner can delete admins",
                result: false
            });
        }

        const admin = await AdminUser.findById(id);
        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
                result: false
            });
        }

        if (admin.role === 'owner') {
            return res.status(403).json({
                message: "Cannot delete owner account",
                result: false
            });
        }

        console.log('🔍 DELETE ADMIN - Deleting AdminUser and Meta:', {
            admin_email: admin.email,
            admin_role: admin.role
        });

        // ✅ ИСПРАВЛЕНО: Правильное удаление Meta записи
        await AdminUser.findByIdAndDelete(id);
        
        // Удаляем Meta запись правильно
        const deletedMeta = await Meta.deleteOne({ 
            admin: id,  // ✅ ИСПРАВЛЕНО: ищем по полю 'admin', а не 'user_id'
            role: 'admin' 
        });

        console.log('🔍 DELETE ADMIN - Meta deletion result:', {
            deleted_count: deletedMeta.deletedCount,
            acknowledged: deletedMeta.acknowledged
        });

        res.status(200).json({
            message: "Admin deleted successfully",
            result: true,
            deletedAdminId: id,
            meta_deleted: deletedMeta.deletedCount > 0
        });

    } catch (error) {
        console.error('🚨 DELETE ADMIN - Error:', error);
        res.status(500).json({
            message: "Failed to delete admin",
            result: false,
            error: error.message
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const { admin } = req;
        const { id } = req.params;

        console.log('🔍 GET PROFILE - Start:', {
            requester_role: admin.role,
            target_admin_id: id
        });

        // Получаем профиль админа по ID
        const adminProfile = await AdminUser.findById(id).select('-password_hash');

        if (!adminProfile) {
            return res.status(404).json({
                message: "Admin profile not found",
                result: false
            });
        }

        // Добавляем статистику активности
        const profileData = {
            ...adminProfile.toObject(),
            profile_stats: {
                account_created: adminProfile.createdAt,
                last_login: adminProfile.last_login_at,
                last_activity: adminProfile.last_activity_at,
                total_logins: adminProfile.activity_stats.total_logins,
                actions_count: adminProfile.activity_stats.actions_count
            }
        };

        console.log('✅ GET PROFILE - Success:', {
            admin_id: adminProfile._id,
            email: adminProfile.email,
            role: adminProfile.role,
            requested_by: admin.role
        });

        res.status(200).json({
            message: "Admin profile retrieved successfully",
            result: true,
            admin: profileData
        });

    } catch (error) {
        console.error('🚨 GET PROFILE - Error:', error);
        res.status(500).json({
            message: "Failed to get admin profile",
            result: false,
            error: error.message
        });
    }
};

const updatePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;
        const requester = req.admin;

        console.log('🔍 UPDATE PERMISSIONS - Start:', {
            target_admin_id: id,
            requester_role: requester.role,
            new_permissions: permissions
        });

        // Проверка прав доступа - только Owner и Manager могут менять разрешения
        if (!["owner", "manager"].includes(requester.role)) {
            return res.status(403).json({
                message: "Access denied: Insufficient permissions to update permissions",
                result: false
            });
        }

        if (!permissions || typeof permissions !== 'object') {
            return res.status(400).json({
                message: "Permissions object is required",
                result: false
            });
        }

        const targetAdmin = await AdminUser.findById(id);
        if (!targetAdmin) {
            return res.status(404).json({
                message: "Admin not found",
                result: false
            });
        }

        // Нельзя менять разрешения Owner'а
        if (targetAdmin.role === 'owner') {
            return res.status(403).json({
                message: "Cannot modify owner permissions",
                result: false
            });
        }

        // Manager не может менять разрешения других Manager'ов (только Owner может)
        if (targetAdmin.role === 'manager' && requester.role !== 'owner') {
            return res.status(403).json({
                message: "Only owner can modify manager permissions",
                result: false
            });
        }

        // Обновляем разрешения
        try {
            await targetAdmin.updatePermissions(permissions);
            
            // Получаем обновленные данные
            const updatedAdmin = await AdminUser.findById(id).select('-password_hash');

            console.log('✅ UPDATE PERMISSIONS - Success:', {
                admin_id: updatedAdmin._id,
                updated_by: requester.role
            });

            res.status(200).json({
                message: "Permissions updated successfully",
                result: true,
                admin: updatedAdmin,
                updated_permissions: permissions
            });

        } catch (updateError) {
            console.error('🚨 UPDATE PERMISSIONS - Update Error:', updateError);
            res.status(400).json({
                message: updateError.message || "Failed to update permissions",
                result: false
            });
        }

    } catch (error) {
        console.error('🚨 UPDATE PERMISSIONS - Error:', error);
        res.status(500).json({
            message: "Failed to update permissions",
            result: false,
            error: error.message
        });
    }
};

const getAdminsList = async (req, res) => {
    try {
        const requester = req.admin;
        const { 
            page = 1, 
            limit = 10, 
            role, 
            department, 
            is_active,
            search 
        } = req.query;

        console.log('🔍 GET ADMINS LIST - Start:', {
            requester_role: requester.role,
            filters: { page, limit, role, department, is_active, search }
        });

        // Проверка прав доступа
        if (!["owner", "manager"].includes(requester.role)) {
            return res.status(403).json({
                message: "Access denied: Insufficient permissions to view admins list",
                result: false
            });
        }

        // Строим фильтр
        const filter = {};
        
        if (role) filter.role = role;
        if (department) filter['contact_info.department'] = department;
        if (is_active !== undefined) filter.is_active = is_active === 'true';
        
        // Поиск по имени или email
        if (search) {
            filter.$or = [
                { full_name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Manager не может видеть Owner'а
        if (requester.role === 'manager') {
            filter.role = { $ne: 'owner' };
        }

        // Подсчет общего количества
        const total = await AdminUser.countDocuments(filter);
        
        // Получение списка с пагинацией
        const admins = await AdminUser.find(filter)
            .select('-password_hash')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Группировка по ролям для статистики
        const roleStats = await AdminUser.aggregate([
            { $match: requester.role === 'manager' ? { role: { $ne: 'owner' } } : {} },
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(total / limit),
            total_admins: total,
            has_next_page: page < Math.ceil(total / limit),
            has_prev_page: page > 1
        };

        console.log('✅ GET ADMINS LIST - Success:', {
            found_admins: admins.length,
            total_count: total,
            requester_role: requester.role
        });

        res.status(200).json({
            message: "Admins list retrieved successfully",
            result: true,
            admins,
            pagination,
            stats: {
                total_admins: total,
                role_distribution: roleStats.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            },
            filters_applied: { role, department, is_active, search }
        });

    } catch (error) {
        console.error('🚨 GET ADMINS LIST - Error:', error);
        res.status(500).json({
            message: "Failed to get admins list",
            result: false,
            error: error.message
        });
    }
};

export { createAdmin, loginAdminController, verifyAdmin, editAdmin, deleteAdmin, getProfile, getAdminsList };