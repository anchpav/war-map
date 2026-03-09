param(
    [Parameter(Mandatory = $false)]
    [string]$PrNumber
)

if (-not $PrNumber) {
    $PrNumber = Read-Host "Enter GitHub PR number"
}

if (-not $PrNumber -or $PrNumber.Trim() -eq "") {
    Write-Host "PR number is required." -ForegroundColor Red
    exit 1
}

$branchName = "pr-$PrNumber"

Write-Host ""
Write-Host "=== Step 0: Ensure we are in a git repo ===" -ForegroundColor Cyan
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "This folder is not a git repository." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 1: Clean old local PR branch if it exists ===" -ForegroundColor Cyan
git branch -D $branchName 2>$null

Write-Host ""
Write-Host "=== Step 2: Fetch PR #$PrNumber ===" -ForegroundColor Cyan
git fetch origin "pull/$PrNumber/head:$branchName" --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to fetch PR #$PrNumber." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 3: Checkout main ===" -ForegroundColor Cyan
git checkout main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to checkout main." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 4: Update main ===" -ForegroundColor Cyan
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to update main." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 5: Merge PR branch $branchName into main ===" -ForegroundColor Cyan
git merge $branchName

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Merge has conflicts." -ForegroundColor Yellow
    Write-Host "If you want to accept the PR version for all conflicted files, run:" -ForegroundColor Yellow
    Write-Host "  git checkout --theirs ." -ForegroundColor White
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m `"Merge PR #$PrNumber and accept PR version`"" -ForegroundColor White
    Write-Host "  git push origin main" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=== Step 6: Push merged main ===" -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Merge succeeded, but push failed." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "PR #$PrNumber merged into main and pushed successfully." -ForegroundColor Green