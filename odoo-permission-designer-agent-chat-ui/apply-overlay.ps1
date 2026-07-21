param(
  [Parameter(Mandatory=$true)]
  [string]$AgentChatUiPath
)

$ErrorActionPreference = "Stop"
$overlay = Join-Path $PSScriptRoot "frontend-overlay"

Write-Host "Copying Odoo Permission Designer overlay..."
Copy-Item -Path (Join-Path $overlay "src\app\page.tsx") `
          -Destination (Join-Path $AgentChatUiPath "src\app\page.tsx") -Force

$target = Join-Path $AgentChatUiPath "src\components\permission-designer"
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -Path (Join-Path $overlay "src\components\permission-designer\*") `
          -Destination $target -Recurse -Force

$threadTarget = Join-Path $AgentChatUiPath "src\components\thread"
New-Item -ItemType Directory -Path $threadTarget -Force | Out-Null
Copy-Item -Path (Join-Path $overlay "src\components\thread\index.tsx") `
          -Destination (Join-Path $threadTarget "index.tsx") -Force

Write-Host "Overlay installed. Run: cd $AgentChatUiPath; pnpm dev"
