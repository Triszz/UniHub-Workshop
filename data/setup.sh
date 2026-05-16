set -e  # dừng ngay nếu có lỗi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "================ UniHub Workshop — Full Setup ================"
echo ""

echo "Cleaning up old environment..."
# Tắt và xóa volume của project hiện tại (nếu có)
docker-compose down -v 2>/dev/null || true
# Xóa các container cũ có thể gây trùng tên từ project khác
docker rm -f unihub_postgres unihub_redis 2>/dev/null || true
echo "Cleanup done."

echo ""
# Khởi động Docker services
echo "Starting Docker services (Postgres + Redis)..."
docker-compose up -d postgres redis
echo "Waiting for services to be healthy..."

# Chờ Postgres sẵn sàng (tối đa 30 giây)
for i in $(seq 1 30); do
  if docker-compose exec -T postgres pg_isready -U unihub -d unihub_workshop > /dev/null 2>&1; then
    echo "Postgres ready"
    break
  fi
  sleep 1
done

# Chờ Redis
for i in $(seq 1 10); do
  if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "Redis ready"
    break
  fi
  sleep 1
done

# Migrate DB
echo ""
echo "Running Prisma migrations..."
cd apps/api
npx prisma generate
npx prisma migrate deploy
echo "Migrations done"

# 4. Seed data
echo ""
echo "Seeding database..."
npx ts-node --project tsconfig.json ../../data/seed.ts
echo "Seed done"

echo ""
echo "Setup hoàn tất!"              
