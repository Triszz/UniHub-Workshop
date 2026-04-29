set -e  # dừng ngay nếu có lỗi

echo "╔══════════════════════════════════════════╗"
echo "║     UniHub Workshop — Full Setup         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Kiểm tra .env
if [ ! -f ".env" ]; then
  echo "⚠️  .env chưa có → copy từ .env.example"
  cp .env.example .env
  echo "   ✅ .env đã được tạo. Kiểm tra lại config nếu cần."
fi

# 2. Khởi động Docker services
echo "🐳 Starting Docker services (Postgres + Redis)..."
cd ../..  # về root repo
docker-compose up -d postgres redis
echo "   ⏳ Waiting for services to be healthy..."

# Chờ Postgres sẵn sàng (tối đa 30 giây)
for i in $(seq 1 30); do
  if docker-compose exec -T postgres pg_isready -U unihub -d unihub_workshop > /dev/null 2>&1; then
    echo "   ✅ Postgres ready"
    break
  fi
  sleep 1
done

# Chờ Redis
for i in $(seq 1 10); do
  if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis ready"
    break
  fi
  sleep 1
done

# 3. Migrate DB
echo ""
echo "📦 Running Prisma migrations..."
cd apps/api
npx prisma migrate deploy
echo "   ✅ Migrations done"

# 4. Seed data
echo ""
echo "🌱 Seeding database..."
npm run seed
echo "   ✅ Seed done"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Setup hoàn tất!                      ║"
echo "║                                          ║"
echo "║  Chạy API:     npm run dev               ║"
echo "║  Chạy Gateway: npm run dev:gateway       ║"
echo "║  Chạy Web:     cd ../web && npm run dev  ║"
echo "╚══════════════════════════════════════════╝"