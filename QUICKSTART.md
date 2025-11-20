# Quick Start Guide

## การติดตั้งและรันโปรเจค

### 1. ติดตั้ง Backend (C#)

**ตรวจสอบ .NET SDK:**
```bash
dotnet --version
```
ต้องเป็น 8.0 หรือสูงกว่า

**Restore และรัน:**
```bash
cd backend/AdjustLog.Api
dotnet restore
dotnet run
```

Backend จะรันที่ `http://localhost:5000`

**หรือใช้ Visual Studio:**
1. เปิด `backend/AdjustLog.Api/AdjustLog.Api.csproj`
2. กด F5 เพื่อรัน

### 2. ติดตั้ง Frontend (React + Vite)

**ตรวจสอบ Node.js:**
```bash
node --version
npm --version
```

**ติดตั้ง dependencies:**
```bash
cd frontend
npm install
```

**รัน development server:**
```bash
npm run dev
```

Frontend จะเปิดที่ `http://localhost:5173` อัตโนมัติ

### 3. การใช้งาน

1. **Upload ไฟล์ LAS**: 
   - Click ที่ "Upload LAS File" area
   - เลือกไฟล์ `LAS/SC113C.las`

2. **Upload ไฟล์ Excel**:
   - Click ที่ "Upload Excel File" area
   - เลือกไฟล์ `Excel/DAT2023 SC113C No Quality.xlsx`

3. **ดูกราฟ**:
   - หลังจาก upload ทั้งสองไฟล์ ระบบจะแสดงกราฟอัตโนมัติ
   - Track 1: Gamma Ray curve
   - Track 2: Bore/Density curve
   - Track 3: Lithology blocks

4. **ปรับ Lithology Boundaries**:
   - Click ที่ขอบบนหรือขอบล่างของ lithology block (10% ของความสูง)
   - ลากเมาส์ขึ้น/ลงเพื่อปรับ depth
   - ปล่อยเมาส์เมื่อได้ตำแหน่งที่ต้องการ

5. **Save Project**:
   - Click "Save Project" เพื่อบันทึกงาน
   - ข้อมูลจะถูกเก็บไว้ใน `backend/AdjustLog.Api/Projects/`

6. **Load Project**:
   - Click "Load Project" เพื่อเปิด project ที่บันทึกไว้
   - เลือก project จาก list

7. **Export**:
   - Click "Export Excel" หรือ "Export CSV" เพื่อ export ข้อมูลที่ปรับแล้ว

## Troubleshooting

### Backend ไม่รัน
- ตรวจสอบว่า .NET 8.0 SDK ติดตั้งแล้ว
- ตรวจสอบว่า port 5000 ไม่ถูกใช้งาน
- ตรวจสอบว่าไฟล์ `.csproj` มี dependencies ครบ

### Frontend ไม่เชื่อมต่อกับ Backend
- ตรวจสอบว่า backend รันอยู่ที่ port 5000
- ตรวจสอบไฟล์ `vite.config.js` proxy settings
- ตรวจสอบ browser console สำหรับ CORS errors

### ไฟล์ upload ไม่ได้
- ตรวจสอบว่าไฟล์มีขนาดไม่เกิน 50MB
- ตรวจสอบว่าไฟล์ LAS และ Excel มี format ถูกต้อง
- ตรวจสอบ backend logs สำหรับ error messages

### กราฟไม่แสดง
- ตรวจสอบ console ใน browser (F12) สำหรับ error messages
- ตรวจสอบว่า data ถูก parse ถูกต้อง (ดู Network tab)
- ตรวจสอบว่า Plotly.js โหลดสำเร็จ

### EPPlus License Error
- EPPlus ใช้ในโหมด NonCommercial
- สำหรับ commercial use ต้องซื้อ license

## ตัวอย่างข้อมูล

โปรเจคนี้มีตัวอย่างข้อมูล:
- `LAS/SC113C.las` - ตัวอย่าง LAS file
- `Excel/DAT2023 SC113C No Quality.xlsx` - ตัวอย่าง Excel file

ใช้ไฟล์เหล่านี้เพื่อทดสอบระบบ

## Development Tips

### Backend Hot Reload
```bash
cd backend/AdjustLog.Api
dotnet watch run
```
จะ auto-reload เมื่อมีการแก้ไขไฟล์ .cs

### Frontend Hot Module Replacement
Vite จะ auto-reload เมื่อมีการแก้ไขไฟล์ .jsx/.js

### Debugging
- **Backend**: ใช้ Visual Studio debugger หรือ `dotnet run` แล้ว attach debugger
- **Frontend**: ใช้ browser DevTools (F12)

## Build for Production

### Backend
```bash
cd backend/AdjustLog.Api
dotnet publish -c Release -o ./publish
```

### Frontend
```bash
cd frontend
npm run build
```
Output จะอยู่ใน `frontend/dist/`
