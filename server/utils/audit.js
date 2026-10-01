import { AuditLog } from '../models/index.js';

/** Record a key action with the acting admin. Never throws (auditing must not break the request). */
export async function audit(req, action, entity, entityId, summary) {
  try {
    await AuditLog.create({
      admin: req.admin?.id,
      adminName: req.admin?.name || '',
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      summary,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
