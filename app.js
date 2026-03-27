// ===== PARTICIPANTS SAFETY GUARD =====
const PARTICIPANTS = window.PARTICIPANTS ?? [];
if (!PARTICIPANTS.length) {
    console.error('participants.js failed to load or is empty');
}

// ===== CONFIGURATION =====
// Adjust these to match your Canva certificate template
const CERT_CONFIG = {
    templateSrc: 'assets/Certificate-Cloud Jam.png',
    name: {
        x: 0.5,       // horizontal center
        y: 0.467,     // vertical position — on the blank line
        fontSize: 0.042, // font size as fraction of image width (~84px on 2000px)
        fontFamily: 'Great Vibes',
        fontWeight: 'normal',
        color: '#5a19df',
        maxWidth: 0.6, // max name width as fraction of image width
    }
};

// ===== DOM ELEMENTS =====
const $ = (sel) => document.querySelector(sel);
const searchView = $('#search-view');
const certView = $('#cert-view');
const searchInput = $('#search-input');
const searchBar = $('#search-bar');
const clearBtn = $('#clear-btn');
const autocompleteList = $('#autocomplete-list');
const searchBtn = $('#search-btn');
const errorMsg = $('#error-msg');
const certCanvas = $('#cert-canvas');
const downloadBtn = $('#download-btn');
const backBtn = $('#back-btn');

// ===== STATE =====
let highlightIndex = -1;
let filteredNames = [];
let certTemplateImg = null;
let currentCertName = '';

// ===== VANTA.JS INIT =====
let vantaEffect = null;
function initVanta() {
    try {
        vantaEffect = VANTA.CLOUDS({
            el: '#vanta-bg',
            THREE: THREE,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            skyColor: 0x68b8d7,
            cloudColor: 0xadc1de,
            cloudShadowColor: 0x183550,
            sunColor: 0xff9919,
            sunGlareColor: 0xff6633,
            sunlightColor: 0xff9933,
            speed: 0.8,
        });
    } catch (e) {
        console.warn('Vanta.js failed to initialize:', e);
        // Fallback gradient background
        document.getElementById('vanta-bg').style.background =
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
}

let fontLoadPromise = null;

// ===== PRELOAD CERTIFICATE TEMPLATE =====
function preloadTemplate() {
    certTemplateImg = new Image();
    certTemplateImg.crossOrigin = 'anonymous';
    certTemplateImg.src = CERT_CONFIG.templateSrc;

    // Explicitly load the font so Canvas can use it immediately without race conditions
    const font = new FontFace('Great Vibes', 'url(assets/great-vibes-names-only.woff2)');
    fontLoadPromise = font.load().then((loaded) => {
        document.fonts.add(loaded);
    }).catch((err) => {
        console.warn('Font preload failed:', err);
    });
}

// ===== SEARCH & AUTOCOMPLETE =====
function normalize(str) {
    return str.toLowerCase().trim();
}

const NORMALIZED = PARTICIPANTS.map(normalize);

// Assumes q and n are already normalized
function fuzzyMatch(q, n) {
    // Check if all characters of query appear in order in name
    if (n.includes(q)) return { match: true, score: 1 };
    let qi = 0;
    for (let ni = 0; ni < n.length && qi < q.length; ni++) {
        if (n[ni] === q[qi]) qi++;
    }
    return { match: qi === q.length, score: qi / q.length };
}

function getMatches(query) {
    if (!query.trim()) return [];
    const q = normalize(query);
    return PARTICIPANTS
        .map((name, i) => {
            const n = NORMALIZED[i];
            return { name, n, ...fuzzyMatch(q, n) };
        })
        .filter(r => r.match)
        .sort((a, b) => {
            // 1. Starts with query (Highest Priority)
            const aStart = a.n.startsWith(q) ? 1 : 0;
            const bStart = b.n.startsWith(q) ? 1 : 0;
            if (bStart !== aStart) return bStart - aStart;

            // 2. Contains word starting with query (e.g., "John Doe" for "do")
            const aWordMatch = a.n.includes(` ${q}`) ? 1 : 0;
            const bWordMatch = b.n.includes(` ${q}`) ? 1 : 0;
            if (bWordMatch !== aWordMatch) return bWordMatch - aWordMatch;

            // 3. Exact substring matches anywhere
            const aExact = a.n.includes(q) ? 1 : 0;
            const bExact = b.n.includes(q) ? 1 : 0;
            if (bExact !== aExact) return bExact - aExact;

            // 4. Fuzzy score
            return b.score - a.score;
        })
        .map(r => r.name)
        .slice(0, 8);
}

function highlightMatch(name, query) {
    if (!query.trim()) return name;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return name.replace(regex, '<mark>$1</mark>');
}

function renderAutocomplete(query) {
    filteredNames = getMatches(query);
    highlightIndex = -1;

    if (filteredNames.length === 0 || !query.trim()) {
        autocompleteList.classList.add('hidden');
        searchBar.classList.remove('has-results');
        autocompleteList.innerHTML = '';
        return;
    }

    const searchSvg = `<svg viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0; margin-right: 12px; opacity: 0.6;"><path fill="#9AA0A6" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;

    autocompleteList.innerHTML = filteredNames
        .map((name, i) => `<li data-index="${i}">${searchSvg}<span style="white-space: pre;">${highlightMatch(name, query)}</span></li>`)
        .join('');

    autocompleteList.classList.remove('hidden');
    searchBar.classList.add('has-results');
}

function selectName(name) {
    searchInput.value = name;
    autocompleteList.classList.add('hidden');
    searchBar.classList.remove('has-results');
    clearBtn.classList.remove('hidden');
    submitSearch();
}

function updateHighlight() {
    const items = autocompleteList.querySelectorAll('li');
    items.forEach((li, i) => {
        li.classList.toggle('highlight', i === highlightIndex);
        if (i === highlightIndex) li.scrollIntoView({ block: 'nearest' });
    });
}

// ===== CERTIFICATE RENDERING =====
function findExactParticipant(query) {
    const q = normalize(query);
    const index = NORMALIZED.indexOf(q);
    return index !== -1 ? PARTICIPANTS[index] : null;
}

function _drawCert(name) {
    const ctx = certCanvas.getContext('2d');
    const img = certTemplateImg;

    // Set canvas to full template resolution
    certCanvas.width = img.naturalWidth;
    certCanvas.height = img.naturalHeight;

    // Draw template
    ctx.drawImage(img, 0, 0);

    // Draw name
    const cfg = CERT_CONFIG.name;
    const fontSize = Math.round(img.naturalWidth * cfg.fontSize);
    ctx.font = `${cfg.fontWeight} ${fontSize}px '${cfg.fontFamily}', Georgia, serif`;
    ctx.fillStyle = cfg.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // ctx.letterSpacing = '2px';
    ctx.wordSpacing = '10px';

    const x = img.naturalWidth * cfg.x;
    const y = img.naturalHeight * cfg.y;
    const maxW = img.naturalWidth * cfg.maxWidth;

    // Auto-shrink font if name is too wide
    let currentFontSize = fontSize;
    while (ctx.measureText(name).width > maxW && currentFontSize > 12) {
        currentFontSize -= 2;
        ctx.font = `${cfg.fontWeight} ${currentFontSize}px '${cfg.fontFamily}', Georgia, serif`;
    }

    ctx.fillText(name, x, y, maxW);
}

function renderCertificate(name) {
    // If template image hasn't loaded yet, show the loader and wait
    if (!certTemplateImg || !certTemplateImg.complete) {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.remove('hidden');
        certTemplateImg.addEventListener('load', () => {
            if (loader) loader.classList.add('hidden');
            renderCertificate(name); // retry once loaded
        }, { once: true });
        return;
    }

    // Gate explicitly on the Great Vibes font being loaded (Canvas requires this)
    const ready = fontLoadPromise || document.fonts.ready;
    ready.then(() => {
        // Wait for the next animation frame so Chromium 
        // has finished calculating the CSS grid layout BEFORE we inject 2000px.
        requestAnimationFrame(() => {
            _drawCert(name);
        });
    });
}

// ===== DOWNLOAD =====
function downloadCertificate(name) {
    certCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificate_${name.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 'image/png');
}

// ===== VIEW SWITCHING =====
function showCertView(name) {
    renderCertificate(name);
    currentCertName = name;

    searchView.classList.remove('active');
    certView.classList.add('active');

    // Trigger shine effect after transition
    setTimeout(() => {
        const card = document.querySelector('.cert-card');
        if (!card) return;
        card.classList.remove('animate-shine');
        void card.offsetWidth; // Force reflow
        card.classList.add('animate-shine');
    }, 400);
}

function resetSearchUI() {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    errorMsg.classList.add('hidden');
    searchBar.classList.remove('error');
    autocompleteList.classList.add('hidden');
    searchBar.classList.remove('has-results');
    searchInput.focus();
}

function showSearchView() {
    certView.classList.remove('active');
    searchView.classList.add('active');
    resetSearchUI();
}

// ===== SUBMIT =====
function submitSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        searchBar.classList.add('error');
        setTimeout(() => searchBar.classList.remove('error'), 600);
        return;
    }

    const participant = findExactParticipant(query);
    if (participant) {
        errorMsg.classList.add('hidden');
        searchBar.classList.remove('error');
        showCertView(participant);
    } else {
        errorMsg.classList.remove('hidden');
        searchBar.classList.add('error');
        setTimeout(() => searchBar.classList.remove('error'), 600);
    }
}

// ===== EVENT LISTENERS =====
let debounceTimer;
searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    clearBtn.classList.toggle('hidden', !val);
    errorMsg.classList.add('hidden');
    searchBar.classList.remove('error');
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        renderAutocomplete(val);
    }, 120);
});

searchInput.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;

    if (e.key === 'Escape') {
        autocompleteList.classList.add('hidden');
        searchBar.classList.remove('has-results');
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filteredNames.length) {
            selectName(filteredNames[highlightIndex]);
        } else {
            submitSearch();
        }
        return;
    }

    // Handle arrow keys
    if (filteredNames.length === 0) return;
    e.preventDefault();

    if (e.key === 'ArrowDown') {
        highlightIndex = Math.min(highlightIndex + 1, filteredNames.length - 1);
    } else if (e.key === 'ArrowUp') {
        highlightIndex = Math.max(highlightIndex - 1, -1);
    }
    updateHighlight();
});

autocompleteList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) {
        const index = parseInt(li.dataset.index, 10);
        if (filteredNames[index]) {
            selectName(filteredNames[index]);
        }
    }
});

clearBtn.addEventListener('click', resetSearchUI);

searchBtn.addEventListener('click', () => {
    submitSearch();
});

downloadBtn.addEventListener('click', () => {
    downloadCertificate(currentCertName);
});

backBtn.addEventListener('click', () => {
    showSearchView();
});

// Close autocomplete when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar-wrapper')) {
        autocompleteList.classList.add('hidden');
        searchBar.classList.remove('has-results');
    }
});

// ===== INIT =====
window.addEventListener('load', () => {
    // window.load guarantees all images, fonts, and Vanta scripts are fully downloaded
    // We add a tiny 250ms buffer to allow Vanta's first WebGL frame to paint gracefully
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');
        searchInput.focus();

        // 🚀 Fetch the heavy 270KB certificate template ONLY AFTER the UI is fully revealed
        // This ensures the Splash screen disappears instantly for users on slow networks,
        // while the certificate loads silently in the background before they finish typing their name.
        preloadTemplate();
    }, 250);
});

document.addEventListener('DOMContentLoaded', () => {
    initVanta();

    // FALLBACK: If a CDN hangs indefinitely (e.g. Vanta/Three.js) and window.load never fires,
    // force hide the splash screen after 5 seconds so the user isn't permanently locked out.
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader && !loader.classList.contains('hidden')) {
            loader.classList.add('hidden');
            console.warn('Splash screen forced hide (window.load hung due to CDN timeout)');
        }
    }, 20000);

    // Setup robust interactions for the certificate card
    const card = document.querySelector('.cert-card');
    if (card) {
        card.addEventListener('mouseenter', () => {
            // Force DOM reflow to guarantee the animation restarts even if it recently finished
            card.classList.remove('animate-shine');
            void card.offsetWidth;
            card.classList.add('animate-shine');
        });

        // The browser fires this natively the exact millisecond the animation finishes
        card.addEventListener('animationend', (e) => {
            if (e.animationName === 'shine') {
                card.classList.remove('animate-shine');
            }
        });
    }
});

// Hide ugly browser teardown during manual refresh
window.addEventListener('beforeunload', () => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.remove('hidden');
        loader.style.opacity = '1';
        loader.style.visibility = 'visible';
    }
});
