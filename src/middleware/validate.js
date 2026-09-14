const AppError = require('../utils/AppError');

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid input'
    );
  }
  return parsed.data;
}

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = parseBody(schema, req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
module.exports.parseBody = parseBody;