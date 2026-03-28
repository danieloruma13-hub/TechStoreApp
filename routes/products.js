import { Router } from 'express';
import { getProducts, getFeatured, getProductBySlug } from '../controllers/productController.js';
const router = Router();
router.get('/', getProducts);
router.get('/featured', getFeatured);
router.get('/:slug', getProductBySlug);
export default router;
