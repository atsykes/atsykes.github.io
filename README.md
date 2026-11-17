# AS-2027: Andrew Sykes portfolio

A static site in the "Datasheet" direction: one typeface (Archivo) at three widths, IBM Plex Mono for signal names, and a single solder-mask green accent. It uses plain HTML and CSS plus about 30 lines of JavaScript, with no framework and no build step.

## Run it locally

From this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` by double-clicking works too, but the 404 page and some browser features behave better through a local server.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Home: pinout hero, projects, experience, about, contact |
| `projects/noc-router.html` | NoC router write-up |
| `projects/simd-processor.html` | SIMD processor write-up |
| `404.html` | Not-found page (GitHub Pages uses it automatically) |
| `css/tokens.css` | Every color, font size, space, and the font files. Change the look here. |
| `css/base.css` | Layout and components. It uses only the tokens. |
| `js/site.js` | Header on scroll, copy-email button, router and pipeline animations |
| `js/wave-viewer.js` | Interactive waveform viewer on the SIMD page |
| `js/waves-data.js` | Waveform data for the viewer, generated from the VCDs by `../wave-tools/build.py`. Don't edit by hand. |
| `fonts/` | Archivo (variable) and IBM Plex Mono, WOFF2, with their OFL licenses |
| `images/` | Favicon, share image, and your photos |
| `AndrewSykes_Resume.pdf` | The resume behind every Resume link. Replace it to update. |
| `archive-v1/` | The first quick version of the site, kept for reference. Safe to delete. |
| `directions/` | The design exploration pages. Not linked from the site. Safe to delete. |

## Add your photos

Each placeholder is a hatched box with a comment right above it showing the exact `<img>` line to paste. For example, for the headshot in `index.html`:

1. Export the photo as WebP (or JPG) at about 800×1000 px for portraits, or 2100×900 px for the full-width hot-fire photo.
2. Save it in `images/` with the file name shown in the placeholder, for example `images/headshot.webp`.
3. Replace the `<div class="ph ...">...</div>` line with the `<img>` line from the comment, and write a real `alt` description.

| Placeholder | Page | File | Shape |
| --- | --- | --- | --- |
| Hot-fire test photo | Not shown for now (removed from Experience in Nov 2026; file kept) | `images/lpl-hotfire.webp` | 21:9, full width |
| Headshot | Home, About | `images/headshot.webp` | 4:5 |
| Drumline photo | Home, About | `images/drumline.webp` | 4:5 |
| NoC waveform | NoC page | `images/noc-waveform.webp` | 16:9 |

Waveform screenshots look best cropped tight to the signals you're discussing, with the signal names visible.

## Edit text

All text is in the HTML files. When you update the site, change the `Rev.` date in each page's footer, because it tells visitors the site is current.

## Publish on GitHub Pages

1. On GitHub, create a public repository named `<your-username>.github.io`.
2. Upload the contents of this folder to it, keeping the folder structure.
3. In the repository, go to Settings, then Pages, and set the source to "Deploy from a branch," `main`, `/ (root)`.
4. After a minute or two the site is live at `https://<your-username>.github.io`.

The site's address is https://atsykes.com. The `CNAME` file tells GitHub Pages to serve it there, and `og:image` on the home page already uses the full URL so LinkedIn previews show the share image.

The 404 page uses root-relative paths, so it expects the site at the root of the domain, which is what a `<username>.github.io` repository gives you.

## Fonts and licenses

Archivo (Omnibus-Type) and IBM Plex Mono (IBM) are under the SIL Open Font License 1.1, which allows self-hosting on a website. The license files are in `fonts/`.
