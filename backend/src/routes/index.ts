import { Router } from 'express';
import authRoutes from './authRoutes';
import projectRoutes from './projectRoutes';
import vendorRoutes from './vendorRoutes';
import materialRoutes from './materialRoutes';
import employeeRoutes from './employeeRoutes';
import poRoutes from './poRoutes';
import submittalRoutes from './submittalRoutes';
import rfiRoutes from './rfiRoutes';
import dashboardRoutes from './dashboardRoutes';
import uploadRoutes from './uploadRoutes';
import stakeholderRoutes from './stakeholderRoutes';
import settingsRoutes from './settingsRoutes';

const router = Router();

router.use('/upload', uploadRoutes); // Moved to top for diagnostic
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/vendors', vendorRoutes);
router.use('/materials', materialRoutes);
router.use('/employees', employeeRoutes);
router.use('/purchase-orders', poRoutes);
router.use('/submittals', submittalRoutes);
router.use('/rfis', rfiRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/stakeholders', stakeholderRoutes);
router.use('/settings', settingsRoutes);

export default router;
