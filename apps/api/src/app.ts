import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import invitationRoutes from './modules/invitations/invitations.routes.js';
import userRoutes from './modules/users/users.routes.js';
import schoolRoutes from './modules/schools/schools.routes.js';
import groupRoutes from './modules/groups/groups.routes.js';
import evaluationRoutes from './modules/evaluations/evaluations.routes.js';
import eventRoutes from './modules/events/events.routes.js';
import materiRoutes from './modules/materi/materi.routes.js';
import pointRoutes from './modules/points/points.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import mutabaahRoutes from './modules/mutabaah/mutabaah.routes.js';
import configRoutes from './modules/config/config.routes.js';

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(compression());
app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { success: false, message: 'Terlalu banyak percobaan login' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { success: false, message: 'Terlalu banyak request' } });

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

const v1 = express.Router();
v1.use(apiLimiter);
v1.use('/auth/login', loginLimiter);
v1.use('/auth', authRoutes);
v1.use('/invitations', invitationRoutes);
v1.use('/users', userRoutes);
v1.use('/schools', schoolRoutes);
v1.use('/groups', groupRoutes);
v1.use('/evaluations', evaluationRoutes);
v1.use('/events', eventRoutes);
v1.use('/materi', materiRoutes);
v1.use('/points', pointRoutes);
v1.use('/notifications', notificationRoutes);
v1.use('/analytics', analyticsRoutes);
v1.use('/mutabaah', mutabaahRoutes);
v1.use('/config', configRoutes);

app.use('/api/v1', v1);
app.use(errorHandler);

export default app;
