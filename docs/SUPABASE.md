# เชื่อมต่อ Supabase (บัญชีครูและซิงก์ข้อมูลขึ้นคลาวด์)

การเชื่อมต่อ Supabase เป็น **ตัวเลือกเสริม** — หากไม่ตั้งค่า แอปทำงานครบทุกฟีเจอร์ในโหมด Local
(ข้อมูลเก็บใน IndexedDB ของเบราว์เซอร์) เมื่อตั้งค่าแล้ว ครูจะสมัครบัญชี สร้าง/เข้าร่วมโรงเรียน
และเก็บห้องเรียน รายชื่อ ประวัติการสุ่ม และการตั้งค่าไว้บนคลาวด์ โดยข้อมูลแต่ละโรงเรียนแยกจากกันด้วย Row Level Security

| สถานะ | ข้อมูลอยู่ที่ |
| --- | --- |
| ไม่ได้ตั้งค่า Supabase / ยังไม่เข้าสู่ระบบ | เบราว์เซอร์เครื่องนี้ (Local) |
| เข้าสู่ระบบแล้ว แต่ยังไม่มีโรงเรียน | เบราว์เซอร์เครื่องนี้ จนกว่าจะสร้างหรือเข้าร่วมโรงเรียน |
| เข้าสู่ระบบและอยู่ในโรงเรียนแล้ว | Supabase (ซิงก์ทุกเครื่องที่เข้าสู่ระบบ) |

ครูที่เคยใช้งานแบบ Local มาก่อน ย้ายข้อมูลขึ้นคลาวด์ได้ที่ **ตั้งค่า → Account → อัปโหลดข้อมูลในเครื่อง**

## 1. สร้างโปรเจกต์

สร้างโปรเจกต์ใหม่ที่ [Supabase Dashboard](https://supabase.com/dashboard) (แนะนำ region ใกล้ผู้ใช้ เช่น Singapore)

## 2. สร้างตาราง ฟังก์ชัน และ RLS

migration ทั้งหมดอยู่ใน `supabase/migrations/` เลือกวิธีใดวิธีหนึ่ง

**SQL Editor** — คัดลอกเนื้อหาไฟล์ `supabase/migrations/20261111061703_initial_schema.sql` ไปวางใน
Dashboard → SQL Editor แล้วกด Run

**Supabase CLI**

```bash
supabase link --project-ref <project-ref>
```

```bash
supabase db push
```

สิ่งที่ migration สร้าง

- ตาราง `schools`, `users`, `classrooms`, `students`, `random_sessions`, `random_results`, `random_settings`, `sound_settings` (UUID primary key ทุกตาราง)
- เปิด RLS ทุกตาราง และ grant แบบ least-privilege — role `anon` ไม่มีสิทธิ์ใด ๆ
- trigger สร้างแถวใน `public.users` อัตโนมัติเมื่อมีผู้สมัคร
- ฟังก์ชันที่แอปเรียกผ่าน `supabase.rpc`: `create_school`, `join_school`, `get_join_code`, `regenerate_join_code`,
  `set_member_role`, `replace_classroom_students`

## 3. ตั้งค่า Authentication

Dashboard → Authentication

- **Sign In / Providers → Email**: เปิดใช้งาน (แนะนำให้เปิด *Confirm email*)
- **URL Configuration**
  - Site URL: โดเมนที่ deploy เช่น `https://randomizer.example.com`
  - Redirect URLs: เพิ่ม `https://randomizer.example.com/login` และ `https://randomizer.example.com/reset-password`
    (ระหว่างพัฒนาเพิ่ม `http://localhost:5173/**`)

## 4. ใส่ค่าให้แอป

Dashboard → Project → Connect (หรือ Settings → API Keys) คัดลอก Project URL และ **Publishable key** (`sb_publishable_…`)

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

บน Vercel / Cloudflare Pages ให้ตั้งตัวแปรเดียวกันใน Environment Variables ของโปรเจกต์แล้ว build ใหม่

> **ห้าม** ใช้ secret key หรือ `service_role` key ในแอปนี้ ตัวแปร `VITE_*` ทุกตัวถูกส่งไปถึงเบราว์เซอร์

## สิทธิ์การเข้าถึง

| ข้อมูล | อ่าน | เขียน |
| --- | --- | --- |
| โรงเรียน | สมาชิกของโรงเรียน | เจ้าของ/ผู้ดูแล (เปลี่ยนชื่อ) |
| รหัสเข้าร่วม | เจ้าของ/ผู้ดูแล ผ่าน `get_join_code()` เท่านั้น | เจ้าของ/ผู้ดูแล (`regenerate_join_code()`) |
| โปรไฟล์ครู | ตนเอง + สมาชิกโรงเรียนเดียวกัน | ตนเอง (เฉพาะชื่อที่แสดง) — บทบาทเปลี่ยนได้โดยเจ้าของผ่าน `set_member_role()` |
| ห้องเรียน / นักเรียน | ครูเจ้าของห้อง + เจ้าของ/ผู้ดูแลโรงเรียน | เช่นเดียวกัน |
| รอบการสุ่ม / ผลการสุ่ม | ครูผู้สุ่ม + เจ้าของ/ผู้ดูแลโรงเรียน | ครูผู้สุ่ม |
| การตั้งค่า | เจ้าของบัญชีเท่านั้น | เจ้าของบัญชีเท่านั้น |

- ทุก policy ตรวจโรงเรียนของผู้ร้องขอ จึงอ่านหรือแก้ข้อมูลข้ามโรงเรียนไม่ได้ แม้รู้ UUID
- คอลัมน์แสดงความเป็นเจ้าของ (`school_id`, `owner_id`, `user_id`, `classroom_id`, `session_id`) เปลี่ยนผ่าน API ไม่ได้ (trigger)
- รหัสเข้าร่วม 8 ตัวอักษร สุ่มด้วย `gen_random_bytes` จากชุดอักษรที่ไม่มีตัวที่สับสน (0/O, 1/I/L)

## ทดสอบ RLS บนเครื่อง

ชุดทดสอบใน `supabase/tests/` จำลองส่วนของ Supabase ที่จำเป็น (roles, `auth.users`, `auth.uid()`)
แล้วรัน migration และตรวจสิทธิ์ 95 กรณี (ข้ามโรงเรียน, บทบาท, anon, การแก้ความเป็นเจ้าของ ฯลฯ)
ต้องมี PostgreSQL 15+ และผู้ใช้ที่สร้าง database/role ได้ โดยเชื่อมต่อผ่านตัวแปร libpq (`PGHOST`, `PGUSER`, `PGPASSWORD`)

```bash
npm run test:db
```

> อย่ารันบน server ที่มี role ของ Supabase อยู่แล้ว (สคริปต์จะหยุดเองหากพบ role `authenticated`)

## หมายเหตุสำหรับนักพัฒนา

- `src/data/supabase/database.types.ts` เขียนตามรูปแบบที่ `supabase gen types typescript` สร้าง
  หากแก้ schema ให้ปรับไฟล์นี้ด้วย (ไฟล์นี้ export type alias ของแถว เช่น `ClassroomRow` ที่โค้ดส่วนอื่นใช้อยู่)
- supabase-js ถูกโหลดเฉพาะเมื่อมีการตั้งค่า Supabase build ที่ไม่ได้ตั้งค่าจะไม่มีโค้ดส่วนนี้เลย
- e2e ของโหมดคลาวด์ (`e2e/cloud.spec.ts`) ทำงานกับ Supabase จำลองใน `e2e/fakeSupabase.ts`
