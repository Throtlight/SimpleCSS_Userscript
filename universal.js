// ==UserScript==
// @name         SimpleCSS
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Комбинированный ускоритель: предзагрузка, оптимизация поиска, lazy load, отключение тяжёлых CSS и сжатие изображений.
// @author       Gemini
// @match        http://*/*
// @match        https://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
'use strict';

/******************************************************************************
 * ОБЩИЕ ПЕРЕМЕННЫЕ
 ******************************************************************************/
const MAX_SVG_SIZE = 512;
const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);

// Проверка поддержки WebP
let supportsWebP = false;
try {
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
} catch (e) { supportsWebP = false; }

/******************************************************************************
 * МОДУЛЬ 1: Ускоритель для ОБЫЧНЫХ сайтов
 ******************************************************************************/
const initGeneralPagePrefetcher = () => {
    initLazyLoader(); // запускаем ленивую загрузку

    window.addEventListener('load', () => {
        const STORAGE_KEY_PREFIX = 'prefetch-learner-';
        const a = document.createElement('a');

        // стандартный предзагрузчик ссылок
        const initLinkPrefetcher = () => {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const link = entry.target;
                        if (link.hostname === window.location.hostname && link.getAttribute('href') && !link.getAttribute('href').startsWith('#')) {
                            prefetchUrl(link.href);
                        }
                        observer.unobserve(link);
                    }
                });
            });
            document.querySelectorAll('a[href]').forEach(link => observer.observe(link));
        };

        // «обучение» интерактивных элементов
        let currentObservedElement = null;
        let performanceObserver = null;
        const getElementFingerprint = (el) => el.tagName + ':' + (el.textContent.trim().slice(0, 50) || el.className);
        const startLearning = (el) => {
            currentObservedElement = el;
            if (performanceObserver) performanceObserver.disconnect();
            performanceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
                        a.href = entry.name;
                        if (a.hostname === window.location.hostname) {
                            const fingerprint = getElementFingerprint(currentObservedElement);
                            sessionStorage.setItem(STORAGE_KEY_PREFIX + fingerprint, entry.name);
                            stopLearning();
                        }
                    }
                });
            });
            performanceObserver.observe({ entryTypes: ['resource'] });
        };
        const stopLearning = () => { if (performanceObserver) performanceObserver.disconnect(); };
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('a[href]')) return;
            const interactiveElement = e.target.closest('button, [role="button"], [onclick]');
            if (interactiveElement) {
                startLearning(interactiveElement);
                interactiveElement.addEventListener('mouseup', stopLearning, { once: true });
                interactiveElement.addEventListener('mouseleave', stopLearning, { once: true });
            }
        }, true);

        // предзагрузчик на основе знаний
        const initLearnedPrefetcher = () => {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        const fingerprint = getElementFingerprint(el);
                        const learnedUrl = sessionStorage.getItem(STORAGE_KEY_PREFIX + fingerprint);
                        if (learnedUrl) {
                            prefetchUrl(learnedUrl);
                            observer.unobserve(el);
                        }
                    }
                });
            });
            document.querySelectorAll('button, [role="button"], [onclick]').forEach(el => observer.observe(el));
        };

        const prefetchUrl = (url) => {
            if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            document.head.appendChild(link);
        };

        initLinkPrefetcher();
        initLearnedPrefetcher();
    });
};

/******************************************************************************
 * МОДУЛЬ 2: Предиктивный ускоритель для ПОИСКОВЫХ сайтов
 ******************************************************************************/
const initSearchPagePrefetcher = () => {
    const searchEngines = {
        'google': { selector: 'div.g a[href]:not([role="button"])' },
        'yandex': { selector: 'a.serp-item__title' },
        'duckduckgo': { selector: 'a[data-testid="result-title-a"]' }
    };
    const engine = Object.keys(searchEngines).find(key => window.location.hostname.includes(key));
    if (!engine) return;

    const links = Array.from(document.querySelectorAll(searchEngines[engine].selector)).slice(0, 5);
    const processedOrigins = new Set();
    links.forEach(link => {
        try {
            const origin = new URL(link.href).origin;
            if (!processedOrigins.has(origin)) {
                createHintLink('dns-prefetch', origin);
                createHintLink('preconnect', origin);
                processedOrigins.add(origin);
            }
        } catch (e) {}
    });
};

/******************************************************************************
 * МОДУЛЬ 3: LAZY LOADER
 ******************************************************************************/
const initLazyLoader = () => {
    const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const src = element.dataset.src;
                if (src) element.src = src;
                const srcset = element.dataset.srcset;
                if (srcset) element.srcset = srcset;
                observer.unobserve(element);
            }
        });
    }, { rootMargin: "200px" });

    document.querySelectorAll('img[src]').forEach(img => {
        if (img.src.startsWith('data:')) return;
        img.dataset.src = img.src;
        if (img.srcset) {
            img.dataset.srcset = img.srcset;
            img.removeAttribute('srcset');
        }
        img.src = createSvgPlaceholder(img.width || 16, img.height || 9);
        lazyLoadObserver.observe(img);
    });

    document.querySelectorAll('iframe[src]').forEach(iframe => {
        if (iframe.src.includes('youtube.com') || iframe.src.includes('vimeo.com')) {
            iframe.dataset.src = iframe.src;
            iframe.removeAttribute('src');
            lazyLoadObserver.observe(iframe);
        }
    });
};

const createSvgPlaceholder = (w, h) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background-color:#f0f0f0;"></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const createHintLink = (rel, href) => {
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
};

/******************************************************************************
 * МОДУЛЬ 4: SimpleCSS (отключение эффектов + сжатие изображений)
 ******************************************************************************/
function disableHeavyEffects() {
    try {
        const style = document.createElement('style');
        style.textContent = `* {
            filter:none!important; backdrop-filter:none!important;
            ${isMobile ? 'box-shadow:none!important;' : ''}
            text-shadow:none!important; mix-blend-mode:normal!important;
            will-change:auto!important; perspective:none!important; transform-style:flat!important;
        } body { background-attachment:scroll!important; }`;
        document.documentElement.appendChild(style);
    } catch (e) { console.warn('[SimpleCSS] CSS injection failed:', e); }
}

function getCompressionSettings(width, height) {
    const maxSide = Math.max(width, height);
    if (isMobile) {
        if (maxSide <= 64) return { quality: 0.8, maxWidth: maxSide };
        if (maxSide <= 256) return { quality: 0.6, maxWidth: 256 };
        if (maxSide <= 512) return { quality: 0.4, maxWidth: 512 };
        return { quality: 0.3, maxWidth: 512 };
    } else {
        if (maxSide <= 64) return { quality: 0.9, maxWidth: maxSide };
        if (maxSide <= 256) return { quality: 0.7, maxWidth: maxSide };
        if (maxSide <= 1024) return { quality: 0.5, maxWidth: 1024 };
        return { quality: 0.35, maxWidth: 1024 };
    }
}

function compressImage(img) {
    try {
        if (!img.complete || img.naturalWidth === 0) return;
        if (img.src.startsWith('data:image')) return;
        if (img.hasAttribute('data-compressed')) return;
        if (img.srcset) return;

        if (img.src.endsWith('.svg') || img.src.includes('svg')) {
            rasterizeSVGImage(img);
            return;
        }

        const { quality, maxWidth } = getCompressionSettings(img.naturalWidth, img.naturalHeight);
        if (img.naturalWidth <= 64 && img.naturalHeight <= 64) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }

        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const format = supportsWebP ? 'image/webp' : 'image/jpeg';
        const newSrc = canvas.toDataURL(format, quality);
        if (newSrc && newSrc !== img.src) {
            img.src = newSrc;
            img.setAttribute('data-compressed', 'true');
        }
    } catch (e) { console.warn('[SimpleCSS] Image compression failed:', e); }
}

function rasterizeSVGImage(img) {
    if (img.hasAttribute('data-svg-processed')) return;
    img.setAttribute('data-svg-processed', 'true');
    const rect = img.getBoundingClientRect();
    let displayW = rect.width || img.width || MAX_SVG_SIZE;
    let displayH = rect.height || img.height || MAX_SVG_SIZE;
    if (displayW <= 32 || displayH <= 32) return;

    fetch(img.src).then(r => r.text()).then(svgText => {
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
        const blobUrl = URL.createObjectURL(svgBlob);
        const image = new Image();
        image.onload = () => {
            drawSVGToCanvas(img, image, displayW, displayH, image.naturalWidth, image.naturalHeight);
            URL.revokeObjectURL(blobUrl);
        };
        image.src = blobUrl;
    }).catch(err => console.warn('[SimpleCSS] SVG fetch failed:', err));
}

function drawSVGToCanvas(originalImg, loadedImg, displayW, displayH, svgW, svgH) {
    const svgAspect = svgW / svgH, dispAspect = displayW / displayH;
    let finalW, finalH;
    if (svgAspect > dispAspect) { finalW = displayW; finalH = displayW / svgAspect; }
    else { finalH = displayH; finalW = displayH * svgAspect; }
    const maxSize = isMobile ? 256 : MAX_SVG_SIZE;
    if (finalW > maxSize || finalH > maxSize) {
        const scale = Math.min(maxSize / finalW, maxSize / finalH);
        finalW *= scale; finalH *= scale;
    }
    finalW = Math.round(finalW); finalH = Math.round(finalH);

    const canvas = document.createElement('canvas');
    canvas.width = finalW; canvas.height = finalH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(loadedImg, 0, 0, finalW, finalH);

    const format = supportsWebP ? 'image/webp' : 'image/png';
    const quality = isMobile ? 0.5 : 0.6;
    const newSrc = canvas.toDataURL(format, quality);
    if (newSrc && newSrc !== originalImg.src) {
        originalImg.src = newSrc;
        originalImg.setAttribute('data-compressed', 'true');
        originalImg.style.width = displayW + 'px';
        originalImg.style.height = displayH + 'px';
        originalImg.style.objectFit = 'contain';
    }
}

function processExistingImages() {
    document.querySelectorAll('img').forEach(img => {
        if (img.complete) setTimeout(() => compressImage(img), 50);
        else img.addEventListener('load', () => setTimeout(() => compressImage(img), 50), { once: true });
    });
}

function setupImageObserver() {
    if (!('MutationObserver' in window)) return;
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (!(node instanceof Element)) return;
            if (node.nodeName === 'IMG') processNewImage(node);
            else if (node.nodeName === 'PICTURE') node.querySelectorAll('img').forEach(processNewImage);
            else if (node.querySelectorAll) node.querySelectorAll('img').forEach(processNewImage);
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function processNewImage(img) {
    if (img.complete) setTimeout(() => compressImage(img), 50);
    else img.addEventListener('load', () => setTimeout(() => compressImage(img), 50), { once: true });
}

/******************************************************************************
 * ИНИЦИАЛИЗАЦИЯ
 ******************************************************************************/
function initialize() {
    disableHeavyEffects();
    setTimeout(processExistingImages, 200);
    setupImageObserver();
}

const currentHostname = window.location.hostname;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (currentHostname.includes('google.') || currentHostname.includes('yandex.') || currentHostname.includes('duckduckgo.')) {
            initSearchPagePrefetcher();
        } else {
            initGeneralPagePrefetcher();
        }
        initialize();
    });
} else {
    if (currentHostname.includes('google.') || currentHostname.includes('yandex.') || currentHostname.includes('duckduckgo.')) {
        initSearchPagePrefetcher();
    } else {
        initGeneralPagePrefetcher();
    }
    initialize();
}

})();
