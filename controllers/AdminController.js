// ================ 3. controllers/AdminController.js ================
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
        const { token, admin } = await loginAdmin(req.body);
        res.status(200).json({ 
            message: "Login successful", 
            result: true, 
            token,
            admin
        });
    } catch (error) {
        console.error(error);
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

        res.status(200).json({ 
            message: "Admin verified", 
            result: true, 
            admin: {
                id: admin._id,
                email: admin.email,
                full_name: admin.full_name,
                role: admin.role,
                department: admin.contact_info?.department
            }
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

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                result: false, 
                message: "Invalid admin ID" 
            });
        }

        if (updateData.role && requester.role !== "owner") {
            return res.status(403).json({
                result: false,
                message: "Access denied: Only owner can change roles"
            });
        }

        const updatedAdmin = await AdminUser.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedAdmin) {
            return res.status(404).json({ 
                result: false, 
                message: "Admin not found" 
            });
        }

        res.status(200).json({ 
            result: true, 
            message: "Admin was updated!", 
            admin: updatedAdmin 
        });
    } catch (error) {
        console.error(error);
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

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                result: false, 
                message: "Invalid admin ID" 
            });
        }

        if (requester.role !== "owner") {
            return res.status(403).json({
                result: false,
                message: "Access denied: Only owner can delete admins"
            });
        }

        const adminToDelete = await AdminUser.findById(id);

        if (!adminToDelete) {
            return res.status(404).json({ 
                result: false, 
                message: "Admin not found" 
            });
        }

        if (adminToDelete._id.toString() === requester._id.toString()) {
            return res.status(400).json({
                result: false,
                message: "You cannot delete yourself"
            });
        }

        await AdminUser.findByIdAndDelete(id);
        await Meta.deleteOne({ admin: id });

        res.status(200).json({
            result: true,
            message: "Admin was deleted successfully!",
            deletedAdmin: {
                id: adminToDelete._id,
                full_name: adminToDelete.full_name,
                role: adminToDelete.role
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to delete admin",
            result: false,
            error: error.message
        });
    }
};

export { createAdmin, loginAdminController, verifyAdmin, editAdmin, deleteAdmin };