#!/usr/bin/env bash
# ==============================================================================
#  AMOS (Avrodip's Minecraft Operating System) - Dedicated Linux Installer
# ==============================================================================
#  Usage: sudo bash linux/install.sh
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "    _    __  __  ___  ____  "
echo "   / \  |  \/  |/ _ \/ ___| "
echo "  / _ \ | |\/| | | | \___ \ "
echo " / ___ \| |  | | |_| |___) |"
echo "/_/   \_\_|  |_|\___/|____/ "
echo -e "${NC}"
echo -e "${PURPLE}Avrodip's Minecraft Operating System - Linux System Setup${NC}"
echo -e "${CYAN}------------------------------------------------------------${NC}"

# Ensure root privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] Error: Please run this installer as root (e.g. sudo bash linux/install.sh)${NC}"
  exit 1
fi

INSTALL_DIR="/opt/amos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINUX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}[1/6] Detecting System & Installing Package Dependencies...${NC}"

if [ -f /etc/debian_version ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl wget git jq unzip tar psmisc lsof sqlite3 build-essential
    
    # Install Node.js 20 LTS if node not present or version < 18
    if ! command -v node &> /dev/null; then
        echo -e "${CYAN}[+] Installing Node.js 20.x LTS...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi

    # Install OpenJDK 21 JRE for PaperMC 1.20.6
    if ! command -v java &> /dev/null; then
        echo -e "${CYAN}[+] Installing OpenJDK 21 JRE...${NC}"
        apt-get install -y openjdk-21-jre-headless || apt-get install -y openjdk-17-jre-headless
    fi

elif [ -f /etc/redhat-release ]; then
    dnf install -y curl wget git jq unzip tar psmisc lsof sqlite3 gcc gcc-c++ make || yum install -y curl wget git jq unzip tar psmisc lsof sqlite3 gcc gcc-c++ make
    if ! command -v node &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        dnf install -y nodejs || yum install -y nodejs
    fi
    if ! command -v java &> /dev/null; then
        dnf install -y java-21-openjdk-headless || dnf install -y java-17-openjdk-headless || yum install -y java-11-openjdk
    fi
elif [ -f /etc/arch-release ]; then
    pacman -Sy --noconfirm curl wget git jq unzip tar psmisc lsof sqlite gcc make nodejs npm jre21-openjdk-headless
else
    echo -e "${YELLOW}[!] Custom Linux distribution. Proceeding with existing Node.js & Java...${NC}"
fi

# Verify Node & Java installation
NODE_VER=$(node -v 2>/dev/null || echo "Not Found")
JAVA_VER=$(java -version 2>&1 | head -n 1 || echo "Not Found")

echo -e "${GREEN}[✔] Node.js Version: ${NODE_VER}${NC}"
echo -e "${GREEN}[✔] Java Version:   ${JAVA_VER}${NC}"

echo -e "${YELLOW}[2/6] Setting up AMOS Directory Structure at ${INSTALL_DIR}...${NC}"
mkdir -p "$INSTALL_DIR"

if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
    echo -e "${CYAN}[+] Copying codebase to ${INSTALL_DIR}...${NC}"
    rsync -a --exclude='node_modules' --exclude='.git' "$SCRIPT_DIR/" "$INSTALL_DIR/" || cp -r "$SCRIPT_DIR/"* "$INSTALL_DIR/" 2>/dev/null || true
fi

cd "$INSTALL_DIR"

echo -e "${YELLOW}[3/6] Installing Backend & Frontend NPM Packages...${NC}"
echo -e "${CYAN}[+] Installing Backend Dependencies...${NC}"
cd "$INSTALL_DIR/backend"
npm install --production=false

echo -e "${CYAN}[+] Installing Frontend Dependencies & Compiling Production Bundle...${NC}"
cd "$INSTALL_DIR/frontend"
npm install
npm run build

echo -e "${YELLOW}[4/6] Installing Systemd Background Daemon (amos.service)...${NC}"
cp "$LINUX_DIR/amos.service" /etc/systemd/system/amos.service
chmod 644 /etc/systemd/system/amos.service
systemctl daemon-reload

echo -e "${YELLOW}[5/6] Installing Global 'amos' Command Line Tool...${NC}"
cp "$LINUX_DIR/amos" /usr/local/bin/amos
chmod +x /usr/local/bin/amos
if [ -d /usr/bin ]; then
    ln -sf /usr/local/bin/amos /usr/bin/amos 2>/dev/null || true
fi

echo -e "${YELLOW}[6/6] Enabling & Starting AMOS Background Service...${NC}"
systemctl enable amos.service
systemctl restart amos.service

sleep 2

LOCAL_IPS=$(hostname -I 2>/dev/null || ip addr show | grep -oP 'inet \K[\d.]+' | grep -v '127.0.0.1')
PUBLIC_IP=$(curl -s --max-time 2 https://api.ipify.org 2>/dev/null || echo "Unavailable")

echo -e "${GREEN}"
echo "============================================================"
echo "    ✔ AMOS (Avrodip's Minecraft Operating System) INSTALLED!  "
echo "============================================================"
echo -e "${NC}"
echo -e "  The AMOS daemon is now running as a background service."
echo -e "  It consumes minimal RAM and auto-starts on system boot."
echo ""
echo -e "${CYAN}[ Web Panel Access Portal ]${NC}"
for ip in $LOCAL_IPS; do
    echo -e "  ➜ Local URL:  ${GREEN}http://${ip}:3001${NC}"
done
if [ "$PUBLIC_IP" != "Unavailable" ]; then
    echo -e "  ➜ Public URL: ${GREEN}http://${PUBLIC_IP}:3001${NC}"
fi
echo ""
echo -e "${CYAN}[ AMOS Command Line Usage ]${NC}"
echo -e "  ${YELLOW}amos status${NC}   - Check daemon status, server state & portal IPs"
echo -e "  ${YELLOW}amos ip${NC}       - Display access portal URLs & IP addresses"
echo -e "  ${YELLOW}amos start${NC}    - Start the background daemon service"
echo -e "  ${YELLOW}amos stop${NC}     - Stop the background daemon service"
echo -e "  ${YELLOW}amos restart${NC}  - Restart the background daemon service"
echo -e "  ${YELLOW}amos logs${NC}     - Stream live system logs"
echo ""
echo -e "${GREEN}Installation finished successfully!${NC}"
