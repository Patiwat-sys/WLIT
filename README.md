# Interactive Well Log Interpretation Tool

เครื่องมือสำหรับตีความและปรับแต่งข้อมูล Well Log แบบ Interactive ที่ช่วยให้ผู้ใช้สามารถลากปรับ Top/Bottom ของ Lithology intervals ให้ตรงกับ Geophysical log curves

## ฟีเจอร์หลัก

- ✅ อ่านไฟล์ LAS (Geophysical log) - Gamma Ray, Density, และ curves อื่นๆ
- ✅ อ่านไฟล์ Excel (Lithology log) - แยกชนิดดิน/ถ่านตาม depth
- ✅ แสดงกราฟ Geophysical log + Lithology log คู่กัน
- ✅ **ลากปรับ Top/Bottom** ของแต่ละ lithology interval ด้วยเมาส์
- ✅ Save งานเป็น JSON เก็บในระบบ
- ✅ Load project ที่บันทึกไว้
- ✅ Export เป็น Excel หรือ CSV

## โครงสร้างโปรเจค

```
AdjustLog/
├── backend/
│   └── AdjustLog.Api/     # C# ASP.NET Core API
│       ├── Controllers/   # API controllers
│       ├── Services/      # LAS & Excel parsers
│       ├── Models/        # Data models
│       └── AdjustLog.Api.csproj
│
├── frontend/              # React + Vite (.jsx)
│   ├── src/
│   │   ├── components/    # React components
│   │   └── services/      # API client
│   ├── package.json
│   └── vite.config.js
│
├── LAS/                  # ตัวอย่างไฟล์ LAS
├── Excel/                # ตัวอย่างไฟล์ Excel
└── README.md
```

## ความต้องการของระบบ

### Backend
- .NET 8.0 SDK หรือสูงกว่า
- Visual Studio 2022 หรือ VS Code (แนะนำ)

### Frontend
- Node.js 18+ และ npm
- Modern browser (Chrome, Firefox, Edge)

## การติดตั้ง

### Backend (C# ASP.NET Core)

```bash
cd backend/AdjustLog.Api
dotnet restore
dotnet run
```

Backend จะรันที่ `http://localhost:5000`

หรือใช้ Visual Studio:
1. เปิด `AdjustLog.Api.csproj`
2. กด F5 เพื่อรัน

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend จะรันที่ `http://localhost:5173` (หรือ port อื่นที่ Vite เลือก)

## การใช้งาน

### 1. Upload ไฟล์

1. **Upload LAS File**: เลือกไฟล์ `.las` ที่มีข้อมูล geophysical log
2. **Upload Excel File**: เลือกไฟล์ `.xlsx` ที่มีข้อมูล lithology log

ระบบจะ parse ไฟล์ทั้งสองและรวมข้อมูลเข้าด้วยกัน

### 2. แสดงกราฟ

หลังจาก upload ไฟล์แล้ว จะเห็น:
- **Track 1**: Gamma Ray (NATU) curve
- **Track 2**: Bore/Density curve
- **Track 3**: Lithology blocks (สีตามชนิด)

### 3. ปรับ Lithology Boundaries

1. **Click ที่ขอบบนหรือขอบล่าง** ของ lithology block
2. **ลากเมาส์ขึ้น/ลง** เพื่อปรับ depth
3. ระบบจะอัพเดทค่า Top/Bottom แบบ real-time

**Tips:**
- Click ที่ขอบบน/ล่าง (10% ของความสูง block) เพื่อเริ่ม drag
- ระบบจะป้องกันไม่ให้ Top > Bottom
- Depth จะถูกจำกัดอยู่ในช่วงของ well

### 4. Save Project

- Click **"Save Project"** เพื่อบันทึกงานเป็น JSON
- ข้อมูลจะถูกเก็บไว้ใน backend (`backend/AdjustLog.Api/Projects/`)

### 5. Load Project

- Click **"Load Project"** เพื่อเปิด project ที่บันทึกไว้
- เลือก project จาก list และ click "Load"

### 6. Export

- **Export Excel**: Export ข้อมูลที่ปรับแล้วเป็นไฟล์ `.xlsx`
- **Export CSV**: Export ข้อมูลที่ปรับแล้วเป็นไฟล์ `.csv`

## API Endpoints

### Upload
- `POST /api/upload/las` - Upload และ parse LAS file
- `POST /api/upload/excel` - Upload และ parse Excel file
- `POST /api/upload/combine` - รวม LAS และ Excel data

### Projects
- `POST /api/projects/save` - Save project
- `GET /api/projects/{projectId}` - Load project
- `GET /api/projects` - List all projects
- `DELETE /api/projects/{projectId}` - Delete project

### Export
- `POST /api/export/excel` - Export to Excel
- `POST /api/export/csv` - Export to CSV

## ข้อมูลที่ใช้

### LAS File Format
- ต้องเป็น CWLS LAS 2.0 format
- Curves ที่รองรับ: DEPT, NATU, LONG, HIGH, BORE
- NULL value: -99999

### Excel File Format
- ใช้ columns: 1-20, 22, 28-30
- Column B: From (Top depth)
- Column C: To (Bottom depth)
- Column F: Lithology type
- Row 3: Metadata (Easting, Northing, Elevation, etc.)

## เทคโนโลยีที่ใช้

### Backend
- **C# ASP.NET Core 8.0**
- **EPPlus** - สำหรับอ่าน/เขียน Excel files
- Custom LAS parser

### Frontend
- **React 18** (JavaScript/JSX)
- **Vite** - Build tool และ dev server
- **Plotly.js** - Visualization
- **Axios** - API client
- **react-dropzone** - File upload

## Development

### Backend Development
```bash
cd backend/AdjustLog.Api
dotnet watch run  # Auto-reload on changes
```

### Frontend Development
```bash
cd frontend
npm run dev  # Vite dev server with HMR
```

### Build for Production

**Backend:**
```bash
cd backend/AdjustLog.Api
dotnet publish -c Release
```

**Frontend:**
```bash
cd frontend
npm run build
```

Output จะอยู่ใน `frontend/dist/`

## ข้อจำกัดและข้อควรระวัง

1. **LAS Parser**: รองรับเฉพาะ CWLS LAS 2.0 format
2. **Excel Parser**: ต้องมี header row และ data เริ่มจาก row 4
3. **File Size**: จำกัดที่ 50MB ต่อไฟล์ (สามารถปรับได้ใน Program.cs)
4. **Browser**: ต้องรองรับ ES6+ และ Canvas API
5. **EPPlus License**: ใช้ในโหมด NonCommercial (สำหรับ commercial ต้องซื้อ license)

## Troubleshooting

### Backend ไม่รัน
- ตรวจสอบว่า .NET 8.0 SDK ติดตั้งแล้ว (`dotnet --version`)
- ตรวจสอบว่า port 5000 ไม่ถูกใช้งาน

### Frontend ไม่เชื่อมต่อกับ Backend
- ตรวจสอบว่า backend รันอยู่ที่ port 5000
- ตรวจสอบไฟล์ `vite.config.js` proxy settings

### CORS Error
- ตรวจสอบว่า CORS policy ใน `Program.cs` ตั้งค่าถูกต้อง

## License

MIT

## Author

Created for Well Log Interpretation and Adjustment
