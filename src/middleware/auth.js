import NoteMembership from '../model/noteMembership.js';
import Role from '../model/role.js';

/**
 * Middleware factory to check if a user has a specific permission for a note.
 * @param {string} permissionName - The name of the permission to check (e.g., 'edit_note_content').
 * @returns {function} An Express middleware function.
 */
const can = (permissionName) => {
  return async (req, res, next) => {
    try {
      // 1. Get the key ingredients from the request.
      const userId = req.user?.id; // Provided by Passport.js after login.
      const { noteId } = req.params;

      // Ensure user is authenticated and noteId is present.
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required. Please log in.' });
      }
      if (!noteId) {
        return res.status(400).json({ message: 'A note ID is required to check permissions.' });
      }

      // 2. Query the "junction" collection to find the user's role for this specific note.
      const membership = await NoteMembership.findOne({ userId, noteId });

      // 3. If no membership exists, the user has no role for this note. Deny access.
      if (!membership) {
        return res.status(403).json({ message: 'Forbidden: You do not have any assigned role for this note.' });
      }

      // 4. If membership exists, find the role and populate its permissions.
      // We use .lean() for a performance boost as we only need to read the data.
      const role = await Role.findById(membership.roleId).populate('permissions').lean();

      if (!role) {
        return res.status(403).json({ message: 'Forbidden: Your assigned role could not be found.' });
      }

      // 5. Check if the required permission is included in the user's role.
      const hasPermission = role.permissions.some(p => p.name === permissionName);

      if (hasPermission) {
        return next(); // Success! The user is authorized.
      } else {
        return res.status(403).json({ message: `Forbidden: Your role ('${role.name}') does not have the '${permissionName}' permission.` });
      }
    } catch (error) {
      console.error('Authorization error in can() middleware:', error);
      return res.status(500).json({ message: 'An internal error occurred during authorization.' });
    }
  };
};

export { can };