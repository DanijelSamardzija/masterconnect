# Kako generisati PNG ikonice iz SVG-a

## Opcija 1: Online (Najlakše - 2 minuta)

1. Idi na: https://realfavicongenerator.net/
2. Upload `public/icon.svg`
3. Klikni "Generate your Favicons and HTML code"
4. Download ZIP fajl
5. Izvuci PNG fajlove u `public/` folder

## Opcija 2: CloudConvert (Batch konverzija)

1. Idi na: https://cloudconvert.com/svg-to-png
2. Upload `public/icon.svg`
3. Podesi rezoluciju (512x512, 192x192, itd.)
4. Convert i download

## Opcija 3: Lokalno sa ImageMagick (ako imaš instaliran)

```bash
# Instaliraj ImageMagick (MacOS)
brew install imagemagick

# Ili Linux
sudo apt-get install imagemagick

# Generiši PNG fajlove
convert public/icon.svg -resize 512x512 public/icon-512.png
convert public/icon.svg -resize 192x192 public/icon-192.png
convert public/icon.svg -resize 180x180 public/apple-touch-icon.png
convert public/icon.svg -resize 152x152 public/icon-152.png
convert public/icon.svg -resize 144x144 public/icon-144.png
convert public/icon.svg -resize 120x120 public/icon-120.png
convert public/icon.svg -resize 96x96 public/icon-96.png
convert public/icon.svg -resize 72x72 public/icon-72.png
convert public/icon.svg -resize 48x48 public/icon-48.png
convert public/icon.svg -resize 32x32 public/favicon.ico
```

## Opcija 4: VS Code Extension

Instaliraj "SVG Export" extension u VS Code:
1. Otvori `public/icon.svg`
2. Right click → "Export SVG"
3. Izaberi veličine

## Potrebne veličine:

- 512x512 (Android/PWA main)
- 192x192 (Android/PWA secondary)
- 180x180 (Apple touch icon)
- 152x152 (iPad)
- 144x144 (Microsoft)
- 120x120 (iPhone)
- 96x96, 72x72, 48x48 (razne platforme)
- 32x32, 16x16 (favicon.ico)
