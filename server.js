import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes    from './routes/auth.js';
import productRoutes from './routes/products.js';
import storeRoutes   from './routes/store.js';
import adminRoutes   from './routes/admin.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({ origin: '*', credentials: false }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api',          storeRoutes);
app.use('/api/admin',    adminRoutes);
app.get('/api/health', (_, res) => res.json({ success: true, timestamp: new Date().toISOString() }));
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀  TechStore API  →  http://localhost:${PORT}`);
    console.log(`📦  Environment   →  ${process.env.NODE_ENV}\n`);
  });
});
