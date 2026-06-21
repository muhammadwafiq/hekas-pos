# HEKAS POS — Marketing Site & Auth Pages

Static HTML/CSS/JS untuk landing page, register, login, dan email verification.

> **Catatan**: Ini adalah **MVP site** yang bisa langsung dipakai untuk collect customer
> (landing → register → trial → login). FE friend (Aidizzacky) bisa replace dengan
> framework modern (Vue/React/Next) nanti. Backend API contract tetap sama.

## 📁 Struktur

```
apps/web/
├── index.html              ← Landing (hero, features, pricing, FAQ)
├── register.html           ← Form signup (auto-create org + outlet + user + trial)
├── login.html              ← Form login
├── verify-email.html       ← Email verification handler
├── dashboard.html          ← Basic dashboard (after login)
├── css/
│   └── style.css           ← Custom styles (supplement Tailwind CDN)
├── js/
│   ├── config.js           ← API base URL config
│   ├── api.js              ← API client (fetch wrapper)
│   └── auth.js             ← Login/logout/role helpers
└── assets/
    └── favicon.svg         ← Logo
```

## 🚀 Cara Jalanin (Development)

### Opsi 1: Langsung buka di browser

Karena pure static, bisa langsung double-click `index.html`. Tapi karena pake ES modules,
butuh **local server** (jangan `file://`).

### Opsi 2: Python HTTP Server

```bash
cd apps/web
python3 -m http.server 8080
# → http://localhost:8080
```

### Opsi 3: Bun Static Server (recommended)

```bash
cd apps/web
bun --bun serve . --port 8080
```

### Opsi 4: Live Server (VS Code extension)

Install extension "Live Server", klik kanan `index.html` → "Open with Live Server".

## ⚙️ Konfigurasi API URL

Edit `js/config.js`:

```javascript
// Development (default)
window.__HEKAS_API__ = 'http://localhost:3001';

// Staging
window.__HEKAS_API__ = 'https://api-staging.hekaspos.id';

// Production
window.__HEKAS_API__ = 'https://api.hekaspos.id';
```

Atau set di `<head>` HTML sebelum `config.js`:

```html
<script>window.__HEKAS_API__ = 'https://api.hekaspos.id';</script>
<script src="/js/config.js"></script>
```

## 🌐 Deployment

### Opsi A: VPS (Caddy / Nginx)

Setup domain `hekaspos.id` pointing ke VPS:

**Caddy** (`/etc/caddy/Caddyfile`):

```caddyfile
hekaspos.id, www.hekaspos.id {
    root * /var/www/hekaspos
    file_server
    encode gzip zstd
    try_files {path} {path}.html
}
```

Deploy:

```bash
# Copy files
rsync -avz apps/web/ root@your-vps:/var/www/hekaspos/

# Caddy auto-SSL via Let's Encrypt
systemctl reload caddy
```

**Nginx** (`/etc/nginx/sites-available/hekaspos`):

```nginx
server {
    listen 443 ssl http2;
    server_name hekaspos.id www.hekaspos.id;

    root /var/www/hekaspos;
    index index.html;

    # SSL via Cloudflare Origin Cert atau Let's Encrypt
    ssl_certificate /etc/ssl/certs/hekaspos.id.pem;
    ssl_certificate_key /etc/ssl/private/hekaspos.id.key;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

### Opsi B: Vercel (Free, Paling Gampang)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd apps/web
vercel --prod
```

Vercel auto-detect static, kasih domain `hekaspos-xxx.vercel.app`. Bisa custom domain nanti.

### Opsi C: Cloudflare Pages (Free)

1. Push ke GitHub
2. Buka https://pages.cloudflare.com
3. Connect repo
4. Set build: `cd apps/web` (atau biarkan default)
5. Deploy

## 📋 Pages

| Page | URL | Purpose |
|------|-----|---------|
| Landing | `index.html` | Hero, features, pricing (dynamic from API), FAQ |
| Register | `register.html` | Signup form (POST /api/register/) |
| Login | `login.html` | Login form (POST /api/auth/login) |
| Verify Email | `verify-email.html` | Handle ?token=xx + ?status=registered |
| Dashboard | `dashboard.html` | Basic dashboard (after login) |

## 🎨 Customization

- **Brand colors**: edit CSS variables di `css/style.css` (top of file)
- **Logo**: replace `assets/favicon.svg`
- **Hero copy**: edit `index.html` langsung
- **Pricing**: auto-loaded dari `/api/public/plans` (fallback static di JS)

## 🔄 Migration ke Framework Modern (Phase B)

Kapan FE friend siap pake Vue/React/Next:

1. **Keep API contract** (sama persis)
2. **Replace `js/api.js`** dengan framework's HTTP client (axios, ofetch, dll)
3. **Replace `js/auth.js`** dengan Pinia/Vuex/Zustand store
4. **Replace `*.html`** dengan framework's components
5. **Setup build** (Vite, Next.js, dll)

Backend ga perlu diubah sama sekali.

## ❓ Troubleshooting

**CORS error di console?**

Pastikan backend allow origin lo. Di `apps/api/src/index.ts`, cari CORS config dan tambahin
domain lo:

```typescript
cors({
  origin: [
    'http://localhost:8080',  // dev
    'https://hekaspos.id',    // prod
    'https://www.hekaspos.id',
  ],
  credentials: true,
})
```

**Form submit ga ngapa-ngapain?**

1. Buka DevTools → Network tab
2. Submit form
3. Liat request ke `/api/register/` — error message apa?
4. Cek console log

**Login sukses tapi ga redirect?**

1. Cek `localStorage.getItem('accessToken')` di DevTools
2. Cek URL tujuan redirect

## 📞 Support

- WhatsApp: 0812-3456-7890
- Email: hello@hekaspos.id
- GitHub: https://github.com/muhammadwafiq/hekas-pos/issues
