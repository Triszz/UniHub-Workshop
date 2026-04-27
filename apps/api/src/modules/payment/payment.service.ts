import { prisma } from "../../shared/database/prisma";
import { generateQrCode } from "../registration/registration.service";

const appError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

type PaymentOptions = {
  shouldFail?: boolean;
  shouldTimeout?: boolean;
};

export const processPayment = async (
  userId: string,
  registrationId: string,
  idempotencyKey: string,
  options: PaymentOptions = {},
) => {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    include: { payment: true, workshop: true },
  });

  if (!registration) {
    throw appError("Không tìm thấy đăng ký.", 404);
  }

  if (Number(registration.workshop.price) === 0) {
    throw appError("Workshop miễn phí, không cần thanh toán.", 400);
  }

  const payment = registration.payment;
  if (!payment) {
    throw appError("Không tìm thấy giao dịch cho đăng ký này.", 404);
  }

  if (payment.status === "completed" && payment.idempotencyKey === idempotencyKey) {
    return {
      success: true,
      status: "completed",
      registration,
      payment,
    };
  }

  if (payment.status === "completed") {
    throw appError("Giao dịch đã được hoàn tất trước đó.", 409);
  }

  if (!["pending", "failed"].includes(payment.status)) {
    throw appError(`Trạng thái thanh toán không hợp lệ: ${payment.status}`, 400);
  }

  if (options.shouldTimeout) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "pending",
        idempotencyKey,
        errorMessage: "Mock timeout",
      },
    });

    return {
      success: false,
      status: "pending",
      message: "Thanh toán đang chờ xử lý do timeout gateway.",
    };
  }

  if (options.shouldFail) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
        idempotencyKey,
        errorMessage: "Mock payment failed",
      },
    });

    throw appError("Thanh toán thất bại. Vui lòng thử lại.", 402);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "completed",
        gatewayRef: `mock_txn_${Date.now()}`,
        idempotencyKey,
        errorMessage: null,
      },
    });

    const qrCode = generateQrCode(
      registration.id,
      registration.workshopId,
      userId,
      registration.workshop.startsAt,
    );

    const updatedRegistration = await tx.registration.update({
      where: { id: registration.id },
      data: { status: "confirmed", qrCode },
      include: { workshop: true, payment: true },
    });

    return { registration: updatedRegistration, payment: updatedPayment };
  });

  return {
    success: true,
    status: "completed",
    registration: updated.registration,
    payment: updated.payment,
  };
};
