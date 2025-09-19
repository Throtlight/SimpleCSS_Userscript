# SimpleCSS
![LiteRender Logo](logo.png)
🚀 **SimpleCSS** is a user script designed to boost web page rendering performance by optimizing animations, disabling heavy CSS effects, compressing images, and rasterizing SVG images to a fixed 512x512 WebP format. Speed up page loading and reduce browser resource usage!

## ✨ Features
- **Optimized CSS Effects**: Disables resource-intensive CSS effects like transitions, filters, shadows, and more for enhanced performance.
- **Adaptive Image Compression**: Automatically compresses images to WebP format with quality settings based on size (from 0.35 to 0.9).
- **SVG Rasterization**: Converts SVG images to WebP with a maximum size of 512x512 for faster rendering.
- **Dynamic Processing**: Handles both existing and dynamically added images using MutationObserver.
- **Universal Compatibility**: Works on any website with `@match *://*/*`.

## 📈 Benefits
- Speeds up page loading by reducing CSS complexity and optimizing images.
- Lowers CPU/GPU usage, especially on low-end devices.
- Easy installation via user script managers (Tampermonkey, Greasemonkey, etc.).
- Improves performance by up to 30–50% on heavy pages (depending on content).

## 🛠 Installation
1. Install a user script manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Safari, Firefox)
   - [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/) (Firefox)
2. Download the script
3. Open Tampermonkey/Greasemonkey, create a new script, and paste the code.
4. Save and enjoy optimized web pages!

## 🚀 Usage
- The script automatically activates on any page (`*://*/*`) after DOM loading (`document-end`).
- No additional actions required—it works out of the box!
- To verify, open DevTools (F12) and check that CSS effects are optimized and images are compressed.

## 🌐 Multiplatform Support
- Chrome, Firefox, Safari, Edge, Via, etc.
