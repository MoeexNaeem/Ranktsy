#!/usr/bin/env bash
# Lock the origin so ONLY Cloudflare can reach the website ports (80/443).
#
# Why: the server IP is publicly reachable, so anyone can skip Cloudflare, hit
# the server directly and send a fake CF-Connecting-IP header to dodge the app's
# per-IP limits (and Cloudflare's own protection). After this, ports 80/443 accept
# Cloudflare's published ranges only. SSH, the aaPanel port and everything else
# are NOT touched, so you cannot lock yourself out of the server or the panel.
#
# Usage (as root, on the server):
#   bash cloudflare-only-firewall.sh            # DRY RUN: shows what it would do
#   bash cloudflare-only-firewall.sh --apply    # apply
#   bash cloudflare-only-firewall.sh --undo     # restore open 80/443
#
# Requires firewalld (CentOS/Rocky/Alma default). Re-run with --apply whenever
# Cloudflare publishes new ranges (rarely; https://www.cloudflare.com/ips/).
set -euo pipefail

MODE="${1:-dry}"
run() { if [ "$MODE" = "--apply" ] || [ "$MODE" = "--undo" ]; then echo "+ $*"; eval "$@"; else echo "[dry-run] $*"; fi; }

if ! command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewalld is not installed. Tell Claude what 'systemctl status firewalld' and 'iptables -S | head' show."; exit 1
fi
if [ "$(firewall-cmd --state 2>/dev/null || true)" != "running" ]; then
  echo "firewalld is installed but not running. Start it from aaPanel (Security > Firewall) first, then re-run."; exit 1
fi

ZONE="$(firewall-cmd --get-default-zone)"
echo "== Zone: $ZONE"
echo "== BEFORE:"; firewall-cmd --zone="$ZONE" --list-all

if [ "$MODE" = "--undo" ]; then
  run "firewall-cmd --permanent --zone=$ZONE --add-service=http --add-service=https"
  for fam in ipv4 ipv6; do set="cf_${fam}"
    for p in 80 443; do
      run "firewall-cmd --permanent --zone=$ZONE --remove-rich-rule='rule family=\"$fam\" source ipset=\"$set\" port port=\"$p\" protocol=\"tcp\" accept' || true"
    done
  done
  run "firewall-cmd --reload"
  echo "== Restored: 80/443 open to everyone."; exit 0
fi

TMP="$(mktemp -d)"
curl -fsS https://www.cloudflare.com/ips-v4 -o "$TMP/v4"
curl -fsS https://www.cloudflare.com/ips-v6 -o "$TMP/v6"
[ -s "$TMP/v4" ] && [ -s "$TMP/v6" ] || { echo "Could not download Cloudflare ranges; nothing changed."; exit 1; }
echo "== Cloudflare ranges: $(wc -l < "$TMP/v4") IPv4, $(wc -l < "$TMP/v6") IPv6"

for fam in ipv4 ipv6; do
  set="cf_${fam}"; file="$TMP/v${fam#ipv}"
  if firewall-cmd --permanent --get-ipsets | tr ' ' '\n' | grep -qx "$set"; then
    run "firewall-cmd --permanent --delete-ipset=$set"
  fi
  if [ "$fam" = "ipv6" ]; then run "firewall-cmd --permanent --new-ipset=$set --type=hash:net --option=family=inet6"
  else run "firewall-cmd --permanent --new-ipset=$set --type=hash:net"; fi
  run "firewall-cmd --permanent --ipset=$set --add-entries-from-file=$file"
  for p in 80 443; do
    run "firewall-cmd --permanent --zone=$ZONE --add-rich-rule='rule family=\"$fam\" source ipset=\"$set\" port port=\"$p\" protocol=\"tcp\" accept'"
  done
done

# Close the world-open web ports (Cloudflare keeps access through the rules above).
run "firewall-cmd --permanent --zone=$ZONE --remove-service=http --remove-service=https || true"
run "firewall-cmd --permanent --zone=$ZONE --remove-port=80/tcp --remove-port=443/tcp || true"
# The Next.js app port must never be public (nginx proxies to it locally).
run "firewall-cmd --permanent --zone=$ZONE --remove-port=3000/tcp || true"
run "firewall-cmd --reload"

echo "== AFTER:"; [ "$MODE" = "--apply" ] && firewall-cmd --zone="$ZONE" --list-all || echo "(dry run: nothing changed. Re-run with --apply.)"
echo
echo "Check: https://rankkw.com must still load. Direct http://<server-ip> should now time out."
echo "If anything is wrong: bash $0 --undo"
