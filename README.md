# Everdrift

**Everdrift** is a polished, dependency-free endless browser game. You pilot a luminous glider through a procedural space field, collect light, chain a resonance multiplier, and phase through hazards. The field scales forever—there is no win screen and no final level.

## Play online

- **Live game:** https://genzadelio.github.io/everdrift/
- **Source:** https://github.com/genZadelio/everdrift

## Play

Open `index.html` directly, or serve the folder locally:

```powershell
python -m http.server 8080 --directory everdrift
```

Then visit `http://127.0.0.1:8080`.

### Controls

- **WASD / arrow keys** — steer
- **Mouse or touch** — steer toward the pointer
- **Space** — phase shift (temporary invulnerability)
- **P / Escape** — pause

## Features

- Infinite procedural field with recurring biomes and scaling difficulty
- Five collectible types, chaining resonance, hull damage, and phase charges
- Particle effects, generated sound, responsive touch controls, and reduced-motion support
- Persistent personal best, pause/restart flow, milestone callouts, and install prompt
- Installable PWA with an offline app shell
- No runtime dependencies or external assets

## Deploy

The game is deployed to GitHub Pages from the `main` branch at https://genzadelio.github.io/everdrift/. The folder is also ready for any static host: for Netlify, use this folder as the publish directory. `netlify.toml` supplies secure cache and content-security headers for that target.
