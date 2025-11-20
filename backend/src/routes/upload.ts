import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { LASParser } from '../services/lasParser';
import { ExcelParser } from '../services/excelParser';
import { ProjectData } from '../types';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload and parse LAS file
router.post('/las', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parser = new LASParser();
    const parsedData = parser.parse(req.file.path);

    // Clean up uploaded file
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json(parsedData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload and parse Excel file
router.post('/excel', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parser = new ExcelParser();
    const parsedData = parser.parse(req.file.path);

    // Clean up uploaded file
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json(parsedData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Combine LAS and Excel data into project
router.post('/combine', (req: Request, res: Response) => {
  try {
    const { lasData, excelData } = req.body;

    if (!lasData || !excelData) {
      return res.status(400).json({ error: 'Missing lasData or excelData' });
    }

    const projectData: ProjectData = {
      wellId: excelData.metadata?.wellId || lasData.metadata?.wellId || 'UNKNOWN',
      metadata: {
        ...excelData.metadata,
        ...lasData.metadata
      },
      geophysicalLogs: lasData.data || [],
      lithologyIntervals: excelData.intervals || [],
      adjustments: [],
      version: '1.0.0',
      lastModified: new Date().toISOString()
    };

    res.json(projectData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

