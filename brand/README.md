# ExitRadar — Brand & Social Kit

Social/brand assets for **exitradar.fun**, generated to match the live site's
palette, fonts, and radar-reticle logo.

## Palette
| Token        | Hex       | Use                                  |
|--------------|-----------|--------------------------------------|
| Background   | `#08090a` | Page / canvas                        |
| Panel        | `#0c0d0f` | Cards, panels                        |
| White        | `#fafafa` | Primary text                         |
| **Green**    | `#5fd39a` | Accent — realized / "out" / dot      |
| Green (dim)  | `#3f8f69` | Secondary green, kickers             |
| Muted        | `#a1a1aa` | Body text                            |
| Muted (dark) | `#71717a` | Secondary line of the headline       |

## Fonts
- **Hanken Grotesk** — headings & wordmark (SemiBold / ExtraBold)
- **IBM Plex Mono** — kickers, pills, data, footer

Both are SIL OFL. They are **not** committed (see `.gitignore`); download them
into `brand/fonts/` to regenerate (commands below).

## Logos
| File                      | Background | Use                                            |
|---------------------------|------------|------------------------------------------------|
| `exitradar-logo-green.png`| transparent| **Default.** Visible on light *and* dark.      |
| `exitradar-logo-white.png`| transparent| Dark backgrounds only.                         |
| `exitradar-logo-dark.png` | brand black| Drop-in on light surfaces / dark sections.     |
| `exitradar-avatar.png`    | rounded tile| X / social **profile picture**.               |

> The white mark is white-on-transparent, so it looks blank on a white page —
> use `-green` or `-dark` there.

## Social images
| File                              | Size      | Use                                   |
|-----------------------------------|-----------|---------------------------------------|
| `exitradar-banner-1-hero.png`     | 1600×900  | Tweet image — centered hero           |
| `exitradar-banner-2-feed.png`     | 1600×900  | Tweet image — live realized-exits feed|
| `exitradar-banner-3-statement.png`| 1600×900  | Tweet image — bold statement          |
| `exitradar-banner-4-features.png` | 1600×900  | Tweet image — three pillars           |
| `exitradar-header.png`            | 1500×500  | X profile header / cover              |

## Regenerate
```bash
pip install Pillow
mkdir -p brand/fonts && cd brand/fonts
base=https://raw.githubusercontent.com/google/fonts/main/ofl
curl -fsSL "$base/hankengrotesk/HankenGrotesk%5Bwght%5D.ttf" -o HankenGrotesk-var.ttf
curl -fsSL "$base/ibmplexmono/IBMPlexMono-Regular.ttf"  -o IBMPlexMono-Regular.ttf
curl -fsSL "$base/ibmplexmono/IBMPlexMono-Medium.ttf"   -o IBMPlexMono-Medium.ttf
curl -fsSL "$base/ibmplexmono/IBMPlexMono-SemiBold.ttf" -o IBMPlexMono-SemiBold.ttf
cd .. && python3 make_assets.py   # writes the PNGs into brand/
```

_Numbers in the feed banner are illustrative placeholders._
