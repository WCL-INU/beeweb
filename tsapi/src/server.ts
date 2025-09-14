import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from '../swagger.json';
import deviceRoutes from './routes/device';
import hiveRoutes from './routes/hive';
import areaRoutes from './routes/area';
import legacyRoutes from './routes/legacy';
import userRoutes from './routes/user';
import dataRoutes from './routes/data';
import { initializeDatabase } from './db/initialize';
import { backfillRange } from './db/summary';

// export async function backfillRange(
//   from: Date | string,
//   to: Date | string,
//   stepDays = 7
// ) {

const app = express();
const PORT = 8090;

initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch((error) => {
    console.error('Error initializing database:', error);
  }
);

// Swagger setup
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API endpoint
app.get('/hello', (req: Request, res: Response) => {
  // 응답은 즉시
  res.send('Hello, World!');

  // 백필은 백그라운드에서 실행
  backfillRange('2022-01-01', '2025-10-30', 7, {
    autoGrowStep: true,
    growFactor: 2,
    growThreshold: 3,
    maxStepDays: 60,
  })
    .then(() => {
      console.log('✅ Backfill finished');
    })
    .catch((err) => {
      console.error('❌ Backfill error', err);
    });
});

// Device routes
app.use('/', legacyRoutes);
app.use('/device', deviceRoutes);
app.use('/hive', hiveRoutes);
app.use('/area', areaRoutes);
app.use('/user', userRoutes);
app.use('/data', dataRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Swagger Docs available at http://localhost:${PORT}/docs`);
});
