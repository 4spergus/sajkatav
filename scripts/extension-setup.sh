#!/bin/bash

VSIX_PATH=""
FORCE_INSTALL=false
WORKSPACE_PATH=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_INSTALL=true
            shift
            ;;
        -w|--workspace)
            WORKSPACE_PATH="$2"
            shift 2
            ;;
        *)
            VSIX_PATH="$1"
            shift
            ;;
    esac
done

# Validate
if [ -z "$VSIX_PATH" ] || [ ! -f "$VSIX_PATH" ]; then
    echo "Error: Valid VSIX file required"
    echo "Usage: ./install-vsix.sh <vsix-path> [-f|--force] [-w|--workspace <path>]"
    exit 1
fi

# Detect VS Code variant
if command -v code &> /dev/null; then
    CODE_CMD="code"
elif command -v code-insiders &> /dev/null; then
    CODE_CMD="code-insiders"
else
    echo "Error: VS Code not found in PATH"
    exit 1
fi

echo "Installing extension..."

# Install extension
if [ "$FORCE_INSTALL" = true ]; then
    $CODE_CMD --install-extension "$VSIX_PATH" --force
else
    $CODE_CMD --install-extension "$VSIX_PATH"
fi

echo "Restarting VS Code..."

# Kill and reopen VS Code
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - gracefully quit VS Code
    osascript -e 'quit app "Visual Studio Code"' 2>/dev/null
    sleep 2
    open -a "Visual Studio Code"
else
    # Linux - kill and reopen
    pkill -f "code" 2>/dev/null
    sleep 2
    "$CODE_CMD" &
fi

echo "✓ Done! Extension installed and VS Code restarted"