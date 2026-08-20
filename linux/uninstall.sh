#!/usr/bin/env bash
# ==============================================================================
#  AMOS (Avrodip's Minecraft Operating System) - Complete Linux Uninstaller
# ==============================================================================
#  Usage: sudo bash linux/uninstall.sh or amos uninstall
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

if [ "$EUID" -ne 0 ]; then
  printf "${RED}[!] Error: Please run uninstaller as root (e.g. sudo amos uninstall or sudo bash linux/uninstall.sh)${NC}\n"
  exit 1
fi

printf "${RED}\n"
printf "============================================================\n"
printf "    [!] WARNING: UNINSTALLING AMOS (THIS CANNOT BE REVERSED) \n"
printf "============================================================\n"
printf "${NC}\n"
printf "${YELLOW}This will stop all running AMOS services, remove systemd background daemons,${NC}\n"
printf "${YELLOW}delete the command-line tool, and remove /opt/amos completely.${NC}\n\n"

# Prompt 1: Confirmation warning
read -p "Are you sure you want to completely uninstall AMOS? [y/N]: " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    printf "${CYAN}[+] Uninstallation cancelled.${NC}\n"
    exit 0
fi

# Prompt 2: Save worlds & server data before wiping
printf "\n${CYAN}Would you like to preserve your Minecraft worlds & server data before wiping?${NC}\n"
read -p "Save worlds & server data to a safe backup zip file? [Y/n]: " SAVE_DATA

SAVE_DATA=${SAVE_DATA:-Y}
INSTALL_DIR="/opt/amos"
BACKUP_PATH=""

if [[ "$SAVE_DATA" == "y" || "$SAVE_DATA" == "Y" ]]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_PATH="/root/amos_world_safeguard_${TIMESTAMP}.tar.gz"
    if [ -d "$INSTALL_DIR/server_data" ]; then
        printf "${YELLOW}[+] Creating safe world backup archive at ${BACKUP_PATH}...${NC}\n"
        tar -czf "$BACKUP_PATH" -C "$INSTALL_DIR/server_data" . 2>/dev/null || true
        printf "${GREEN}[OK] Safeguard backup saved successfully to ${BACKUP_PATH}!${NC}\n"
    fi
fi

printf "\n${YELLOW}[1/4] Stopping & Disabling AMOS Systemd Background Service...${NC}\n"
systemctl stop amos.service 2>/dev/null || true
systemctl disable amos.service 2>/dev/null || true

printf "${YELLOW}[2/4] Removing Systemd Service File...${NC}\n"
rm -f /etc/systemd/system/amos.service
systemctl daemon-reload 2>/dev/null || true

printf "${YELLOW}[3/4] Removing Global 'amos' Command Line Tool...${NC}\n"
rm -f /usr/local/bin/amos /usr/bin/amos

printf "${YELLOW}[4/4] Wiping AMOS Core Files (/opt/amos)...${NC}\n"
rm -rf /opt/amos

printf "${GREEN}\n"
printf "============================================================\n"
printf "    [OK] AMOS HAS BEEN COMPLETELY UNINSTALLED CLEANLY!    \n"
printf "============================================================\n"
printf "${NC}\n"
if [ -n "$BACKUP_PATH" ] && [ -f "$BACKUP_PATH" ]; then
    printf "Your saved world & server data backup is safely located at:\n"
    printf "  -> ${GREEN}${BACKUP_PATH}${NC}\n\n"
fi
