// legacy.ts
import express, { Request, Response, NextFunction } from 'express';
import { getAreaHives } from '../db/legacy';
import userRoutes from './user';
import dataRoutes from './data';

const router = express.Router();
router.use(express.json());

// ✅ 기존 legacy 라우트 유지
router.get('/areahive', async (req: Request, res: Response) => {
  // #swagger.tags = ['Legacy']
  // #swagger.description = 'Endpoint to fetch all area hives'
  try {
    const areaHives = await getAreaHives();
    // #swagger.responses[200] = { description: 'Area hives fetched successfully' }
    res.status(200).json(areaHives);
  } catch (error) {
    console.error('Error fetching area hives:', error);
    // #swagger.responses[500] = { description: 'Failed to fetch area hives' }
    res.status(500).json({ error: 'Failed to fetch area hives' });
  }
});

// ✅ /login → /user/login 으로 단순 포워딩
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
    req.url = '/login';
    (userRoutes as any).handle(req, res, next);
});

// ✅ /inout → /data/inout 으로 포워딩
router.get('/inout', (req: Request, res: Response, next: NextFunction) => {
  req.url = '/inout';
  (dataRoutes as any).handle(req, res, next);
});

// ✅ /sensor → /data/sensor 으로 포워딩
router.get('/sensor', (req: Request, res: Response, next: NextFunction) => {
  req.url = '/sensor';
  (dataRoutes as any).handle(req, res, next);
});

// ✅ /camera → /data/camera 으로 포워딩
router.get('/camera', (req: Request, res: Response, next: NextFunction) => {
  req.url = '/camera';
  (dataRoutes as any).handle(req, res, next);
});

// ✅ /uplink → /data/uplink 으로 포워딩
router.post('/uplink', (req: Request, res: Response, next: NextFunction) => {
  req.url = '/uplink';
  (dataRoutes as any).handle(req, res, next);
});

// ✅ /upload → /data/upload 으로 포워딩
router.post('/upload', (req: Request, res: Response, next: NextFunction) => {
  req.url = '/upload';
  (dataRoutes as any).handle(req, res, next);
});

export default router;
