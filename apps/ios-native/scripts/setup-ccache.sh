#!/bin/bash
# Setup ccache for faster iOS builds

echo "Setting up ccache for faster builds..."

# Check if ccache is installed
if ! command -v ccache &> /dev/null; then
    echo "ccache not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ccache
    else
        echo "Error: Homebrew not found. Please install Homebrew first:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
fi

# Configure ccache for optimal iOS build performance
export CCACHE_SLOPPINESS="clang_index_store,file_stat_matches,include_file_ctime,include_file_mtime,ivfsoverlay,pch_defines,modules,system_headers,time_macros"
export CCACHE_FILECLONE=true
export CCACHE_DEPEND=true
export CCACHE_INODECACHE=true
export CCACHE_MAXSIZE=10G

# Set ccache directory
export CCACHE_DIR="${HOME}/.ccache"

# Create ccache directory if it doesn't exist
mkdir -p "${CCACHE_DIR}"

# Add ccache configuration to shell profile if not already present
SHELL_RC="${HOME}/.zshrc"
if [ -f "${HOME}/.bashrc" ]; then
    SHELL_RC="${HOME}/.bashrc"
fi

if ! grep -q "CCACHE environment" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# CCACHE environment for iOS builds" >> "$SHELL_RC"
    echo "export USE_CCACHE=1" >> "$SHELL_RC"
    echo "export CCACHE_SLOPPINESS=\"clang_index_store,file_stat_matches,include_file_ctime,include_file_mtime,ivfsoverlay,pch_defines,modules,system_headers,time_macros\"" >> "$SHELL_RC"
    echo "export CCACHE_FILECLONE=true" >> "$SHELL_RC"
    echo "export CCACHE_DEPEND=true" >> "$SHELL_RC"
    echo "export CCACHE_INODECACHE=true" >> "$SHELL_RC"
    echo "export CCACHE_MAXSIZE=10G" >> "$SHELL_RC"
    echo "export CCACHE_DIR=\"\${HOME}/.ccache\"" >> "$SHELL_RC"
    echo "" >> "$SHELL_RC"
    echo "✅ Added ccache configuration to $SHELL_RC"
else
    echo "✅ ccache already configured in $SHELL_RC"
fi

echo ""
echo "✅ ccache setup complete!"
echo ""
echo "ccache stats:"
ccache -s
echo ""
echo "To apply the changes to your current shell, run:"
echo "  source $SHELL_RC"
echo ""
echo "Or restart your terminal."
