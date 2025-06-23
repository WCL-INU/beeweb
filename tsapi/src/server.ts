import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from '../swagger.json';
import deviceRoutes from './routes/device';
import hiveRoutes from './routes/hive';
import areaRoutes from './routes/area';
import legacyRoutes from './routes/legacy';
import userRoutes from './routes/user';
import dataRoutes from './routes/data';
import pictureRoutes from './routes/picture';
import { initializeDatabase } from './db/initialize';
import { backupDatabase } from './db/backup';

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

setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        // 자정마다 실행 (컨테이너 계속 켜져 있어야 함)
        backupDatabase();
    }
}, 60 * 1000); // 1분마다 확인

// Swagger setup
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API endpoint
app.get('/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello, World!' });
});
app.get('/backup', (req: Request, res: Response) => {
  backupDatabase();
  res.json({ message: 'Backup initiated' });
});

// Device routes
app.use('/', legacyRoutes);
app.use('/device', deviceRoutes);
app.use('/hive', hiveRoutes);
app.use('/area', areaRoutes);
app.use('/user', userRoutes);
app.use('/data', dataRoutes);
app.use('/picture', pictureRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Swagger Docs available at http://localhost:${PORT}/docs`);
});

