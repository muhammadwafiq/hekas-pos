/**
 * Phase 4 E2E Test v2 — proper response envelope handling.
 */

const BASE = 'http://localhost:3001';
const PRODUCT_ID = '19c75023-55bd-42b0-829c-66dbba16aff4'; // Chitato
const OUTLET_ID = '00000000-0000-0000-0000-000000000001';

async function login(username: string, password = 'password123'): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`Login ${username} failed`);
  return data.data?.accessToken ?? data.accessToken;
}

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: any; raw?: boolean } = {}
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`, detail === undefined ? '(undefined)' : JSON.stringify(detail).slice(0, 200)); }
}

async function run() {
  console.log('🔐 Login 3 roles...');
  const tokens = {
    admin: await login('gudang1'),
    manager: await login('manager1'),
    kasir: await login('kasir1'),
  };
  check('admin login', !!tokens.admin);
  check('manager login', !!tokens.manager);
  check('kasir login', !!tokens.kasir);

  console.log('\n📱 Telegram link generation (admin)...');
  const linkRes = await req('POST', '/api/telegram/link', { token: tokens.admin });
  const linkPayload = linkRes.data?.data ?? linkRes.data;
  check('POST /api/telegram/link → 200', linkRes.status === 200);
  check('code starts with HEKAS-', linkPayload?.code?.startsWith?.('HEKAS-'));
  check('has bot_url', !!linkPayload?.bot_url);

  console.log('\n📱 Telegram status...');
  const statusRes = await req('GET', '/api/telegram/status', { token: tokens.admin });
  const statusPayload = statusRes.data?.data ?? statusRes.data;
  check('GET /api/telegram/status → 200', statusRes.status === 200);
  check('hasPendingCode=true', statusPayload?.hasPendingCode === true);

  console.log('\n📋 RBAC checks...');
  const kasirCreate = await req('POST', '/api/surat-jalan', {
    token: tokens.kasir,
    body: { outletId: OUTLET_ID, destination: 'X', recipientName: 'Y', items: [{ productId: PRODUCT_ID, quantity: 1 }] },
  });
  check('Kasir blocked from SJ create (403)', kasirCreate.status === 403);

  const kasirLink = await req('POST', '/api/telegram/link', { token: tokens.kasir });
  check('Kasir blocked from telegram link (403)', kasirLink.status === 403);

  console.log('\n📋 Full Surat Jalan workflow...');
  // 1. Create
  const createRes = await req('POST', '/api/surat-jalan', {
    token: tokens.admin,
    body: {
      outletId: OUTLET_ID,
      destination: 'Toko Cabang Bekasi',
      recipientName: 'Pak Budi',
      recipientPhone: '081234567890',
      notes: 'Pengiriman rutin',
      items: [{ productId: PRODUCT_ID, quantity: 10 }],
    },
  });
  const created = createRes.data?.data ?? createRes.data;
  check('POST /api/surat-jalan → 201', createRes.status === 201, { status: createRes.status, err: createRes.data?.error });
  const sjId = created?.id;

  if (sjId) {
    // 2. Detail
    const detailRes = await req('GET', `/api/surat-jalan/${sjId}`, { token: tokens.admin });
    const detail = detailRes.data?.data ?? detailRes.data;
    check('GET /api/surat-jalan/:id → 200', detailRes.status === 200);
    check('SJ has 1 item', detail?.items?.length === 1);
    check('SJ status=draft', detail?.status === 'draft');

    // 3. Review (admin_gudang)
    const reviewRes = await req('POST', `/api/surat-jalan/${sjId}/review-gudang`, {
      token: tokens.admin,
      body: { notes: 'Stok siap, mohon approval' },
    });
    const reviewed = reviewRes.data?.data ?? reviewRes.data;
    check('POST /review-gudang → 200', reviewRes.status === 200);
    check('SJ status=pending_review', reviewed?.status === 'pending_review');

    // 4. Approve (manager) — triggers PDF + enqueue notification
    const approveRes = await req('POST', `/api/surat-jalan/${sjId}/approve`, {
      token: tokens.manager,
      body: { notes: 'Disetujui' },
    });
    const approved = approveRes.data?.data ?? approveRes.data;
    check('POST /approve → 200', approveRes.status === 200);
    check('SJ status=approved', approved?.status === 'approved');

    // 5. PDF download
    const pdfRes = await fetch(`${BASE}/api/surat-jalan/${sjId}/pdf`, {
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });
    check('GET /pdf → 200', pdfRes.status === 200);
    check('content-type is PDF', pdfRes.headers.get('content-type')?.includes('pdf'));
    const pdfSize = (await pdfRes.arrayBuffer()).byteLength;
    check(`PDF size > 0 (${pdfSize} bytes)`, pdfSize > 0);

    // 6. Mark sent
    const sentRes = await req('POST', `/api/surat-jalan/${sjId}/mark-sent`, { token: tokens.admin });
    const sent = sentRes.data?.data ?? sentRes.data;
    check('POST /mark-sent → 200', sentRes.status === 200);
    check('SJ status=sent', sent?.status === 'sent');

    // 7. Try approve already-sent → should fail
    const reapproveRes = await req('POST', `/api/surat-jalan/${sjId}/approve`, {
      token: tokens.manager,
      body: { notes: 're' },
    });
    check('Cannot re-approve sent SJ (422)', reapproveRes.status === 422 || reapproveRes.status === 400);
  }

  console.log('\n📋 Notification queue check (should have entries from review + approve)...');
  const queueRes = await req('GET', '/api/telegram/queue?limit=20', { token: tokens.manager });
  const queuePayload = queueRes.data?.data ?? queueRes.data;
  const queueItems = Array.isArray(queuePayload) ? queuePayload : queuePayload?.items ?? [];
  check('GET /api/telegram/queue → 200', queueRes.status === 200);
  check(`Queue has items (${queueItems.length})`, queueItems.length > 0);
  const sjPending = queueItems.find((q: any) => q.eventType === 'sj_pending_approval');
  check('Queue has sj_pending_approval event', !!sjPending, { eventTypes: queueItems.map((q: any) => q.eventType) });
  const sjApproved = queueItems.find((q: any) => q.eventType === 'sj_approved');
  check('Queue has sj_approved event', !!sjApproved);

  console.log('\n📋 Reject flow...');
  // Create another SJ + reject
  const create2 = await req('POST', '/api/surat-jalan', {
    token: tokens.admin,
    body: {
      outletId: OUTLET_ID,
      destination: 'Reject Test',
      recipientName: 'Pak X',
      items: [{ productId: PRODUCT_ID, quantity: 5 }],
    },
  });
  const sj2 = create2.data?.data ?? create2.data;
  if (sj2?.id) {
    await req('POST', `/api/surat-jalan/${sj2.id}/review-gudang`, { token: tokens.admin });
    const rejectRes = await req('POST', `/api/surat-jalan/${sj2.id}/reject`, {
      token: tokens.manager,
      body: { reason: 'Stok belum siap' },
    });
    const rejected = rejectRes.data?.data ?? rejectRes.data;
    check('POST /reject → 200', rejectRes.status === 200);
    check('SJ status=rejected', rejected?.status === 'rejected');
  }

  console.log('\n📋 Webhook handler (bot /start command)...');
  // Simulate Telegram webhook with valid code
  const linkCode = linkPayload?.code?.replace('HEKAS-', '');
  const whRes = await fetch(`${BASE}/api/telegram/webhook/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, username: 'testuser', first_name: 'Test' },
        text: `/start ${linkCode}`,
      },
    }),
  });
  check('Webhook /start → 200', whRes.status === 200);
  const whBody = await whRes.json();
  check('Webhook ok=true', whBody?.ok === true);

  // Verify link is now verified
  const status2 = await req('GET', '/api/telegram/status', { token: tokens.admin });
  const status2Payload = status2.data?.data ?? status2.data;
  check('After webhook: linked=true', status2Payload?.linked === true, status2Payload);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Phase 4 E2E v2: ${pass} passed, ${fail} failed`);
  console.log('='.repeat(50));
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => { console.error('FATAL:', err); process.exit(1); });