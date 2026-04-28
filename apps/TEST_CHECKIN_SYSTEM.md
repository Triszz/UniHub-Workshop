# 📋 Hướng Dẫn Test Hệ Thống QR Check-in

## ✅ Đã Fix
- **Fix lỗi Prisma**: Regenerate Prisma client → API server hoạt động ✅
- **API server**: Chạy thành công trên port 3000 ✅

---

## 🧪 Test Checklist

### **PHASE 1: Server-side QR Generation**

#### Test 1: Generate QR code khi register
```bash
# Bước 1: Đăng nhập web (Organizer)
# Bước 2: Tạo workshop
# Bước 3: Sinh viên register → QR code được generate

# Kiểm tra:
- [ ] QR code là JWT với algorithm RS256
- [ ] JWT chứa: sub (registrationId), workshopId, userId, type: "workshop_qr"
- [ ] exp = workshopStartsAt + 2 giờ
```

#### Test 2: Verify QR signature trên server
```bash
# Command test
npm run dev

# Output mong đợi:
API Server running on http://localhost:3000
```

---

### **PHASE 2: Mobile - Local QR Verification**

#### Test 3: Verify JWT signature offline
```bash
# File: test-qr.ts (đã tạo)
# Output:
# ✅ Generated QR Code
# ✅ QR Verification Successful
# ✅ Expired QR correctly rejected
# ✅ Invalid signature correctly rejected
```

#### Test 4: SQLite Database
```bash
# File: src/services/offlineSync/checkinDatabase.ts
# Các operations:
- [ ] Initialize database
- [ ] Insert check-in record
- [ ] Check deduplication (hasCheckin)
- [ ] Get pending records
- [ ] Mark as synced
- [ ] Get pending count
```

---

### **PHASE 3: Mobile - Camera & Scanning**

#### Test 5: CheckInScreen UI
```bash
# File: src/screens/CheckIn/CheckInScreen.tsx
# Kiểm tra:
- [ ] Camera preview hiển thị (nếu permission granted)
- [ ] QR scanner frame visible
- [ ] Network status indicator (Online/Offline)
- [ ] Pending sync counter
- [ ] Sync button
- [ ] Logout button
```

#### Test 6: Scan Valid QR
```bash
# Kịch bản:
1. App mở CheckInScreen
2. Scan QR code hợp lệ
3. Kết quả mong đợi:
   - [ ] < 1 giây hiển thị kết quả
   - [ ] Haptic success feedback (rung nhẹ)
   - [ ] Hiển thị "🎉 Chào mừng [Tên sinh viên]!"
   - [ ] Record lưu vào SQLite
   - [ ] Tự reset camera sau 1.5-2 giây
```

#### Test 7: Scan Invalid QR
```bash
# Kịch bản:
1. Scan QR hết hạn hoặc giả mạo
2. Kết quả mong đợi:
   - [ ] Haptic error feedback (rung mạnh)
   - [ ] Hiển thị lỗi "❌ QR code expired" hoặc "❌ Invalid QR"
   - [ ] KHÔNG gọi API
   - [ ] KHÔNG lưu vào database
```

#### Test 8: Deduplication
```bash
# Kịch bản:
1. Scan cùng QR code 2 lần liên tiếp
2. Lần 1: ✅ "Chào mừng [Tên]"
3. Lần 2: Mong đợi:
   - [ ] ⚠️ "Already checked in"
   - [ ] KHÔNG gọi API
   - [ ] Haptic error feedback
```

---

### **PHASE 4: Offline Sync**

#### Test 9: Sync khi có mạng
```bash
# Kịch bản:
1. Tắt internet (airplane mode)
2. Scan 3-5 QR code → lưu local
3. Bật lại internet
4. Kiểm tra:
   - [ ] Pending counter hiển thị
   - [ ] Auto sync trigger
   - [ ] Records sync thành công
   - [ ] Pending count reset về 0
```

#### Test 10: Exponential Backoff Retry
```bash
# Kịch bản:
1. API server down
2. Scan QR → lưu local
3. Khởi động API server
4. Kiểm tra:
   - [ ] Retry #1 trong 5s
   - [ ] Retry #2 trong 10s
   - [ ] Retry #3 trong 20s
   - [ ] Cuối cùng sync thành công
```

#### Test 11: Manual Sync Button
```bash
# Kịch bản:
1. Có pending records
2. Nhấn "🔄 Sync" button
3. Kiểm tra:
   - [ ] Button disabled nếu offline
   - [ ] Show pending count
   - [ ] Alert "Sync completed" khi xong
```

---

### **PHASE 5: Performance**

#### Test 12: Response Time < 1 giây
```bash
# Đo từ moment scan → kết quả hiển thị
# Tool: Chrome DevTools Timing / React Profiler

Expected:
- Scan detect: < 100ms
- JWT verify: < 200ms
- SQLite check: < 50ms
- UI render: < 100ms
TOTAL: < 500ms (target < 1s) ✅
```

---

### **PHASE 6: Server-side Sync**

#### Test 13: POST /checkins/sync endpoint
```bash
# API: POST /checkins/sync
# Body:
{
  "records": [
    {
      "qrCode": "eyJ...",
      "checkedInAt": "2026-04-28T21:30:00Z",
      "deviceId": "device_abc123"
    }
  ]
}

# Response mong đợi:
{
  "synced": ["qrCode1"],
  "skipped": [],
  "failed": [],
  "summary": {
    "total": 1,
    "synced": 1,
    "skipped": 0,
    "failed": 0
  }
}
```

#### Test 14: Server-side Deduplication (Upsert)
```bash
# Kịch bản: Gửi cùng QR 2 lần
1. POST /checkins/sync với qrCode1
2. POST /checkins/sync với qrCode1 (duplicate)
3. Kết quả:
   - [ ] Lần 1: synced
   - [ ] Lần 2: skipped (idempotent)
   - [ ] Không báo lỗi
   - [ ] Database chỉ có 1 record
```

---

## 📊 Test Results Template

```markdown
### ✅ Passed Tests
- [ ] Test 1: QR Generation
- [ ] Test 2: Server Verification
- [ ] Test 3: JWT Offline Verify
- [ ] Test 4: SQLite Ops
- [ ] Test 5: UI Components
- [ ] Test 6: Valid QR Scan
- [ ] Test 7: Invalid QR Reject
- [ ] Test 8: Deduplication
- [ ] Test 9: Auto Sync
- [ ] Test 10: Exponential Backoff
- [ ] Test 11: Manual Sync
- [ ] Test 12: Performance < 1s
- [ ] Test 13: Sync API
- [ ] Test 14: Server Dedup

### ⏳ Pending Tests
- [ ] Test 15: E2E with real device
```

---

## 🚀 Quick Start Testing

### **Option 1: Test trên Web**
```bash
cd apps/web
npm run dev
# Truy cập: http://localhost:5173
# Login: organizer account
# Tạo workshop → QR được sinh
```

### **Option 2: Test QR Generation & Verification**
```bash
cd apps/api
npm run dev
# Server chạy trên http://localhost:3000

# Trong terminal khác:
npx ts-node test-qr.ts
# Output: ✅ All QR tests passed
```

### **Option 3: Test Mobile App**
```bash
cd apps/mobile
npm start
# Chọn: Android emulator / iOS simulator / Web
# Hoặc scan QR code để chạy trên device
```

---

## 🔧 Debug Tips

### Xem logs
```bash
# API server logs
tail -f logs/api.log

# Mobile logs
console.log() trong React Native
```

### Database inspection
```bash
# SQLite mobile database
# Đường dẫn: ~/Library/Caches/ExponentExperienceData (iOS)
#           ~/.android/emulator/... (Android)

# Dùng tool: DB Browser for SQLite
```

### Network monitoring
```bash
# Chrome DevTools → Network tab
# Xem: /checkins (online) vs /checkins/sync (batch)
```

---

## ✨ Expected Behaviors

| Scenario | Expected | Status |
|----------|----------|--------|
| Scan valid QR | Display name < 1s | 🔄 To test |
| Scan expired QR | Reject + error haptic | 🔄 To test |
| Scan duplicate | "Already checked in" | 🔄 To test |
| Offline scan | Save to SQLite | 🔄 To test |
| Online + pending | Auto sync | 🔄 To test |
| Server down | Retry with backoff | 🔄 To test |
| Manual sync | Show results | 🔄 To test |

---

## 📝 Notes

- Tất cả tests phải pass trước khi deploy production
- Performance target: < 1 giây từ scan → hiển thị
- Security: RSA signature verify offline (no API call)
- Reliability: Exponential backoff, idempotent dedup
- UX: Haptic feedback, network status, auto-reset scanner
