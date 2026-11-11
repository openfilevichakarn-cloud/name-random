# NEXT-GEN STUDENT RANDOMIZER

ระบบสุ่มชื่อนักเรียนสไตล์เกมสำหรับห้องเรียนยุคใหม่ (ประถม–มัธยม) ใช้งานผ่านเบราว์เซอร์ได้ทันทีบนคอมพิวเตอร์ แท็บเล็ต
มือถือ โปรเจกเตอร์ และ Smart TV — ไม่ต้องติดตั้ง ไม่ต้องมีบัญชี (เก็บข้อมูลในเครื่อง) และเชื่อมต่อ Supabase ได้เมื่อต้องการบัญชีครูและซิงก์ข้อมูลขึ้นคลาวด์

## ฟีเจอร์

**Randomizer Studio**

- 5 โหมดเกม: Lucky Wheel, Mystery Slot, Mystery Card, Countdown 5-4-3-2-1, Gacha
- สุ่มทีละคน / หลายคน / แบ่งทีม (กำหนดจำนวนทีมหรือขนาดทีม) และสุ่มตัวเลขได้แม้ยังไม่มีรายชื่อ
- กติกา: ไม่ซ้ำจนครบรอบ, ซ้ำได้, ตัดชื่อผู้ถูกเลือก, ตัดชื่อเองก่อนสุ่ม, เริ่มรอบใหม่
- ประกาศผล 10 ขั้น (READY → หมุนเร็ว → ชะลอ → ลุ้น → ชื่อ + Avatar → Confetti → เสียงฉลอง → ปุ่มสุ่มต่อ)
- โหมดจอใหญ่ (Big Screen) สำหรับโปรเจกเตอร์/ทีวี, คีย์ลัด Space/Enter/Esc/F ใช้กับรีโมตพรีเซนต์ได้

**ความยุติธรรมของการสุ่ม**

- `crypto.getRandomValues()` + rejection sampling (ไม่มี modulo bias) และ Fisher–Yates
- ผลถูกคำนวณก่อนเริ่มแอนิเมชัน แอนิเมชันแค่ "แสดง" ผลนั้น — กดซ้ำระหว่างสุ่มไม่ได้

**ฟีเจอร์พิเศษ** (เปิด/ปิดที่ ตั้งค่า → Special Features)

- **Class Ranking** — ให้ดาวบนหน้าผู้ชนะ ดูอันดับรายวัน/สัปดาห์/เดือน พร้อมรายชื่อคนที่ยังไม่ถูกเลือกและปุ่ม "สุ่มจากคนกลุ่มนี้"
- **Team Battle** — กระดานคะแนนทีม, สุ่มทีมที่ได้ตอบ, สุ่มตัวแทนทีม, จบเกมแล้วให้ดาวทีมที่ชนะ
- **Quiz Mode** — ตัวจับเวลาตอบ + ปุ่มตอบถูก/ตอบผิด (ตอบถูกได้ดาว)
- **Random Challenge / Surprise Reward / Lucky Streak** — ภารกิจ รางวัลเซอร์ไพรส์ และป้ายเมื่อถูกเลือกซ้ำในวันเดียว
- **Group Maker** และ **Student Avatar** (Avatar หุ่นยนต์สร้างอัตโนมัติหรืออีโมจิ — ไม่ใช้รูปถ่ายนักเรียน)

**ข้อมูลและรายงาน**

- จัดการห้องเรียนและนักเรียน, ค้นหา, เลือกกลุ่มย่อย, นำเข้า/ส่งออก Excel และ CSV
- ประวัติการสุ่มรายครั้งและรายรอบ ตัวกรองครบ ส่งออกรายงาน Excel/CSV
- Dashboard: สถิติ, กราฟ 7 วัน, Quick Start, กิจกรรมล่าสุด
- สำรองข้อมูล/กู้คืนเป็นไฟล์ JSON

**เสียงและแอนิเมชัน**

- เสียงสังเคราะห์เองทั้งหมด 10 เหตุการณ์ × 3 ธีม และเพลงประกอบ (ไม่ใช้ไฟล์เสียงที่มีลิขสิทธิ์)
- AudioContext เริ่มหลัง interaction แรกเท่านั้น, ปรับเสียง Master/Music/SFX
- แอนิเมชัน 3 ระดับ (Low/Medium/High) และเคารพ `prefers-reduced-motion`

## เริ่มต้นใช้งาน (สำหรับนักพัฒนา)

ต้องมี Node.js 22.22 ขึ้นไป

```bash
npm install
```

```bash
npm run dev
```

เปิด http://localhost:5173 — แอปทำงานโหมด Local ทันที (ข้อมูลเก็บใน IndexedDB ของเบราว์เซอร์)
ลองใช้งานได้เร็วด้วยปุ่ม **ลองด้วยข้อมูลตัวอย่าง** ในหน้าห้องเรียน (ข้อมูลตัวอย่างมีป้ายกำกับชัดเจน)

### คำสั่ง

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | typecheck + build ไปที่ `dist/` |
| `npm run preview` | เปิด build ที่ http://localhost:4173 |
| `npm run check` | typecheck + lint + unit tests |
| `npm test` | unit tests (Vitest) |
| `npm run test:e2e` | end-to-end tests (Playwright: desktop, mobile, cloud) |
| `npm run test:db` | migration + ทดสอบ RLS บน PostgreSQL ([รายละเอียด](docs/SUPABASE.md#ทดสอบ-rls-บนเครื่อง)) |

## Deploy

แอปเป็น static SPA — build ด้วย `npm run build` แล้วนำ `dist/` ขึ้นโฮสต์ใดก็ได้ที่ส่งทุก path กลับไปที่ `index.html`

### GitHub Pages

1. Settings → Pages → Build and deployment → Source: เลือก **GitHub Actions**
2. workflow `.github/workflows/pages.yml` จะ build (ตั้ง base path เป็น `/<ชื่อ repository>/`) และ deploy ทุกครั้งที่ push
   หรือกดรันเองที่แท็บ Actions → Deploy to GitHub Pages → Run workflow
3. (ไม่บังคับ) ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` ที่ Settings → Secrets and variables → Actions → Variables

### Vercel

1. Import repository นี้ใน Vercel — `vercel.json` ตั้งค่า build, SPA rewrites, security headers และ cache ให้แล้ว
2. (ไม่บังคับ) ตั้ง Environment Variables `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` แล้ว Redeploy

### Cloudflare Pages

1. Create project → Connect to Git → เลือก repository นี้
2. Build command: `npm run build` · Build output directory: `dist` (Node อ่านจาก `.nvmrc`)
3. (ไม่บังคับ) ตั้ง Environment Variables ของ Supabase เช่นเดียวกับ Vercel
4. `public/_redirects` (SPA fallback) และ `public/_headers` (security headers, cache) ถูก deploy ไปพร้อมกัน

### บัญชีครูและคลาวด์ (Supabase, ไม่บังคับ)

ทำตาม [docs/SUPABASE.md](docs/SUPABASE.md): สร้างโปรเจกต์, รัน migration, ตั้งค่า Auth และใส่ค่า URL/Publishable key
ถ้าไม่ตั้งค่า แอปไม่มีโค้ดส่วน Supabase อยู่ใน bundle เลยและทำงานครบทุกฟีเจอร์ในโหมด Local

## ความปลอดภัยและความเป็นส่วนตัว

- **Content-Security-Policy** ถูกสร้างตอน build (`build/csp.ts`) อนุญาตเชื่อมต่อเฉพาะตัวแอปและโปรเจกต์ Supabase ที่ตั้งค่าไว้
  ส่วน `frame-ancestors`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` มาจาก headers ของโฮสต์
- ข้อมูลแต่ละโรงเรียนแยกกันด้วย Row Level Security (ทดสอบอัตโนมัติ 105 กรณี) — ห้ามใช้ `service_role`/secret key ในแอป
- โหมด Local: ข้อมูลอยู่ในเบราว์เซอร์เครื่องนั้นเท่านั้น
- ไม่เก็บรูปถ่ายนักเรียน Avatar ถูกสร้างจากรหัสแบบสุ่ม

## การทดสอบ

- **Unit** (Vitest): random engine (ความสม่ำเสมอเชิงสถิติ, ไม่ซ้ำ, กติกา), ฟีเจอร์พิเศษ, ranking, repository ทั้ง IndexedDB และ Supabase, import/export, การตั้งค่า
- **Database** (psql): migration ใช้ได้จริงและ RLS กันการเข้าถึงข้ามโรงเรียน
- **E2E** (Playwright): ทุกโหมดเกม ทุกกติกา, นักเรียน/ห้องเรียน, ประวัติ, เสียง, ตั้งค่า, ฟีเจอร์พิเศษ, บัญชีครู (Supabase จำลอง)
  และการตรวจ accessibility อัตโนมัติด้วย axe (WCAG 2.1 A/AA) บน desktop และมือถือ
- CI (`.github/workflows/ci.yml`) รันทั้งหมดทุก pull request

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

## โครงสร้างโปรเจกต์

```
src/
├─ app/          router, AppShell
├─ pages/        หน้าหลักแต่ละหน้า (lazy-loaded)
├─ features/     randomizer (engine + stages), battle, ranking, students, classrooms, history, dashboard, settings, auth
├─ components/   ui (shadcn-style), common, layout
├─ data/         โมเดล, DataRepository (local IndexedDB / Supabase)
├─ stores/       Zustand
├─ lib/          audio, animation, date, spreadsheet, …
└─ hooks/
supabase/        migrations + RLS tests
e2e/             Playwright tests
build/           build-time helpers (CSP)
```

รายละเอียดสถาปัตยกรรมและเหตุผลของการออกแบบ: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## เบราว์เซอร์ที่รองรับ

Chrome, Edge, Firefox และ Safari รุ่นปัจจุบัน รวมถึงเบราว์เซอร์บน Smart TV ที่ใช้ Chromium
โหมดเต็มจอและการกันจอดับ (Wake Lock) ทำงานเมื่ออุปกรณ์รองรับ — ถ้าไม่รองรับ โหมดจอใหญ่ยังใช้งานได้ตามปกติ
