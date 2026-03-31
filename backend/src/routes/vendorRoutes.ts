import { Router } from 'express';
import { getVendors, getVendor, createVendor, updateVendor, deleteVendor } from '../controllers/vendorController';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getVendors);
router.get('/:id', getVendor);
router.post('/', createVendor);
router.patch('/:id', updateVendor);
// Only COMPANY_MANAGER can delete vendors
router.delete('/:id', authorizeRole(['COMPANY_MANAGER']), deleteVendor);

export default router;
