import { db } from './src/config/database.js';
import { products } from './src/db/schema/master.js';
import { eq } from 'drizzle-orm';

const rows = await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).limit(3);
console.log(JSON.stringify(rows, null, 2));