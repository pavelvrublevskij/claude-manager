#!/usr/bin/env bash
set -e

PORT=3000
URL="http://127.0.0.1:$PORT"
MIN_NODE=16

# Detect OS
IS_WINDOWS=false
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "mingw"* ]] || [[ "$OSTYPE" == "cygwin"* ]]; then
  IS_WINDOWS=true
fi

echo "=== Claude Manager ==="
echo ""

# Check Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
    echo "Node.js v$MIN_NODE+ required (found $(node -v))"
    echo "Please update Node.js: https://nodejs.org"
    exit 1
  fi
  echo "Node.js $(node -v) found"
else
  echo "Node.js not found. Attempting to install..."
  echo ""
  if $IS_WINDOWS; then
    if command -v winget.exe &>/dev/null; then
      winget.exe install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    elif command -v choco.exe &>/dev/null; then
      choco.exe install nodejs-lts -y
    else
      echo "Install Node.js manually: https://nodejs.org"
      exit 1
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      brew install node
    else
      echo "Homebrew not found. Install Node.js manually: https://nodejs.org"
      exit 1
    fi
  elif [[ "$OSTYPE" == "linux"* ]]; then
    if command -v apt-get &>/dev/null; then
      echo "Using apt to install Node.js (may require sudo)..."
      curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v dnf &>/dev/null; then
      echo "Using dnf to install Node.js (may require sudo)..."
      curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
      sudo dnf install -y nodejs
    elif command -v pacman &>/dev/null; then
      echo "Using pacman to install Node.js (may require sudo)..."
      sudo pacman -S --noconfirm nodejs npm
    else
      echo "Could not detect package manager. Install Node.js manually: https://nodejs.org"
      exit 1
    fi
  else
    echo "Unsupported OS. Install Node.js manually: https://nodejs.org"
    exit 1
  fi

  if ! command -v node &>/dev/null; then
    echo "Node.js installation failed. Install manually: https://nodejs.org"
    exit 1
  fi
  echo "Node.js $(node -v) installed"
fi

# Kill existing instance on the same port
PID=""
if $IS_WINDOWS; then
  PID=$(netstat.exe -aon 2>/dev/null | grep "127.0.0.1:$PORT " | grep LISTENING | awk '{print $NF}' | head -1 || true)
  if [ -n "$PID" ]; then
    echo "Port $PORT in use (PID $PID), stopping previous instance..."
    taskkill.exe //PID "$PID" //F &>/dev/null || true
    sleep 2
  fi
elif command -v lsof &>/dev/null; then
  PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
elif command -v ss &>/dev/null; then
  PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
elif command -v fuser &>/dev/null; then
  PID=$(fuser $PORT/tcp 2>/dev/null || true)
fi
if [ -n "$PID" ] && ! $IS_WINDOWS; then
  echo "Port $PORT in use (PID $PID), stopping previous instance..."
  kill "$PID" 2>/dev/null || true
  sleep 1
fi

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
else
  echo "Dependencies already installed"
fi

echo ""
echo "Starting Claude Manager at $URL"
echo "Press Ctrl+C to stop"
echo ""

# Open browser after short delay
(
  sleep 2
  if $IS_WINDOWS; then
    cmd.exe /c "start $URL" &>/dev/null
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    open "$URL"
  elif [[ "$OSTYPE" == "linux"* ]]; then
    if command -v wslview &>/dev/null; then
      wslview "$URL"
    elif command -v xdg-open &>/dev/null; then
      xdg-open "$URL"
    fi
  fi
) &

npm start
