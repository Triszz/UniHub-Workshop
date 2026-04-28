import { Request, Response, NextFunction } from "express";
import * as WorkshopService from "./workshop.service";
import {
  WorkshopListQuery,
  WorkshopRegistrationListQuery,
} from "./workshop.types";

// ─── Public ───────────────────────────────────────────────────────────────────

export const listWorkshopsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await WorkshopService.listPublishedWorkshops(
      req.query as WorkshopListQuery,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getWorkshopHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const workshop = await WorkshopService.getPublishedWorkshopById(
      req.params.id as string,
    );
    res.json({ workshop });
  } catch (err) {
    next(err);
  }
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminListWorkshopsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await WorkshopService.listAllWorkshops(
      req.query as WorkshopListQuery,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const adminGetWorkshopHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const workshop = await WorkshopService.getWorkshopByIdAdmin(
      req.params.id as string,
    );
    res.json({ workshop });
  } catch (err) {
    next(err);
  }
};

export const adminListWorkshopRegistrationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await WorkshopService.listWorkshopRegistrations(
      req.params.id as string,
      req.query as WorkshopRegistrationListQuery,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createWorkshopHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const workshop = await WorkshopService.createWorkshop(
      req.body,
      req.user!.id,
    );
    res.status(201).json({ workshop });
  } catch (err) {
    next(err);
  }
};

export const updateWorkshopHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const workshop = await WorkshopService.updateWorkshop(
      req.params.id as string,
      req.body,
    );
    res.json({ workshop });
  } catch (err) {
    next(err);
  }
};

export const cancelWorkshopHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await WorkshopService.cancelWorkshop(
      req.params.id as string,
    );
    res.json({
      cancelled: true,
      workshopId: result.workshop.id,
      affectedRegistrations: result.affectedRegistrations,
    });
  } catch (err) {
    next(err);
  }
};

export const getWorkshopStatsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const stats = await WorkshopService.getWorkshopStats(
      req.params.id as string,
    );
    res.json(stats);
  } catch (err) {
    next(err);
  }
};
