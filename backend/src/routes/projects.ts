import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectData } from '../types';

const router = Router();
const projectsDir = path.join(__dirname, '../../projects');

// Ensure projects directory exists
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir, { recursive: true });
}

// Save project
router.post('/save', (req: Request, res: Response) => {
  try {
    const projectData: ProjectData = req.body;

    if (!projectData.wellId) {
      return res.status(400).json({ error: 'wellId is required' });
    }

    projectData.lastModified = new Date().toISOString();
    const filename = `${projectData.wellId}_${Date.now()}.json`;
    const filepath = path.join(projectsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(projectData, null, 2));

    res.json({
      success: true,
      projectId: filename,
      message: 'Project saved successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Load project
router.get('/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const filepath = path.join(projectsDir, projectId);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const projectData: ProjectData = JSON.parse(fileContent);

    res.json(projectData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all projects
router.get('/', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(projectsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filepath = path.join(projectsDir, file);
        const stats = fs.statSync(filepath);
        const content = fs.readFileSync(filepath, 'utf-8');
        const project: ProjectData = JSON.parse(content);
        
        return {
          projectId: file,
          wellId: project.wellId,
          lastModified: project.lastModified
        };
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const filepath = path.join(projectsDir, projectId);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    fs.unlinkSync(filepath);

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

