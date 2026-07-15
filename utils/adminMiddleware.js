/**
 * isAdmin middleware
 * Must be used AFTER the `protect` middleware (which sets req.user).
 * Returns 403 if the authenticated user is not an admin.
 */
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Access denied. Admins only." });
};
