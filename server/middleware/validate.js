import { badRequest } from '../utils/http.js';

/**
 * zod validation middleware. Replaces req[source] with the parsed (coerced, stripped) value,
 * so controllers receive numbers as numbers. (Express 4: req.query is assignable.)
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      const first = details[0];
      return next(badRequest(first ? `${first.path ? first.path + ': ' : ''}${first.message}` : 'Invalid input', details));
    }
    req[source] = result.data;
    next();
  };
