#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-gcp-vm.sh
# Run ONCE on the GCP VM to install Docker, Git, and prepare the system.
#
# Usage:
#   bash setup-gcp-vm.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "==> Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Installing prerequisites..."
sudo apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  wget \
  unzip \
  openssl

echo "==> Installing Docker Engine..."
# Remove any old installations
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Adding current user to docker group (no sudo needed for docker)..."
sudo usermod -aG docker "$USER"

echo "==> Starting and enabling Docker service..."
sudo systemctl enable --now docker

echo "==> Verifying Docker installation..."
sudo docker run --rm hello-world

echo "==> Configuring system limits for production containers..."
# Increase file descriptor limits
cat <<'EOF' | sudo tee /etc/security/limits.d/smart-acr.conf
* soft nofile 65536
* hard nofile 65536
EOF

# Tune kernel parameters for web service
cat <<'EOF' | sudo tee /etc/sysctl.d/99-smart-acr.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
vm.overcommit_memory = 1
EOF
sudo sysctl --system

echo ""
echo "======================================================"
echo "  GCP VM setup complete!"
echo "======================================================"
echo ""
echo "IMPORTANT: Log out and back in (or run: newgrp docker)"
echo "so your user can run docker without sudo."
echo ""
echo "Next step: Transfer code to this VM and run deploy-gcp.sh"
