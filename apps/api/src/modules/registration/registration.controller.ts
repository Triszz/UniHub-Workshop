import { Request, Response, NextFunction } from "express";
import * as RegistrationService from "./registration.service";

// ─── POST /registrations ─────────────────────────────────────────────────────

export const createRegistrationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { workshopId } = req.body;

    if (!workshopId) {
      res.status(400).json({ error: "workshopId là bắt buộc." });
      return;
    }

    const result = await RegistrationService.register(
      req.user!.id,
      workshopId,
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// ─── GET /registrations/me ────────────────────────────────────────────────────

export const getMyRegistrationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await RegistrationService.getMyRegistrations(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── GET /registrations/me/:id ───────────────────────────────────────────────

export const getMyRegistrationByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await RegistrationService.getMyRegistrationById(
      req.user!.id,
      req.params.id as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /registrations/:id ───────────────────────────────────────────────

export const cancelRegistrationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await RegistrationService.cancelRegistration(
      req.user!.id,
      req.params.id as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
