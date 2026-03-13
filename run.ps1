Write-Host "Syncing repository with origin/main..."
git fetch origin
if ($LASTEXITCODE -eq 0) {
  git reset --hard origin/main
}

Write-Host "Starting backend in new PowerShell window..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot/server'; npm install; node index.js"

Write-Host "Starting frontend in new PowerShell window..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot/client'; npm install; npm run dev"
