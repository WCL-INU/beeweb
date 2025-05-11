import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from '../swagger.json';
import deviceRoutes from './routes/device';
import hiveRoutes from './routes/hive';
import areaRoutes from './routes/area';
import legacyRoutes from './routes/legacy';
import userRoutes from './routes/user';
import dataRoutes from './routes/data';

const app = express();
const PORT = 8090;

// Swagger setup
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API endpoint
app.get('/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello, World!' });
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
