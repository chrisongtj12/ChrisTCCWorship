#!/usr/bin/env bash
#
# setup-mac-mini-autologin.sh
# -----------------------------------------------------------------------------
# Enable (or disable) macOS automatic login on the TCC Worship Mac mini so it
# boots straight to the desktop with no password prompt — handy for an
# unattended worship-stand display that should come back up on its own after a
# power blip.
#
# Optionally it can also open the worship app on login.
#
# RUN THIS ON THE MAC MINI ITSELF (macOS). It cannot be run from CI / Linux —
# it changes local macOS preferences and writes /etc/kcpassword.
#
# Usage:
#   sudo ./scripts/setup-mac-mini-autologin.sh --user <shortname> [options]
#
# Options:
#   --user <shortname>   Account to auto-login (e.g. "worship"). If omitted you
#                        are prompted. Use the short name shown by `whoami`.
#   --open-app           Also install a login item that opens the worship app
#                        ( https://chris-tcc-worship.vercel.app ) on login.
#   --kiosk              With --open-app, launch Google Chrome fullscreen kiosk
#                        instead of the default browser. Requires Chrome.
#   --disable-sleep      Prevent the Mac from sleeping / display from sleeping
#                        (good for an always-on stand display).
#   --disable            Turn OFF auto-login (removes the setting and
#                        /etc/kcpassword) and exit.
#   -h, --help           Show this help.
#
# Notes:
#   * FileVault must be OFF — FileVault disk encryption forces a login at the
#     pre-boot stage and overrides auto-login. The script warns if it's on.
#   * You will be prompted for the account password; it is required to build
#     the obfuscated /etc/kcpassword file that macOS uses for auto-login.
# -----------------------------------------------------------------------------
set -euo pipefail

APP_URL="https://chris-tcc-worship.vercel.app"
LOGINWINDOW_PLIST="/Library/Preferences/com.apple.loginwindow"
KCPASSWORD="/etc/kcpassword"

USERNAME=""
OPEN_APP=false
KIOSK=false
DISABLE_SLEEP=false
DISABLE=false

err()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }

usage() { sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# --- parse args --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)         USERNAME="${2:-}"; shift 2 ;;
    --open-app)     OPEN_APP=true; shift ;;
    --kiosk)        KIOSK=true; shift ;;
    --disable-sleep) DISABLE_SLEEP=true; shift ;;
    --disable)      DISABLE=true; shift ;;
    -h|--help)      usage 0 ;;
    *) err "Unknown option: $1"; usage 1 ;;
  esac
done

# --- guards ------------------------------------------------------------------
if [[ "$(uname -s)" != "Darwin" ]]; then
  err "This script must be run ON the Mac mini (macOS), not $(uname -s)."
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  err "Please run with sudo:  sudo $0 ${*:-}"
  exit 1
fi

# --- disable path ------------------------------------------------------------
if [[ "$DISABLE" == true ]]; then
  info "Disabling automatic login…"
  /usr/bin/defaults delete "$LOGINWINDOW_PLIST" autoLoginUser 2>/dev/null || true
  rm -f "$KCPASSWORD"
  ok "Automatic login disabled. The Mac mini will ask for a password at boot."
  exit 0
fi

# --- resolve user ------------------------------------------------------------
if [[ -z "$USERNAME" ]]; then
  read -r -p "Short name of the account to auto-login: " USERNAME
fi
if [[ -z "$USERNAME" ]]; then
  err "No username given."; exit 1
fi
if ! /usr/bin/dscl . -read "/Users/$USERNAME" >/dev/null 2>&1; then
  err "No local account named '$USERNAME'. Check the short name (see \`whoami\`)."
  exit 1
fi
HOME_DIR="$(/usr/bin/dscl . -read "/Users/$USERNAME" NFSHomeDirectory 2>/dev/null | awk '{print $2}')"
HOME_DIR="${HOME_DIR:-/Users/$USERNAME}"

# --- FileVault warning -------------------------------------------------------
if /usr/bin/fdesetup status 2>/dev/null | grep -q "FileVault is On"; then
  err "WARNING: FileVault is ON. Auto-login will NOT work until FileVault is"
  err "turned off (System Settings ▸ Privacy & Security ▸ FileVault)."
  read -r -p "Continue configuring anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || { info "Aborted."; exit 1; }
fi

# --- prompt for password & build /etc/kcpassword -----------------------------
info "macOS needs the account password to enable password-less auto-login."
read -r -s -p "Password for '$USERNAME': " PW1; echo
read -r -s -p "Confirm password:          " PW2; echo
if [[ "$PW1" != "$PW2" ]]; then err "Passwords do not match."; exit 1; fi

# Obfuscate the password into /etc/kcpassword using the well-known loginwindow
# cipher: XOR each byte against the repeating 11-byte key, padded to a multiple
# of 12 bytes. Perl ships with macOS, so no Python dependency.
PW="$PW1" perl -e '
  my @k = (0x7D,0x89,0x52,0x23,0xD2,0xBC,0xDD,0xEA,0xA3,0xB9,0x1F);
  my @p = unpack("C*", $ENV{PW});
  my $r = scalar(@p) % 12;
  push @p, (0) x (12 - $r) if $r;          # pad to a 12-byte boundary
  for my $i (0..$#p) { $p[$i] ^= $k[$i % 11]; }
  print pack("C*", @p);
' > "$KCPASSWORD"
unset PW1 PW2
chown root:wheel "$KCPASSWORD"
chmod 600 "$KCPASSWORD"

# --- set the auto-login user -------------------------------------------------
/usr/bin/defaults write "$LOGINWINDOW_PLIST" autoLoginUser -string "$USERNAME"
chmod 644 "${LOGINWINDOW_PLIST}.plist" 2>/dev/null || true
ok "Automatic login enabled for '$USERNAME'."

# --- optional: open the worship app on login ---------------------------------
if [[ "$OPEN_APP" == true ]]; then
  AGENT_DIR="$HOME_DIR/Library/LaunchAgents"
  AGENT_PLIST="$AGENT_DIR/com.tcc.worship.openapp.plist"
  mkdir -p "$AGENT_DIR"

  if [[ "$KIOSK" == true ]]; then
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [[ ! -x "$CHROME" ]]; then
      err "--kiosk requested but Google Chrome was not found at:"
      err "  $CHROME"
      err "Install Chrome or drop --kiosk to use the default browser."
      exit 1
    fi
    PROG_ARGS="<string>$CHROME</string>
      <string>--kiosk</string>
      <string>--incognito</string>
      <string>--noerrdialogs</string>
      <string>--disable-session-crashed-bubble</string>
      <string>$APP_URL</string>"
  else
    PROG_ARGS="<string>/usr/bin/open</string>
      <string>$APP_URL</string>"
  fi

  cat > "$AGENT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.tcc.worship.openapp</string>
  <key>ProgramArguments</key>
  <array>
      $PROG_ARGS
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
PLIST
  chown "$USERNAME":staff "$AGENT_PLIST"
  chmod 644 "$AGENT_PLIST"
  ok "Will open the worship app on login → $AGENT_PLIST"
fi

# --- optional: keep the Mac awake --------------------------------------------
if [[ "$DISABLE_SLEEP" == true ]]; then
  /usr/bin/pmset -a sleep 0 displaysleep 0 disksleep 0
  ok "Sleep disabled (system, display and disk will stay awake)."
fi

echo
ok "Done. Reboot the Mac mini to test:  sudo shutdown -r now"
info "To undo later:  sudo $0 --disable"
