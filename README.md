<h1 align="center"><p style="display: inline-flex; align-items: center; gap: 0.25em"><img style="width: 1.5em; height: 1.5em;" src="public/icons/favicon.png">wplacer</p></h1>

<p align="center"><img src="https://img.shields.io/github/package-json/v/luluwaffless/wplacer">
<a href="LICENSE"><img src="https://img.shields.io/github/license/luluwaffless/wplacer"></a>
<a href="https://discord.gg/qbtcWrHJvR"><img src="https://img.shields.io/badge/Support-gray?style=flat&logo=Discord&logoColor=white&logoSize=auto&labelColor=5562ea"></a>
<a href="LEIAME.md"><img src="https://img.shields.io/badge/tradução-português_(brasil)-green"></a>
<a href="LISEZMOI.md"><img src="https://img.shields.io/badge/traduction-français-blue"></a></p>

A massively updated auto-drawing bot for [wplace.live](https://wplace.live/).

## Features ✅

### Web UI (Fully Reworked)
- **Simple Navigation Panel:** One-click access to **Users**, **Add Template**, **Manage Templates**, **Settings**.
- **Manage Users:**
  - Add accounts using **JWT cookie (`j`)** + optional **session cookie (`s`)**.
  - **Account Status Checker:** Parallel/sequential checks (respecting UI cooldown) show **charges / max / level / % / droplets**.
  - **Show Latest Info:** Re-applies last fetched stats (kept in local storage) without refetching.
  - **Hide Sensitive Info:** Masks names/IDs/actions for streams & screenshots.
  - **Quick JSON Peek:** Pretty popup with user info + one-click **Copy raw JSON**.
  - **Bulk “Buy Max Upgrades (All)”**: Purchases **Max Charge** upgrades for every account that can afford them; displays a compact report.
- **Add Template:**
  - **Image → Template converter** (palette mapping to wplace color IDs).
  - **Use paid colors** toggle: exact premium matches allowed; otherwise **nearest basic** color used.
  - **Coordinates parser:** Paste a full URL (`.../pixel/{tx}/{ty}?x={px}&y={py}`) or labeled string — fields **auto-fill**.
  - **Canvas Preview:** Fetches live canvas tiles and overlays the **translucent template** with adjustable preview distance.
  - Per-template toggles: **Paint transparent pixels**, **Buy charges**, **Buy Max upgrades**, **Anti-grief mode**.
  - **Assign users** (multi-select + **Select All**).
- **Manage Templates:**
  - Cards showing **coords**, **assigned accounts**, **progress bar**, **pixel counts**, and **status**.
  - **Start/Stop** per template, plus **Start All / Stop All** actions.
  - **Edit** (opens prefilled Add Template form) and **Delete** (with confirmation).
  - **Full-screen Preview:** Zoom/pan, **toggle overlay**, **highlight mismatches**, and **match % summary**.
- **Active Templates bar:** Floating bar listing running templates with a miniature preview and quick **Stop/Edit** actions.
- **Settings:**
  - **Drawing mode gallery** with animated previews for every mode.
  - **Reference scenes** (Space / Portrait / Typo / Landscape / Dungeon / Emblem), **preview speed** slider, and **seed count** on Burst.
  - Behaviour: **Always draw when ≥1 charge** (or use **Charge Threshold**), optional **Turnstile notifications**.
  - Timings: **Account turn cooldown**, **Purchase cooldown**, **Account check cooldown**, **Anti-grief standby**, **Droplet reserve**.
  - **Proxy panel:** Enable proxying, **rotation mode** (sequential/random), **log proxy usage**, **reload `proxies.txt`**, and **loaded count**.


### Painting Engine & Modes
- **Palette-accurate rendering:** Supports 63 wplace colors (basic + premium). Skips premium colors a specific user doesn’t own.
- **Transparent handling:** `0` means “transparent” in templates. Toggle **Paint transparent pixels** to allow overwriting background.
- **Precise mismatch detection:** Loads remote tiles, decodes pixels to palette IDs, compares against template.
- **Multiple strategies to fit any artwork:**
  - **Linear:** `linear` (Top→Bottom), `linear-reversed` (Bottom→Top), `linear-ltr` (Left→Right), `linear-rtl` (Right→Left).
  - **Spatial:** `radial-inward` (edges to center).
  - **Color-centric:** `singleColorRandom` (random color grouping), `colorByColor` (group by color).
  - **Scatter:** `random`.
  - **Advanced burst family:**
    - **`burst`** — multi-seed BFS with dynamic queue speeds and directional “dash” streaks; seeds persist per template.
    - **`outline-then-burst`** — trace outlines first, then fill interiors.
    - **`colors-burst-rare`** — sort colors by **rarity** ascending, burst each color.
    - **`burst-mixed`** — splits work into segments and randomly mixes *outline / burst / rare* every segment.
- **Seeds:** Global **seed count (1–16)**; **burst seeds persist** across turns and reset on image/coordinate change.

## Previews

### Drawing mods:
(1)
![drawing-mode-preview-1](./preview/drawing-mode-preview-1.gif)
(2)
![drawing-mode-preview-2](./preview/drawing-mode-preview-2.gif)
![manage-templates](./preview/manage-templates.png)
![preview-template-progress](./preview/preview-template-progress.png)

## Installation and Usage 💻

[Video Tutorial](https://www.youtube.com/watch?v=YR978U84LSY)

### Requirements:
- [Node.js and NPM](https://nodejs.org/en/download)
- [Tampermonkey](https://www.tampermonkey.net/)
- [git](https://git-scm.com/downloads) (optional, but recommended)
### Installation:
1. Install the extension on each browser window with an account you want to be used by wplacer and to automatically solve Turnstiles (CAPTCHAs) by going to the extensions page of your browser, turning on developer mode, pressing load unpacked, and then selecting the LOAD_UNPACKED folder included with wplacer.
2. Download the repository using [git](https://git-scm.com/downloads) (`git clone https://github.com/luluwaffless/wplacer.git`) or download the ZIP directly from GitHub (not recommended).
3. In the terminal, navigate to the project directory and install the dependencies with `npm i`.
- If you'd like, you can change the host and port of the local server by creating a `.env` file.
### Usage:
1. To start the bot, run `npm start` in the terminal.
2. Open the URL printed in the console (usually `http://127.0.0.1/`) in your browser.
3. In each browser window with the extension installed, log into your account on wplace.live. If your account does not show up in the manager after refreshing it, you can press on the extension to manually send it to wplacer.
4. Go to the "Add Template" page to create your drawing templates.
   - The coordinates (`Tile X/Y`, `Pixel X/Y`) are for the top-left corner of your image. You can find these by clicking a pixel on wplace.live and inspecting the `pixel` request in the Network tab of DevTools. You can also use the [Blue Marble](https://github.com/SwingTheVine/Wplace-BlueMarble) userscript (user TamperMonkey) to see a pixel's coordinates.
   - You can assign multiple users to a single template.
5. Finally, go to "Manage Templates" and click "Start" on any template to begin drawing.
   - The script will occasionally refresh one of the active bot windows on [wplace.live](https://wplace.live/). This is required to refresh the Turnstile token needed for painting.

## Notes 📝

> [!CAUTION]
> This bot is not affiliated with [wplace.live](https://wplace.live/) and its use may be against the site's rules. The developers are not responsible for any punishments against your accounts. Use at your own risk.

### Running in Docker / non-interactive (non-TTY) environments

Interactive console features (progress bars, cursor movement) are now guarded and will only run when `process.stdout.isTTY` is `true`. In Docker or other non-TTY contexts, these calls are skipped to prevent crashes (for example, `TypeError: process.stdout.clearLine is not a function`).

No interactive features were removed; they simply don't render when there is no TTY.

### Docker start command
The Dockerfile starts the app with `CMD ["node", "."]`.
To pass environment variables when running the container:
  - Use `docker run --env-file .env ...`
  - Or pass specific vars: `docker run -e HOST=0.0.0.0 -e PORT=3000 ...`
  - Or bake defaults via `ENV` in a custom Dockerfile.

- Example docker run command:
`docker run -d --restart always -p 3000:3000 `
  -v "E:\.github\wplacer\data\users.json:/usr/src/app/users.json" `
  -v "E:\.github\wplacer\data\templates.json:/usr/src/app/templates.json" `
  -v "E:\.github\wplacer\data\settings.json:/usr/src/app/settings.json" `
  --name wplacer luluwaffless/wplacer`
Note: HOST and PORT can be omitted if you passed them in the .env file or the Dockerfile.


### Credits 🙏

-   [luluwaffless](https://github.com/luluwaffless)
-   [Jinx](https://github.com/JinxTheCatto)
-   Fork maintainer: [lllexxa](https://github.com/lllexxa)

### License 📜

[GNU AGPL v3](LICENSE)



