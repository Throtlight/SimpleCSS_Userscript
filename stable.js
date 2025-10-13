// ==UserScript==
// @name         SimpleCSS v1.2
// @namespace    https://github.com
// @version      1.2
// @description  Универсальная оптимизация рендера без нарушения анимаций
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const MAX_SVG_SIZE = 512;
  const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);

  // Проверка поддержки WebP
  let supportsWebP = false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch (e) {
    supportsWebP = false;
  }

  // === 1. Мягкое отключение тяжёлых CSS-эффектов (БЕЗ анимаций) ===
  function disableHeavyEffects() {
    try {
      const style = document.createElement('style');
      style.textContent = `
        * {
          filter: none !important;
          backdrop-filter: none !important;
          ${isMobile ? 'box-shadow: none !important;' : ''}
          text-shadow: none !important;
          mix-blend-mode: normal !important;
          will-change: auto !important;
          perspective: none !important;
          transform-style: flat !important;
        }
        body {
          background-attachment: scroll !important;
        }
      `;
      document.documentElement.appendChild(style);
    } catch (e) {
      console.warn('[SimpleCSS] CSS injection failed:', e);
    }
  }

  // === 2. Настройки сжатия с учётом устройства ===
  function getCompressionSettings(width, height) {
    const maxSide = Math.max(width, height);
    
    if (isMobile) {
      // Более агрессивное сжатие для мобильных
      if (maxSide <= 64) return { quality: 0.8, maxWidth: maxSide };
      if (maxSide <= 256) return { quality: 0.6, maxWidth: 256 };
      if (maxSide <= 512) return { quality: 0.4, maxWidth: 512 };
      return { quality: 0.3, maxWidth: 512 };
    } else {
      // Стандартные настройки для десктопа
      if (maxSide <= 64) return { quality: 0.9, maxWidth: maxSide };
      if (maxSide <= 256) return { quality: 0.7, maxWidth: maxSide };
      if (maxSide <= 1024) return { quality: 0.5, maxWidth: 1024 };
      return { quality: 0.35, maxWidth: 1024 };
    }
  }

  // === 3. Сжатие обычных изображений ===
  function compressImage(img) {
    try {
      if (!img.complete || img.naturalWidth === 0) return;
      if (img.src.startsWith('data:image')) return;
      if (img.hasAttribute('data-compressed')) return;
      if (img.srcset) return; // Пропускаем адаптивные изображения
      
      // SVG обрабатываем отдельно
      if (img.src.endsWith('.svg') || img.src.includes('svg')) {
        rasterizeSVGImage(img);
        return;
      }

      const { quality, maxWidth } = getCompressionSettings(img.naturalWidth, img.naturalHeight);
      
      // Пропускаем маленькие изображения
      if (img.naturalWidth <= 64 && img.naturalHeight <= 64) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let w = img.naturalWidth;
      let h = img.naturalHeight;
      
      if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }

      canvas.width = w;
      canvas.height = h;

      ctx.drawImage(img, 0, 0, w, h);
      
      const format = supportsWebP ? 'image/webp' : 'image/jpeg';
      const newSrc = canvas.toDataURL(format, quality);
      
      if (newSrc && newSrc !== img.src) {
        img.src = newSrc;
        img.setAttribute('data-compressed', 'true');
      }
    } catch (e) {
      console.warn('[SimpleCSS] Image compression failed:', e);
    }
  }

  // === 4. Растеризация SVG с сохранением пропорций ===
  function rasterizeSVGImage(img) {
    try {
      if (img.hasAttribute('data-svg-processed')) return;
      img.setAttribute('data-svg-processed', 'true');

      // Получаем отображаемые размеры элемента
      const rect = img.getBoundingClientRect();
      let displayW = rect.width || img.width || img.offsetWidth;
      let displayH = rect.height || img.height || img.offsetHeight;

      // Если размеры всё ещё не определены, используем defaults
      if (!displayW || !displayH) {
        displayW = MAX_SVG_SIZE;
        displayH = MAX_SVG_SIZE;
      }

      if (displayW <= 32 || displayH <= 32) return;

      // Пробуем разные методы получения SVG
      const svgUrl = img.src;
      
      if (svgUrl.startsWith('data:image/svg+xml')) {
        // Обрабатываем data URL
        rasterizeFromDataURL(img, svgUrl, displayW, displayH);
      } else {
        // Пробуем fetch с fallback
        fetchSVG(img, svgUrl, displayW, displayH);
      }
    } catch (e) {
      console.warn('[SimpleCSS] SVG processing failed:', e);
    }
  }

  function rasterizeFromDataURL(img, dataUrl, displayW, displayH) {
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      
      image.onload = () => {
        // Получаем реальные размеры SVG после загрузки
        const svgW = image.naturalWidth || image.width;
        const svgH = image.naturalHeight || image.height;
        
        if (svgW && svgH) {
          drawSVGToCanvas(img, image, displayW, displayH, svgW, svgH);
        } else {
          // Fallback: используем отображаемые размеры
          drawSVGToCanvas(img, image, displayW, displayH, displayW, displayH);
        }
      };
      
      image.onerror = () => {
        console.warn('[SimpleCSS] SVG data URL load failed');
      };
      
      image.src = dataUrl;
    } catch (e) {
      console.warn('[SimpleCSS] SVG data URL processing failed:', e);
    }
  }

  function fetchSVG(img, url, displayW, displayH) {
    // Простая проверка на same-origin
    try {
      const imgOrigin = new URL(url).origin;
      const currentOrigin = window.location.origin;
      
      if (imgOrigin !== currentOrigin && !url.startsWith('/')) {
        console.warn('[SimpleCSS] Cross-origin SVG skipped:', url);
        return;
      }
    } catch (e) {
      // Если не можем распарсить URL, пропускаем
      return;
    }

    fetch(url, { 
      mode: 'same-origin',
      cache: 'force-cache'
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(svgText => {
      // Пытаемся извлечь размеры из SVG
      const svgDimensions = extractSVGDimensions(svgText);
      
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
      const blobUrl = URL.createObjectURL(svgBlob);
      
      const image = new Image();
      image.crossOrigin = 'anonymous';
      
      image.onload = () => {
        const svgW = image.naturalWidth || svgDimensions.width || displayW;
        const svgH = image.naturalHeight || svgDimensions.height || displayH;
        
        drawSVGToCanvas(img, image, displayW, displayH, svgW, svgH);
        URL.revokeObjectURL(blobUrl);
      };
      
      image.onerror = () => {
        console.warn('[SimpleCSS] SVG blob load failed');
        URL.revokeObjectURL(blobUrl);
      };
      
      image.src = blobUrl;
    })
    .catch(err => {
      console.warn('[SimpleCSS] SVG fetch failed:', err.message);
    });
  }

  // Функция для извлечения размеров из SVG кода
  function extractSVGDimensions(svgText) {
    try {
      // Ищем width и height атрибуты
      const widthMatch = svgText.match(/width=["']([^"']+)["']/);
      const heightMatch = svgText.match(/height=["']([^"']+)["']/);
      
      let width = null, height = null;
      
      if (widthMatch && widthMatch[1]) {
        const w = parseFloat(widthMatch[1]);
        if (!isNaN(w)) width = w;
      }
      
      if (heightMatch && heightMatch[1]) {
        const h = parseFloat(heightMatch[1]);
        if (!isNaN(h)) height = h;
      }
      
      // Если нет width/height, пытаемся извлечь из viewBox
      if (!width || !height) {
        const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/);
        if (viewBoxMatch && viewBoxMatch[1]) {
          const viewBox = viewBoxMatch[1].split(/[\s,]+/);
          if (viewBox.length >= 4) {
            const vbWidth = parseFloat(viewBox[2]);
            const vbHeight = parseFloat(viewBox[3]);
            if (!width && !isNaN(vbWidth)) width = vbWidth;
            if (!height && !isNaN(vbHeight)) height = vbHeight;
          }
        }
      }
      
      return { width, height };
    } catch (e) {
      return { width: null, height: null };
    }
  }

  function drawSVGToCanvas(originalImg, loadedImg, displayW, displayH, svgW, svgH) {
    try {
      // Вычисляем правильные пропорции
      const svgAspectRatio = svgW / svgH;
      const displayAspectRatio = displayW / displayH;
      
      // Определяем финальные размеры с сохранением пропорций
      let finalW, finalH;
      
      if (svgAspectRatio > displayAspectRatio) {
        // SVG шире чем область отображения
        finalW = displayW;
        finalH = displayW / svgAspectRatio;
      } else {
        // SVG выше чем область отображения
        finalH = displayH;
        finalW = displayH * svgAspectRatio;
      }
      
      // Ограничиваем максимальные размеры
      const maxSize = isMobile ? 256 : MAX_SVG_SIZE;
      if (finalW > maxSize || finalH > maxSize) {
        const scale = Math.min(maxSize / finalW, maxSize / finalH);
        finalW *= scale;
        finalH *= scale;
      }
      
      finalW = Math.round(finalW);
      finalH = Math.round(finalH);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = finalW;
      canvas.height = finalH;
      
      // Рисуем SVG с правильными пропорциями
      ctx.drawImage(loadedImg, 0, 0, finalW, finalH);
      
      const format = supportsWebP ? 'image/webp' : 'image/png';
      const quality = isMobile ? 0.5 : 0.6;
      const newSrc = canvas.toDataURL(format, quality);
      
      if (newSrc && newSrc !== originalImg.src) {
        originalImg.src = newSrc;
        originalImg.setAttribute('data-compressed', 'true');
        
        // Устанавливаем правильные размеры элемента
        originalImg.style.width = displayW + 'px';
        originalImg.style.height = displayH + 'px';
        originalImg.style.objectFit = 'contain';
      }
    } catch (e) {
      console.warn('[SimpleCSS] SVG canvas draw failed:', e);
    }
  }

  // === 5. Обработка существующих изображений ===
  function processExistingImages() {
    try {
      document.querySelectorAll('img').forEach(img => {
        if (img.complete) {
          setTimeout(() => compressImage(img), 50);
        } else {
          img.addEventListener('load', () => setTimeout(() => compressImage(img), 50), { once: true });
        }
      });
    } catch (e) {
      console.warn('[SimpleCSS] Existing images processing failed:', e);
    }
  }

  // === 6. MutationObserver для новых изображений ===
  function setupImageObserver() {
    try {
      if (!('MutationObserver' in window)) return;
      
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (!(node instanceof Element)) return;

            if (node.nodeName === 'IMG') {
              processNewImage(node);
            } else if (node.nodeName === 'PICTURE') {
              node.querySelectorAll('img').forEach(processNewImage);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('img').forEach(processNewImage);
            }
          });
        });
      });

      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
    } catch (e) {
      console.warn('[SimpleCSS] Observer setup failed:', e);
    }
  }

  function processNewImage(img) {
    if (img.complete) {
      setTimeout(() => compressImage(img), 50);
    } else {
      img.addEventListener('load', () => setTimeout(() => compressImage(img), 50), { once: true });
    }
  }

  // === 7. Инициализация ===
  function initialize() {
    console.log('[SimpleCSS] Starting initialization...');
    
    // Отключаем тяжёлые эффекты (БЕЗ анимаций)
    disableHeavyEffects();
    
    // Обрабатываем существующие изображения с задержкой
    setTimeout(processExistingImages, 100);
    
    // Настраиваем observer
    setupImageObserver();
    
    console.log('[SimpleCSS] Initialization complete');
  }

  // Запускаем
  initialize();
})();
