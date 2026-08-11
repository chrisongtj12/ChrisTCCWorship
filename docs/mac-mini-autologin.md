# Mac mini auto-login (worship-stand display)

Enable **automatic login** on the Mac mini that runs the TCC Worship Setlist
Viewer, so it boots straight to the desktop with no password prompt and comes
back up on its own after a power blip. Optionally have it open the worship app
on login.

> Run everything **on the Mac mini itself**. These steps change local macOS
> settings — they can't be done remotely from this repo / CI.

## Quick start (script)

From a clone of this repo on the Mac mini:

```bash
# Bare auto-login for the "worship" account:
sudo ./scripts/setup-mac-mini-autologin.sh --user worship

# Auto-login AND open the app on login, kept awake:
sudo ./scripts/setup-mac-mini-autologin.sh --user worship --open-app --disable-sleep

# Full unattended display: auto-login + Chrome fullscreen kiosk on the app:
sudo ./scripts/setup-mac-mini-autologin.sh --user worship --open-app --kiosk --disable-sleep
```

You'll be prompted for the account password (macOS needs it to build the
`/etc/kcpassword` file that drives auto-login). Reboot to test:

```bash
sudo shutdown -r now
```

To turn auto-login back off:

```bash
sudo ./scripts/setup-mac-mini-autologin.sh --disable
```

### Options

| Flag | What it does |
| --- | --- |
| `--user <shortname>` | Account to auto-login (short name, as shown by `whoami`). Prompted if omitted. |
| `--open-app` | Install a login item that opens `https://chris-tcc-worship.vercel.app` on login. |
| `--kiosk` | With `--open-app`, launch **Google Chrome** fullscreen kiosk instead of the default browser. |
| `--disable-sleep` | Keep the system, display and disk awake (always-on display). |
| `--disable` | Turn auto-login off and remove `/etc/kcpassword`. |

## Heads-up

- **FileVault must be OFF.** FileVault disk encryption requires a password at
  the pre-boot screen and overrides auto-login. Check with `fdesetup status`;
  turn it off in **System Settings ▸ Privacy & Security ▸ FileVault**.
- The account password is stored in obfuscated (not securely encrypted) form in
  `/etc/kcpassword`, readable only by root. This is how macOS auto-login works —
  treat the Mac mini as physically trusted (it's a worship-stand machine).
- Auto-login applies on a full **boot/restart**. After **logging out** or
  **locking**, macOS still shows the login screen — that's expected.

## Doing it by hand (no script)

If you'd rather use the GUI:

1. **System Settings ▸ Users & Groups ▸ Automatically log in as** → pick the
   account and enter its password.
   (If that control is greyed out, FileVault is on — turn it off first.)
2. To open the app on login: **System Settings ▸ General ▸ Login Items ▸ +**
   and add a small launcher, or add the app/Chrome shortcut there.
3. To keep it awake: **System Settings ▸ Displays ▸ Advanced** (or
   `sudo pmset -a sleep 0 displaysleep 0`).
