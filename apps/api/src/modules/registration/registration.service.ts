import jwt from "jsonwebtoken";
import { prisma } from "../../shared/database/prisma";
import { QrPayload } from "./registration.types";

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const JWT_SECRET = process.env.JWT_SECRET!;

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const appError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

/**
 * Sinh QR code: JWT signed chá»©a registrationId, workshopId, userId.
 * Háº¿t háº¡n 2 tiáº¿ng sau khi workshop báº¯t Ä‘áº§u.
 */
export const generateQrCode = (
  registrationId: string,
  workshopId: string,
  userId: string,
  workshopStartsAt: Date,
): string => {
  const exp = Math.floor(workshopStartsAt.getTime() / 1000) + 2 * 60 * 60;

  const payload: QrPayload & { exp: number } = {
    sub: registrationId,
    workshopId,
    userId,
    type: "workshop_qr",
    exp,
  };

  return jwt.sign(payload, JWT_SECRET);
};

// â”€â”€â”€ Service: POST /registrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const register = async (userId: string, workshopId: string) => {
  // â”€â”€ BÆ°á»›c 1: Validate workshop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      title: true,
      status: true,
      price: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      registeredCount: true,
      room: { select: { name: true, building: true } },
    },
  });

  if (!workshop || workshop.status !== "published") {
    throw appError("Workshop khĂ´ng tá»“n táº¡i.", 404);
  }

  if (workshop.endsAt < new Date()) {
    throw appError("Workshop Ä‘Ă£ káº¿t thĂºc, khĂ´ng thá»ƒ Ä‘Äƒng kĂ½.", 400);
  }

  // â”€â”€ BÆ°á»›c 2: Kiá»ƒm tra Ä‘Ă£ Ä‘Äƒng kĂ½ chÆ°a â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const existingReg = await prisma.registration.findUnique({
    where: { userId_workshopId: { userId, workshopId } },
  });

  if (existingReg && existingReg.status !== "cancelled") {
    throw appError("Báº¡n Ä‘Ă£ Ä‘Äƒng kĂ½ workshop nĂ y rá»“i.", 409);
  }

  // â”€â”€ BÆ°á»›c 3: DB Transaction vá»›i SELECT FOR UPDATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // KHĂ”NG dĂ¹ng Redis distributed lock vĂ¬:
  //   - Lock chá»‰ cho 1 request qua táº¡i má»™t thá»i Ä‘iá»ƒm â†’ bottleneck nghiĂªm trá»ng
  //   - SELECT FOR UPDATE Ä‘Ă£ Ä‘á»§ Ä‘á»ƒ chá»‘ng race condition á»Ÿ táº§ng DB
  //
  // CĂ¡ch PostgreSQL xá»­ lĂ½ 100 concurrent requests:
  //   - Táº¥t cáº£ vĂ o transaction, nhÆ°ng chá»‰ 1 transaction hold row lock táº¡i má»™t thá»i Ä‘iá»ƒm
  //   - CĂ¡c transaction khĂ¡c WAIT (khĂ´ng bá»‹ tá»« chá»‘i) cho Ä‘áº¿n khi lock Ä‘Æ°á»£c release
  //   - Má»—i transaction sau khi cĂ³ lock sáº½ Ä‘á»c registeredCount Má»I NHáº¤T
  //   - Transaction thá»© 61 trá»Ÿ Ä‘i tháº¥y registeredCount = 60 = capacity â†’ throw 409
  //
  // Káº¿t quáº£: Ä‘Ăºng 60 thĂ nh cĂ´ng, 40 nháº­n 409 "Háº¿t chá»—" â€” khĂ´ng cĂ³ double-booking
  //
  const registration = await prisma.$transaction(
    async (tx) => {
      // SELECT FOR UPDATE: lock row workshop, Ä‘á»c giĂ¡ trá»‹ HIá»†N Táº I (khĂ´ng bá»‹ stale read)
      const rows = await tx.$queryRaw<
        Array<{ id: string; registered_count: number; capacity: number }>
      >`
        SELECT id, registered_count, capacity
        FROM workshops
        WHERE id = ${workshopId}
        FOR UPDATE
      `;

      if (rows.length === 0) throw appError("Workshop khĂ´ng tá»“n táº¡i.", 404);

      const { registered_count, capacity } = rows[0];

      // Guard cuá»‘i cĂ¹ng â€” Ä‘á»c sau khi cĂ³ lock nĂªn luĂ´n chĂ­nh xĂ¡c
      if (registered_count >= capacity) {
        throw appError("Workshop Ä‘Ă£ háº¿t chá»—.", 409);
      }

      const isFree = Number(workshop.price) === 0;
      const initialStatus = isFree ? "confirmed" : "pending";

      // Upsert registration
      let reg;
      if (existingReg?.status === "cancelled") {
        reg = await tx.registration.update({
          where: { id: existingReg.id },
          data: { status: initialStatus, qrCode: null },
        });
      } else {
        reg = await tx.registration.create({
          data: { userId, workshopId, status: initialStatus },
        });
      }

      // TÄƒng registeredCount trong cĂ¹ng transaction â€” atomic
      await tx.workshop.update({
        where: { id: workshopId },
        data: { registeredCount: { increment: 1 } },
      });

      // Náº¿u cĂ³ phĂ­, táº¡o transaction pending payment (hoáº·c reset náº¿u cĂ³ cÅ©)
      let paymentRecord = null;
      if (!isFree) {
        // TĂ¡i táº¡o hoáº·c táº¡o má»›i Payment
        if (existingReg?.paymentId) {
          paymentRecord = await tx.payment.update({
            where: { id: existingReg.paymentId },
            data: { status: "pending", idempotencyKey: `pay_${Date.now()}_${userId}` }, // Táº¡m gen 1 idempotency key má»›i náº¿u retry session
          });
        } else {
          paymentRecord = await tx.payment.create({
            data: {
              amount: workshop.price,
              status: "pending",
              idempotencyKey: `pay_${Date.now()}_${userId}`,
            },
          });
          // Gáº¯n paymentId vĂ o registration
          await tx.registration.update({
            where: { id: reg.id },
            data: { paymentId: paymentRecord.id },
          });
        }
      }

      return { reg, isFree, paymentRecord };
    },
    {
      // Timeout transaction: 10 giĂ¢y
      // Khi 100 requests xáº¿p hĂ ng chá» lock, request cuá»‘i cĂ¹ng cĂ³ thá»ƒ chá» lĂ¢u
      timeout: 10_000,
    },
  );

  if (registration.isFree) {
    // â”€â”€ BÆ°á»›c 4: Sinh QR code (ngoĂ i transaction, chá»‰ cho free workshop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const qrCode = generateQrCode(
      registration.reg.id,
      workshopId,
      userId,
      workshop.startsAt,
    );

    const updatedReg = await prisma.registration.update({
      where: { id: registration.reg.id },
      data: { qrCode },
      select: { id: true, status: true, qrCode: true, createdAt: true },
    });

    // â”€â”€ BÆ°á»›c 5: Enqueue notification (TODO NgĂ y 9) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log(
      `[TODO] Enqueue notification: registration_confirmed â€” user ${userId}, workshop ${workshopId}`,
    );

    return {
      registration: {
        ...updatedReg,
        workshop: { ...workshop },
      },
    };
  } else {
    // Luá»“ng cĂ³ phĂ­: tráº£ vá» checkoutUrl
    return {
      registration: {
        id: registration.reg.id,
        status: registration.reg.status,
        createdAt: registration.reg.createdAt,
        workshop: { ...workshop },
        payment: registration.paymentRecord,
      },
      checkoutUrl: `/checkout/${registration.reg.id}`,
    };
  }
};

// â”€â”€â”€ Service: GET /registrations/me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getMyRegistrations = async (userId: string) => {
  const registrations = await prisma.registration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      qrCode: true,
      createdAt: true,
      workshop: {
        select: {
          id: true,
          title: true,
          speakerName: true,
          startsAt: true,
          endsAt: true,
          price: true,
          status: true,
          room: { select: { name: true, building: true } },
        },
      },
      payment: {
        select: { id: true, amount: true, status: true },
      },
    },
  });

  return { registrations };
};

// â”€â”€â”€ Service: GET /registrations/me/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getMyRegistrationById = async (
  userId: string,
  registrationId: string,
) => {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    select: {
      id: true,
      status: true,
      qrCode: true,
      createdAt: true,
      updatedAt: true,
      workshop: {
        select: {
          id: true,
          title: true,
          description: true,
          speakerName: true,
          startsAt: true,
          endsAt: true,
          price: true,
          status: true,
          room: { select: { name: true, building: true, floorMapUrl: true } },
        },
      },
      payment: {
        select: { id: true, amount: true, status: true, gatewayRef: true },
      },
      checkin: {
        select: { checkedInAt: true, isOffline: true },
      },
    },
  });

  if (!registration) throw appError("KhĂ´ng tĂ¬m tháº¥y Ä‘Äƒng kĂ½.", 404);

  return { registration };
};

// â”€â”€â”€ Service: DELETE /registrations/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const cancelRegistration = async (
  userId: string,
  registrationId: string,
) => {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    include: { workshop: true },
  });

  if (!registration) throw appError("KhĂ´ng tĂ¬m tháº¥y Ä‘Äƒng kĂ½.", 404);
  if (registration.status === "cancelled")
    throw appError("ÄÄƒng kĂ½ Ä‘Ă£ Ä‘Æ°á»£c há»§y trÆ°á»›c Ä‘Ă³.", 400);
  if (registration.status === "checked_in")
    throw appError("KhĂ´ng thá»ƒ há»§y sau khi Ä‘Ă£ check-in.", 400);
  if (registration.workshop.startsAt <= new Date())
    throw appError("KhĂ´ng thá»ƒ há»§y sau khi workshop Ä‘Ă£ báº¯t Ä‘áº§u.", 400);

  await prisma.$transaction([
    prisma.registration.update({
      where: { id: registrationId },
      data: { status: "cancelled", qrCode: null },
    }),
    prisma.workshop.update({
      where: { id: registration.workshopId },
      data: { registeredCount: { decrement: 1 } },
    }),
  ]);

  return { cancelled: true, registrationId };
};
