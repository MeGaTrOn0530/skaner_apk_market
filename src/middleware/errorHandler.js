const { ZodError } = require('zod');
const AppError = require('../utils/appError');

module.exports = function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: error.issues[0]?.message || 'Yuborilgan ma\'lumot noto\'g\'ri.',
    });
  }

  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: 'Bu qiymat allaqachon mavjud.',
    });
  }

  console.error(error);

  return res.status(500).json({
    message: 'Serverda kutilmagan xatolik yuz berdi.',
  });
};
