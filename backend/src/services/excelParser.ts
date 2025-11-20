import * as XLSX from 'xlsx';
import { LithologyInterval, WellMetadata } from '../types';

export class ExcelParser {
  parse(filePath: string): { intervals: LithologyInterval[]; metadata: WellMetadata } {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null 
    });

    if (data.length < 3) {
      throw new Error('Excel file must have at least 3 rows');
    }

    // Extract metadata from row 3 (index 2)
    const metadataRow = data[2] as any[];
    const metadata: WellMetadata = {
      wellId: this.getCellValue(data, 0, 2) || '', // A3
      easting: this.parseNumber(this.getCellValue(data, 1, 2)),
      northing: this.parseNumber(this.getCellValue(data, 2, 2)),
      elevation: this.parseNumber(this.getCellValue(data, 3, 2)),
      azimuth: this.parseNumber(this.getCellValue(data, 4, 2)),
      dipDegree: this.parseNumber(this.getCellValue(data, 5, 2)),
      depth: this.parseNumber(this.getCellValue(data, 6, 2)),
      xSectionLine: this.getCellValue(data, 22, 2), // Column W (index 22)
      year: this.getCellValue(data, 23, 2), // Column X (index 23)
      geologist: this.getCellValue(data, 24, 2), // Column Y (index 24)
      geophysicalDepth: this.parseNumber(this.getCellValue(data, 25, 2)), // Column Z (index 25)
    };

    // Parse data rows (starting from row 4, index 3)
    const intervals: LithologyInterval[] = [];
    const headerRow = data[1] as any[]; // Row 2 (index 1) for column names

    for (let i = 3; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      const dhid = this.getCellValue(data, 0, i);
      if (!dhid || dhid === '') continue; // Skip empty rows

      const from = this.parseNumber(this.getCellValue(data, 1, i)); // Column B
      const to = this.parseNumber(this.getCellValue(data, 2, i)); // Column C
      const thickness = this.parseNumber(this.getCellValue(data, 3, i)); // Column D
      const lithology = this.getCellValue(data, 5, i) || ''; // Column F (index 5)

      if (from === null || to === null) continue;

      const interval: LithologyInterval = {
        id: `interval-${i}-${Date.now()}`,
        top: from,
        bottom: to,
        thickness: thickness || (to - from),
        lithologyType: lithology,
        rockCode: this.parseNumber(this.getCellValue(data, 7, i)), // Column H (index 7)
        splitedSeam: this.getCellValue(data, 6, i), // Column G (index 6)
        splitedCode: this.parseNumber(this.getCellValue(data, 8, i)), // Column I (index 8)
      };

      // Add additional columns 1-20, 22, 28-30
      for (let col = 0; col < 20; col++) {
        const header = headerRow[col];
        if (header) {
          interval[`col${col + 1}`] = this.getCellValue(data, col, i);
        }
      }

      // Column 22 (index 21)
      if (headerRow[21]) {
        interval.col22 = this.getCellValue(data, 21, i);
      }

      // Columns 28-30 (indices 27-29)
      for (let col = 27; col < 30; col++) {
        if (headerRow[col]) {
          interval[`col${col + 1}`] = this.getCellValue(data, col, i);
        }
      }

      intervals.push(interval);
    }

    return { intervals, metadata };
  }

  private getCellValue(data: any[][], col: number, row: number): string | null {
    if (row >= data.length || col >= data[row].length) return null;
    const value = data[row][col];
    return value !== null && value !== undefined ? String(value).trim() : null;
  }

  private parseNumber(value: string | null): number | null {
    if (!value) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
}

