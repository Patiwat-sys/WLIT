import { Router, Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { ProjectData } from '../types';

const router = Router();

// Export project to Excel
router.post('/excel', (req: Request, res: Response) => {
  try {
    const projectData: ProjectData = req.body;

    if (!projectData.lithologyIntervals || projectData.lithologyIntervals.length === 0) {
      return res.status(400).json({ error: 'No lithology intervals to export' });
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Prepare data for export
    const exportData = projectData.lithologyIntervals.map(interval => ({
      'DHID': projectData.wellId,
      'From': interval.adjustedTop !== undefined ? interval.adjustedTop : interval.top,
      'To': interval.adjustedBottom !== undefined ? interval.adjustedBottom : interval.bottom,
      'Thickness': (interval.adjustedBottom !== undefined ? interval.adjustedBottom : interval.bottom) - 
                   (interval.adjustedTop !== undefined ? interval.adjustedTop : interval.top),
      'Lithology': interval.lithologyType,
      'Rock Code': interval.rockCode,
      'Splited Seam': interval.splitedSeam,
      'Splited Code': interval.splitedCode,
      // Add other fields as needed
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lithology Log');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${projectData.wellId}_adjusted.xlsx"`);

    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export project to CSV
router.post('/csv', (req: Request, res: Response) => {
  try {
    const projectData: ProjectData = req.body;

    if (!projectData.lithologyIntervals || projectData.lithologyIntervals.length === 0) {
      return res.status(400).json({ error: 'No lithology intervals to export' });
    }

    // Create CSV content
    const headers = ['DHID', 'From', 'To', 'Thickness', 'Lithology', 'Rock Code', 'Splited Seam'];
    const rows = projectData.lithologyIntervals.map(interval => [
      projectData.wellId,
      interval.adjustedTop !== undefined ? interval.adjustedTop : interval.top,
      interval.adjustedBottom !== undefined ? interval.adjustedBottom : interval.bottom,
      (interval.adjustedBottom !== undefined ? interval.adjustedBottom : interval.bottom) - 
      (interval.adjustedTop !== undefined ? interval.adjustedTop : interval.top),
      interval.lithologyType,
      interval.rockCode || '',
      interval.splitedSeam || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${projectData.wellId}_adjusted.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

