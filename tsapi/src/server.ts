import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from '../swagger.json';
import deviceRoutes from './routes/device';
import hiveRoutes from './routes/hive';
import areaRoutes from './routes/area';
import areaHiveRoutes from './routes/legacy';
import userRoutes from './routes/user';

const app = express();
const PORT = 3000;

// Swagger setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API endpoint
app.get('/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello, World!' });
});

// Device routes
app.use('/api/areahive', areaHiveRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/hive', hiveRoutes);
app.use('/api/area', areaRoutes);
app.use('/api/user', userRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Swagger Docs available at http://localhost:${PORT}/api-docs`);
});
