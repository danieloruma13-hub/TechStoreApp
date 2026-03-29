import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getStats,
  adminGetProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct,
  adminGetOrders, adminUpdateOrderStatus,
  adminGetUsers, adminUpdateUserRole,
  adminGetCategories, adminCreateCategory, adminUpdateCategory,
  getSettings, updateSettings,
  getBanners, createBanner, updateBanner, deleteBanner
} from '../controllers/adminController.js';

const router = Router();
router.use(protect, adminOnly);

router.get('/stats', getStats);

router.get('/products', adminGetProducts);
router.post('/products', adminCreateProduct);
router.put('/products/:id', adminUpdateProduct);
router.delete('/products/:id', adminDeleteProduct);

router.get('/orders', adminGetOrders);
router.put('/orders/:id/status', adminUpdateOrderStatus);

router.get('/users', adminGetUsers);
router.put('/users/:id/role', adminUpdateUserRole);

router.get('/categories', adminGetCategories);
router.post('/categories', adminCreateCategory);
router.put('/categories/:id', adminUpdateCategory);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/banners', getBanners);
router.post('/banners', createBanner);
router.put('/banners/:id', updateBanner);
router.delete('/banners/:id', deleteBanner);

export default router;
