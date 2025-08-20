// ================ 2. services/admin.auth.service.js ================
import { AdminUser } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta, comparePassword } from '../utils/hash.js';
import { generateCustomerToken } from './token.service.js';

export const createAdminAccount = async (adminData) => {
    try {
        let { full_name, email, password, role, department } = adminData;

        if (!full_name || !email || !password || !role) {
            throw new Error('Missing required fields');
        }

        email = email.toLowerCase().trim();

        const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(email), 'admin');

        if (metaInfo) {
            return { isNewAdmin: false, admin: metaInfo.admin };
        }

        const hashedPassword = await hashString(password);

        const newAdmin = new AdminUser({
            full_name,
            email,
            password_hash: hashedPassword,
            role,
            contact_info: {
                department: department || 'general'
            },
            is_active: true
        });

        await newAdmin.save();
        await Meta.createForAdmin(newAdmin._id, hashMeta(email));

        return { isNewAdmin: true, admin: newAdmin };

    } catch (error) {
        throw error;
    }
};

export const loginAdmin = async ({ email, password }) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();

        const metaInfo = await Meta.findByEmailAndRoleWithUser(hashMeta(normalizedEmail), 'admin');

        if (!metaInfo || !metaInfo.admin) {
            const error = new Error('Admin not found');
            error.statusCode = 404;
            throw error;
        }

        if (!metaInfo.admin.is_active) {
            const error = new Error('Account deactivated');
            error.statusCode = 403;
            throw error;
        }

        const isPasswordValid = await comparePassword(password, metaInfo.admin.password_hash);

        if (!isPasswordValid) {
            const error = new Error('Invalid password');
            error.statusCode = 401;
            throw error;
        }

        await metaInfo.admin.resetLoginAttempts();
        await metaInfo.admin.recordActivity();

        const token = generateCustomerToken({
            _id: metaInfo.admin._id,
            email: metaInfo.admin.email,
            role: 'admin',
            admin_role: metaInfo.admin.role
        }, '8h');

        return {
            token,
            admin: {
                id: metaInfo.admin._id,
                email: metaInfo.admin.email,
                full_name: metaInfo.admin.full_name,
                role: metaInfo.admin.role,
                department: metaInfo.admin.contact_info?.department
            }
        };

    } catch (error) {
        throw error;
    }
};