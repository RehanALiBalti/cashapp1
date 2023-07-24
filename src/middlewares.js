const errorTypes = {
  ValidationError: 422,
  UniqueViolationError: 409,
};

const errorMessages = {
  UniqueViolationError: 'Already exists.',
};

function notFound(req, res, next) {
  const error = new Error('Not found');
  res.status(404);
  next(error);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const statusCode = res.statusCode === 200 ? errorTypes[error.name] || 500 : res.statusCode;
  res.status(statusCode);
  let message;

  // parse if the error is json
  try {
    return res.json({
      message: 'failed',
      data: JSON.parse(error.message),
    });
  } catch (err) {
    message = error.message;
  }

  console.log(process.env.NODE_ENV === 'production' ? undefined : error.stack || undefined);
  return res.json({
    message: errorMessages[error.name] || message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack || undefined,
    errors: process.env.NODE_ENV === 'production' ? undefined : error.errors || undefined,
  });
}

module.exports = {
  notFound,
  errorHandler,
};
