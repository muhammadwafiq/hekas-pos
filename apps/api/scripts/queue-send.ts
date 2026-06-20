// Test daily report job — fire a job to the queue
import { startQueue } from '../src/config/queue.js';

const boss = await startQueue();
const id = await boss.send('reports-daily', { reportDate: '2026-06-20' });
console.log('Sent job:', id);
// Give worker a moment to pick it up
await new Promise((r) => setTimeout(r, 2000));
await boss.stop({ graceful: false });
process.exit(0);
