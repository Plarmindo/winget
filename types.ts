export interface WingetPackage {
  id: string;
  name: string;
  description: string;
  publisher: string;
  category: string;
  version?: string;
}

export interface SearchState {
  query: string;
  results: WingetPackage[];
  loading: boolean;
  error: string | null;
}

export type CartItem = WingetPackage;

export enum ViewMode {
  GRID = 'GRID',
  LIST = 'LIST'
}