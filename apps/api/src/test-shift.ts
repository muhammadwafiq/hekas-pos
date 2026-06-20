import { db } from './config/database.ts';
import { shifts } from './db/schema/shift.ts';

try {
  const [row] = await db.insert(shifts).values({
    shiftCode: 'TEST-SHIFT-1',
    outletId: 'd3d1143e-984f-4185-b182-50b5dd3a3c8c',
    cashierId: 'a073aa5a-a57f-435e-8f60-263043fcd587',
    startedAt: new Date(),
    startingCash: '100000',
    expectedCash: '100000',
    status: 'aktif',
  }).returning();
  console.log('OK:', row);
} catch (err) {
  console.error('ACTUAL ERROR:');
  console.error(err);
  console.error('---');
  console.error('Error message:', err instanceof Error ? err.message : err);
  console.error('Error cause:', err instanceof Error ? err.cause : 'no cause');
}
