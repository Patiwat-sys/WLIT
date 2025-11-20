export interface GeophysicalLog {
  depth: number;
  natu: number | null;
  long: number | null;
  high: number | null;
  bore: number | null;
  [key: string]: number | null;
}

export interface LithologyInterval {
  id: string;
  top: number;
  bottom: number;
  thickness: number;
  lithologyType: string;
  rockCode: number | null;
  splitedSeam: string | null;
  splitedCode: number | null;
  adjustedTop?: number;
  adjustedBottom?: number;
  // Additional fields from Excel columns
  [key: string]: any;
}

export interface WellMetadata {
  wellId: string;
  easting?: number;
  northing?: number;
  elevation?: number;
  azimuth?: number;
  dipDegree?: number;
  depth?: number;
  geophysicalDepth?: number;
  xSectionLine?: string;
  year?: string;
  geologist?: string;
  [key: string]: any;
}

export interface ProjectData {
  wellId: string;
  metadata: WellMetadata;
  geophysicalLogs: GeophysicalLog[];
  lithologyIntervals: LithologyInterval[];
  adjustments: AdjustmentHistory[];
  version: string;
  lastModified: string;
}

export interface AdjustmentHistory {
  id: string;
  intervalId: string;
  type: 'top' | 'bottom';
  oldValue: number;
  newValue: number;
  timestamp: string;
}

export interface ParsedLASData {
  metadata: {
    startDepth: number;
    stopDepth: number;
    step: number;
    nullValue: number;
    wellId?: string;
    [key: string]: any;
  };
  curves: {
    name: string;
    unit: string;
    description: string;
  }[];
  data: GeophysicalLog[];
}

