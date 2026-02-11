# RobinPath installer for Windows
# Usage: irm https://robinpath.com/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo = "wiredwp/robinpath-workspace"
$InstallDir = "$env:USERPROFILE\.robinpath\bin"
$BinaryName = "robinpath-windows-x64.exe"

Write-Host "RobinPath Installer" -ForegroundColor Cyan
Write-Host ""

# Get latest release
Write-Host "Fetching latest release..."
try {
    $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
} catch {
    Write-Host "Error: Could not fetch release information." -ForegroundColor Red
    Write-Host "Please visit https://github.com/$Repo/releases for manual download."
    exit 1
}

$Asset = $Release.assets | Where-Object { $_.name -eq $BinaryName } | Select-Object -First 1

if (-not $Asset) {
    Write-Host "Error: Could not find $BinaryName in the latest release." -ForegroundColor Red
    Write-Host "Please visit https://github.com/$Repo/releases for manual download."
    exit 1
}

$DownloadUrl = $Asset.browser_download_url

# Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$ExePath = "$InstallDir\robinpath.exe"

# Download binary
Write-Host "Downloading $BinaryName..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExePath -UseBasicParsing

# Verify it works
try {
    $Version = & $ExePath --version 2>&1
    Write-Host "Installed $Version" -ForegroundColor Green
} catch {
    Write-Host "Error: Binary downloaded but failed to execute." -ForegroundColor Red
    exit 1
}

# Add to PATH if not already there
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($UserPath -notlike "*$InstallDir*") {
    $NewPath = "$InstallDir;$UserPath"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")

    # Also update current session
    $env:Path = "$InstallDir;$env:Path"

    Write-Host ""
    Write-Host "Added $InstallDir to your PATH." -ForegroundColor Green
    Write-Host ""
    Write-Host "Restart your terminal, then run:" -ForegroundColor Cyan
    Write-Host "  robinpath --version"
} else {
    Write-Host ""
    Write-Host "robinpath is ready! Try:" -ForegroundColor Green
    Write-Host "  robinpath --version"
}
