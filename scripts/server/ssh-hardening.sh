#!/usr/bin/env bash
# Stop SSH password guessing: install fail2ban (bans an IP after 5 failed logins
# for 1 hour, repeat offenders for a week). Safe: it does NOT disable password
# login and does not change the SSH port, so you cannot lock yourself out.
#
# Usage (as root, on the server):  bash ssh-hardening.sh
#
# Optional, stronger (do it ONLY after you can log in with an SSH key): disable
# password logins. See the note printed at the end.
set -euo pipefail

echo "== Your current IP (will be whitelisted so fail2ban never bans you):"
MYIP="$(echo "${SSH_CLIENT:-}" | awk '{print $1}')"
echo "${MYIP:-unknown (run this from an SSH session to auto-whitelist)}"

dnf install -y epel-release
dnf install -y fail2ban

cat > /etc/fail2ban/jail.d/rankkw-sshd.local <<EOF
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 ${MYIP}
bantime  = 1h
findtime = 10m
maxretry = 5
banaction = firewallcmd-rich-rules

[sshd]
enabled = true

[recidive]
enabled  = true
bantime  = 7d
findtime = 1d
maxretry = 5
EOF

# The recidive jail reads fail2ban's own log file, and fail2ban refuses to start if
# that file is missing ("Have not found any log file for recidive jail", seen
# 2026-10-09 on CentOS 9). Log to the file explicitly and make sure it exists.
mkdir -p /etc/fail2ban/fail2ban.d
printf '[Definition]\nlogtarget = /var/log/fail2ban.log\n' > /etc/fail2ban/fail2ban.d/rankkw.local
touch /var/log/fail2ban.log
# Ban through firewalld when it runs (aaPanel's firewall), otherwise nftables directly.
if ! systemctl is-active --quiet firewalld; then
  sed -i 's/^banaction = .*/banaction = nftables-multiport/' /etc/fail2ban/jail.d/rankkw-sshd.local
fi

systemctl enable fail2ban
systemctl restart fail2ban
sleep 3
fail2ban-client status sshd || true

cat <<'NOTE'

Done. Check bans any time:   fail2ban-client status sshd
Unban an IP:                 fail2ban-client set sshd unbanip <ip>

STRONGER, LATER (key-only login). Only after you have added your SSH public key
to /root/.ssh/authorized_keys AND successfully logged in with the key:
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl reload sshd
Keep your current session open while testing a NEW login in another window.
NOTE
