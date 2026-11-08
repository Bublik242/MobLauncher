# MobLauncher

A fast, clean, open-source launcher for **Minecraft: Java Edition**.
Швидкий, чистий лаунчер з відкритим кодом для **Minecraft: Java Edition**.

![Play](docs/9-play-progress.png)

## Features
- **Builds (instances)** with their own folders: Vanilla, Fabric, Quilt, Forge, NeoForge
- **All Minecraft versions**; Java is downloaded automatically; one-click **Download** for a new build
- **Built-in browser** for mods, resource packs, shaders and modpacks (Modrinth, CurseForge) with descriptions and images
- **Mod update checker**
- **Accounts:** Microsoft, Ely.by, offline
- **Friends, chat and voice calls** (Microsoft / Ely.by accounts), see what friends play and join them
- **Server list** with online status, players, ping and one-click join
- **3D avatar** viewer, skins and capes
- **Self-repair** and crash analysis
- RAM sliders in MiB and GiB with warnings, many languages (English by default)
- **Uninstall** from Settings (optionally with your game data)

| Builds | Mod browser |
|---|---|
| ![Builds](docs/2-builds.png) | ![Browser](docs/5-browser.png) |

| Friends | Friend profile |
|---|---|
| ![Friends](docs/6-friends.png) | ![Profile](docs/6c-profile.png) |

| Avatar | Servers |
|---|---|
| ![Avatar](docs/7-avatar.png) | ![Servers](docs/8b-servers.png) |

## Install
Download **MobLauncher-Setup-Offline.exe** from the [Releases](../../releases) page and run it.
Windows may show a SmartScreen warning because the app is not code-signed: click *More info → Run anyway*.

## Privacy
Friends see your play time and what you are playing only if you allow it. Both can be turned off in Settings → Privacy. Offline accounts do not connect to the friends service.

## Build from source
Requires Node.js 20+. Run `build-all.bat` (Windows) or see `launcher/` and `installer/`.

## Self-hosting the friends server (optional)
The launcher uses a built-in public friends server. To run your own copy, see [`server/README.md`](server/README.md) and [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Українською
**MobLauncher** — відкритий лаунчер для Minecraft: збірки з власними теками, усі версії, автоматична Java, вбудований пошук модів, ресурспаків і шейдерів (Modrinth, CurseForge), перевірка оновлень модів, акаунти Microsoft / Ely.by / офлайн, друзі з чатом і дзвінками, список серверів, 3D-аватар.
Завантаж `MobLauncher-Setup-Offline.exe` у розділі Releases і запусти. Друзі працюють без налаштувань.

## License
MIT.

> Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
