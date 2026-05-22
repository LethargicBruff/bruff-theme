/* ════════════════════════════════════════
   bruff.me — main.js
   ════════════════════════════════════════ */

'use strict';

const CONFIG = {
  bttrFeedUrl: 'https://bttr.reviews/rss/',
  ytFeedUrl:   'https://www.youtube.com/feeds/videos.xml?channel_id=UCAoGBE-IIXgXhnLH5VClteQ',
  mbJsonFeed:  '/feeds/json',
  corsProxy:   'https://api.allorigins.win/raw?url=',
};

function qs(sel, ctx)  { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

function timeAgo(dateStr) {
  const now  = new Date();
  const then = new Date(dateStr);
  const secs = Math.floor((now - then) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  if (secs < 604800) return Math.floor(secs / 86400) + 'd ago';
  return then.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function fetchXml(url) {
  const res = await fetch(CONFIG.corsProxy + encodeURIComponent(url));
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  const text = await res.text();
  return new DOMParser().parseFromString(text, 'application/xml');
}

function safeSetHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* ── BTTR FEED ── */

async function loadBttrFeed() {
  try {
    const xml   = await fetchXml(CONFIG.bttrFeedUrl);
    const items = Array.from(xml.querySelectorAll('item')).slice(0, 4);

    const html = items.map(item => {
      const title   = item.querySelector('title')?.textContent || '';
      const link    = item.querySelector('link')?.textContent || '#';
      const date    = item.querySelector('pubDate')?.textContent || '';
      const dateStr = date ? new Date(date).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric'
      }) : '';
      return `
        <div class="bttr-item">
          <a href="${link}" target="_blank" rel="noopener">
            <div class="bttr-item-title">${title}</div>
            <div class="bttr-item-meta">${dateStr}</div>
          </a>
        </div>`;
    }).join('');

    safeSetHtml('bttr-feed', html || '<div class="bttr-item"><div class="bttr-item-title" style="color:var(--ink-faint)">No posts found</div></div>');
  } catch (e) {
    safeSetHtml('bttr-feed', '<div class="bttr-item"><div class="bttr-item-title" style="color:var(--ink-faint)">Could not load feed</div></div>');
    console.warn('BTTR feed error:', e);
  }
}

/* ── YOUTUBE FEED ── */

async function loadYtFeed() {
  try {
    const xml   = await fetchXml(CONFIG.ytFeedUrl);
    const items = Array.from(xml.querySelectorAll('entry')).slice(0, 3);

    const html = items.map(item => {
      const title     = item.querySelector('title')?.textContent || '';
      const link      = item.querySelector('link')?.getAttribute('href') || '#';
      const published = item.querySelector('published')?.textContent || '';
      const videoId   = item.querySelector('videoId')?.textContent || '';
      const thumb     = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';
      const dateStr   = published ? timeAgo(published) : '';
      return `
        <a href="${link}" target="_blank" rel="noopener" class="yt-item">
          <div class="yt-thumb">
            ${thumb ? `<img src="${thumb}" alt="" loading="lazy">` : ''}
          </div>
          <div>
            <div class="yt-item-title">${title}</div>
            <span class="yt-item-date">${dateStr}</span>
          </div>
        </a>`;
    }).join('');

    safeSetHtml('yt-feed', html || '<div style="padding:1rem 1.1rem;font-size:0.82rem;color:var(--ink-faint)">No videos found</div>');
  } catch (e) {
    safeSetHtml('yt-feed', '<div style="padding:1rem 1.1rem;font-size:0.82rem;color:var(--ink-faint)">Could not load feed</div>');
    console.warn('YouTube feed error:', e);
  }
}

/* ── BOOKS SIDEBAR ── */

async function loadBooksSidebar() {
  try {
    const res = await fetch('/bookshelf/');
    if (!res.ok) throw new Error('bookshelf fetch failed');
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // First .bookshelf section is Currently Reading
    const shelf = doc.querySelector('.bookshelf');
    if (!shelf) throw new Error('no shelf found');

    const books = Array.from(shelf.querySelectorAll('.book')).slice(0, 6);

    if (books.length > 0) {
      const booksHtml = `<div class="books-row">` + books.map(book => {
        const img = book.querySelector('img');
        const link = book.querySelector('a');
        const src = img ? img.src : '';
        const url = link ? link.href : '/bookshelf/';
        return src ? `<a href="${url}" class="book-item" target="_blank" rel="noopener"><img src="${src}" alt="" loading="lazy"></a>` : '';
      }).filter(Boolean).join('') + `</div>`;
      safeSetHtml('books-feed', booksHtml);
    } else {
      safeSetHtml('books-feed', '<div style="padding:0.9rem 1.1rem;font-size:0.82rem;color:var(--ink-faint)">Nothing on the shelf yet</div>');
    }

  } catch (e) {
    safeSetHtml('books-feed', '<div style="padding:0.9rem 1.1rem;font-size:0.82rem;color:var(--ink-faint)">Could not load</div>');
    console.warn('Books sidebar error:', e);
  }
}

/* ── WATCHED SIDEBAR ── */

async function loadWatchedSidebar() {
  try {
    const res = await fetch(CONFIG.corsProxy + encodeURIComponent(CONFIG.mbJsonFeed));
    if (!res.ok) throw new Error('feed failed');
    const data = await res.json();
    const items = (data.items || []).filter(item => {
      const text = (item.content_text || '').toLowerCase();
      return text.startsWith('watched') || text.startsWith('watching');
    }).slice(0, 3);

    if (items.length > 0) {
      const html = `<div class="watched-row">` + items.map(post => {
        const text = post.content_text || '';
        const url = post.url || '#';
        const date = post.date_published ? timeAgo(post.date_published) : '';
        const titleMatch = text.match(/(?:Watched|Watching)\s+["']?([^"'\n.!]+)/i);
        const title = titleMatch ? titleMatch[1].trim() : text.slice(0, 60);
        return `
          <a href="${url}" class="watched-item">
            <div>
              <div class="watched-title">${title}</div>
              <div class="watched-date">${date}</div>
            </div>
          </a>`;
      }).join('') + `</div>`;
      safeSetHtml('watched-feed', html);
    } else {
      safeSetHtml('watched-feed', '<div style="padding:0.9rem 1.1rem;font-size:0.82rem;color:var(--ink-faint)">Nothing logged yet</div>');
    }

  } catch (e) {
    safeSetHtml('watched-feed', '<div style="padding:0.9rem 1.1rem;font-size:0.82rem;color:var(--ink-faint)">Could not load</div>');
    console.warn('Watched sidebar error:', e);
  }
}

/* ── STREAM FILTERING ── */

function initStreamFilters() {
  const filterBtns = qsa('.filter-btn');
  const stream     = qs('#post-stream');
  if (!stream || !filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter   = btn.dataset.filter;
      const articles = qsa('article', stream);

      articles.forEach(article => {
        if (filter === 'all') { article.style.display = ''; return; }
        const type = (article.dataset.type || '').toLowerCase();
        article.style.display = type.includes(filter) ? '' : 'none';
      });
    });
  });
}

/* ── LOAD MORE ── */

function initLoadMore() {
  const btn = qs('.load-more-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const nextUrl = btn.dataset.next;
    if (!nextUrl || btn.classList.contains('loading')) return;

    btn.classList.add('loading');
    btn.textContent = 'Loading…';

    try {
      const res  = await fetch(nextUrl);
      if (!res.ok) throw new Error('fetch failed');
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      const newPosts = doc.querySelectorAll('#post-stream article');
      const stream   = qs('#post-stream');

      if (stream && newPosts.length) {
        newPosts.forEach(post => {
          post.style.opacity = '0';
          stream.appendChild(post);
          requestAnimationFrame(() => {
            post.style.transition = 'opacity 0.3s ease';
            post.style.opacity = '1';
          });
        });
      }

      const nextBtn = doc.querySelector('.load-more-btn');
      if (nextBtn) {
        btn.dataset.next = nextBtn.dataset.next;
        btn.classList.remove('loading');
        btn.textContent = 'Load more';
      } else {
        btn.closest('.pagination').remove();
      }

    } catch (e) {
      btn.classList.remove('loading');
      btn.textContent = 'Try again';
      console.warn('Load more error:', e);
    }
  });
}

/* ── MOBILE NAV ── */

function initMobileNav() {
  const toggle = qs('.nav-toggle');
  const nav    = qs('.site-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => nav.classList.toggle('open'));

  document.addEventListener('click', e => {
    if (!e.target.closest('.site-header')) nav.classList.remove('open');
  });
}

/* ── INIT ── */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initStreamFilters();
  initLoadMore();

  if (qs('.sidebar')) {
    loadBttrFeed();
    loadYtFeed();
    loadBooksSidebar();
    loadWatchedSidebar();
  }
});
