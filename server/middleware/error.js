import mongoose from 'mongoose';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' } });
}

/** Central error handler. Consistent shape: { error: { message, code, details? } } */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let code = err.code || 'SERVER_ERROR';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    message = details[0]?.message || 'Invalid input';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'A record with these details already exists';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'Malformed JSON body';
  }

  if (status >= 500) console.error(err);
  const body = { error: { message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong' : message, code } };
  if (details) body.error.details = details;
  res.status(status).json(body);
}
