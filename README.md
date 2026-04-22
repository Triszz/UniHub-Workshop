# UniHub Workshop 🎓

Hệ thống quản lý đăng ký và check-in cho "Tuần lễ kỹ năng và nghề nghiệp".  
Xây dựng theo kiến trúc Modular Monolith với Node.js, React, và React Native.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js 20 + Express + TypeScript |
| ORM | Prisma |
| Web Frontend | React 18 + Vite + TailwindCSS |
| Mobile | React Native (Expo) |
| Primary DB | PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ |
| Email | Nodemailer (Mailtrap) |
| AI Summary | OpenAI gpt-4o-mini |

---

## Prerequisites

- **Docker** & **Docker Compose** (v2+)
- **Node.js** 20+ và **npm** 9+
- *(Mobile only)* Expo Go app trên điện thoại Android

---

## Cách chạy (5 bước)

### 1. Clone & cài dependencies

```bash
git clone https://github.com/your-team/unihub-workshop.git
cd unihub-workshop
npm install          # cài dependencies cho tất cả workspace
```

### 2. Cấu hình environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Chỉnh sửa `apps/api/.env`:

```env
# Database
DATABASE_URL="postgresql://unihub:unihub@localhost:5432/unihub_workshop"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="change-this-to-a-32-char-random-string-in-prod"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Email (dùng Mailtrap cho dev)
SMTP_HOST="sandbox.smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="your_mailtrap_user"
SMTP_PASS="your_mailtrap_pass"
EMAIL_FROM="noreply@unihub.dev"

# OpenAI
OPENAI_API_KEY="sk-..."

# Mock Payment Gateway
MOCK_GATEWAY_URL="http://localhost:3001"
MOCK_GATEWAY_DELAY_MS=500
MOCK_GATEWAY_ERROR_RATE=0.0

# Rate Limiting
RATE_LIMIT_CAPACITY=10
RATE_LIMIT_REFILL_RATE=2

# Circuit Breaker
CB_FAILURE_THRESHOLD=5
CB_TIMEOUT_MS=30000
```

### 3. Khởi động services (PostgreSQL + Redis)

```bash
docker-compose up -d postgres redis
```

Chờ ~10 giây để Postgres khởi động xong.

### 4. Migrate database + Seed data

```bash
cd apps/api
npx prisma migrate deploy     # chạy migrations
npm run seed                  # tạo dữ liệu mẫu
```

Seed tạo ra:
- **5 workshops** (3 free, 2 paid) cho 5 ngày tới
- **100 sinh viên** (email: student001@university.edu.vn ... password: Password123!)
- **2 organizer** (organizer@university.edu.vn / OrgAdmin2024!)
- **3 checkin_staff** (staff001@university.edu.vn / Staff2024!)
- **50 registrations** mẫu
- **1 file CSV** mẫu tại `seed/students.csv`

### 5. Khởi động tất cả apps

```bash
# Terminal 1: API server
cd apps/api && npm run dev     # → http://localhost:3000

# Terminal 2: Mock payment gateway
cd apps/api && npm run dev:gateway  # → http://localhost:3001

# Terminal 3: Web frontend
cd apps/web && npm run dev     # → http://localhost:5173

# Terminal 4 (optional): Bull Board (queue monitor)
# Tự động chạy cùng API → http://localhost:3000/admin/queues
```

---

## Tài khoản mẫu sau khi seed

| Role | Email | Password |
|------|-------|----------|
| Organizer | organizer@university.edu.vn | OrgAdmin2024! |
| Student | student001@university.edu.vn | Password123! |
| Check-in Staff | staff001@university.edu.vn | Staff2024! |

---

## Kiểm tra các tính năng chính

### Test Rate Limiting
```bash
# Gửi 20 request liên tiếp → lần thứ 11 trở đi nhận 429
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST http://localhost:3000/api/v1/registrations \
    -H "Authorization: Bearer {student_token}" \
    -H "Content-Type: application/json" \
    -d '{"workshopId": "{workshop_id}"}'
done
```

### Test Circuit Breaker
```bash
# Set payment gateway lỗi 100%
docker-compose exec api \
  curl -X POST http://localhost:3001/admin/config \
  -d '{"errorRate": 1.0}'

# Gửi 6 payment requests → lần 6 nhận 503 (circuit OPEN)
```

### Test Idempotency
```bash
KEY="test-$(uuidgen)"
# Gọi 2 lần với cùng key → chỉ charge 1 lần
curl -X POST http://localhost:3000/api/v1/payments/{id} \
  -H "Idempotency-Key: $KEY" ...
curl -X POST http://localhost:3000/api/v1/payments/{id} \
  -H "Idempotency-Key: $KEY" ...  # → trả kết quả cache
```

### Test CSV Import
```bash
# Copy file CSV vào volume và trigger import
docker cp seed/students.csv unihub_api:/data/students.csv
curl -X POST http://localhost:3000/api/v1/admin/csv-sync/trigger \
  -H "Authorization: Bearer {organizer_token}"
```

---

## Cấu trúc thư mục

```
unihub-workshop/
├── apps/
│   ├── api/                # Node.js API (port 3000)
│   ├── web/                # React web (port 5173)
│   └── mobile/             # React Native (Expo)
├── blueprint/              # Tài liệu thiết kế
│   ├── proposal.md
│   ├── design.md
│   └── specs/
├── seed/                   # Seed data
│   ├── seed.ts
│   └── students.csv
├── docker-compose.yml
└── README.md
```

---

## API Documentation

Swagger UI tại: http://localhost:3000/api/docs  
*(tự động generate từ JSDoc annotations)*

---

## Chạy tests

```bash
cd apps/api
npm test                    # unit tests
npm run test:integration    # integration tests (cần DB running)
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

**Expo app không kết nối được API:**
- Thay `localhost` bằng IP máy tính trong `apps/mobile/.env`
- Ví dụ: `API_URL=http://192.168.1.100:3000`
