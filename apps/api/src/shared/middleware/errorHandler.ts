import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Lỗi hệ thống";

  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}: ${message}`,
  );

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
