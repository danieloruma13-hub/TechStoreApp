export const notFound = (req, res, next) => {
  const err = new Error(`Route not found — ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[ERROR] ${statusCode} — ${err.message}`);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};
