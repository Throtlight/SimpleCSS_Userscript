// ==UserScript==
// @name         SimpleCSS
// @namespace    https://github.com
// @version      3.0
// @description  The most powerful optimization for anyone browser - say goodbay to your lags!
// @author       Throtlight & Gemini
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- Глобальная конфигурация ---
    const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
    const supportsWebP = (() => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        } catch (e) { return false; }
    })();

    /******************************************************************************
     * Main router and launch
     ******************************************************************************/
    const run = () => {
        const currentHostname = window.location.hostname;
        if (currentHostname.includes('google.') || currentHostname.includes('yandex.') || currentHostname.includes('duckduckgo.')) {
            initSearchPageOptimizer();
        } else {
            initRenderOptimizer();
            initLazyLoaderWithDecode();
            initApiCaching();
            // Network optimization
            window.addEventListener('load', initNetworkOptimizer);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    /******************************************************************************
     * Module 1: Optimize CSS
     ******************************************************************************/
    const initRenderOptimizer = () => {
        // --- 1.1 Disable effects ---
        const style = document.createElement('style');
        style.textContent = `
          * { filter: none !important; backdrop-filter: none !important; ${isMobile ? 'box-shadow: none !important;' : ''}
            text-shadow: none !important; mix-blend-mode: normal !important; will-change: auto !important;
            perspective: none !important; transform-style: flat !important; }
          body { background-attachment: scroll !important; }`;
        document.documentElement.appendChild(style);

        // --- 1.2 Logic for a compress images ---
        const getCompressionSettings = (width, height) => {
            const maxSide = Math.max(width, height);
            if (isMobile) {
                if (maxSide <= 256) return { quality: 0.6, maxWidth: 256 };
                return { quality: 0.4, maxWidth: 512 };
            } else {
                if (maxSide <= 256) return { quality: 0.7, maxWidth: 256 };
                if (maxSide <= 1024) return { quality: 0.5, maxWidth: 1024 };
                return { quality: 0.35, maxWidth: 1024 };
            }
        };

        const compressImage = (img) => {
            try {
                if (!img.complete || img.naturalWidth === 0 || img.src.startsWith('data:image') || img.hasAttribute('data-compressed') || img.srcset) return;
                const { quality, maxWidth } = getCompressionSettings(img.naturalWidth, img.naturalHeight);
                if (img.naturalWidth <= 64) return;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                let w = img.naturalWidth, h = img.naturalHeight;
                if (w > maxWidth) {
                    h = Math.round(h * (maxWidth / w));
                    w = maxWidth;
                }
                canvas.width = w; canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);

                const format = supportsWebP ? 'image/webp' : 'image/jpeg';
                const newSrc = canvas.toDataURL(format, quality);

                if (newSrc && newSrc.length < img.src.length) {
                    img.src = newSrc;
                    img.setAttribute('data-compressed', 'true');
                }
            } catch (e) { /* Ignore errors (e.g. cross-origin) */ }
        };

        // --- 1.3 Global function for call all modules ---
        window.processImageForOptimization = (img) => {
             if (img.complete) {
                 compressImage(img);
             } else {
                 img.addEventListener('load', () => compressImage(img), { once: true });
             }
        };
    };

    /******************************************************************************
     * Module 2: Lazy Loader with async decoder
     ******************************************************************************/
    const initLazyLoaderWithDecode = () => {
        GM_addStyle(`
            img[data-src] { transition: opacity 0.3s ease-in-out !important; opacity: 0 !important; }
            img.lazy-loaded { opacity: 1 !important; }
        `);

        const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    observer.unobserve(img);

                    const src = img.dataset.src;
                    if (src) {
                        img.src = src;
                        // Async decoder
                        if ('decode' in img) {
                            img.decode()
                               .catch(e => console.warn('[Accelerator] Image decoding failed:', e))
                               .finally(() => img.classList.add('lazy-loaded'));
                        } else {
                            // Fallback for old browsers
                            img.classList.add('lazy-loaded');
                        }
                    }
                    if (img.dataset.srcset) img.srcset = img.dataset.srcset;

                    // Calling compression after load
                    if (window.processImageForOptimization) {
                         window.processImageForOptimization(img);
                    }
                }
            });
        }, { rootMargin: "300px" });

        const processImgForLazyLoad = (img) => {
            if (!img.src || img.src.startsWith('data:') || img.hasAttribute('data-src') || img.closest('picture')) return;
            // Filter lazy-load for images
            if (img.getBoundingClientRect().top < window.innerHeight * 1.5) {
                if (window.processImageForOptimization) window.processImageForOptimization(img);
                return;
            }

            img.dataset.src = img.src;
            if (img.srcset) {
                img.dataset.srcset = img.srcset;
                img.removeAttribute('srcset');
            }
            img.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${img.width || 1} ${img.height || 1}'%3E%3C/svg%3E`;
            lazyLoadObserver.observe(img);
        };

        // Observer
        document.querySelectorAll('img').forEach(processImgForLazyLoad);
        new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.matches('img')) processImgForLazyLoad(node);
                else node.querySelectorAll('img').forEach(processImgForLazyLoad);
            }
        }))).observe(document.documentElement, { childList: true, subtree: true });
    };

    /******************************************************************************
     * Module 3: Intellectual API Cacher (Experemintal)
     ******************************************************************************/
    const initApiCaching = () => {
        const CACHE_PREFIX = 'api-cache-';
        const CACHE_TTL_MS = 5 * 60 * 1000;
        const originalFetch = window.fetch;

        const createCacheUI = () => {
            const cacheIndicator = document.createElement('div');
            cacheIndicator.id = 'api-cache-indicator';
            cacheIndicator.textContent = 'API';
            cacheIndicator.title = 'API кешер активен. Нажмите, чтобы очистить.';
            document.body.appendChild(cacheIndicator);
            cacheIndicator.addEventListener('click', () => {
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                    const key = sessionStorage.key(i);
                    if (key.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
                }
                cacheIndicator.classList.remove('cached', 'used');
            });
            GM_addStyle(`
                #api-cache-indicator { position: fixed; bottom: 10px; right: 10px; background-color: #333; color: #888;
                    padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 10px; z-index: 999999;
                    cursor: pointer; transition: all 0.3s; user-select: none; }
                #api-cache-indicator:hover { color: #eee; }
                #api-cache-indicator.cached { background-color: #005d25; color: #eee; }
                #api-cache-indicator.used { background-color: #00ff7f; color: #111; transform: scale(1.1); }
            `);
        };

        window.fetch = async function(...args) {
            const request = new Request(args[0], args[1]);
            if (request.method !== 'GET') return originalFetch(...args);

            const cacheKey = CACHE_PREFIX + request.url;
            const cachedItem = sessionStorage.getItem(cacheKey);
            const indicator = document.getElementById('api-cache-indicator');

            if (cachedItem) {
                const { timestamp, data } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < CACHE_TTL_MS) {
                    if (indicator) {
                        indicator.classList.add('used');
                        setTimeout(() => indicator.classList.remove('used'), 1000);
                    }
                    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' }});
                }
            }

            const response = await originalFetch(...args);
            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                const responseClone = response.clone();
                responseClone.json().then(data => {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
                    if (indicator) indicator.classList.add('cached');
                });
            }
            return response;
        };

        createCacheUI();
    };

    /******************************************************************************
     * Module 4: Preloader buttons and navigation
     ******************************************************************************/
    const initNetworkOptimizer = () => {
        const prefetchUrl = (url) => {
            if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'prefetch'; link.href = url;
            document.head.appendChild(link);
        };

        // --- 4.1 Preload default links ---
        const linkObserver = new IntersectionObserver(entries => entries.forEach(entry => {
            if (entry.isIntersecting) {
                const link = entry.target;
                if (link.hostname === window.location.hostname && link.getAttribute('href') && !link.getAttribute('href').startsWith('#')) {
                    prefetchUrl(link.href);
                }
                linkObserver.unobserve(link);
            }
        }));
        document.querySelectorAll('a[href]').forEach(link => linkObserver.observe(link));

        // --- 4.2 "Learning" on the JS-elements ---
        // (Experimental)
        const STORAGE_KEY_PREFIX = 'prefetch-learner-';
        const getElementFingerprint = (el) => el.tagName + ':' + (el.textContent.trim().slice(0, 50) || el.className);
        document.addEventListener('mousedown', (e) => {
            const interactiveElement = e.target.closest('button, [role="button"], [onclick]');
            if (!interactiveElement || e.target.closest('a[href]')) return;
            const perfObserver = new PerformanceObserver(list => {
                list.getEntries().forEach(entry => {
                    if ((entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') && new URL(entry.name, location.href).hostname === location.hostname) {
                        sessionStorage.setItem(STORAGE_KEY_PREFIX + getElementFingerprint(interactiveElement), entry.name);
                        perfObserver.disconnect();
                    }
                });
            });
            perfObserver.observe({ entryTypes: ['resource'] });
            setTimeout(() => perfObserver.disconnect(), 2000); // Stop listening after 2s
        }, true);

        const learnedObserver = new IntersectionObserver(entries => entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const learnedUrl = sessionStorage.getItem(STORAGE_KEY_PREFIX + getElementFingerprint(el));
                if (learnedUrl) prefetchUrl(learnedUrl);
                learnedObserver.unobserve(el);
            }
        }));
        document.querySelectorAll('button, [role="button"], [onclick]').forEach(el => learnedObserver.observe(el));
    };

    /******************************************************************************
     * Module 5: Accelerator for search systems
     ******************************************************************************/
    const initSearchPageOptimizer = () => {
        const searchEngines = {
            'google': 'div.g a[href]:not([role="button"])',
            'yandex': 'a.serp-item__title',
            'duckduckgo': 'a[data-testid="result-title-a"]'
        };
        const engineKey = Object.keys(searchEngines).find(key => window.location.hostname.includes(key));
        if (!engineKey) return;

        const links = Array.from(document.querySelectorAll(searchEngines[engineKey])).slice(0, 5);
        const processedOrigins = new Set();
        links.forEach(link => {
            try {
                const origin = new URL(link.href).origin;
                if (!processedOrigins.has(origin)) {
                    ['dns-prefetch', 'preconnect'].forEach(rel => {
                        const hint = document.createElement('link');
                        hint.rel = rel; hint.href = origin;
                        document.head.appendChild(hint);
                    });
                    processedOrigins.add(origin);
                }
            } catch (e) { /* Ignore invalid URLs */ }
        });
    };

})();
