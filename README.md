# UniHub Workshop

Hệ thống quản lý đăng ký và check-in cho "Tuần lễ kỹ năng và nghề nghiệp".  
Xây dựng theo kiến trúc Modular Monolith với Node.js, React, và React Native.

---

## Tech Stack

| Layer         | Technology                        |
| ------------- | --------------------------------- |
| Backend API   | Node.js 20 + Express + TypeScript |
| ORM           | Prisma                            |
| Web Frontend  | React 18 + Vite + TailwindCSS     |
| Mobile        | React Native (Expo)               |
| Primary DB    | PostgreSQL 16                     |
| Cache / Queue | Redis 7 + BullMQ                  |
| Email         | Nodemailer                        |
| AI Summary    | Google Gemini 2.5 Flash           |

---

## Prerequisites

- **Docker** & **Docker Compose** (v2+)
- **Node.js** 20+ và **npm** 9+
- _(Mobile only)_ Expo Go app trên điện thoại Android

---

## Cách chạy (3 bước)

### 1. Cài dependencies

Mở Terminal tại thư mục gốc của dự án (`src/`) và chạy:

```bash
npm install          # cài dependencies cho tất cả workspace
```

### 2. Khởi động services (PostgreSQL + Redis) và seed data

Toàn bộ script khởi tạo DB và dữ liệu mẫu đã được đóng gói trong thư mục `data/`. Từ thư mục gốc của dự án (`src/`), chạy lệnh:

```bash
bash data/setup.sh
```

Seed tạo ra:

- **5 workshops** (3 free, 2 paid) cho 5 ngày tới
- **100 sinh viên** (email: student001@university.edu.vn ... password: Password123!)
- **1 organizer** (organizer@university.edu.vn / OrgAdmin2024!)
- **3 checkin_staff** (staff001@university.edu.vn / Staff2024!)
- **50 registrations** mẫu
- **20 checkins** (15 online + 5 offline-synced)

### 3. Khởi động tất cả apps

```bash
# Terminal 1: API server
cd apps/api && npm run dev     # → http://localhost:3000

# Terminal 2: Mock payment gateway
cd apps/api && npm run dev:gateway  # → http://localhost:3001

# Terminal 3: Web frontend
cd apps/web && npm run dev     # → http://localhost:5173

# Terminal 4: Mobile App (React Native / Expo)
cd apps/mobile && npm start         # Mở app Expo Go trên điện thoại và quét mã QR
```

> **Lưu ý cho Mobile App:** Khi test trên điện thoại thật bằng Expo Go, App sẽ không hiểu `localhost` là gì. Hãy đảm bảo bạn đã mở file `apps/mobile/.env` và đổi `EXPO_PUBLIC_API_URL` thành địa chỉ IPv4 máy tính của bạn (VD: `EXPO_PUBLIC_API_URL=http://192.168.1.xxx:3000/api/v1`) trước khi quét mã QR!
> Để lấy IPv4 thì dùng cmd nhập ipconfig tại cổng lan/wlan hiện tại đang sử dụng lấy IPv4

---

## Tài khoản mẫu sau khi seed

| Role           | Email                        | Password      |
| -------------- | ---------------------------- | ------------- |
| Organizer      | organizer@university.edu.vn  | OrgAdmin2024! |
| Student        | student001@university.edu.vn | Password123!  |
| Check-in Staff | staff001@university.edu.vn   | Staff2024!    |

---

## Kiểm tra các tính năng chính

### Test Rate Limiting

```bash
# Gửi 15 request liên tiếp → lần thứ 11 trở đi nhận 429
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student001@university.edu.vn","password":"Password123!"}' \
  | jq -r '.access_token')

for i in $(seq 1 15); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3000/api/v1/registrations \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"workshopId":"ws-003"}')
  echo "Request $i → HTTP $HTTP"
done
```

### Test Circuit Breaker

```bash
# Lấy token trước
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student002@university.edu.vn","password":"Password123!"}' \
  | jq -r '.access_token')

ORG_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@university.edu.vn","password":"OrgAdmin2024!"}' \
  | jq -r '.access_token')

# Bước 1: Set payment gateway lỗi 100%
curl -s -X PATCH http://localhost:3001/admin/config \
  -H "Content-Type: application/json" \
  -d '{"errorRate": 1.0}' | jq '.config'

# Bước 2: Gửi 6 payment requests → request 6 nhận 503 (circuit OPEN)

# Đăng ký ws-003 (có phí) để lấy registrationId
REG_ID=$(curl -s -X POST http://localhost:3000/api/v1/registrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workshopId":"ws-003"}' \
  | jq -r '.registration.id')

echo "REG_ID: $REG_ID"

for i in $(seq 1 6); do
  KEY=$(python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null \
    || node -e "console.log(require('crypto').randomUUID())")
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "http://localhost:3000/api/v1/payments/$REG_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $KEY" \
    -H "Content-Type: application/json")
  CB=$(curl -s http://localhost:3000/api/v1/admin/circuit-breaker \
    -H "Authorization: Bearer $ORG_TOKEN" | jq -r '.circuitBreaker.state')
  echo "Request $i → HTTP $HTTP | CB state: $CB"
  sleep 0.5
done

# Bước 3: Reset về bình thường sau khi test
curl -s -X POST http://localhost:3000/api/v1/admin/circuit-breaker/reset \
  -H "Authorization: Bearer $ORG_TOKEN" | jq '.message'
curl -s -X PATCH http://localhost:3001/admin/config \
  -H "Content-Type: application/json" \
  -d '{"errorRate": 0.0}' | jq '.config.errorRate'
```

### Test Idempotency

```bash
# Đăng ký ws-003 để lấy REG_ID mới
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"student003@university.edu.vn","password":"Password123!"}' \
 | jq -r '.access_token')

REG_ID=$(curl -s -X POST http://localhost:3000/api/v1/registrations \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"workshopId":"ws-003"}' \
 | jq -r '.registration.id')

KEY="idem-$(date +%s)-$RANDOM"

# Lần 1 → thanh toán thật, idempotent: false
curl -s -X POST "http://localhost:3000/api/v1/payments/$REG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" | jq '{idempotent: .idempotent}'

# Lần 2 (cùng key) → cache hit, idempotent: true
curl -s -X POST "http://localhost:3000/api/v1/payments/$REG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" | jq '{idempotent: .idempotent}'
```

### Test CSV Import

```bash
ORG_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@university.edu.vn","password":"OrgAdmin2024!"}' \
  | jq -r '.access_token')

# Trigger CSV import thủ công
curl -s -X POST http://localhost:3000/api/v1/admin/csv-imports/trigger \
  -H "Authorization: Bearer $ORG_TOKEN" | jq

# Xem kết quả import
curl -s http://localhost:3000/api/v1/admin/csv-imports \
  -H "Authorization: Bearer $ORG_TOKEN" | jq '.imports[0]'
```

---

## Cấu trúc thư mục

```
src/
├── apps/
│   ├── api/                # Node.js API (port 3000)
│   ├── web/                # React web (port 5173)
│   └── mobile/             # React Native (Expo)
├── data/                   # Seed data & Script khởi tạo CSDL
│   ├── seed.ts
|   ├── setup.sh
│   └── students.csv
├── docker-compose.yml
└── README.md
```

---

## Troubleshooting

**Prisma migration fail:**

```bash
docker-compose down -v      # xóa volume DB cũ
docker-compose up -d postgres redis
cd apps/api && npx prisma migrate deploy
```

**Redis connection refused:**

```bash
docker-compose up -d redis
# Kiểm tra: docker-compose ps
```
