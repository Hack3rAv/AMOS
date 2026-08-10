# 🐧 AMOS Linux Setup & System Service Integration

This directory contains the dedicated Linux deployment, `systemd` background service configuration, and command-line utility for **AMOS (Avrodip's Minecraft Operating System)**.

---

## 🚀 Quick Automated Installation

To install AMOS on any Linux server (Debian, Ubuntu, RHEL, AlmaLinux, Rocky, Fedora, Arch):

```bash
sudo bash linux/install.sh
```

---

## 🛠️ Included Components

- **`linux/install.sh`**: Automated installer script. Installs Node.js 20 LTS, OpenJDK 21 JRE, builds the Web Panel, installs `amos.service`, and links the global `amos` CLI tool.
- **`linux/amos.service`**: `systemd` unit configuration file for background daemon execution.
- **`linux/amos`**: Global command-line control tool installed to `/usr/local/bin/amos`.

---

## 💻 `amos` Terminal Commands

Once installed, use the `amos` CLI command anywhere in the Linux terminal:

| Command | Action |
| :--- | :--- |
| **`amos status`** | Displays daemon status, server online state, and web portal URLs |
| **`amos ip`** | Displays all local & public Web Access Portal URLs |
| **`amos start`** | Starts the AMOS background daemon (`systemctl start amos`) |
| **`amos stop`** | Stops the AMOS background daemon (`systemctl stop amos`) |
| **`amos restart`** | Restarts the AMOS background daemon (`systemctl restart amos`) |
| **`amos enable`** | Enables AMOS auto-start on system boot (`systemctl enable amos`) |
| **`amos disable`** | Disables AMOS auto-start on system boot (`systemctl disable amos`) |
| **`amos logs`** | Streams live systemd daemon logs (`journalctl -u amos -f`) |
| **`amos help`** | Displays command line menu |
