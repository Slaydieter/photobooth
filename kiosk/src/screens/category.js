import { navigate, goBack } from '../utils/router.js'
import { state, setState } from '../utils/state.js'
import { API } from '../utils/api.js'

// ── Screen 2: Category ─────────────────────────────────────────────────────
export async function renderCategoryScreen() {
  const el = document.getElementById('screen-category')
  el.innerHTML = `
    <button class="back-btn" onclick="goBack()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Quay lại
    </button>
    <div class="screen-inner">
      <div class="screen-header">
        <p class="text-sm text-muted" style="letter-spacing:0.15em;text-transform:uppercase">Bước 1 / 2</p>
        <h2 class="display-md" style="margin-top:8px">Chọn <span class="text-accent">chủ đề</span></h2>
        <div class="divider"></div>
      </div>
      <div class="category-grid scroll-area" id="category-grid">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `

  try {
    const { data: categories } = await API.getCategories()
    const grid = document.getElementById('category-grid')
    if (!categories.length) {
      grid.innerHTML = `<p class="text-muted text-center" style="padding:60px">Chưa có category nào</p>`
      return
    }
    grid.innerHTML = categories.map((cat, i) => `
      <div class="cat-card card animate-up"
           style="animation-delay:${i * 0.07}s"
           data-id="${cat._id}"
           data-name="${cat.name}">
        <div class="cat-card-img">
          ${cat.coverImage
            ? `<img src="http://localhost:3001/${cat.coverImage}" alt="${cat.name}">`
            : `<div class="cat-card-placeholder">${cat.name.charAt(0)}</div>`
          }
          <div class="cat-card-overlay">
            <span class="cat-card-count">${cat.themeCount} chủ đề</span>
          </div>
        </div>
        <div class="cat-card-body">
          <h3 class="cat-card-title">${cat.name}</h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    `).join('')

    grid.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', () => {
        setState('session.categoryId', card.dataset.id)
        setState('session.category',   { _id: card.dataset.id, name: card.dataset.name })
        renderThemeScreen(card.dataset.id, card.dataset.name)
        navigate('theme')
      })
    })
  } catch (err) {
    document.getElementById('category-grid').innerHTML =
      `<p class="text-muted text-center">Lỗi tải dữ liệu: ${err.message}</p>`
  }
}

// ── Screen 3: Theme ────────────────────────────────────────────────────────
export async function renderThemeScreen(categoryId, categoryName) {
  const el = document.getElementById('screen-theme')
  el.innerHTML = `
    <button class="back-btn" onclick="goBack()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Quay lại
    </button>
    <div class="screen-inner">
      <div class="screen-header">
        <p class="text-sm text-muted" style="letter-spacing:0.15em;text-transform:uppercase">
          Bước 2 / 2 · ${categoryName}
        </p>
        <h2 class="display-md" style="margin-top:8px">Chọn <span class="text-accent">bộ ảnh</span></h2>
        <div class="divider"></div>
      </div>
      <div class="theme-grid scroll-area" id="theme-grid">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `

  try {
    const { data: themes } = await API.getThemesByCategory(categoryId)
    const grid = document.getElementById('theme-grid')
    if (!themes.length) {
      grid.innerHTML = `<p class="text-muted text-center" style="padding:60px">Chưa có theme nào</p>`
      return
    }
    grid.innerHTML = themes.map((theme, i) => `
      <div class="theme-card card animate-up"
           style="animation-delay:${i * 0.07}s"
           data-id="${theme._id}"
           data-name="${theme.name}"
           data-price="${theme.pricePerCopy}"
           data-template="${theme.templateLayer || ''}"
           data-photo-count="${theme.photoCount || 4}"
           data-placeholder-color="${theme.placeholderColor || '#87CEEB'}">
        <div class="theme-card-img">
          ${theme.coverImage
            ? `<img src="http://localhost:3001/${theme.coverImage}" alt="${theme.name}">`
            : `<div class="theme-card-placeholder">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                  <rect x="4" y="10" width="40" height="30" rx="5"/>
                  <circle cx="24" cy="25" r="8"/>
                  <circle cx="24" cy="25" r="3" fill="currentColor" opacity="0.4"/>
                </svg>
                <span>${theme.name}</span>
              </div>`
          }
        </div>
        <div class="theme-card-footer">
          <div>
            <span class="theme-card-name">${theme.name}</span>
            <span class="theme-card-price">${theme.pricePerCopy.toLocaleString('vi-VN')}đ / tấm</span>
          </div>
          <button class="btn btn-primary btn-sm">Chọn</button>
        </div>
      </div>
    `).join('')

    grid.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const theme = {
          _id:              card.dataset.id,
          name:             card.dataset.name,
          pricePerCopy:     parseInt(card.dataset.price),
          templateLayer:    card.dataset.template || null,
          photoCount:       parseInt(card.dataset.photoCount) || 4,
          placeholderColor: card.dataset.placeholderColor || '#87CEEB',
        }
        setState('session.themeId',    theme._id)
        setState('session.theme',      theme)
        // Render màn hình quantity với theme đã chọn
        const { renderQuantityScreen } = window._screens
        renderQuantityScreen()
        navigate('quantity')
      })
    })
  } catch (err) {
    document.getElementById('theme-grid').innerHTML =
      `<p class="text-muted text-center">Lỗi tải dữ liệu: ${err.message}</p>`
  }
}

export const categoryStyles = `
  .screen-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 60px 48px 40px;
  }
  .screen-header { margin-bottom: 36px; }
  .loading-spinner {
    width: 40px; height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 80px auto;
  }

  /* Category grid */
  .category-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    align-content: start;
    padding-right: 8px;
  }
  .cat-card { cursor: pointer; opacity: 0; }
  .cat-card-img {
    aspect-ratio: 16/9;
    overflow: hidden;
    position: relative;
    background: var(--bg-3);
  }
  .cat-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
  .cat-card:hover .cat-card-img img { transform: scale(1.05); }
  .cat-card-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: 4rem; font-weight: 900;
    color: var(--border-hover);
    background: linear-gradient(135deg, var(--bg-3), var(--surface));
  }
  .cat-card-overlay {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 16px;
    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  }
  .cat-card-count {
    font-size: 0.75rem;
    color: var(--accent);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .cat-card-body {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px;
    color: var(--text-muted);
  }
  .cat-card-title {
    font-size: 1.1rem; font-weight: 600;
    color: var(--text);
  }

  /* Theme grid */
  .theme-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 20px;
    align-content: start;
    padding-right: 8px;
  }
  .theme-card { cursor: pointer; opacity: 0; }
  .theme-card-img {
    aspect-ratio: 3/4;
    overflow: hidden;
    background: var(--bg-3);
    position: relative;
  }
  .theme-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
  .theme-card:hover .theme-card-img img { transform: scale(1.05); }
  .theme-card-placeholder {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px;
    color: var(--border-hover);
    background: linear-gradient(135deg, var(--bg-3), var(--surface));
    font-size: 0.875rem; font-weight: 500;
  }
  .theme-card-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; gap: 12px;
  }
  .theme-card-name { display: block; font-weight: 600; font-size: 0.95rem; }
  .theme-card-price { display: block; font-size: 0.8rem; color: var(--accent); margin-top: 2px; }
`
