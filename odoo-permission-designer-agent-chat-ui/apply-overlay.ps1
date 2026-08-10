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

$threadMessagesTarget = Join-Path $AgentChatUiPath "src\components\thread\messages"
New-Item -ItemType Directory -Path $threadMessagesTarget -Force | Out-Null
Copy-Item -Path (Join-Path $overlay "src\components\thread\messages\ai.tsx") `
          -Destination (Join-Path $threadMessagesTarget "ai.tsx") -Force
Copy-Item -Path (Join-Path $overlay "src\components\thread\messages\human.tsx") `
          -Destination (Join-Path $threadMessagesTarget "human.tsx") -Force

$appTarget = Join-Path $AgentChatUiPath "src\app"
New-Item -ItemType Directory -Path $appTarget -Force | Out-Null
Copy-Item -Path (Join-Path $overlay "src\app\layout.tsx") `
          -Destination (Join-Path $appTarget "layout.tsx") -Force
Copy-Item -Path (Join-Path $overlay "src\app\icon.svg") `
          -Destination (Join-Path $appTarget "icon.svg") -Force
Copy-Item -Path (Join-Path $overlay "src\app\icon1.png") `
          -Destination (Join-Path $appTarget "icon1.png") -Force

$iconsTarget = Join-Path $AgentChatUiPath "src\components\icons"
New-Item -ItemType Directory -Path $iconsTarget -Force | Out-Null
Copy-Item -Path (Join-Path $overlay "src\components\icons\langgraph.tsx") `
          -Destination (Join-Path $iconsTarget "langgraph.tsx") -Force

$i18nTarget = Join-Path $AgentChatUiPath "src\i18n"
New-Item -ItemType Directory -Path $i18nTarget -Force | Out-Null
Copy-Item -Path (Join-Path $overlay "src\i18n\*") `
          -Destination $i18nTarget -Recurse -Force

Write-Host "Overlay installed. Run: cd $AgentChatUiPath; pnpm dev"
