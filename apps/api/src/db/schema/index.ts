/**
 * Schema barrel — exports all 13 domains.
 * Imported by drizzle.config.ts and db client.
 */

// Enums
export * from './enums.js';

// Auth
export * from './auth.js';

// Master (categories, products, suppliers, members)
export * from './master.js';

// Stock
export * from './stock.js';

// POS (orders, payments, drafts)
export * from './pos.js';

// Shift
export * from './shift.js';

// Inventory + Surat Jalan
export * from './inventory.js';

// HR
export * from './hr.js';

// Reports
export * from './reports.js';

// Telegram
export * from './telegram.js';

// AI
export * from './ai.js';

// System (audit, settings, devices, printers)
export * from './system.js';
