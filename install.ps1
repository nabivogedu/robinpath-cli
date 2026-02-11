# RobinPath installer for Windows
# Usage: irm https://raw.githubusercontent.com/nabivogedu/robinpath-cli/main/install.ps1 | iex
& {
    $ErrorActionPreference = "Stop"

    $Repo = "nabivogedu/robinpath-cli"
    $InstallDir = "$env:USERPROFILE\.robinpath\bin"
    $BinaryName = "robinpath-windows-x64.exe"

    Write-Host ""
    Write-Host "  RobinPath Installer" -ForegroundColor Cyan
    Write-Host ""

    # Get latest release
    Write-Host "  Fetching latest release..."
    try {
        $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
    } catch {
        Write-Host "  Error: No releases found." -ForegroundColor Red
        Write-Host "  Please visit https://github.com/$Repo/releases" -ForegroundColor Yellow
        return
    }

    $Asset = $Release.assets | Where-Object { $_.name -eq $BinaryName } | Select-Object -First 1

    if (-not $Asset) {
        Write-Host "  Error: Could not find $BinaryName in the latest release." -ForegroundColor Red
        Write-Host "  Please visit https://github.com/$Repo/releases" -ForegroundColor Yellow
        return
    }

    $DownloadUrl = $Asset.browser_download_url

    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $ExePath = "$InstallDir\robinpath.exe"

    # Download binary
    Write-Host "  Downloading $BinaryName..."
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExePath -UseBasicParsing
    } catch {
        Write-Host "  Error: Download failed." -ForegroundColor Red
        return
    }

    # Verify it works
    try {
        $Version = & $ExePath --version 2>&1
        Write-Host "  Installed $Version" -ForegroundColor Green
    } catch {
        Write-Host "  Error: Binary downloaded but failed to execute." -ForegroundColor Red
        return
    }

    # Add to PATH if not already there
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")

    if ($UserPath -notlike "*$InstallDir*") {
        $NewPath = "$InstallDir;$UserPath"
        [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
        $env:Path = "$InstallDir;$env:Path"

        Write-Host ""
        Write-Host "  Added $InstallDir to your PATH." -ForegroundColor Green
        Write-Host ""
        Write-Host "  Restart your terminal, then run:" -ForegroundColor Cyan
        Write-Host "    robinpath --version"
    } else {
        Write-Host ""
        Write-Host "  robinpath is ready! Try:" -ForegroundColor Green
        Write-Host "    robinpath --version"
    }
    Write-Host ""
}
