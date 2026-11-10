# NEXT-GEN STUDENT RANDOMIZER — Requirement Analysis & Architecture

เอกสารนี้คือผลลัพธ์ของ "Phase 0" — วิเคราะห์ Requirement และออกแบบ Architecture ก่อนลงมือเขียนโค้ด
ทุก Phase ถัดไปยึดตามเอกสารนี้ และจะอัปเดตเมื่อการออกแบบเปลี่ยน

---

## 1. Requirement Analysis

### 1.1 ผู้ใช้และบริบท

| ผู้ใช้ | สิ่งที่ต้องการ | ผลต่อการออกแบบ |
| --- | --- | --- |
| ครู (ประถม–มัธยม) | เปิดเว็บแล้วสุ่มได้ทันที จัดการรายชื่อง่าย | ใช้งานได้โดยไม่ต้องสมัครสมาชิก (Local mode), Import Excel ได้, สุ่มตัวเลขได้โดยไม่ต้องมีรายชื่อ |
| นักเรียน Gen Alpha | ความตื่นเต้น ภาพ เสียง การมีส่วนร่วม | Randomizer Studio 5 โหมด, เสียงสังเคราะห์, Confetti, Avatar |
| ห้องเรียนจริง | จอโปรเจกเตอร์ / Smart TV / แท็บเล็ต / เน็ตไม่เสถียร | Big Screen Mode, ฟอนต์และเสียงฝังในแอป (ไม่พึ่ง CDN), ระดับแอนิเมชัน Low/Medium/High |
| โรงเรียน | ข้อมูลนักเรียนเป็นข้อมูลส่วนบุคคล | Supabase Auth + RLS แยกโรงเรียน, Avatar แบบสร้างขึ้น (ไม่ใช้รูปถ่ายเด็ก) |

### 1.2 การตีความ Requirement ที่กำกวม

**กติกาการสุ่ม 8 แบบ** ถูกแยกเป็น 4 แกนที่ผสมกันได้ เพื่อให้ทุกกติกามีปุ่มควบคุมจริงและทดสอบได้

| กติกาใน Requirement | แกน | ความหมายในระบบ |
| --- | --- | --- |
| Normal Random | รูปแบบการจับ `single` | จับ 1 รายการจากกองสุ่ม |
| Multiple Random | รูปแบบการจับ `multiple` | จับ k รายการ (ไม่ซ้ำกันในครั้งเดียว) |
| Team Random | รูปแบบการจับ `team` | สับทั้งกองแล้วแบ่งทีมให้จำนวนสมดุล (ต่างกันไม่เกิน 1) |
| Number Random | แหล่งข้อมูล `numbers` | สุ่มจากช่วงตัวเลข (เช่น เลขที่ 1–40) ไม่ต้องมีรายชื่อ |
| No Repeat | นโยบายซ้ำ `no-repeat` | คนที่ถูกสุ่มแล้วไม่กลับเข้ากองจนกว่าจะ "เริ่มรอบใหม่" |
| Repeat Allowed | นโยบายซ้ำ `allow-repeat` | ทุกครั้งสุ่มจากทั้งกอง |
| Exclude Selected | การตัดออก (หลังสุ่ม) | ปุ่ม "ตัดชื่อออก" บนหน้าประกาศผล — ตัดผู้ถูกเลือกออกถาวรจนกว่าจะคืนสิทธิ์ |
| Manual Exclude | การตัดออก (ก่อนสุ่ม) | ครูแตะรายชื่อในแผง "ผู้เข้าร่วม" เพื่อตัด/คืน (เช่น นักเรียนขาดเรียน) |

- **"รอบ" (Round / Session)** = ช่วงการสุ่มต่อเนื่องของห้องเรียนหนึ่ง เริ่มเมื่อสุ่มครั้งแรก จบเมื่อกด "เริ่มรอบใหม่"
  หรือเปลี่ยนห้อง/แหล่งข้อมูล ประวัติจึงดูได้ทั้งรายครั้งและรายรอบ
- **Mystery Card** — สับไพ่ (Fisher-Yates) แล้วผูกชื่อกับการ์ดแต่ละใบ *ก่อน* คว่ำการ์ด ผลจึงขึ้นกับการ์ดที่นักเรียนเลือกจริง ไม่ใช่การบังคับผล
- **Mystery Slot** — 3 ช่อง: เลขที่ / ชื่อ / Avatar หยุดทีละช่อง (ในโหมดตัวเลข แต่ละช่องคือหลักของตัวเลข)
- **Special Features (ข้อ 8)** — "เตรียมโครงสร้าง" ตีความว่า data model และจุดต่อขยายต้องพร้อม
  และฟีเจอร์ใดที่ยังไม่เสร็จต้อง *ไม่มีปุ่ม* ให้กด (กฎข้อ 13)

### 1.3 ข้อจำกัดที่ไม่ใช่ฟังก์ชัน (NFR)

- **ความยุติธรรม**: ผลสุ่มมาจาก `crypto.getRandomValues()` + rejection sampling (ไม่มี modulo bias) เท่านั้น
- **ความถูกต้อง**: คำนวณผลก่อนเริ่ม Animation เสมอ, Animation เป็นเพียง "การเล่นซ้ำ" ผลที่คำนวณแล้ว
- **Performance**: 60fps บนคอมพิวเตอร์ทั่วไป — animate เฉพาะ `transform`/`opacity`, วาดวงล้อบน Canvas ครั้งเดียวแล้วหมุนด้วย GPU,
  หลีกเลี่ยง `backdrop-filter` บนพื้นที่ใหญ่ที่อยู่เหนือ Canvas เคลื่อนไหว
- **Accessibility**: ใช้ Radix primitives (focus trap, ARIA), รองรับคีย์บอร์ด/รีโมต, เคารพ `prefers-reduced-motion`, ประกาศผลผ่าน `aria-live`
- **Privacy**: ข้อมูลนักเรียนอยู่ในเบราว์เซอร์ (Local) หรือ Supabase ของโรงเรียน (Cloud) เท่านั้น ไม่มี analytics ภายนอก

---

## 2. Architecture Overview

```
┌──────────────────────────── UI Layer ────────────────────────────┐
│ pages/            หน้าระดับ route (ประกอบ feature เข้าด้วยกัน)        │
│ features/*/components   UI เฉพาะโมดูล                              │
│ components/ui     shadcn-style primitives (Radix + Tailwind)      │
│ components/common ส่วนประกอบใช้ซ้ำ (GlassCard, Avatar, EmptyState) │
└───────────────┬──────────────────────────────────────────────────┘
                │ hooks / selectors
┌───────────────▼────────── State Layer (Zustand) ─────────────────┐
│ stores/dataStore      ห้องเรียน + นักเรียน (cache + optimistic)     │
│ stores/historyStore   รอบการสุ่ม + ผลลัพธ์                           │
│ stores/settingsStore  ค่าตั้งค่า (persist → localStorage)            │
│ stores/studioStore    สถานะกองสุ่มต่อห้อง (persist)                  │
│ stores/authStore      session / โปรไฟล์ / โรงเรียน                   │
└───────────────┬──────────────────────────────────────────────────┘
                │ DataRepository (interface)
┌───────────────▼────────── Data Layer ────────────────────────────┐
│ data/local/LocalRepository       IndexedDB (ใช้ได้ทันที ออฟไลน์)     │
│ data/supabase/SupabaseRepository Supabase + RLS (หลายอุปกรณ์)       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────── Domain Layer (TypeScript ล้วน ไม่มี React) ────────┐
│ features/randomizer/engine   RNG, Fisher-Yates, กติกา, แผนการสุ่ม   │
│ features/students/lib        validation, import/export mapping    │
│ features/history/lib         filter, สถิติ, รายงาน                  │
│ lib/audio                    สังเคราะห์เสียง, WAV encoder           │
└──────────────────────────────────────────────────────────────────┘
```

หลักการ:

1. **Business logic ไม่รู้จัก UI** — โฟลเดอร์ `engine/` และ `lib/` ไม่ import React จึงทดสอบด้วย Vitest ได้ตรง ๆ
2. **UI ไม่รู้จักที่เก็บข้อมูล** — ทุกอย่างผ่าน `DataRepository` สลับ Local ↔ Cloud ได้โดยไม่แก้ UI
3. **Animation ไม่ตัดสินผล** — Stage component รับ "แผนการสุ่ม" (ผลที่คำนวณแล้ว) และมีหน้าที่แสดงให้ตรงเท่านั้น

### 2.1 โหมดการเก็บข้อมูล

| โหมด | เงื่อนไข | ที่เก็บ |
| --- | --- | --- |
| Local | ค่าเริ่มต้น / ไม่ได้ตั้ง `VITE_SUPABASE_URL` / เลือกใช้แบบไม่ล็อกอิน | IndexedDB ในเบราว์เซอร์นี้ |
| Cloud | ตั้งค่า Supabase และล็อกอินแล้ว | PostgreSQL + RLS |

---

## 3. Technology Stack

| ส่วน | เทคโนโลยี | หมายเหตุ |
| --- | --- | --- |
| Framework | React 19 + TypeScript 7 + Vite 8 | ตาม template ทางการปัจจุบัน |
| Styling | Tailwind CSS 4 + shadcn/ui pattern (Radix + CVA) | โทเคนสีตาม Palette ที่กำหนด |
| Icons | Lucide React | |
| Animation | GSAP (เวที/ไทม์ไลน์เกม), Framer Motion (ทรานซิชัน UI, layout) | |
| Audio | Web Audio API (สังเคราะห์เสียงเอง) → Howler.js (เล่น/ผสมเสียง) | ไม่มีไฟล์เสียงลิขสิทธิ์ |
| Data | Supabase (PostgreSQL, Auth, RLS) + IndexedDB | |
| Utilities | SheetJS (Excel/CSV), Recharts (กราฟ) | โหลดแบบ lazy |
| State | Zustand | เพิ่มจาก Requirement — เล็ก, ไม่มี boilerplate |
| Routing | React Router 8 | เพิ่มจาก Requirement |
| Lint/Test | oxlint, Vitest, Playwright | |
| Hosting | Vercel หรือ Cloudflare Pages | SPA fallback พร้อม |

ข้อเบี่ยงเบนที่ควรรู้:

- **SheetJS**: เวอร์ชันบน npm ทางการ (`xlsx@0.18.5`) มีช่องโหว่ที่ทราบแล้ว (Prototype Pollution, ReDoS)
  เวอร์ชันแก้ไข 0.20.3 เผยแพร่ผ่าน `cdn.sheetjs.com` เท่านั้น โปรเจกต์จึงอ้าง `xlsx` เป็น alias ไปยัง mirror บน npm
  (`@e965/xlsx@0.20.3`, มี provenance attestation) หากต้องการใช้ tarball ทางการ:
  `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` — โค้ดไม่ต้องแก้
- **shadcn/ui**: component ใน `src/components/ui` เขียนตามแพตเทิร์น shadcn (Radix + CVA + tailwind-merge) และมี `components.json`
  จึงใช้ `npx shadcn@latest add <component>` เพิ่มได้ภายหลัง
- **ฟอนต์ Prompt**: ใช้ Google Font "Prompt" ผ่านแพ็กเกจ `@fontsource/prompt` (ฝังในแอป ใช้ได้แม้ออฟไลน์)

---

## 4. Folder Structure

```
├─ docs/ARCHITECTURE.md
├─ e2e/                         Playwright end-to-end tests
├─ supabase/
│  ├─ migrations/               schema + RLS
│  └─ tests/                    ทดสอบ RLS ด้วย SQL
├─ public/                      favicon, _redirects (SPA fallback)
└─ src/
   ├─ main.tsx                  entry
   ├─ app/                      router, AppShell, providers, error boundary
   ├─ pages/                    Dashboard, Classrooms, ClassroomDetail, Studio, History, Settings, Auth
   ├─ components/
   │  ├─ ui/                    button, dialog, select, tabs, slider, ... (shadcn-style)
   │  ├─ common/                GlassCard, PageHeader, EmptyState, ConfirmDialog, StudentAvatar, ...
   │  └─ layout/                Dock (เมนู), ParticleBackground, Logo
   ├─ features/
   │  ├─ dashboard/             สถิติ, Quick Start, กราฟ
   │  ├─ classrooms/            ฟอร์ม/การ์ดห้องเรียน
   │  ├─ students/              ตาราง, ฟอร์ม, Avatar picker, Import/Export (lib + components)
   │  ├─ randomizer/
   │  │  ├─ engine/             ★ RNG, shuffle, rules, planner (pure TS + tests)
   │  │  ├─ stages/             wheel/ slot/ card/ countdown/ gacha/ team/
   │  │  ├─ components/         StudioStage, ModeSelector, ParticipantsPanel, RulesPanel, WinnerReveal
   │  │  └─ hooks/              useDrawController (state machine), useBigScreen
   │  ├─ history/               ตัวกรอง, ตาราง, รายงาน
   │  ├─ settings/              แท็บตั้งค่า 7 หมวด
   │  └─ auth/                  ล็อกอิน, สมัคร, onboarding โรงเรียน
   ├─ stores/                   Zustand stores
   ├─ data/
   │  ├─ types.ts               โดเมนโมเดล (ตรงกับตารางฐานข้อมูล)
   │  ├─ repository.ts          DataRepository interface
   │  ├─ local/                 IndexedDB wrapper + LocalRepository
   │  └─ supabase/              client, mappers, SupabaseRepository
   ├─ lib/
   │  ├─ audio/                 synth (Web Audio), wav, themes, SoundManager (Howler), music
   │  ├─ animation/             ระดับแอนิเมชัน, confetti engine
   │  └─ *.ts                   utils, id, date, validation, download
   ├─ styles/globals.css        Tailwind theme + design tokens
   └─ test/                     test setup
```

---

## 5. Data Model

ตารางตรงตาม Requirement ทั้ง 8 ตาราง ทุกตารางใช้ UUID เป็น Primary Key และมี `school_id` เพื่อแยกโรงเรียน

```
schools 1─┬─* users            (โปรไฟล์ผูกกับ auth.users, มี role: owner | admin | teacher)
          ├─* classrooms 1─* students
          ├─* random_sessions 1─* random_results
          ├─* random_settings   (1 แถวต่อผู้ใช้)
          └─* sound_settings    (1 แถวต่อผู้ใช้)
```

| ตาราง | คอลัมน์สำคัญ |
| --- | --- |
| `schools` | `name`, `join_code` (รหัสเชิญครูเข้าร่วมโรงเรียน) |
| `users` | `id → auth.users`, `school_id`, `display_name`, `role` |
| `classrooms` | `school_id`, `owner_id`, `name`, `grade_level`, `academic_year`, `color`, `is_demo` |
| `students` | `classroom_id`, `student_code`, `number`, `first_name`, `last_name`, `nickname`, `avatar` |
| `random_sessions` | `classroom_id`, `user_id`, `classroom_name` (snapshot), `source`, `rules` (jsonb), `started_at`, `ended_at` |
| `random_results` | `session_id`, `student_id` (null ได้), `display_name`/`student_number`/`avatar` (snapshot), `mode`, `draw_type`, `draw_index`, `pick_index`, `team_index`, `points`, `meta` |
| `random_settings` | `user_id` (unique), `general`, `appearance`, `animation`, `rules`, `display`, `features` (jsonb) |
| `sound_settings` | `user_id` (unique), `enabled`, `master_volume`, `music_volume`, `sfx_volume`, `theme`, `music_mode` |

- ผลการสุ่มเก็บ **snapshot** ของชื่อ/เลขที่/Avatar ประวัติจึงไม่หายเมื่อแก้หรือลบนักเรียน
- `is_demo` ใช้ติดป้าย "ข้อมูลตัวอย่าง" ให้ชัดเจน (กฎข้อ 12)

### 5.1 สิทธิ์การเข้าถึง (RLS)

| ข้อมูล | อ่าน | เขียน |
| --- | --- | --- |
| `schools` | สมาชิกของโรงเรียน | owner/admin |
| `users` | ตนเอง + สมาชิกโรงเรียนเดียวกัน | ตนเอง (เฉพาะชื่อที่แสดง) — role/school เปลี่ยนผ่าน RPC เท่านั้น |
| `classrooms`, `students` | เจ้าของห้อง + admin ของโรงเรียน | เจ้าของห้อง + admin ของโรงเรียน |
| `random_sessions`, `random_results` | ผู้สุ่ม + admin ของโรงเรียน | ผู้สุ่ม |
| `random_settings`, `sound_settings` | ตนเอง | ตนเอง |

ทุก policy ตรวจ `school_id` ตรงกับโรงเรียนของผู้ใช้ จึงข้ามโรงเรียนไม่ได้แม้รู้ UUID

---

## 6. Random Engine

```
candidates ──► getEligible(pool, rules) ──► planDraw(request) ──► DrawPlan ──► Stage Animation ──► commit
                 ตัดออก / ไม่ซ้ำ              crypto RNG            ผลลัพธ์จริง       แสดงผลตาม plan     บันทึกประวัติ
```

- `rng.ts` — `cryptoRng.nextInt(n)` ใช้ `crypto.getRandomValues(Uint32Array)` + rejection sampling
- `shuffle.ts` — `shuffle()` (Fisher-Yates เต็ม), `sample(k)` (partial Fisher-Yates สำหรับสุ่มไม่ซ้ำ)
- `engine.ts` — `getEligible()`, `planDraw()`, `dealCards()`, `makeTeams()`
- ทุกฟังก์ชันรับ `Rng` เป็นพารามิเตอร์ → เทสต์ใช้ seeded RNG ตรวจผลแบบ deterministic ได้
- Engine คืนค่าเป็น `{ ok: true, plan }` หรือ `{ ok: false, error }` (`empty-pool`, `round-complete`, …) UI ไม่ต้องเดา

### 6.1 Draw Pipeline (state machine)

```
idle ─► ready ─► running ─► suspense ─► reveal ─► idle
          ▲         │           (หลายคน: วนกลับ running)      └► summary (หลายคน/ทีม)
          └─ ล็อก: ระหว่าง ≠ idle ปุ่มสุ่ม/คีย์ลัด/เปลี่ยนโหมดถูกปิดทั้งหมด
```

ตรงกับ Winner Reveal 10 ขั้นใน Requirement: (1) เริ่ม → (2) READY → (3–5) `running` เร็วแล้วชะลอ →
(6) `suspense` → (7–9) `reveal` ชื่อ + Avatar + Confetti + เสียง → (10) ปุ่ม Next Round

---

## 7. Sound Architecture

```
SoundTheme (สูตรสังเคราะห์) ─► OfflineAudioContext ─► AudioBuffer ─► WAV ─► Howl (cache) ─► Howler master
MusicEngine (step sequencer บน Web Audio แบบสด) ───────────────────────────────────────► Howler master
```

- เสียงทั้ง 10 เหตุการณ์ (click, hover, spin, tick, suspense, countdown, reveal, winner, confetti, error) สังเคราะห์เองทั้งหมด
- 3 ธีม: Neon (ซินธ์), Arcade (8-bit), Soft (นุ่ม เหมาะห้องเรียน)
- **Audio Policy**: ไม่สร้าง AudioContext จนกว่าจะมี interaction ครั้งแรก (`pointerdown`/`keydown`)
- ระดับเสียง 3 ชั้น: Master × (Music | SFX)

## 8. Animation & Performance

| ระดับ | พื้นหลัง | เวที | Confetti | Glass blur |
| --- | --- | --- | --- | --- |
| Low | ไล่สีนิ่ง | สั้น ไม่มี glow เคลื่อนไหว | ไม่มี | ปิด |
| Medium (ค่าเริ่มต้น) | อนุภาคเบาบาง | เต็มรูปแบบ | ปานกลาง | เฉพาะ overlay |
| High | อนุภาค + เส้นเชื่อม | เต็ม + screen shake + ลำแสง | เต็ม | เฉพาะ overlay |

`prefers-reduced-motion` → เริ่มที่ Low โดยอัตโนมัติ

## 9. Testing Strategy

| ระดับ | เครื่องมือ | ครอบคลุม |
| --- | --- | --- |
| Unit | Vitest | random engine (ความสม่ำเสมอ, ไม่ซ้ำ, กติกา), validation, import/export, repository (fake-indexeddb), WAV encoder |
| Database | psql + สคริปต์ SQL | migration ใช้ได้จริง, RLS กันข้ามโรงเรียน |
| E2E | Playwright (desktop + mobile) | CRUD ห้อง/นักเรียน, import, สุ่มทั้ง 5 โหมด, ไม่ซ้ำจนครบรอบ, ประวัติ, ตั้งค่า |

## 10. Roadmap

| Phase | ส่งมอบ | เกณฑ์ผ่าน |
| --- | --- | --- |
| 1 UI Foundation | โครงโปรเจกต์, design tokens, UI primitives, AppShell, routing | typecheck + lint + build ผ่าน, ทุก route แสดงผล desktop/mobile |
| 2 Student Management | data layer, CRUD, ค้นหา, Avatar, Import/Export | unit + e2e ผ่าน, ข้อมูลคงอยู่หลัง reload |
| 3 Randomizer Engine | engine + tests, Studio 5 โหมด, ประวัติ, Dashboard | ผล animation ตรงกับ plan, กดซ้ำไม่ได้, แจ้งเตือนเมื่อครบรอบ |
| 4 Sound & Animation | เสียง 10 เหตุการณ์ × 3 ธีม, Winner Reveal, Confetti, ระดับแอนิเมชัน, Big Screen, Settings | ไม่มี AudioContext ก่อน interaction, ทุกตัวเลือกใน Settings มีผลจริง |
| 5 Database & Auth | schema + RLS, Supabase repository, Auth, onboarding | RLS test ผ่าน, Local mode ยังทำงานเมื่อไม่ตั้งค่า Supabase |
| 6 Advanced Features | Group Maker, Team Battle, Challenge, Reward, Streak, Ranking | ไม่มีปุ่มที่กดแล้วไม่ทำงาน |
| 7 Testing & Deployment | e2e ครบ, a11y/performance pass, config deploy, README | `npm run check` + e2e ผ่านทั้งหมด |
