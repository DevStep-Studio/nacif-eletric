export const BILLING_API_VERSION: string;
export const FEATURE_KEYS: Record<string, string>;
export const COMMERCIAL_PLANS: any[];
export const LEGACY_PLANS: any[];

export const MODULE_ALIASES: Record<string, string>;
export function getCatalogPlan(code?: string | null): any;
export function catalogModuleLevel(plan: any, key: string): any;
export function catalogModuleAccess(code: string, key: string, options?: any): { allowed: boolean; level: string; isAcademic: boolean; isFreeRestricted: boolean; watermark: string | null; message: string | null; requiredPlans: string[] };
export function planComparisonValue(plan: any, key: string): string;

export function getTrialSchedule(now?: number): { start: Date; end: Date; firstChargeDate: string };
