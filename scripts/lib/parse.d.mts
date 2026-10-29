export function parseCsv(text: string): string[][];
export function csvObjects(text: string): Array<Record<string, string> & { _row: number }>;
export function parseTime(input: string): string;
export function parseDate(input: string): string;
export function slugify(text: string, maxWords?: number): string;
