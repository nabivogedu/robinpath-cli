#!/bin/sh
# RobinPath installer for macOS and Linux
# Usage: curl -fsSL https://robinpath.com/install.sh | sh
set -e

REPO="wiredwp/robinpath-workspace"
INSTALL_DIR="$HOME/.robinpath/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${CYAN}RobinPath Installer${NC}"
echo ""

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux)  PLATFORM="linux" ;;
    darwin) PLATFORM="macos" ;;
    *)
        echo "${RED}Error: Unsupported OS: $OS${NC}"
        echo "Please visit https://github.com/$REPO/releases for manual download."
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64|amd64) ARCH_SUFFIX="x64" ;;
    arm64|aarch64) ARCH_SUFFIX="arm64" ;;
    *)
        echo "${RED}Error: Unsupported architecture: $ARCH${NC}"
        exit 1
        ;;
esac

BINARY_NAME="robinpath-${PLATFORM}-${ARCH_SUFFIX}"

# macOS x64 fallback: if arm64 binary doesn't exist, try x64 (Rosetta)
if [ "$PLATFORM" = "macos" ] && [ "$ARCH_SUFFIX" = "arm64" ]; then
    : # arm64 build exists, use it
fi

echo "  Platform: $PLATFORM ($ARCH_SUFFIX)"
echo "  Binary:   $BINARY_NAME"
echo ""

# Get latest release URL
echo "Fetching latest release..."
DOWNLOAD_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep "browser_download_url.*$BINARY_NAME" \
    | head -1 \
    | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
    echo "${RED}Error: Could not find binary for your platform.${NC}"
    echo "Please visit https://github.com/$REPO/releases for manual download."
    exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download binary
echo "Downloading $BINARY_NAME..."
curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_DIR/robinpath"
chmod +x "$INSTALL_DIR/robinpath"

# Verify it works
if "$INSTALL_DIR/robinpath" --version > /dev/null 2>&1; then
    VERSION=$("$INSTALL_DIR/robinpath" --version)
    echo "${GREEN}Installed $VERSION${NC}"
else
    echo "${RED}Error: Binary downloaded but failed to execute.${NC}"
    exit 1
fi

# Add to PATH if not already there
SHELL_NAME=$(basename "$SHELL")
PROFILE=""

case "$SHELL_NAME" in
    zsh)  PROFILE="$HOME/.zshrc" ;;
    bash)
        if [ -f "$HOME/.bashrc" ]; then
            PROFILE="$HOME/.bashrc"
        elif [ -f "$HOME/.bash_profile" ]; then
            PROFILE="$HOME/.bash_profile"
        fi
        ;;
    fish) PROFILE="$HOME/.config/fish/config.fish" ;;
esac

PATH_LINE="export PATH=\"$INSTALL_DIR:\$PATH\""
if [ "$SHELL_NAME" = "fish" ]; then
    PATH_LINE="set -gx PATH $INSTALL_DIR \$PATH"
fi

# Check if already in PATH
if echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo ""
    echo "${GREEN}robinpath is ready! Try:${NC}"
    echo "  robinpath --version"
else
    if [ -n "$PROFILE" ]; then
        # Check if line already exists in profile
        if ! grep -q "$INSTALL_DIR" "$PROFILE" 2>/dev/null; then
            echo "" >> "$PROFILE"
            echo "# RobinPath" >> "$PROFILE"
            echo "$PATH_LINE" >> "$PROFILE"
        fi
        echo ""
        echo "${GREEN}robinpath installed to $INSTALL_DIR${NC}"
        echo ""
        echo "Run this to start using it now:"
        echo "  ${CYAN}$PATH_LINE${NC}"
        echo ""
        echo "Or restart your terminal, then:"
        echo "  robinpath --version"
    else
        echo ""
        echo "${GREEN}robinpath installed to $INSTALL_DIR${NC}"
        echo ""
        echo "Add this to your shell profile:"
        echo "  ${CYAN}$PATH_LINE${NC}"
    fi
fi
