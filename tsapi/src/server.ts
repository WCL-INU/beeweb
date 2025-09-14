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
import { backfillRange } from './db/summary';
import { backupDatabase } from './db/backup';
import { runCorrectProcess } from './db/correct_sensor_data';

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
    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (hours === 0 && minutes === 0) {
        // 자정마다 실행 (컨테이너 계속 켜져 있어야 함)
        backupDatabase();
    }
    if (minutes === 0) {
        // 매시간 0분에 실행
        // TODO: 보정 프로세스를 별도 컨테이너로 빼고 싶은데 고유의 SQL 쿼리가 있음, 별도 컨테이너가 DB권한을 가져가는건 바라지 않는데, 내부에 API를 다 만들면 별도 컨테이너에 쓸게 없음
        runCorrectProcess();
    }
}, 60 * 1000); // 1분마다 확인

// Swagger setup
app.use('/docs', (req: Request, res: Response) => {
  try {
    res.status(200).send(swaggerUi.generateHTML(swaggerDocument));
  } catch (error) {
    console.error('Error running migration:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API endpoint
app.get('/hello', (req: Request, res: Response) => {
  res.send('Hello, World!');  
});

app.get('/summary', (req: Request, res: Response) => {
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
  res.json({ message: 'Summary data' });
});

app.get('/backup', (req: Request, res: Response) => {
  backupDatabase();
  res.json({ message: 'Backup initiated' });
});

app.get('/correct', (req: Request, res: Response) => {
  runCorrectProcess();
  res.json({ message: 'Correction process initiated' });
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

