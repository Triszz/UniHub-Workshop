import { Request, Response, NextFunction } from "express";
import * as PaymentService from "./payment.service";

export const processPaymentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const idempotencyKey = req.headers["idempotency-key"] as string;
    if (!idempotencyKey) {
      res.status(400).json({ error: "Missing Idempotency-Key header." });
      return;
    }

    const { registrationId } = req.params;
    const { shouldFail, shouldTimeout } =
      (req.body ?? {}) as { shouldFail?: boolean; shouldTimeout?: boolean };

    const result = await PaymentService.processPayment(
      req.user!.id as string,
      registrationId as string,
      idempotencyKey as string,
      { shouldFail, shouldTimeout },
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
};
