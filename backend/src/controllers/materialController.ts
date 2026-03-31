import { Request, Response, NextFunction } from 'express';
import * as materialService from '../services/materialService';

export const getMaterials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const materials = await materialService.getAllMaterials();
    res.json(materials);
  } catch (error) {
    next(error);
  }
};

export const getMaterial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const material = await materialService.getMaterialById(req.params.id);
    res.json(material);
  } catch (error: any) {
    if (error.message === 'Material not found') {
      res.status(404).json({ message: error.message });
    } else {
      next(error);
    }
  }
};
