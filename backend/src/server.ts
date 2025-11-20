import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/upload';
import projectRoutes from './routes/projects';
import exportRoutes from './routes/export';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AdjustLog API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Projects directory: ${__dirname}/../projects`);
});

