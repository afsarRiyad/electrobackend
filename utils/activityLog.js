import { ActivityLog } from "./models.js";

export const logActivity = async (data) => {
  try {
    await ActivityLog.create(data);
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

export const activityMiddleware = (action, entity) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to log after response
    res.json = function(data) {
      // Only log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logActivity({
          user: req.user?._id,
          action,
          entity,
          entityId: req.params.id || req.body._id || null,
          details: {
            method: req.method,
            path: req.path,
            body: req.body,
            params: req.params,
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
        });
      }
      return originalJson(data);
    };
    
    next();
  };
};
