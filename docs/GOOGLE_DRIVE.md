# บันทึกข้อมูลลง Google Drive

เมื่อเปิดใช้ ครูกด **ตั้งค่า → Data Management → เชื่อมต่อ Google Drive** แล้วแอปจะบันทึกห้องเรียน รายชื่อนักเรียน
ประวัติการสุ่ม ดาว และการตั้งค่า เป็นไฟล์ `NEXT-GEN Student Randomizer - ข้อมูล.json` ใน Google Drive ของครูเองโดยอัตโนมัติ
(ประมาณ 2 วินาทีหลังแก้ไข) เปิดแอปจากเครื่องไหนแล้วเชื่อมต่อบัญชีเดียวกัน ก็ได้ข้อมูลชุดเดิม

- ข้อมูลอยู่ใน Drive ของครูแต่ละคน ไม่มีเซิร์ฟเวอร์กลาง และไม่มีค่าใช้จ่าย
- แอปขอสิทธิ์ `drive.file` เท่านั้น: เข้าถึงได้เฉพาะไฟล์ที่แอปสร้าง ไม่เห็นไฟล์อื่นใน Drive
- ไฟล์ใช้รูปแบบเดียวกับไฟล์สำรองข้อมูล จึงดาวน์โหลดจาก Drive แล้วกู้คืนเองได้เสมอ
- ถ้าข้อมูลถูกแก้ทั้งในเครื่องนี้และจากเครื่องอื่น แอปจะถามก่อนว่าจะใช้ชุดไหน ไม่เขียนทับเอง
- Google ให้สิทธิ์ครั้งละไม่เกิน 1 ชั่วโมง และเมื่อเปิดแอปใหม่ต้องกดเชื่อมต่ออีกครั้ง (ปุ่มรูปเมฆในเมนู)
  ระหว่างนั้นแอปใช้งานได้ตามปกติ และการเปลี่ยนแปลงจะถูกบันทึกลง Drive เมื่อเชื่อมต่อแล้ว

## ตั้งค่าครั้งแรก (ผู้ดูแลระบบ ทำครั้งเดียว)

### 1. สร้างโปรเจกต์และเปิด Drive API

1. เข้า [Google Cloud Console](https://console.cloud.google.com/) → สร้างโปรเจกต์ใหม่ (เช่น `name-random`)
2. **APIs & Services → Library** → ค้นหา **Google Drive API** → **Enable**

### 2. หน้าขอความยินยอม (OAuth consent screen / Google Auth Platform)

1. **APIs & Services → OAuth consent screen** (หรือ **Google Auth Platform → Branding**)
2. User type: **External** (บัญชีโรงเรียนใน Google Workspace เลือก **Internal** ได้)
3. ใส่ชื่อแอป เช่น `NEXT-GEN Student Randomizer` และอีเมลติดต่อ
4. **Data access / Scopes** → Add scope → `https://www.googleapis.com/auth/drive.file`
5. **Audience**: ระหว่างทดลอง เพิ่มอีเมลครูใน **Test users** หรือกด **Publish app** เพื่อให้ทุกบัญชีใช้ได้
   (`drive.file` เป็น scope ที่ไม่ต้องให้ Google ตรวจสอบแอป)

### 3. สร้าง OAuth Client ID

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**
2. Application type: **Web application**
3. **Authorized JavaScript origins** ใส่โดเมนของเว็บ (ไม่ต้องมี path):
   - `https://openfilevichakarn-cloud.github.io`
   - `http://localhost:5173` (ถ้าพัฒนาบนเครื่อง)
4. Authorized redirect URIs ไม่ต้องใส่
5. คัดลอก **Client ID** (ลงท้ายด้วย `.apps.googleusercontent.com`) — ค่านี้เปิดเผยได้ ไม่ใช่รหัสลับ
   (ห้ามใส่ Client secret ในแอป)

### 4. ใส่ค่าให้แอป

**GitHub Pages** — repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**

- Name: `VITE_GOOGLE_CLIENT_ID`
- Value: Client ID จากขั้นที่ 3

แล้วไปที่แท็บ **Actions → Deploy to GitHub Pages → Run workflow**

**Vercel / Cloudflare Pages** — เพิ่ม Environment Variable ชื่อเดียวกันแล้ว deploy ใหม่

**บนเครื่อง** — ใส่ใน `.env.local`

```dotenv
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

ถ้าไม่ได้ตั้งค่านี้ ส่วน Google Drive จะไม่แสดงในแอป และแอปทำงานแบบเก็บข้อมูลในเบราว์เซอร์ตามเดิม

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| หน้าต่าง Google ขึ้น `Error 400: redirect_uri_mismatch` หรือ `origin_mismatch` | ยังไม่ได้ใส่โดเมนของเว็บใน Authorized JavaScript origins (ขั้นที่ 3) หรือใส่มี `/name-random` ต่อท้าย — ใส่แค่ `https://openfilevichakarn-cloud.github.io` |
| `Error 403: access_denied` / แอปยังไม่ผ่านการตรวจสอบ | บัญชีนั้นยังไม่อยู่ใน Test users — เพิ่มอีเมล หรือ Publish app (ขั้นที่ 2) |
| กดเชื่อมต่อแล้วไม่มีอะไรเกิดขึ้น | เบราว์เซอร์บล็อกป๊อปอัป — อนุญาตป๊อปอัปสำหรับเว็บนี้ |
| ข้อความ "Google Drive ไม่อนุญาตให้เข้าถึงไฟล์นี้" | ยังไม่ได้ Enable Google Drive API (ขั้นที่ 1) |
| ไม่เห็นส่วน Google Drive ในตั้งค่า | ยังไม่ได้ตั้ง `VITE_GOOGLE_CLIENT_ID` หรือยังไม่ได้ build/deploy ใหม่หลังตั้งค่า |
