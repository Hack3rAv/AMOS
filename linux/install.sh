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

printf "${CYAN}\n"
printf "    _    __  __  ___  ____  \n"
printf "   / \  |  \/  |/ _ \/ ___| \n"
printf "  / _ \ | |\/| | | | \___ \ \n"
printf " / ___ \| |  | | |_| |___) |\n"
printf "/_/   \_\_|  |_|\___/|____/ \n"
printf "${NC}\n"
printf "${PURPLE}Avrodip's Minecraft Operating System - Linux System Setup${NC}\n"
printf "${CYAN}------------------------------------------------------------${NC}\n"

# Ensure root privileges
if [ "$EUID" -ne 0 ]; then
  printf "${RED}[!] Error: Please run this installer as root (e.g. sudo bash linux/install.sh)${NC}\n"
  exit 1
fi

INSTALL_DIR="/opt/amos"

# Dynamically locate AMOS repository root folder containing backend/package.json
SEARCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR=""
while [ "$SEARCH_DIR" != "/" ] && [ "$SEARCH_DIR" != "." ]; do
    if [ -f "$SEARCH_DIR/backend/package.json" ]; then
        SCRIPT_DIR="$SEARCH_DIR"
        break
    fi
    SEARCH_DIR="$(cd "$SEARCH_DIR/.." && pwd)"
done

if [ -z "$SCRIPT_DIR" ]; then
    if [ -f "$(pwd)/backend/package.json" ]; then
        SCRIPT_DIR="$(pwd)"
    else
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    fi
fi

LINUX_DIR="$SCRIPT_DIR/linux"

printf "${YELLOW}[1/6] Detecting System & Installing Package Dependencies...${NC}\n"

if [ -f /etc/debian_version ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl wget git jq unzip tar psmisc lsof sqlite3 build-essential
    
    # Install Node.js 20 LTS if node not present or version < 18
    if ! command -v node >/dev/null 2>&1; then
        printf "${CYAN}[+] Installing Node.js 20.x LTS...${NC}\n"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi

    # Install OpenJDK 21 JRE for PaperMC 1.20.6
    if ! command -v java >/dev/null 2>&1; then
        printf "${CYAN}[+] Installing OpenJDK 21 JRE...${NC}\n"
        apt-get install -y openjdk-21-jre-headless || apt-get install -y openjdk-17-jre-headless
    fi

elif [ -f /etc/redhat-release ]; then
    dnf install -y curl wget git jq unzip tar psmisc lsof sqlite3 gcc gcc-c++ make || yum install -y curl wget git jq unzip tar psmisc lsof sqlite3 gcc gcc-c++ make
    if ! command -v node >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        dnf install -y nodejs || yum install -y nodejs
    fi
    if ! command -v java >/dev/null 2>&1; then
        dnf install -y java-21-openjdk-headless || dnf install -y java-17-openjdk-headless || yum install -y java-11-openjdk
    fi
elif [ -f /etc/arch-release ]; then
    pacman -Sy --noconfirm curl wget git jq unzip tar psmisc lsof sqlite gcc make nodejs npm jre21-openjdk-headless
else
    printf "${YELLOW}[!] Custom Linux distribution. Proceeding with existing Node.js & Java...${NC}\n"
fi

# Verify Node & Java installation
NODE_VER=$(node -v 2>/dev/null || echo "Not Found")
JAVA_VER=$(java -version 2>&1 | head -n 1 || echo "Not Found")

printf "${GREEN}[OK] Node.js Version: ${NODE_VER}${NC}\n"
printf "${GREEN}[OK] Java Version:   ${JAVA_VER}${NC}\n"

printf "${YELLOW}[2/6] Setting up Fresh AMOS Directory Structure at ${INSTALL_DIR}...${NC}\n"
mkdir -p "$INSTALL_DIR"

if [ ! -f "$SCRIPT_DIR/backend/package.json" ]; then
    printf "${RED}[!] Error: Could not locate backend/package.json in '${SCRIPT_DIR}'.${NC}\n"
    printf "${YELLOW}[!] Please run install.sh from inside the AMOS repository folder (e.g. cd ~/AMOS && sudo bash linux/install.sh)${NC}\n"
    exit 1
fi

if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
    printf "${CYAN}[+] Installing clean AMOS core files to ${INSTALL_DIR}...${NC}\n"
    
    printf "    -> Copying backend engine...\n"
    rm -rf "$INSTALL_DIR/backend"
    cp -r "$SCRIPT_DIR/backend" "$INSTALL_DIR/backend"
    rm -rf "$INSTALL_DIR/backend/node_modules" "$INSTALL_DIR/backend/"*.sqlite* "$INSTALL_DIR/backend/"*.db 2>/dev/null || true
    
    printf "    -> Copying frontend application...\n"
    rm -rf "$INSTALL_DIR/frontend"
    cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/frontend"
    rm -rf "$INSTALL_DIR/frontend/node_modules" "$INSTALL_DIR/frontend/dist" 2>/dev/null || true
    
    # Extract frontend assets if assets.zip exists in the copied directory
    if [ -f "$INSTALL_DIR/frontend/public/assets/assets.zip" ]; then
        printf "    -> Extracting frontend assets.zip...\n"
        unzip -q -o "$INSTALL_DIR/frontend/public/assets/assets.zip" -d "$INSTALL_DIR/frontend/public/assets/"
        rm -f "$INSTALL_DIR/frontend/public/assets/assets.zip"
    fi
    if [ -f "$INSTALL_DIR/frontend/public/assets/master.zip" ]; then
        rm -f "$INSTALL_DIR/frontend/public/assets/master.zip"
    fi
    
    printf "    -> Copying linux control scripts...\n"
    rm -rf "$INSTALL_DIR/linux"
    cp -r "$SCRIPT_DIR/linux" "$INSTALL_DIR/linux"
    
    printf "${GREEN}[OK] Core files copied and assets extracted successfully!${NC}\n"
fi

# Ensure fresh empty server_data directory
mkdir -p "$INSTALL_DIR/server_data"
# Ensure any copied db files are wiped for a 100% fresh setup
rm -f "$INSTALL_DIR/backend/panel.sqlite"*
rm -f "$INSTALL_DIR/backend/database.sqlite"*
rm -f "$INSTALL_DIR/backend/database.db"*

cd "$INSTALL_DIR"

printf "${YELLOW}[3/6] Installing Backend & Frontend NPM Packages...${NC}\n"
printf "${CYAN}[+] Installing Backend Dependencies & Compiling Native SQLite3 Module...${NC}\n"
cd "$INSTALL_DIR/backend"
npm install --production=false
npm rebuild sqlite3 --build-from-source || npm install sqlite3 --build-from-source
printf "${GREEN}[OK] Backend dependencies & native sqlite3 module compiled successfully!${NC}\n"

printf "${CYAN}[+] Installing Frontend Dependencies...${NC}\n"
cd "$INSTALL_DIR/frontend"
npm install
printf "${GREEN}[OK] Frontend dependencies installed successfully!${NC}\n"

printf "${CYAN}[+] Compiling Production Web App Bundle with Vite (building assets & chunks, please wait...)${NC}\n"
NODE_OPTIONS="--max-old-space-size=4096" npm run build
printf "${GREEN}[OK] Web App production bundle compiled successfully!${NC}\n"

printf "${YELLOW}[4/6] Installing Systemd Background Daemon (amos.service)...${NC}\n"
cp "$LINUX_DIR/amos.service" /etc/systemd/system/amos.service
chmod 644 /etc/systemd/system/amos.service
systemctl daemon-reload

printf "${YELLOW}[5/6] Installing Global 'amos' Command Line Tool...${NC}\n"
cp "$LINUX_DIR/amos" /usr/local/bin/amos
chmod +x /usr/local/bin/amos
if [ -d /usr/bin ]; then
    ln -sf /usr/local/bin/amos /usr/bin/amos 2>/dev/null || true
fi

printf "${YELLOW}[6/6] Enabling & Starting AMOS Background Service...${NC}\n"
systemctl enable amos.service
systemctl restart amos.service

sleep 2

LOCAL_IPS=$(hostname -I 2>/dev/null || ip addr show | grep -oP 'inet \K[\d.]+' | grep -v '127.0.0.1')
PUBLIC_IP=$(curl -s --max-time 2 https://api.ipify.org 2>/dev/null || echo "Unavailable")

printf "${GREEN}\n"
printf "============================================================\n"
printf "    [OK] AMOS (Avrodip's Minecraft Operating System) INSTALLED!  \n"
printf "============================================================\n"
printf "${NC}\n"
printf "  The AMOS daemon is now running as a background service.\n"
printf "  It consumes minimal RAM and auto-starts on system boot.\n\n"
printf "${CYAN}[ Web Panel Access Portal ]${NC}\n"
for ip in $LOCAL_IPS; do
    printf "  -> Local URL:  ${GREEN}http://${ip}:3001${NC}\n"
done
if [ "$PUBLIC_IP" != "Unavailable" ]; then
    printf "  -> Public URL: ${GREEN}http://${PUBLIC_IP}:3001${NC}\n"
fi
printf "\n"
printf "${CYAN}[ AMOS Command Line Usage ]${NC}\n"
printf "  ${YELLOW}amos status${NC}   - Check daemon status, server state & portal IPs\n"
printf "  ${YELLOW}amos ip${NC}       - Display access portal URLs & IP addresses\n"
printf "  ${YELLOW}amos start${NC}    - Start the background daemon service\n"
printf "  ${YELLOW}amos stop${NC}     - Stop the background daemon service\n"
printf "  ${YELLOW}amos restart${NC}  - Restart the background daemon service\n"
printf "  ${YELLOW}amos logs${NC}     - Stream live system logs\n\n"
printf "${GREEN}Installation finished successfully!${NC}\n"