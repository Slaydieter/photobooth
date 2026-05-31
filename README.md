# 📸 PhotoBooth App

Hệ thống photobooth chạy local với Electron + Node.js + MongoDB.

---

## Cấu trúc project

```
photobooth/
├── electron/          ← Kiosk app (Electron fullscreen)
├── server/            ← Backend API (Express + MongoDB)
├── kiosk/             ← Kiosk UI (Vite + Vanilla JS)
├── dashboard/         ← Dashboard quản lý (plain HTML)
└── assets/            ← Ảnh upload, output, stickers...
```

---

## Yêu cầu

- **Node.js** >= 18
- **MongoDB** đang chạy local (port 27017)
- **npm** >= 9

---

## Cài đặt

### 1. Cài MongoDB (nếu chưa có)

**Windows:** https://www.mongodb.com/try/download/community  
**Mac:** `brew install mongodb-community && brew services start mongodb-community`  
**Ubuntu:** `sudo apt install mongodb && sudo systemctl start mongodb`

### 2. Cài dependencies

```bash
# Server
cd server && npm install

# Kiosk UI
cd ../kiosk && npm install

# Electron
cd ../electron && npm install
```

---

## Chạy development

### Terminal 1 — Server (API + serve dashboard)
```bash
cd server
npm run dev
# → http://localhost:3001
```

### Terminal 2 — Kiosk UI (hot reload)
```bash
cd kiosk
npm run dev
# → http://localhost:5173
```

### Terminal 3 — Electron (kiosk fullscreen)
```bash
cd electron
npm run dev
# → Mở cửa sổ fullscreen
```

### Dashboard
Mở trình duyệt: **http://localhost:3001**  
(Hoặc từ màn hình khác trên cùng mạng LAN: `http://<IP_MÁY>:3001`)

---

## Cấu hình

Tất cả cấu hình trong file `server/.env`:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/photobooth
```

Cài đặt app (tên, ngân hàng, timer...) quản lý qua **Dashboard → Cài đặt**.

---

## Luồng hoạt động

```
Idle → Chọn Category → Chọn Theme → Số lượng tấm
     → Thanh toán QR → Chọn sticker → Chụp (countdown 10s/lần)
     → Xem lại (retake 1 lần) → Sắp xếp ảnh → Cảm ơn → Idle
```

---

## Thay thế phần cứng thật

### Canon R100 (thay webcam)
1. Cài **gphoto2**: `sudo apt install gphoto2` (Linux) hoặc `brew install gphoto2` (Mac)
2. Trong `server/api/routes/sessions.js`, thay đoạn lưu base64 bằng lệnh gphoto2:
   ```bash
   gphoto2 --capture-image-and-download --filename=output.jpg
   ```

### DNP DS-RX1HS (thay lưu file)
1. Cài driver CUPS của DNP
2. Trong `server/api/routes/sessions.js` route `/output`, dùng `lp` hoặc `node-printer` để in:
   ```bash
   lp -d DNP_DS-RX1HS -o media=4x6 output.jpg
   ```

---

## Assets cần chuẩn bị

```
assets/
├── backgrounds/
│   └── default.jpg        ← Ảnh nền màn hình chờ (khuyên: 1920×1080)
├── stickers/              ← PNG trong suốt (khuyên: 512×512)
│   ├── hat_birthday.png
│   ├── hat_cowboy.png
│   ├── smile.png
│   ├── heart.png
│   ├── glasses.png
│   ├── mustache.png
│   └── crown.png
└── themes/                ← Upload qua Dashboard
    ← Template mặt trước: PNG 4×6" (1200×1800px hoặc 800×1200px)
    ← Template mặt sau:   PNG cùng kích thước
```
