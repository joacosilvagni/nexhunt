#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# NexHunt Installer — Kali Linux / Debian
# Installs all required tools, Python backend, and builds the frontend.
# Run as root: sudo bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; }
step() { echo -e "\n${BLUE}${BOLD}[$((++STEP))/${TOTAL_STEPS}]${NC} ${BOLD}$1${NC}"; }

NEXHUNT_DIR="$(cd "$(dirname "$0")" && pwd)"
GO_BIN="$HOME/go/bin"
TOTAL_STEPS=8
STEP=0

echo -e "\n${CYAN}${BOLD}"
echo "  ███╗   ██╗███████╗██╗  ██╗██╗  ██╗██╗   ██╗███╗   ██╗████████╗"
echo "  ████╗  ██║██╔════╝╚██╗██╔╝██║  ██║██║   ██║████╗  ██║╚══██╔══╝"
echo "  ██╔██╗ ██║█████╗   ╚███╔╝ ███████║██║   ██║██╔██╗ ██║   ██║   "
echo "  ██║╚██╗██║██╔══╝   ██╔██╗ ██╔══██║██║   ██║██║╚██╗██║   ██║   "
echo "  ██║ ╚████║███████╗██╔╝ ██╗██║  ██║╚██████╔╝██║ ╚████║   ██║   "
echo "  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   "
echo -e "${NC}"
echo -e "  ${BOLD}Bug Bounty Automation Platform — Installer${NC}"
echo -e "  Install path: ${CYAN}$NEXHUNT_DIR${NC}"
echo -e "  Running as:   ${CYAN}$(whoami)${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
step "System dependencies (apt)"
# ─────────────────────────────────────────────────────────────────────────────
apt-get update -qq 2>/dev/null
apt-get install -y -qq \
    curl wget git build-essential coreutils \
    nmap nikto sqlmap gobuster ffuf \
    dirsearch amass commix \
    python3 python3-pip python3-venv \
    golang-go \
    nodejs npm \
    xvfb 2>/dev/null || true

ok "System packages installed"

# Node.js v18+ required
NODE_VER=$(node --version 2>/dev/null | cut -d. -f1 | tr -d 'v' || echo "0")
if [ "$NODE_VER" -lt 18 ]; then
    warn "Node.js $NODE_VER too old — installing v20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs
fi
ok "Node.js $(node --version)"

# ─────────────────────────────────────────────────────────────────────────────
step "Go toolchain"
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v go &>/dev/null; then
    warn "Go not found — installing 1.21..."
    GO_ARCH="amd64"
    [[ "$(uname -m)" == "aarch64" ]] && GO_ARCH="arm64"
    wget -q "https://go.dev/dl/go1.21.13.linux-${GO_ARCH}.tar.gz" -O /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz
    export PATH="$PATH:/usr/local/go/bin"
fi
export PATH="$PATH:$GO_BIN:/usr/local/go/bin"
ok "$(go version)"

# ─────────────────────────────────────────────────────────────────────────────
step "ProjectDiscovery tools (Go install)"
# ─────────────────────────────────────────────────────────────────────────────
PD_TOOLS=(
    "github.com/projectdiscovery/httpx/cmd/httpx@latest:httpx"
    "github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest:subfinder"
    "github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest:nuclei"
    "github.com/projectdiscovery/katana/cmd/katana@latest:katana"
    "github.com/hahwul/dalfox/v2@latest:dalfox"
    "github.com/lc/gau/v2/cmd/gau@latest:gau"
    "github.com/tomnomnom/waybackurls@latest:waybackurls"
    "github.com/sensepost/gowitness@latest:gowitness"
)

for entry in "${PD_TOOLS[@]}"; do
    pkg="${entry%:*}"
    name="${entry#*:}"
    printf "  Installing %-20s ... " "$name"
    if go install "$pkg" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}failed (check manually)${NC}"
    fi
done

# Priority-link ProjectDiscovery httpx over httpx-toolkit (/usr/local/bin wins PATH)
if [ -f "$GO_BIN/httpx" ]; then
    ln -sf "$GO_BIN/httpx" /usr/local/bin/httpx
    ok "httpx (ProjectDiscovery) → /usr/local/bin/httpx"
fi

# Symlink all Go tools to /usr/local/bin for system-wide access
for bin in subfinder nuclei katana dalfox gau waybackurls gowitness; do
    [ -f "$GO_BIN/$bin" ] && ln -sf "$GO_BIN/$bin" /usr/local/bin/$bin
done
ok "Go tools symlinked to /usr/local/bin"

# ─────────────────────────────────────────────────────────────────────────────
step "Python security tools (pip)"
# ─────────────────────────────────────────────────────────────────────────────

# arjun — HTTP parameter discovery
printf "  Installing %-20s ... " "arjun"
pip3 install -q --break-system-packages arjun 2>/dev/null || \
pip3 install -q arjun 2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}skipped${NC}"

# paramspider
printf "  Installing %-20s ... " "paramspider"
pip3 install -q --break-system-packages paramspider 2>/dev/null || \
pip3 install -q paramspider 2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}skipped${NC}"

# XSStrike — needs git clone
printf "  Installing %-20s ... " "xsstrike"
if ! command -v xsstrike &>/dev/null; then
    git clone -q https://github.com/s0md3v/XSStrike.git /opt/XSStrike 2>/dev/null || true
    pip3 install -q -r /opt/XSStrike/requirements.txt 2>/dev/null || true
    cat > /usr/local/bin/xsstrike <<'EOF'
#!/bin/bash
cd /opt/XSStrike && python3 xsstrike.py "$@"
EOF
    chmod +x /usr/local/bin/xsstrike
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${GREEN}✓ (already installed)${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "PATH configuration"
# ─────────────────────────────────────────────────────────────────────────────
PATH_LINE='export PATH="$PATH:'"$GO_BIN"':/usr/local/go/bin"'
for rcfile in /root/.bashrc /root/.zshrc /home/kali/.bashrc /home/kali/.zshrc; do
    if [ -f "$rcfile" ] && ! grep -q "go/bin" "$rcfile" 2>/dev/null; then
        echo "" >> "$rcfile"
        echo "# Go tools (added by NexHunt installer)" >> "$rcfile"
        echo "$PATH_LINE" >> "$rcfile"
    fi
done
export PATH="$PATH:$GO_BIN:/usr/local/go/bin"
ok "~/go/bin in PATH (restart shell or: source ~/.zshrc)"

# ─────────────────────────────────────────────────────────────────────────────
step "Python backend"
# ─────────────────────────────────────────────────────────────────────────────
cd "$NEXHUNT_DIR/backend"
if [ ! -d venv ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
deactivate
ok "Python venv ready at backend/venv"

# ─────────────────────────────────────────────────────────────────────────────
step "Node.js frontend"
# ─────────────────────────────────────────────────────────────────────────────
cd "$NEXHUNT_DIR"
npm install --silent 2>/dev/null
ok "npm packages installed"

# ─────────────────────────────────────────────────────────────────────────────
step "Build NexHunt"
# ─────────────────────────────────────────────────────────────────────────────
npm run build 2>&1 | tail -5
ok "Build complete → out/"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║       NexHunt installed successfully!    ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Start:${NC}  cd $NEXHUNT_DIR && bash start.sh"
echo ""
echo -e "  ${BOLD}Tools status:${NC}"
TOOLS="nmap nikto sqlmap gobuster ffuf dirsearch amass httpx subfinder nuclei katana dalfox gau waybackurls gowitness arjun xsstrike"
for tool in $TOOLS; do
    if command -v "$tool" &>/dev/null; then
        echo -e "    ${GREEN}✓${NC} $tool  $(command -v $tool)"
    else
        echo -e "    ${YELLOW}✗${NC} $tool  not in PATH"
    fi
done
echo ""
echo -e "  ${YELLOW}Note:${NC} Run ${CYAN}source ~/.zshrc${NC} to reload PATH in current shell"
echo ""
