import { Request, Response, NextFunction } from 'express';
import * as vendorService from '../services/vendorService';
import { logActivity } from '../utils/activityLogger';
import { AuthRequest } from '../middleware/auth';

export const getVendors = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await vendorService.getAllVendors()); } catch (e) { next(e); }
};

export const getVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendor = await vendorService.getVendorById(req.params.id);
    res.json(vendor);
  } catch (error: any) {
    error.message === 'Vendor not found' ? res.status(404).json({ message: error.message }) : next(error);
  }
};

export const createVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor = await vendorService.createVendor(req.body);
    await logActivity(req.user.id, 'CREATE', 'vendor', vendor.id, null, vendor);
    res.status(201).json(vendor);
  } catch (e) { next(e); }
};

export const updateVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const before = await vendorService.getVendorById(req.params.id);
    const updated = await vendorService.updateVendor(req.params.id, req.body);
    await logActivity(req.user.id, 'UPDATE', 'vendor', req.params.id, before, updated);
    res.json(updated);
  } catch (error: any) {
    error.message === 'Vendor not found' ? res.status(404).json({ message: error.message }) : next(error);
  }
};

export const deleteVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const before = await vendorService.getVendorById(req.params.id);
    await vendorService.deleteVendor(req.params.id);
    await logActivity(req.user.id, 'DELETE', 'vendor', req.params.id, before, null);
    res.status(204).send();
  } catch (error: any) {
    if (error.message === 'Vendor not found') return res.status(404).json({ message: error.message });
    if (error.message.includes('Cannot delete')) return res.status(409).json({ message: error.message });
    next(error);
  }
};
