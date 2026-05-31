import { navigate } from '../utils/router.js'
import { state, setState } from '../utils/state.js'
import { API } from '../utils/api.js'

export function renderArrangeScreen() {
  const el        = document.getElementById('screen-arrange')
  const photos    = state.session.photos || []
  const copyCount = state.session.copyCount
  const theme     = state.session.theme

  // Mỗi tấm có 4 slot
  // layouts[copyIdx][slotIdx] = photo object | null
  const layouts = Array.from({ length: copyCount }, () => Array(4).fill(null))

  function renderAll() {
    el.innerHTML = `
      <div class="arrange-layout">
        <!-- Left: photo pool -->
        <div class="arrange-pool-wrap">
          <div class="arrange-pool-header">
            <p class="text-sm text-muted" style="letter-spacing:0.12em;text-transform:uppercase">Ảnh đã chụp</p>
            <p class="text-sm text-muted">${photos.length} bức · Kéo vào ô bên phải</p>
          </div>
          <div class="arrange-pool scroll-area" id="photo-pool">
            ${photos.map((p, i) => `
              <div class="pool-photo"
                   draggable="true"
                   data-photo-idx="${i}"
                   data-path="${p.filePath}">
                <img src="http://localhost:3001/${p.filePath}"
                     alt="Ảnh ${i+1}"
                     draggable="false"
                     onerror="this.style.opacity='0.2'">
                <span class="pool-photo-num">#${i + 1}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right: layout frames -->
        <div class="arrange-frames-wrap">
          <div class="arrange-frames-header">
            <div>
              <p class="text-sm text-muted" style="letter-spacing:0.12em;text-transform:uppercase">Sắp xếp vào tấm ảnh</p>
              <h2 class="display-md" style="margin-top:6px">
                Kéo ảnh vào <span class="text-accent">các ô</span>
              </h2>
            </div>
            <button class="btn btn-primary btn-lg" id="confirm-arrange-btn" onclick="confirmArrange()">
              Hoàn tất &nbsp;→
            </button>
          </div>

          <div class="arrange-copies scroll-area">
            ${Array.from({ length: copyCount }, (_, ci) => `
              <div class="arrange-copy" data-copy="${ci}">
                <p class="text-sm text-accent" style="margin-bottom:12px;font-weight:600">
                  Tấm ${ci + 1} / ${copyCount}
                </p>
                <div class="arrange-slots">
                  ${Array.from({ length: 4 }, (_, si) => `
                    <div class="arrange-slot empty"
                         data-copy="${ci}"
                         data-slot="${si}"
                         id="slot-${ci}-${si}">
                      <div class="slot-empty-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
                          <rect x="3" y="3" width="18" height="18" rx="3"/>
                          <path d="M12 8v8M8 12h8"/>
                        </svg>
                        <span>Ô ${si + 1}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `

    setupDragDrop()
  }

  function setupDragDrop() {
    let draggingEl   = null
    let draggingIdx  = null

    // Pool photos — drag start
    document.querySelectorAll('.pool-photo').forEach(photo => {
      photo.addEventListener('dragstart', e => {
        draggingIdx = parseInt(photo.dataset.photoIdx)
        draggingEl  = photo
        photo.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'copy'
      })
      photo.addEventListener('dragend', () => {
        photo.classList.remove('dragging')
      })
    })

    // Slots — drop target
    document.querySelectorAll('.arrange-slot').forEach(slot => {
      slot.addEventListener('dragover', e => {
        e.preventDefault()
        slot.classList.add('drag-over')
        e.dataTransfer.dropEffect = 'copy'
      })
      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over')
      })
      slot.addEventListener('drop', e => {
        e.preventDefault()
        slot.classList.remove('drag-over')

        const ci = parseInt(slot.dataset.copy)
        const si = parseInt(slot.dataset.slot)
        if (draggingIdx === null) return

        const photo = photos[draggingIdx]
        layouts[ci][si] = photo

        // Render ảnh vào slot
        slot.classList.remove('empty')
        slot.innerHTML = `
          <img src="http://localhost:3001/${photo.filePath}"
               alt="Ảnh" draggable="false"
               onerror="this.style.opacity='0.2'">
          <button class="slot-remove" onclick="removeSlot(${ci},${si})" title="Xóa">✕</button>
        `
        updateConfirmBtn()
      })

      // Slot hiện có ảnh — cũng drag được để hoán đổi
      slot.addEventListener('dragstart', e => {
        const ci = parseInt(slot.dataset.copy)
        const si = parseInt(slot.dataset.slot)
        if (layouts[ci][si]) {
          draggingIdx = photos.indexOf(layouts[ci][si])
          draggingEl  = slot
          slot.classList.add('dragging')
          e.dataTransfer.effectAllowed = 'move'
        }
      })
    })

    window.removeSlot = (ci, si) => {
      layouts[ci][si] = null
      const slot = document.getElementById(`slot-${ci}-${si}`)
      slot.classList.add('empty')
      slot.innerHTML = `
        <div class="slot-empty-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
          <span>Ô ${si + 1}</span>
        </div>
      `
      updateConfirmBtn()
    }
  }

  function updateConfirmBtn() {
    const allFilled = layouts.every(copy => copy.every(slot => slot !== null))
    const btn = document.getElementById('confirm-arrange-btn')
    if (btn) {
      btn.disabled = !allFilled
      btn.style.opacity = allFilled ? '1' : '0.4'
    }
  }

  window.confirmArrange = async () => {
    const btn = document.getElementById('confirm-arrange-btn')
    btn.disabled = true
    btn.textContent = 'Đang xử lý...'

    try {
      const layoutPayload = layouts.map((copy, ci) => ({
        copyIndex: ci,
        photoArrangement: copy.map(p => p?._id || null),
      }))
      const outputData = await API.saveOutput(state.session.id, layoutPayload)
      setState('session.layouts', layouts)
      setState('session.outputs', outputData.data || [])
      navigate('thankyou')
    } catch (err) {
      btn.disabled = false
      btn.textContent = 'Hoàn tất →'
      console.error(err)
    }
  }

  renderAll()
}

export const arrangeStyles = `
  .arrange-layout {
    height: 100%;
    display: grid;
    grid-template-columns: 320px 1fr;
  }

  /* Pool */
  .arrange-pool-wrap {
    display: flex; flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-2);
    padding: 40px 20px;
    gap: 16px;
  }
  .arrange-pool {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    align-content: start;
  }
  .pool-photo {
    position: relative;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1.5px solid var(--border);
    cursor: grab;
    transition: var(--transition);
    background: var(--surface);
  }
  .pool-photo:hover { border-color: var(--accent); transform: scale(1.02); }
  .pool-photo.dragging { opacity: 0.4; cursor: grabbing; }
  .pool-photo img { width: 100%; display: block; aspect-ratio: 4/3; object-fit: cover; }
  .pool-photo-num {
    position: absolute; top: 4px; right: 4px;
    padding: 1px 6px;
    background: rgba(0,0,0,0.7);
    color: var(--text-muted);
    border-radius: 8px;
    font-size: 0.65rem;
  }

  /* Frames */
  .arrange-frames-wrap {
    display: flex; flex-direction: column;
    padding: 40px 40px;
    gap: 24px;
  }
  .arrange-frames-header {
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .arrange-copies {
    flex: 1;
    display: flex; flex-direction: column; gap: 28px;
    padding-right: 8px;
  }
  .arrange-copy {}
  .arrange-slots {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .arrange-slot {
    position: relative;
    aspect-ratio: 3/4;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 2px dashed var(--border);
    background: var(--surface);
    transition: var(--transition);
    cursor: pointer;
  }
  .arrange-slot.drag-over {
    border-color: var(--accent);
    background: var(--accent-glow);
    transform: scale(1.03);
  }
  .arrange-slot img {
    width: 100%; height: 100%;
    object-fit: cover; display: block;
  }
  .slot-empty-label {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 8px; color: var(--border-hover);
    font-size: 0.75rem;
  }
  .slot-remove {
    position: absolute; top: 6px; right: 6px;
    width: 24px; height: 24px;
    background: rgba(0,0,0,0.7);
    color: white;
    border: none; border-radius: 50%;
    cursor: pointer;
    font-size: 0.7rem;
    display: flex; align-items: center; justify-content: center;
    transition: var(--transition);
    z-index: 2;
  }
  .slot-remove:hover { background: var(--danger); }
`
