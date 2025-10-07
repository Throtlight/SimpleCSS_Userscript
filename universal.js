// ==UserScript==
// @name         SimpleCSS
// @namespace    https://github.com
// @version      3.5
// @description  Комплексная оптимизация веб-страниц: рендер, изображения, SVG, шрифты, API кэш, prefetch
// @author       Claude & Community
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    /******************************************************************************
     * ГЛОБАЛЬНЫЕ НАСТРОЙКИ И КОНСТАНТЫ
     ******************************************************************************/
    const CONFIG = {
        MAX_SVG_SIZE: 512,
        TEXT_RASTER_THRESHOLD_MOBILE: 16,
        TEXT_RASTER_THRESHOLD_DESKTOP: 24,
        CACHE_TTL_MS: 24 * 60 * 60 * 1000,
        PREFETCH_MARGIN: '300px',
        IMAGE_LAZY_THRESHOLD: 1.5,

        // API кэширование - whitelist доменов
        API_CACHE_WHITELIST: [
            'api.',
            'cdn.',
            '/api/',
            '/v1/',
            '/v2/',
            'graphql'
        ],

        // API кэширование - blacklist
        API_CACHE_BLACKLIST: [
            '/auth',
            '/login',
            '/logout',
            '/session',
            '/csrf',
            '/token',
            'analytics',
            'tracking'
        ]
    };

    const STATE = {
        isMobile: window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent),
        supportsWebP: false,
        isLowEndDevice: false,
        processedImages: new WeakSet(),
        processedSVGs: new WeakSet()
    };

    /******************************************************************************
     * ИНИЦИАЛИЗАЦИЯ И РОУТИНГ
     ******************************************************************************/
    function init() {
        // Детекция возможностей браузера
        detectCapabilities();

        // Модуль 0: JS оптимизатор (всегда)
        initJsOptimizer();

        // Определяем тип страницы
        const run = () => {
            const hostname = window.location.hostname;
            const isSearchEngine = hostname.includes('google.') ||
                                  hostname.includes('yandex.') ||
                                  hostname.includes('duckduckgo.');

            if (isSearchEngine) {
                initSearchPageOptimizer();
            } else {
                initRenderOptimizer();
                initDomOptimizer();
                initLazyLoaderWithDecode();
                initApiCaching();
            }

            // Network оптимизатор запускаем после загрузки
            window.addEventListener('load', initNetworkOptimizer);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }

    /******************************************************************************
     * ДЕТЕКЦИЯ ВОЗМОЖНОСТЕЙ УСТРОЙСТВА
     ******************************************************************************/
    function detectCapabilities() {
        // Проверка WebP
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            STATE.supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        } catch (e) {
            STATE.supportsWebP = false;
        }

        // Детекция слабого устройства
        STATE.isLowEndDevice = STATE.isMobile &&
                              (navigator.hardwareConcurrency <= 2 ||
                               navigator.deviceMemory <= 2);

        console.log('[SimpleCSS] Device:', {
            mobile: STATE.isMobile,
            webp: STATE.supportsWebP,
            lowEnd: STATE.isLowEndDevice,
            cores: navigator.hardwareConcurrency,
            memory: navigator.deviceMemory
        });
    }

    /******************************************************************************
     * МОДУЛЬ 0: ОПТИМИЗАТОР JAVASCRIPT
     ******************************************************************************/
    function initJsOptimizer() {
        try {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.tagName === 'SCRIPT' && node.src &&
                            !node.async && !node.defer && !node.type) {
                            node.defer = true;
                        }
                    });
                });
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        } catch (e) {
            console.warn('[SimpleCSS] JS optimizer failed:', e);
        }
    }

    /******************************************************************************
     * МОДУЛЬ 1: ОПТИМИЗАТОР РЕНДЕРИНГА
     ******************************************************************************/
    function initRenderOptimizer() {
        // 1.1 Отключение тяжелых эффектов и оптимизация шрифтов
        injectOptimizedStyles();

        // 1.2 Блокировка внешних шрифтов
        blockExternalFonts();

        // 1.3 Обработка изображений
        setTimeout(processExistingImages, 100);

        // 1.4 Observer для новых изображений
        setupImageObserver();

        // 1.5 Растеризация текста (только для слабых устройств)
        if (STATE.isLowEndDevice) {
            setTimeout(rasterizeLargeText, 2000);
        }
    }

    /******************************************************************************
     * 1.1 ИНЪЕКЦИЯ ОПТИМИЗИРОВАННЫХ СТИЛЕЙ
     ******************************************************************************/
    function injectOptimizedStyles() {
        try {
            const style = document.createElement('style');
            style.textContent = `
                /* Отключение тяжелых эффектов */
                * {
                    filter: none !important;
                    backdrop-filter: none !important;
                    ${STATE.isMobile ? 'box-shadow: none !important;' : ''}
                    text-shadow: none !important;
                    mix-blend-mode: normal !important;
                    will-change: auto !important;
                    perspective: none !important;
                    transform-style: flat !important;
                }

                body {
                    background-attachment: scroll !important;
                }

                /* Оптимизация шрифтов (с исключением иконочных) */
                *:not([class*="icon"]):not([class*="material"]):not([class*="fa-"]):not([class*="glyphicon"]):not(i):not([data-icon]),
                *:not([class*="icon"]):not([class*="material"]):not([class*="fa-"]):not([class*="glyphicon"]):not(i):not([data-icon])::before,
                *:not([class*="icon"]):not([class*="material"]):not([class*="fa-"]):not([class*="glyphicon"]):not(i):not([data-icon])::after {
                    font-family: Ubuntu, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                    text-rendering: optimizeSpeed !important;
                    -webkit-font-smoothing: antialiased !important;
                    -moz-osx-font-smoothing: grayscale !important;
                    font-variant-ligatures: none !important;
                }

                /* Для текстовых элементов */
                p, span, div, a, h1, h2, h3, h4, h5, h6, li, td, th, label, input, textarea, button {
                    font-family: Ubuntu, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                }

                /* Блокировка внешних шрифтов */
                link[href*="fonts.googleapis.com"],
                link[href*="fonts.gstatic.com"],
                link[href*="typekit.net"],
                link[href*="fonts.adobe.com"] {
                    display: none !important;
                }
            `;

            if (document.documentElement) {
                document.documentElement.appendChild(style);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    document.documentElement.appendChild(style);
                });
            }
        } catch (e) {
            console.warn('[SimpleCSS] Style injection failed:', e);
        }
    }

    /******************************************************************************
     * 1.2 БЛОКИРОВКА ВНЕШНИХ ШРИФТОВ
     ******************************************************************************/
    function blockExternalFonts() {
        try {
            // Удаляем существующие ссылки на шрифты
            const fontLinks = document.querySelectorAll(
                'link[href*="fonts.googleapis.com"], ' +
                'link[href*="fonts.gstatic.com"], ' +
                'link[href*="typekit.net"], ' +
                'link[href*="fonts.adobe.com"]'
            );

            fontLinks.forEach(link => {
                link.remove();
                console.log('[SimpleCSS] Blocked font:', link.href);
            });

            // Блокируем @import в стилях
            const styleSheets = Array.from(document.styleSheets);
            styleSheets.forEach(sheet => {
                try {
                    const rules = Array.from(sheet.cssRules || sheet.rules || []);
                    rules.forEach((rule, index) => {
                        if (rule.type === CSSRule.IMPORT_RULE &&
                            (rule.href.includes('fonts.googleapis.com') ||
                             rule.href.includes('fonts.gstatic.com') ||
                             rule.href.includes('typekit.net'))) {
                            sheet.deleteRule(index);
                        }
                    });
                } catch (e) {
                    // Игнорируем CORS ошибки
                }
            });

            // Observer для новых шрифтовых ссылок
            const fontObserver = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const fontLinks = node.querySelectorAll ?
                                node.querySelectorAll(
                                    'link[href*="fonts.googleapis.com"], ' +
                                    'link[href*="fonts.gstatic.com"]'
                                ) : [];
                            fontLinks.forEach(link => link.remove());
                        }
                    });
                });
            });

            if (document.head) {
                fontObserver.observe(document.head, {
                    childList: true,
                    subtree: true
                });
            }
        } catch (e) {
            console.warn('[SimpleCSS] Font blocking failed:', e);
        }
    }

    /******************************************************************************
     * 1.3 ОБРАБОТКА ИЗОБРАЖЕНИЙ
     ******************************************************************************/
    function getCompressionSettings(width, height) {
        const maxSide = Math.max(width, height);

        if (STATE.isMobile) {
            if (maxSide <= 64) return { quality: 0.8, maxWidth: maxSide };
            if (maxSide <= 256) return { quality: 0.6, maxWidth: 256 };
            if (maxSide <= 512) return { quality: 0.4, maxWidth: 512 };
            return { quality: 0.3, maxWidth: 512 };
        } else {
            if (maxSide <= 64) return { quality: 0.9, maxWidth: maxSide };
            if (maxSide <= 256) return { quality: 0.7, maxWidth: 256 };
            if (maxSide <= 1024) return { quality: 0.5, maxWidth: 1024 };
            return { quality: 0.35, maxWidth: 1024 };
        }
    }

    function compressImage(img) {
        try {
            // Проверки
            if (!img || !img.complete || !img.naturalWidth) return;
            if (img.src.startsWith('data:image')) return;
            if (STATE.processedImages.has(img)) return;
            if (img.hasAttribute('data-compressed')) return;
            if (img.srcset) return; // Не трогаем адаптивные

            // Маркируем как обработанное
            STATE.processedImages.add(img);

            // SVG обрабатываем отдельно
            if (img.src.endsWith('.svg') || img.src.includes('svg+xml')) {
                rasterizeSVGImage(img);
                return;
            }

            const { quality, maxWidth } = getCompressionSettings(
                img.naturalWidth,
                img.naturalHeight
            );

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

            const format = STATE.supportsWebP ? 'image/webp' : 'image/jpeg';
            const newSrc = canvas.toDataURL(format, quality);

            // Проверяем что новое изображение валидное и меньше
            if (newSrc && newSrc.length > 100 && newSrc.length < img.src.length * 1.5) {
                img.src = newSrc;
                img.setAttribute('data-compressed', 'true');
            }
        } catch (e) {
            console.warn('[SimpleCSS] Image compression failed:', e);
        }
    }

    /******************************************************************************
     * 1.4 РАСТЕРИЗАЦИЯ SVG С ПРАВИЛЬНЫМИ ПРОПОРЦИЯМИ
     ******************************************************************************/
    function rasterizeSVGImage(img) {
        try {
            if (STATE.processedSVGs.has(img)) return;
            if (img.hasAttribute('data-svg-processed')) return;

            STATE.processedSVGs.add(img);
            img.setAttribute('data-svg-processed', 'true');

            // Получаем размеры элемента
            const rect = img.getBoundingClientRect();
            let displayW = rect.width || img.width || img.offsetWidth;
            let displayH = rect.height || img.height || img.offsetHeight;

            if (!displayW || !displayH) {
                displayW = CONFIG.MAX_SVG_SIZE;
                displayH = CONFIG.MAX_SVG_SIZE;
            }

            if (displayW <= 32 || displayH <= 32) return;

            const svgUrl = img.src;

            if (svgUrl.startsWith('data:image/svg+xml')) {
                rasterizeFromDataURL(img, svgUrl, displayW, displayH);
            } else {
                fetchAndRasterizeSVG(img, svgUrl, displayW, displayH);
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
                const svgW = image.naturalWidth || image.width;
                const svgH = image.naturalHeight || image.height;

                if (svgW && svgH) {
                    drawSVGToCanvas(img, image, displayW, displayH, svgW, svgH);
                } else {
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

    function fetchAndRasterizeSVG(img, url, displayW, displayH) {
        try {
            // Проверка same-origin
            const imgOrigin = new URL(url, window.location.href).origin;
            const currentOrigin = window.location.origin;

            if (imgOrigin !== currentOrigin && !url.startsWith('/')) {
                console.warn('[SimpleCSS] Cross-origin SVG skipped:', url);
                return;
            }
        } catch (e) {
            console.warn('[SimpleCSS] SVG URL parse failed:', e);
            return;
        }

        fetch(url, {
            mode: 'same-origin',
            cache: 'force-cache',
            credentials: 'same-origin'
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        })
        .then(svgText => {
            // Извлекаем размеры из SVG
            const dimensions = extractSVGDimensions(svgText);

            const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
            const blobUrl = URL.createObjectURL(svgBlob);

            const image = new Image();
            image.crossOrigin = 'anonymous';

            image.onload = () => {
                const svgW = image.naturalWidth || dimensions.width || displayW;
                const svgH = image.naturalHeight || dimensions.height || displayH;

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

    function extractSVGDimensions(svgText) {
        try {
            const widthMatch = svgText.match(/width=["']?([^"'\s>]+)/);
            const heightMatch = svgText.match(/height=["']?([^"'\s>]+)/);

            let width = null, height = null;

            if (widthMatch && widthMatch[1]) {
                const w = parseFloat(widthMatch[1]);
                if (!isNaN(w)) width = w;
            }

            if (heightMatch && heightMatch[1]) {
                const h = parseFloat(heightMatch[1]);
                if (!isNaN(h)) height = h;
            }

            // Fallback на viewBox
            if (!width || !height) {
                const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/);
                if (viewBoxMatch && viewBoxMatch[1]) {
                    const viewBox = viewBoxMatch[1].split(/[\s,]+/);
                    if (viewBox.length >= 4) {
                        if (!width) width = parseFloat(viewBox[2]);
                        if (!height) height = parseFloat(viewBox[3]);
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
            if (!svgW || !svgH) {
                console.warn('[SimpleCSS] Invalid SVG dimensions');
                return;
            }

            // ПРАВИЛЬНЫЙ расчет пропорций
            const svgAspectRatio = svgW / svgH;
            const displayAspectRatio = displayW / displayH;

            let finalW, finalH;

            // Подгоняем под контейнер с сохранением пропорций
            if (svgAspectRatio > displayAspectRatio) {
                // SVG шире
                finalW = displayW;
                finalH = displayW / svgAspectRatio;
            } else {
                // SVG выше
                finalH = displayH;
                finalW = displayH * svgAspectRatio;
            }

            // Ограничиваем максимальный размер
            const maxSize = STATE.isMobile ? 256 : CONFIG.MAX_SVG_SIZE;
            if (finalW > maxSize || finalH > maxSize) {
                const scale = Math.min(maxSize / finalW, maxSize / finalH);
                finalW = Math.round(finalW * scale);
                finalH = Math.round(finalH * scale);
            } else {
                finalW = Math.round(finalW);
                finalH = Math.round(finalH);
            }

            if (finalW < 10 || finalH < 10) return;

            const canvas = document.createElement('canvas');
            canvas.width = finalW;
            canvas.height = finalH;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(loadedImg, 0, 0, finalW, finalH);

            // Для SVG лучше PNG чем WebP
            const format = STATE.supportsWebP ? 'image/webp' : 'image/png';
            const quality = STATE.isMobile ? 0.6 : 0.7;
            const newSrc = canvas.toDataURL(format, quality);

            if (newSrc && newSrc.length > 100) {
                originalImg.src = newSrc;
                originalImg.setAttribute('data-compressed', 'true');

                // Устанавливаем правильные размеры
                originalImg.style.width = displayW + 'px';
                originalImg.style.height = displayH + 'px';
                originalImg.style.objectFit = 'contain';
            }
        } catch (e) {
            console.warn('[SimpleCSS] SVG canvas draw failed:', e);
        }
    }

    /******************************************************************************
     * 1.5 РАСТЕРИЗАЦИЯ ТЕКСТА (ТОЛЬКО ДЛЯ СЛАБЫХ УСТРОЙСТВ)
     ******************************************************************************/
    function rasterizeLargeText() {
        try {
            const threshold = STATE.isMobile ?
                CONFIG.TEXT_RASTER_THRESHOLD_MOBILE :
                CONFIG.TEXT_RASTER_THRESHOLD_DESKTOP;

            const textElements = document.querySelectorAll(
                'h1, h2, h3, .title, .heading, .banner-text, .hero-title'
            );

            let processed = 0;
            textElements.forEach((element, index) => {
                setTimeout(() => {
                    const fontSize = parseFloat(window.getComputedStyle(element).fontSize);
                    if (fontSize >= threshold && !element.children.length) {
                        rasterizeTextElement(element);
                        processed++;
                    }
                }, index * 100); // Распределяем нагрузку
            });

            if (processed > 0) {
                console.log(`[SimpleCSS] Rasterized ${processed} text elements`);
            }
        } catch (e) {
            console.warn('[SimpleCSS] Text rasterization failed:', e);
        }
    }

    function rasterizeTextElement(element) {
        try {
            if (element.hasAttribute('data-text-rasterized')) return;

            const text = element.textContent.trim();
            if (!text || text.length > 100) return;

            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const computedStyle = window.getComputedStyle(element);
            const fontSize = parseFloat(computedStyle.fontSize);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const scale = window.devicePixelRatio || 1;
            canvas.width = rect.width * scale;
            canvas.height = rect.height * scale;

            ctx.scale(scale, scale);
            ctx.font = `${computedStyle.fontWeight} ${fontSize}px Ubuntu, Arial, sans-serif`;
            ctx.fillStyle = computedStyle.color || '#000000';
            ctx.textBaseline = 'top';

            // Простая отрисовка текста
            ctx.fillText(text, 0, 0);

            const imageData = canvas.toDataURL('image/png', 0.8);
            if (imageData && imageData.length > 100) {
                element.style.backgroundImage = `url(${imageData})`;
                element.style.backgroundSize = 'contain';
                element.style.backgroundRepeat = 'no-repeat';
                element.textContent = '';
                element.setAttribute('data-text-rasterized', 'true');
                element.setAttribute('aria-label', text); // Для доступности
            }
        } catch (e) {
            console.warn('[SimpleCSS] Text element rasterization failed:', e);
        }
    }

    /******************************************************************************
     * 1.6 ОБРАБОТКА СУЩЕСТВУЮЩИХ ИЗОБРАЖЕНИЙ
     ******************************************************************************/
    function processExistingImages() {
        try {
            const images = document.querySelectorAll('img');

            images.forEach((img, index) => {
                setTimeout(() => {
                    if (img.complete) {
                        compressImage(img);
                    } else {
                        img.addEventListener('load', () => compressImage(img), { once: true });
                    }
                }, index * 10); // Распределяем нагрузку
            });

            console.log(`[SimpleCSS] Processing ${images.length} images`);
        } catch (e) {
            console.warn('[SimpleCSS] Existing images processing failed:', e);
        }
    }

    /******************************************************************************
     * 1.7 OBSERVER ДЛЯ НОВЫХ ИЗОБРАЖЕНИЙ
     ******************************************************************************/
    function setupImageObserver() {
        try {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (!(node instanceof Element)) return;

                        if (node.tagName === 'IMG') {
                            processNewImage(node);
                        } else if (node.tagName === 'PICTURE') {
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
            console.warn('[SimpleCSS] Image observer setup failed:', e);
        }
    }

    function processNewImage(img) {
        if (img.complete) {
            setTimeout(() => compressImage(img), 50);
        } else {
            img.addEventListener('load', () => {
                setTimeout(() => compressImage(img), 50);
            }, { once: true });
        }
    }

    // Глобальная функция для внешнего доступа
    window.processImageForOptimization = compressImage;

    /******************************************************************************
     * МОДУЛЬ 2: DOM ОПТИМИЗАТОР (content-visibility)
     ******************************************************************************/
    function initDomOptimizer() {
        try {
            const SELECTORS = [
                'div[class*="message"]',
                'div[class*="conversation"]',
                'div[class*="response"]',
                'div[class*="post"]',
                'div[class*="comment"]',
                'div[class*="card"]',
                'article',
                '[role="article"]',
                'section'
            ].join(',');

            const applyOptimization = (el) => {
                try {
                    el.style.setProperty('content-visibility', 'auto', 'important');
                    el.style.setProperty('contain-intrinsic-size', 'auto 500px', 'important');
                } catch (e) {}
            };

            const processNode = (node) => {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches(SELECTORS)) {
                        applyOptimization(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll(SELECTORS).forEach(applyOptimization);
                    }
                }
            };

            // Обрабатываем существующие элементы
            document.querySelectorAll(SELECTORS).forEach(applyOptimization);

            // Observer для новых элементов
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(processNode);
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('[SimpleCSS] DOM optimizer initialized');
        } catch (e) {
            console.warn('[SimpleCSS] DOM optimizer failed:', e);
        }
    }

    /******************************************************************************
     * МОДУЛЬ 3: LAZY LOADER С АСИНХРОННЫМ ДЕКОДИРОВАНИЕМ
     ******************************************************************************/
    function initLazyLoaderWithDecode() {
        try {
            // Добавляем стили для плавного появления
            GM_addStyle(`
                img[data-lazy-src] {
                    transition: opacity 0.3s ease-in-out !important;
                    opacity: 0 !important;
                }
                img.lazy-loaded {
                    opacity: 1 !important;
                }
            `);

            // Intersection Observer для ленивой загрузки
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        obs.unobserve(img);

                        const src = img.dataset.lazySrc;
                        if (src) {
                            img.src = src;

                            // Асинхронное декодирование для плавности
                            if ('decode' in img) {
                                img.decode()
                                    .then(() => {
                                        img.classList.add('lazy-loaded');
                                        compressImage(img);
                                    })
                                    .catch(() => {
                                        img.classList.add('lazy-loaded');
                                    });
                            } else {
                                img.classList.add('lazy-loaded');
                                compressImage(img);
                            }
                        }

                        if (img.dataset.lazySrcset) {
                            img.srcset = img.dataset.lazySrcset;
                        }
                    }
                });
            }, {
                rootMargin: CONFIG.PREFETCH_MARGIN,
                threshold: 0.01
            });

            // Функция обработки изображения для lazy loading
            const processImgForLazy = (img) => {
                try {
                    if (!img.src || img.src.startsWith('data:') ||
                        img.hasAttribute('data-lazy-src') || img.closest('picture')) {
                        return;
                    }

                    // Если изображение в видимой области - обрабатываем сразу
                    const rect = img.getBoundingClientRect();
                    if (rect.top < window.innerHeight * CONFIG.IMAGE_LAZY_THRESHOLD) {
                        compressImage(img);
                        return;
                    }

                    // Иначе делаем lazy
                    img.dataset.lazySrc = img.src;

                    if (img.srcset) {
                        img.dataset.lazySrcset = img.srcset;
                        img.removeAttribute('srcset');
                    }

                    // Заменяем на placeholder SVG
                    const w = img.width || 1;
                    const h = img.height || 1;
                    img.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'%3E%3C/svg%3E`;

                    observer.observe(img);
                } catch (e) {}
            };

            // Обрабатываем существующие изображения
            document.querySelectorAll('img').forEach(processImgForLazy);

            // Observer для новых изображений
            const mutationObserver = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.matches && node.matches('img')) {
                                processImgForLazy(node);
                            } else if (node.querySelectorAll) {
                                node.querySelectorAll('img').forEach(processImgForLazy);
                            }
                        }
                    });
                });
            });

            mutationObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });

            console.log('[SimpleCSS] Lazy loader initialized');
        } catch (e) {
            console.warn('[SimpleCSS] Lazy loader failed:', e);
        }
    }

    /******************************************************************************
     * МОДУЛЬ 4: УМНОЕ API КЭШИРОВАНИЕ
     ******************************************************************************/
    function initApiCaching() {
        try {
            const CACHE_PREFIX = 'simplecss-api-v3-';
            const originalFetch = window.fetch;

            // Проверка URL для кэширования
            const shouldCache = (url) => {
                const urlLower = url.toLowerCase();

                // Проверяем blacklist
                for (const pattern of CONFIG.API_CACHE_BLACKLIST) {
                    if (urlLower.includes(pattern)) return false;
                }

                // Проверяем whitelist
                for (const pattern of CONFIG.API_CACHE_WHITELIST) {
                    if (urlLower.includes(pattern)) return true;
                }

                return false;
            };

            // Горячая клавиша для очистки кэша: Ctrl+Shift+клик в правом нижнем углу
            document.addEventListener('click', e => {
                if (e.ctrlKey && e.shiftKey &&
                    e.clientX > window.innerWidth - 100 &&
                    e.clientY > window.innerHeight - 100) {

                    let cleared = 0;
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(CACHE_PREFIX)) {
                            localStorage.removeItem(key);
                            cleared++;
                        }
                    }
                    alert(`[SimpleCSS] Cleared ${cleared} cached API responses`);
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            // Перехватываем fetch
            window.fetch = async function(...args) {
                const request = new Request(args[0], args[1]);

                // Кэшируем только GET запросы к API
                if (request.method !== 'GET' || !shouldCache(request.url)) {
                    return originalFetch(...args);
                }

                const cacheKey = CACHE_PREFIX + request.url;

                // Проверяем кэш
                try {
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        const { timestamp, data, contentType } = JSON.parse(cached);

                        // Проверяем TTL
                        if (Date.now() - timestamp < CONFIG.CACHE_TTL_MS) {
                            console.log('[SimpleCSS] Cache hit:', request.url);
                            return new Response(JSON.stringify(data), {
                                status: 200,
                                headers: {
                                    'Content-Type': contentType || 'application/json',
                                    'X-Cache': 'HIT',
                                    'X-Cache-Age': Math.floor((Date.now() - timestamp) / 1000)
                                }
                            });
                        } else {
                            localStorage.removeItem(cacheKey);
                        }
                    }
                } catch (e) {
                    // Ошибка чтения кэша - игнорируем
                }

                // Делаем реальный запрос
                const response = await originalFetch(...args);

                // Кэшируем успешные JSON ответы
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const clone = response.clone();

                        clone.json().then(data => {
                            try {
                                localStorage.setItem(cacheKey, JSON.stringify({
                                    timestamp: Date.now(),
                                    data: data,
                                    contentType: contentType
                                }));
                                console.log('[SimpleCSS] Cached:', request.url);
                            } catch (e) {
                                // Квота превышена - очищаем старый кэш
                                if (e.name === 'QuotaExceededError') {
                                    clearOldCache(CACHE_PREFIX);
                                }
                            }
                        }).catch(() => {
                            // Не JSON или ошибка парсинга
                        });
                    }
                }

                return response;
            };

            // Функция очистки старого кэша
            function clearOldCache(prefix) {
                try {
                    const items = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(prefix)) {
                            try {
                                const data = JSON.parse(localStorage.getItem(key));
                                items.push({ key, timestamp: data.timestamp || 0 });
                            } catch (e) {}
                        }
                    }

                    // Сортируем по времени и удаляем 50% старых
                    items.sort((a, b) => a.timestamp - b.timestamp);
                    const toRemove = items.slice(0, Math.ceil(items.length / 2));
                    toRemove.forEach(item => localStorage.removeItem(item.key));

                    console.log('[SimpleCSS] Cleared old cache:', toRemove.length, 'items');
                } catch (e) {}
            }

            console.log('[SimpleCSS] API caching initialized');
        } catch (e) {
            console.warn('[SimpleCSS] API caching failed:', e);
        }
    }

    /******************************************************************************
     * МОДУЛЬ 5: NETWORK ОПТИМИЗАТОР (Prefetch)
     ******************************************************************************/
    function initNetworkOptimizer() {
        try {
            const prefetchedUrls = new Set();

            const prefetch = (url) => {
                if (prefetchedUrls.has(url)) return;
                if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;

                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = url;
                document.head.appendChild(link);

                prefetchedUrls.add(url);
                console.log('[SimpleCSS] Prefetched:', url);
            };

            // Observer для ссылок в видимой области
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const link = entry.target;

                        try {
                            const href = link.getAttribute('href');
                            if (href &&
                                !href.startsWith('#') &&
                                !href.startsWith('javascript:') &&
                                link.hostname === window.location.hostname) {

                                prefetch(link.href);
                            }
                        } catch (e) {}

                        observer.unobserve(link);
                    }
                });
            }, {
                rootMargin: '50px'
            });

            // Обрабатываем все ссылки
            document.querySelectorAll('a[href]').forEach(link => {
                observer.observe(link);
            });

            // Observer для новых ссылок
            const mutationObserver = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.matches && node.matches('a[href]')) {
                                observer.observe(node);
                            } else if (node.querySelectorAll) {
                                node.querySelectorAll('a[href]').forEach(link => {
                                    observer.observe(link);
                                });
                            }
                        }
                    });
                });
            });

            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('[SimpleCSS] Network optimizer initialized');
        } catch (e) {
            console.warn('[SimpleCSS] Network optimizer failed:', e);
        }
    }

    /******************************************************************************
     * МОДУЛЬ 6: ОПТИМИЗАТОР ДЛЯ ПОИСКОВИКОВ
     ******************************************************************************/
    function initSearchPageOptimizer() {
        try {
            const engines = {
                'google': 'div.g a[href]:not([role="button"])',
                'yandex': 'a.serp-item__title, a.OrganicTitle-Link',
                'duckduckgo': 'a[data-testid="result-title-a"]'
            };

            const engineKey = Object.keys(engines).find(k =>
                window.location.hostname.includes(k)
            );

            if (!engineKey) return;

            const selector = engines[engineKey];
            const links = Array.from(document.querySelectorAll(selector)).slice(0, 10);
            const origins = new Set();

            links.forEach(link => {
                try {
                    const url = new URL(link.href);
                    const origin = url.origin;

                    if (!origins.has(origin)) {
                        // DNS prefetch
                        const dnsPrefetch = document.createElement('link');
                        dnsPrefetch.rel = 'dns-prefetch';
                        dnsPrefetch.href = origin;
                        document.head.appendChild(dnsPrefetch);

                        // Preconnect
                        const preconnect = document.createElement('link');
                        preconnect.rel = 'preconnect';
                        preconnect.href = origin;
                        document.head.appendChild(preconnect);

                        origins.add(origin);
                    }
                } catch (e) {}
            });

            console.log('[SimpleCSS] Search page optimizer initialized:', origins.size, 'origins');
        } catch (e) {
            console.warn('[SimpleCSS] Search optimizer failed:', e);
        }
    }

    /******************************************************************************
     * ЗАПУСК
     ******************************************************************************/
    init();
    console.log('[SimpleCSS v3.5] Initialized successfully');

})();
