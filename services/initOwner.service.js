// ================ 5. services/initOwner.service.js ================
import { AdminUser } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';

const initOwnerAccount = async () => {
    try {
        const existingOwner = await AdminUser.findOne({ role: "owner" });

        if (existingOwner) {
            console.log("🎯 Owner already exists");
            return;
        }

        const defaultOwnerData = {
            password: "admin",
            email: "admin@admin.com",
            full_name: "System Owner"
        };

        const hashedPassword = await hashString(defaultOwnerData.password);

        const newOwner = new AdminUser({
            full_name: defaultOwnerData.full_name,
            email: defaultOwnerData.email,
            password_hash: hashedPassword,
            role: "owner",
            contact_info: {
                department: "administration"
            },
            is_active: true
        });

        await newOwner.save();
        await Meta.createForAdmin(newOwner._id, hashMeta(defaultOwnerData.email));

        console.log("🎉 Owner created:", {
            email: defaultOwnerData.email,
            password: defaultOwnerData.password
        });

    } catch (error) {
        console.error("🚨 Error creating owner:", error);
    }
};

export default initOwnerAccount;