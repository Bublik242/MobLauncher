# MobLauncher

A fast, clean, open-source launcher for **Minecraft: Java Edition**.
Швидкий, чистий лаунчер з відкритим кодом для **Minecraft: Java Edition**.

![Play](<img width="1180" height="740" alt="9-play-progress" src="https://github.com/user-attachments/assets/4dfc2085-417e-45e1-8abd-36c579467e11" />
)

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
| ![Builds](<img width="1180" height="740" alt="2-builds (1)" src="https://github.com/user-attachments/assets/344a863f-36bd-4c74-b5d5-ba1ba38782f7" />
) | ![Browser](<img width="1180" height="740" alt="5-browser (1)" src="https://github.com/user-attachments/assets/d5286ced-606f-44b7-b880-41bcf5b910dd" />
) |

| Friends | Friend profile |
|---|---|
| ![Friends](<img width="1180" height="740" alt="6-friends (1)" src="https://github.com/user-attachments/assets/05ef00de-3233-42ef-a2c8-190c2596da09" />
) | ![Profile](<img width="1180" height="740" alt="6c-profile (1)" src="https://github.com/user-attachments/assets/60ce850a-0826-412b-9116-0372e2e6415f" />
) |

| Avatar | Servers |
|---|---|
| ![Avatar](<img width="1180" height="740" alt="7-avatar (1)" src="https://github.com/user-attachments/assets/ff9ebb22-10b7-4d0c-8b89-f1250cb8ccd9" />![Uploading 6-friends (1).png…]()

) | ![Servers](<img width="1180" height="740" alt="8b-servers (2)" src="https://github.com/user-attachments/assets/d9d2401a-869c-49d5-b88b-1873d54598f1" />
) |

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
