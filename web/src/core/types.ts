import type { ComponentType } from 'react';

export type Cell = string | number | null;
export interface DataTable { id: string; name: string; role: string; columns: string[]; rows: Cell[][]; }
export interface Dataset { tables: DataTable[]; text?: string; format?: string; files?:{id:string;name:string;role:string;format:string;text:string}[]; }
export interface Issue { message: string; tableId?: string; row?: number; column?: number; severity?: 'error'|'warning'; }
export interface ChartStyle {
  width: number; height: number; background: string; transparent: boolean;
  marginTop: number; marginRight: number; marginBottom: number; marginLeft: number;
  title: string; subtitle: string; fontFamily: string; fontSize: number; titleSize: number;
  textColor: string; palette: string[]; opacity: number; showLegend: boolean;
  showGrid: boolean; showLabels: boolean; xTitle: string; yTitle: string;
  xMin?: number; xMax?: number; yMin?: number; yMax?: number;
  pointSize: number; lineWidth: number; orientation: string; sort: string;
  [key: string]: unknown;
}
export interface Layer { id: string; type: string; name: string; visible: boolean; data?: Dataset; settings: Record<string, unknown>; }
export interface AnalysisState { method: string; params: Record<string, unknown>; inputHash: string; result?: Record<string, unknown>; diagnostics?: string[]; }
export interface Project {
  schemaVersion: 1; id: string; name: string; templateId: string; templateVersion: number;
  createdAt: string; updatedAt: string; dataset: Dataset; mapping: Record<string,string>;
  style: ChartStyle; layers: Layer[]; layout: Record<string, unknown>; analysis?: AnalysisState;
}
export interface Control {
  key: string; label: string; type: 'number'|'text'|'color'|'boolean'|'select';
  min?: number; max?: number; step?: number; options?: {value: string; label: string}[];
  section?: string; help?: string;
}
export interface RendererProps { project: Project; thumbnail?: boolean; onLayoutChange?: (layout: Record<string, unknown>) => void; }
export interface Template {
  id: string; familyId: string; variant: string; version: number; name: string; category: string;
  description: string; tags: string[]; sourceUrls: string[]; status: 'available'|'development';
  defaultStyle: Partial<ChartStyle>; controls: Control[]; example: Dataset; alternate: Dataset;
  inputHelp: string; tutorial: string[]; limitations: string[]; formats: string[];
  exampleSource: {kind: 'simulated'|'public'; label: string; url?: string; license: string};
  validate: (dataset: Dataset, style?: ChartStyle) => Issue[];
  Renderer: ComponentType<RendererProps>;
  analysisMethods?: {method: string; label: string; description: string; params?: Record<string,unknown>}[];
  prepareAnalysis?: (method:string,dataset:Dataset,params:Record<string,unknown>)=>{data:Record<string,unknown>;params:Record<string,unknown>};
  layerTypes?: {type:string; label:string; help:string; example?: Dataset}[];
}
