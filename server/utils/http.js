/** Wraps an async route handler so rejections reach the central error handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Error carrying an HTTP status; rendered by the central error handler. */
export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, 'BAD_REQUEST', details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg) => new HttpError(409, msg, 'CONFLICT');

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Parse ?page=&limit= into safe numbers. */
export function paging(query, defaultLimit = 20, maxLimit = 200) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Parse a YYYY-MM-DD string as a UTC-midnight Date. */
export const parseDate = (s) => new Date(`${s}T00:00:00.000Z`);

/**
 * Parse a "YYYY-MM-DDTHH:mm" string (from an <input type="datetime-local">, entered by the
 * admin in India Standard Time — this app has one timezone of users) into the UTC Date it
 * represents. IST is UTC+5:30, so UTC = local time - 5:30. Stored as UTC; display converts back.
 */
export function parseIST(s) {
  const [datePart, timePart = '00:00'] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - (5 * 60 + 30) * 60000);
}
