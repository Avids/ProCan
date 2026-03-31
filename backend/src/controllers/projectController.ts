import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/projectService';

export const getProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await projectService.getAllProjects();
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    res.json(project);
  } catch (error: any) {
    if (error.message === 'Project not found') {
      res.status(404).json({ message: error.message });
    } else {
      next(error);
    }
  }
};
