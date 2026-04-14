#!/usr/bin/env bash
# Claude Manager — unified run script
#
# Usage:
#   ./run.sh           # Show interactive menu
#   ./run.sh <number>  # Run option directly (e.g., ./run.sh 1)

set -e

# Colors (printf for macOS compatibility — echo -e is unreliable across shells)
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000
URL="http://127.0.0.1:$PORT"
MIN_NODE=16
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
DOCKER_SERVICE="app"

# Detect OS
IS_WINDOWS=false
if printf '%s' "$OSTYPE" | grep -qE "msys|mingw|cygwin"; then
  IS_WINDOWS=true
fi

# ─── Helper functions ───────────────────────────────────────────────

print_header() {
    printf "\n"
    printf "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}\n"
    printf "${BOLD}${CYAN}║          Claude Manager                      ║${NC}\n"
    printf "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}\n"
    printf "\n"
}

print_menu() {
    printf "  ${BOLD}${GREEN}Local (Node.js)${NC}\n"
    printf "  ${BOLD}1)${NC}  ${GREEN}Start${NC}            Install deps, start server, open browser\n"
    printf "\n"
    printf "  ${BOLD}${BLUE}Docker${NC}\n"
    printf "  ${BOLD}2)${NC}  ${BLUE}Build & Start${NC}    Build image and start container\n"
    printf "  ${BOLD}3)${NC}  ${BLUE}Start${NC}            Start existing container\n"
    printf "  ${BOLD}4)${NC}  ${YELLOW}Stop${NC}             Stop and remove container\n"
    printf "  ${BOLD}5)${NC}  ${YELLOW}Restart${NC}          Restart container\n"
    printf "  ${BOLD}6)${NC}  ${BLUE}Rebuild${NC}          Full rebuild (no cache)\n"
    printf "  ${BOLD}7)${NC}  ${BLUE}Logs${NC}             Follow container logs\n"
    printf "  ${BOLD}8)${NC}  ${BLUE}Status${NC}           Show container status\n"
    printf "  ${BOLD}9)${NC}  ${BLUE}Shell${NC}            Open shell in container\n"
    printf "\n"
    printf "  ${BOLD}0)${NC}  ${DIM}Exit${NC}\n"
    printf "\n"
}

open_browser() {
    if $IS_WINDOWS; then
        # "start" needs an empty title ("") before the URL, otherwise // is parsed as a window title
        cmd.exe /c "start \"\" $1" >/dev/null 2>&1 &
    elif [ "$(uname)" = "Darwin" ]; then
        open "$1" 2>/dev/null || true
    elif [ "$(uname)" = "Linux" ]; then
        if command -v wslview >/dev/null 2>&1; then
            wslview "$1" 2>/dev/null || true
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$1" 2>/dev/null || true
        fi
    fi
}

wait_for_url() {
    local target_url="$1"
    local attempts=0
    printf "  Waiting for server"
    while ! curl -s -o /dev/null "$target_url" 2>/dev/null; do
        printf "."
        sleep 1
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 30 ]; then
            printf "\n"
            printf "  ${RED}Server did not respond within 30 seconds.${NC}\n"
            return 1
        fi
    done
    printf " ${GREEN}ready!${NC}\n"
}

check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        printf "${RED}Docker is not installed.${NC}\n"
        printf "Install Docker: https://docs.docker.com/get-docker/\n"
        return 1
    fi
    if ! docker info >/dev/null 2>&1; then
        printf "${RED}Docker daemon is not running.${NC}\n"
        printf "Please start Docker Desktop or the Docker service.\n"
        return 1
    fi
}

is_container_running() {
    docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q "claude-manager"
}

# ─── Local (Node.js) ───────────────────────────────────────────────

do_local_start() {
    printf "${BOLD}${GREEN}▶ Local Start${NC}\n\n"

    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
            printf "${RED}Node.js v${MIN_NODE}+ required (found $(node -v))${NC}\n"
            printf "Please update Node.js: https://nodejs.org\n"
            return 1
        fi
        printf "  ${GREEN}✓${NC} Node.js $(node -v)\n"
    else
        printf "${RED}Node.js not found.${NC}\n"
        printf "Install Node.js: https://nodejs.org\n"
        return 1
    fi

    # Kill existing instance on the same port
    local PID=""
    if $IS_WINDOWS; then
        PID=$(netstat.exe -aon 2>/dev/null | grep "127.0.0.1:$PORT " | grep LISTENING | awk '{print $NF}' | head -1 || true)
        if [ -n "$PID" ]; then
            printf "  Port $PORT in use (PID $PID), stopping previous instance...\n"
            taskkill.exe //PID "$PID" //F >/dev/null 2>&1 || true
            sleep 2
        fi
    elif command -v lsof >/dev/null 2>&1; then
        PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
    elif command -v ss >/dev/null 2>&1; then
        PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
    elif command -v fuser >/dev/null 2>&1; then
        PID=$(fuser $PORT/tcp 2>/dev/null || true)
    fi
    if [ -n "$PID" ] && ! $IS_WINDOWS; then
        printf "  Port $PORT in use (PID $PID), stopping previous instance...\n"
        kill "$PID" 2>/dev/null || true
        sleep 1
    fi

    # Install dependencies
    cd "$SCRIPT_DIR"
    if [ ! -d "node_modules" ]; then
        printf "  Installing dependencies...\n"
        npm install
    else
        printf "  ${GREEN}✓${NC} Dependencies installed\n"
    fi

    printf "\n"

    # Start server in background
    if $IS_WINDOWS; then
        powershell.exe -command "Start-Process node -ArgumentList 'server.js' -WorkingDirectory '$(pwd -W)' -WindowStyle Hidden"
    else
        nohup node server.js > /dev/null 2>&1 &
    fi

    wait_for_url "$URL" && open_browser "$URL"

    printf "\n${GREEN}${BOLD}✓ Claude Manager is running at ${URL}${NC}\n"
    printf "  To stop: kill the Node.js process on port $PORT\n\n"
}

# ─── Docker actions ─────────────────────────────────────────────────

do_docker_build_start() {
    check_docker || return 1
    printf "${BOLD}${BLUE}▶ Docker Build & Start${NC}\n\n"

    printf "${YELLOW}This will mount the following directory with read-write access:${NC}\n"
    printf "  ${BOLD}~/.claude${NC} — Claude Code configuration, sessions, and memory\n\n"
    printf "  Read-write access is required to manage sessions, memory, backups, and other configuration.\n\n"
    printf "  ${BOLD}Continue? [y/N]:${NC} "
    read -r CONFIRM
    CONFIRM=$(printf '%s' "$CONFIRM" | tr -d '\r')
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        printf "\n${YELLOW}Aborted.${NC}\n\n"
        return
    fi
    printf "\n"

    printf "${BLUE}▸${NC} Building image and starting container...\n"
    docker compose -f "$COMPOSE_FILE" up --build -d

    printf "\n"
    wait_for_url "http://localhost:$PORT" || true
    open_browser "http://localhost:$PORT"
    printf "\n"
    printf "  ${GREEN}${BOLD}✓ Claude Manager is running at http://localhost:${PORT}${NC}\n"
    printf "\n"
}

do_docker_start() {
    check_docker || return 1
    printf "${BOLD}${BLUE}▶ Docker Start${NC}\n\n"

    if is_container_running; then
        printf "${YELLOW}Container is already running.${NC}\n\n"
        return
    fi

    printf "${BLUE}▸${NC} Starting container...\n"
    docker compose -f "$COMPOSE_FILE" up -d

    printf "\n"
    wait_for_url "http://localhost:$PORT" || true
    open_browser "http://localhost:$PORT"
    printf "\n"
    printf "  ${GREEN}${BOLD}✓ Claude Manager is running at http://localhost:${PORT}${NC}\n"
    printf "\n"
}

do_docker_stop() {
    check_docker || return 1
    printf "${BOLD}${YELLOW}▶ Docker Stop${NC}\n\n"

    printf "${BLUE}▸${NC} Stopping container...\n"
    docker compose -f "$COMPOSE_FILE" down

    printf "\n${GREEN}${BOLD}✓ Container stopped.${NC}\n\n"
}

do_docker_restart() {
    check_docker || return 1
    printf "${BOLD}${YELLOW}▶ Docker Restart${NC}\n\n"

    if ! is_container_running; then
        printf "${RED}Container is not running. Use option 2 or 3 to start.${NC}\n\n"
        return
    fi

    printf "${BLUE}▸${NC} Restarting container...\n"
    docker compose -f "$COMPOSE_FILE" restart

    printf "\n"
    wait_for_url "http://localhost:$PORT" || true
    printf "\n"
    printf "  ${GREEN}${BOLD}✓ Container restarted.${NC}\n"
    printf "\n"
}

do_docker_rebuild() {
    check_docker || return 1
    printf "${BOLD}${BLUE}▶ Docker Rebuild (no cache)${NC}\n\n"

    printf "${YELLOW}This will mount the following directory with read-write access:${NC}\n"
    printf "  ${BOLD}~/.claude${NC} — Claude Code configuration, sessions, and memory\n\n"
    printf "  Read-write access is required to manage sessions, memory, backups, and other configuration.\n\n"
    printf "  ${BOLD}Continue? [y/N]:${NC} "
    read -r CONFIRM
    CONFIRM=$(printf '%s' "$CONFIRM" | tr -d '\r')
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        printf "\n${YELLOW}Aborted.${NC}\n\n"
        return
    fi
    printf "\n"

    printf "${BLUE}▸${NC} Rebuilding image from scratch...\n"
    docker compose -f "$COMPOSE_FILE" build --no-cache

    printf "${BLUE}▸${NC} Starting container...\n"
    docker compose -f "$COMPOSE_FILE" up -d

    printf "\n"
    wait_for_url "http://localhost:$PORT" || true
    open_browser "http://localhost:$PORT"
    printf "\n"
    printf "  ${GREEN}${BOLD}✓ Claude Manager rebuilt and running at http://localhost:${PORT}${NC}\n"
    printf "\n"
}

do_docker_logs() {
    check_docker || return 1
    printf "${BOLD}${BLUE}▶ Docker Logs${NC} ${DIM}(Ctrl+C to exit)${NC}\n\n"

    if is_container_running; then
        docker compose -f "$COMPOSE_FILE" logs -f
    else
        printf "${RED}Container is not running.${NC}\n\n"
    fi
}

do_docker_status() {
    check_docker || return 1
    printf "${BOLD}${BLUE}▶ Docker Status${NC}\n\n"

    docker compose -f "$COMPOSE_FILE" ps -a

    printf "\n"
    if is_container_running; then
        printf "  ${GREEN}●${NC} Running at ${CYAN}http://localhost:${PORT}${NC}\n"
    else
        printf "  ${RED}●${NC} Not running\n"
    fi
    printf "\n"
}

do_docker_shell() {
    check_docker || return 1
    printf "${BOLD}${BLUE}▶ Docker Shell${NC}\n\n"

    if ! is_container_running; then
        printf "${RED}Container is not running. Use option 2 or 3 to start.${NC}\n\n"
        return
    fi

    docker compose -f "$COMPOSE_FILE" exec "$DOCKER_SERVICE" sh
}

# ─── Main ───────────────────────────────────────────────────────────

print_header

CHOICE=$(printf '%s' "${1:-}" | tr -d '\r')

if [ -z "$CHOICE" ]; then
    print_menu
    printf "  ${BOLD}Select option:${NC} "
    read -r CHOICE
    CHOICE=$(printf '%s' "$CHOICE" | tr -d '\r')
    printf "\n"
fi

case "$CHOICE" in
    1) do_local_start ;;
    2) do_docker_build_start ;;
    3) do_docker_start ;;
    4) do_docker_stop ;;
    5) do_docker_restart ;;
    6) do_docker_rebuild ;;
    7) do_docker_logs ;;
    8) do_docker_status ;;
    9) do_docker_shell ;;
    0) printf "Bye!\n" ;;
    *) printf "${RED}Invalid option: $CHOICE${NC}\n" ;;
esac
