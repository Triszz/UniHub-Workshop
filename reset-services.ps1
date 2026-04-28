# Reset all necessary services

Write-Host "🔄 Resetting gateway error rate..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Invoke-WebRequest -Uri "http://localhost:3001/admin/config" -Method PATCH -ContentType "application/json" -Body '{"errorRate":0.0}' -UseBasicParsing | Out-Null
Write-Host "✅ Gateway error rate reset to 0" -ForegroundColor Green

Write-Host "🔄 Resetting circuit breaker..." -ForegroundColor Cyan
Start-Sleep -Seconds 1
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/admin/circuit-breaker/reset" -Method POST -ContentType "application/json" -Headers @{"Authorization"="Bearer admin"} -UseBasicParsing | Out-Null
Write-Host "✅ Circuit breaker reset" -ForegroundColor Green

Write-Host ""
Write-Host "✨ All systems reset! Ready to test." -ForegroundColor Yellow
