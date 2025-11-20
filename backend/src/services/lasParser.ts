import * as fs from 'fs';
import { ParsedLASData, GeophysicalLog } from '../types';

export class LASParser {
  private nullValue: number = -99999;

  parse(filePath: string): ParsedLASData {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const metadata: any = {};
    const curves: { name: string; unit: string; description: string }[] = [];
    const data: GeophysicalLog[] = [];
    let dataStartIndex = -1;
    let curveNames: string[] = [];

    let currentSection = '';
    let wellId = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('~')) {
        currentSection = line;
        continue;
      }

      if (line.startsWith('#') || line === '') {
        continue;
      }

      // Parse VERSION section
      if (currentSection.includes('VERSION')) {
        if (line.includes('NULL.')) {
          const match = line.match(/NULL\.\s+(-?\d+)/);
          if (match) {
            this.nullValue = parseFloat(match[1]);
            metadata.nullValue = this.nullValue;
          }
        }
      }

      // Parse WELL section
      if (currentSection.includes('WELL')) {
        if (line.includes('STRT.')) {
          const match = line.match(/STRT\.M\s+([\d.]+)/);
          if (match) metadata.startDepth = parseFloat(match[1]);
        }
        if (line.includes('STOP.')) {
          const match = line.match(/STOP\.M\s+([\d.]+)/);
          if (match) metadata.stopDepth = parseFloat(match[1]);
        }
        if (line.includes('STEP.')) {
          const match = line.match(/STEP\.M\s+([\d.]+)/);
          if (match) metadata.step = parseFloat(match[1]);
        }
        if (line.includes('WELL_ID.')) {
          const match = line.match(/WELL_ID\.\s+(.+?)\s*:/);
          if (match) {
            wellId = match[1].trim();
            metadata.wellId = wellId;
          }
        }
      }

      // Parse CURVE section
      if (currentSection.includes('CURVE')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const curveDef = parts[0];
          const match = curveDef.match(/(\w+)\.(\w+)/);
          if (match) {
            const name = match[1];
            const unit = match[2];
            const description = line.split(':')[1]?.trim() || '';
            curves.push({ name, unit, description });
            curveNames.push(name);
          }
        }
      }

      // Find data section
      if (currentSection.includes('~A') || currentSection.includes('~ASCII')) {
        if (dataStartIndex === -1) {
          dataStartIndex = i;
          // The line after ~A should contain curve names
          // Skip if it's the section header itself
          if (i + 1 < lines.length) {
            const headerLine = lines[i + 1];
            if (headerLine && !headerLine.trim().startsWith('~')) {
              const headerParts = headerLine.trim().split(/\s+/).filter(p => p);
              if (headerParts.length > 1) {
                // Extract curve names (skip first which is usually DEPT or depth)
                curveNames = headerParts.slice(1).map(name => {
                  // Remove brackets and units, keep only the name
                  const match = name.match(/(\w+)/);
                  return match ? match[1].toLowerCase() : name.toLowerCase();
                });
              }
            }
          }
          // If no header found, use curve names from CURVE section
          if (curveNames.length === 0 && curves.length > 0) {
            curveNames = curves.map(c => c.name.toLowerCase());
          }
        } else {
          // Parse data line
          const values = line.split(/\s+/).filter(v => v && v.trim() !== '');
          if (values.length > 0) {
            const logEntry: any = {};
            const depth = parseFloat(values[0]);
            if (!isNaN(depth)) {
              logEntry.depth = depth;
              
              // Parse curve values
              for (let j = 0; j < curveNames.length && j < values.length - 1; j++) {
                const value = parseFloat(values[j + 1]);
                const curveName = curveNames[j];
                logEntry[curveName] = 
                  (isNaN(value) || value === this.nullValue) ? null : value;
              }
              
              data.push(logEntry);
            }
          }
        }
      }
    }

    return {
      metadata,
      curves,
      data
    };
  }
}

