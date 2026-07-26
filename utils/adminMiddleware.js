/**
 * Role hierarchy for permission checks
 * Higher roles can access lower role permissions
 */
const roleHierarchy = {
  super_admin: 6,
  admin: 5,
  content_manager: 4,
  product_manager: 3,
  order_manager: 2,
  support_admin: 1,
  user: 0,
};

/**
 * Default permissions for each role
 */
const rolePermissions = {
  super_admin: ["*"], // All permissions
  admin: ["products", "orders", "users", "categories", "customers", "payments", "inventory", "stats", "inbox", "returns"],
  content_manager: ["products", "categories"],
  product_manager: ["products", "categories", "inventory"],
  order_manager: ["orders", "customers", "payments", "returns"],
  support_admin: ["orders", "customers", "inbox"],
  user: [],
};

/**
 * isAdmin middleware
 * Must be used AFTER the `protect` middleware (which sets req.user).
 * Returns 403 if the authenticated user is not an admin.
 */
export const isAdmin = (req, res, next) => {
  if (req.user && roleHierarchy[req.user.role] >= roleHierarchy.support_admin) {
    return next();
  }
  return res.status(403).json({ message: "Access denied. Admins only." });
};

/**
 * hasRole middleware
 * Checks if user has specific role or higher
 */
export const hasRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const minRequiredLevel = Math.max(...allowedRoles.map(role => roleHierarchy[role] || 0));

    if (userRoleLevel >= minRequiredLevel) {
      return next();
    }

    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  };
};

/**
 * hasPermission middleware
 * Checks if user has specific permission for a resource
 */
export const hasPermission = (resource, action = "read") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Super admin has all permissions
    if (req.user.role === "super_admin") {
      return next();
    }

    // Check role-based permissions
    const allowedResources = rolePermissions[req.user.role] || [];
    
    // If role has wildcard or specific resource permission
    if (allowedResources.includes("*") || allowedResources.includes(resource)) {
      return next();
    }

    // Check custom permissions
    const hasCustomPermission = req.user.permissions?.some(
      perm => perm.resource === resource && perm.actions.includes(action)
    );

    if (hasCustomPermission) {
      return next();
    }

    return res.status(403).json({ 
      message: `Access denied. You don't have ${action} permission for ${resource}.` 
    });
  };
};
