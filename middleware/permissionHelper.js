/**
 * Permission Helper for ZomoCook Backend
 * Verifies if an admin/staff user has permission for a specific module and action.
 */

const legacyAliases = {
    'customer_client:view': ['Customer/Client', 'Customer/Client List', 'Customer List', 'customer_client'],
    'customer_client:add': ['Add Customer/Client', 'Add Customer', 'customer_client'],
    'customer_client:edit': ['Edit Customer', 'customer_client'],
    'customer_client:delete': ['Delete Customer', 'customer_client'],
    'customer_client:approve': ['Approve Customer', 'customer_client'],
    'customer_client:export': ['Export Customer', 'customer_client'],
    'customer_client:manage': ['Manage Customer', 'customer_client'],

    'job_management:view': ['Jobs', 'Job List', 'Pending Jobs', 'job_management'],
    'job_management:add': ['Add Job', 'job_management'],
    'job_management:edit': ['Edit Job', 'job_management'],
    'job_management:delete': ['Delete Job', 'job_management'],
    'job_management:approve': ['Approve Job', 'job_management'],
    'job_management:export': ['Export Job', 'job_management'],
    'job_management:manage': ['Manage Jobs', 'job_management'],

    'candidates:view': ['Candidates', 'Candidate List', 'All Applications', 'Applied Candidates List', 'Shortlisted Candidate List', 'candidates'],
    'candidates:add': ['Add Candidate', 'candidates'],
    'candidates:edit': ['Edit Candidate', 'candidates'],
    'candidates:delete': ['Delete Candidate', 'candidates'],
    'candidates:approve': ['Approve Candidate', 'candidates'],
    'candidates:export': ['Export Candidate', 'candidates'],
    'candidates:manage': ['Manage Candidates', 'candidates'],

    'dashboard:view': ['Dashboard', 'dashboard'],
    'dashboard:add': ['dashboard'],
    'dashboard:edit': ['dashboard'],
    'dashboard:manage': ['dashboard'],
    'dashboard:export': ['dashboard'],
    'dashboard:approve': ['dashboard'],
    'dashboard:delete': ['dashboard'],

    'service_packages:view': ['Subscription Plans', 'Plan List', 'Subscription History', 'service_packages', 'Hiring Processing Fee', 'hiring_processing_fee'],
    'service_packages:add': ['Add Plan', 'service_packages', 'hiring_processing_fee'],
    'service_packages:edit': ['Edit Plan', 'service_packages', 'hiring_processing_fee'],
    'service_packages:delete': ['Delete Plan', 'service_packages', 'hiring_processing_fee'],
    'service_packages:manage': ['Manage Plans', 'service_packages', 'hiring_processing_fee'],

    'offer_management:view': ['Offers', 'Offer List', 'offer_management'],
    'offer_management:add': ['Add Offer', 'offer_management'],
    'offer_management:edit': ['Edit Offer', 'offer_management'],
    'offer_management:delete': ['Delete Offer', 'offer_management'],
    'offer_management:manage': ['Manage Offers', 'offer_management'],

    'banner_management:view': ['Banners', 'Banner List', 'banner_management'],
    'banner_management:add': ['Add Banner', 'banner_management'],
    'banner_management:edit': ['Edit Banner', 'banner_management'],
    'banner_management:delete': ['Delete Banner', 'banner_management'],
    'banner_management:manage': ['Manage Banners', 'banner_management'],

    'cook_approvals:view': ['Cook Approvals', 'cook_approvals'],
    'cook_approvals:add': ['cook_approvals'],
    'cook_approvals:edit': ['cook_approvals'],
    'cook_approvals:delete': ['cook_approvals'],
    'cook_approvals:approve': ['cook_approvals'],
    'cook_approvals:manage': ['cook_approvals'],

    'query_management:view': ['Query History', 'Queries', 'query_management'],
    'query_management:add': ['Add Query', 'query_management'],
    'query_management:edit': ['Edit Query', 'query_management'],
    'query_management:delete': ['Delete Query', 'query_management'],
    'query_management:manage': ['Manage Queries', 'query_management'],

    'finance_revenue:view': ['Finance / Revenue', 'Finance', 'Revenue', 'finance_revenue'],
    'finance_revenue:add': ['finance_revenue'],
    'finance_revenue:edit': ['finance_revenue'],
    'finance_revenue:delete': ['finance_revenue'],
    'finance_revenue:approve': ['finance_revenue'],
    'finance_revenue:export': ['finance_revenue'],
    'finance_revenue:manage': ['finance_revenue'],

    'role_permission:view': ['Roles & Permissions', 'User List', 'Roles', 'Role List', 'Users', 'role_permission'],
    'role_permission:add': ['Add Role', 'Add User', 'role_permission'],
    'role_permission:edit': ['Edit Role', 'Edit User', 'role_permission'],
    'role_permission:delete': ['Delete Role', 'Delete User', 'role_permission'],
    'role_permission:manage': ['Manage Roles', 'Permissions', 'role_permission'],

    'masters:view': ['Masters', 'Master Data', 'States', 'State List', 'Cities', 'City List', 'Facility', 'Facility List', 'Property Category', 'Property Category List', 'Position', 'Position List', 'Salary Range', 'Salary Range List', 'Experience Range', 'Experience Range List', 'Cooking Preference', 'Cooking Preference List', 'Cook Preference', 'Cook Preference List', 'Food Preference', 'Add Food Preference List', 'Gender Preference', 'Gender Preference List', 'Service Duration', 'Service Duration List', 'Job Type', 'Job Type List', 'Event', 'Event List', 'Cooking Category', 'Cooking Category List', 'Time Range', 'Time Range List', 'Outlet Status', 'Outlet Status List', 'Benefits', 'Benefit List', 'Outlets', 'Outlet List', 'CMS', 'CMS List', 'Sliders', 'Slider List', 'Videos', 'Video List', 'Menu Item', 'Menu Item List', 'Job Category', 'Job Category List', 'Skill Category', 'Skill Category List', 'Skill', 'Skill List', 'masters'],
    'masters:add': ['Add State', 'Add City', 'Add Facility', 'Add Property Category', 'Add Position', 'Add Salary Range', 'Add Experience Range', 'Add Cooking Preference', 'Add Cook Preference', 'Add Food Preference', 'Add Gender Preference', 'Add Service Duration', 'Add Job Type', 'Add Event', 'Add Cooking Category', 'Add Time Range', 'Add Outlet Status', 'Add Benefit', 'Add Outlet', 'Add CMS', 'Add Slider', 'Add Video', 'Add Menu Item', 'Add Job Category', 'Add Skill Category', 'Add Skill', 'masters'],

    'notifications:view': ['Notifications', 'Notification List', 'notifications'],
    'notifications:add': ['Add Notification', 'notifications'],
    'notifications:edit': ['Edit Notification', 'notifications'],
    'notifications:delete': ['Delete Notification', 'notifications'],
    'notifications:manage': ['Manage Notifications', 'notifications'],

    'settings:view': ['Web Settings', 'Settings', 'settings'],
    'settings:edit': ['Edit Settings', 'settings'],
    'settings:manage': ['settings']
};

/**
 * Check if the given user/admin has permission for a specific key
 * @param {Object} admin - req.admin Mongoose document
 * @param {String} permKey - e.g. 'customer_client:view'
 * @returns {Boolean}
 */
const hasPermission = (admin, permKey) => {
    if (!admin) return false;

    // 1. Super Admin account checks
    const modelName = admin.constructor ? admin.constructor.modelName : '';
    if (modelName === 'Admin') return true;
    if (admin.type === 'admin') return true;
    if (admin.email === 'zomocookadmin@gmail.com') return true;

    // Check if role is literally 'super admin'
    const roleName = (admin.role && admin.role.name) ? admin.role.name.toLowerCase().trim() : '';
    if (roleName === 'super admin') return true;

    // App users (cooks, customers without staff roles) don't have staff permissions
    if (['cook', 'user', 'customer'].includes(roleName)) return false;

    // 2. Global full access
    const permissions = (admin.role && Array.isArray(admin.role.permissions)) ? admin.role.permissions : [];
    if (permissions.includes('global:full_access')) return true;

    // 3. Exact permission key match
    if (permissions.includes(permKey)) return true;

    // 4. Legacy alias match
    const aliases = legacyAliases[permKey];
    if (aliases && aliases.length > 0) {
        const found = aliases.some(alias => 
            permissions.includes(alias) ||
            permissions.some(p => String(p).toLowerCase() === alias.toLowerCase())
        );
        if (found) return true;
    }

    // 5. If permKey is a general module check (e.g. checking 'view' when action is view)
    const [module, action] = permKey.split(':');
    if (module && action) {
        // If they have manage permission for the module, they can also view/add/edit
        if (permissions.includes(`${module}:manage`)) return true;
    }

    return false;
};

module.exports = {
    hasPermission,
    legacyAliases
};
