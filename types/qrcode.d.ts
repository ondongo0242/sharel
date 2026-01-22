declare module 'qrcode' {
  interface QRCodeModules {
    size: number;
    get(row: number, col: number): number;
  }

  interface QRCodeData {
    modules: QRCodeModules;
    version: number;
    errorCorrectionLevel: string;
    maskPattern: number;
    segments: any[];
  }

  interface CreateOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    version?: number;
    maskPattern?: number;
  }

  export function create(text: string, options?: CreateOptions): QRCodeData;
  export function toString(text: string, options?: any): Promise<string>;
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: any, text: string, options?: any): Promise<void>;
  export function toFile(path: string, text: string, options?: any): Promise<void>;
}
