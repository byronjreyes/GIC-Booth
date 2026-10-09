const assert = require('assert')

// Replicate compositor constants & functions in Node.js
const WIDTH = 600
const HEIGHT = 1800
const SIDE = 42
const TOP = 132
const BOTTOM = 170
const GAP = 22

function getTextFlags(text) {
  if (!text) {
    return { hasTitle: true, hasFooter: true }
  }
  const hasTitle = text.showTitle !== false && Boolean(text.title?.trim())
  const hasFooter = Boolean(text.showBrand)
  return { hasTitle, hasFooter }
}

function getPhotoRegions(layout, text) {
  const { hasTitle, hasFooter } = getTextFlags(text)

  if (layout.id === 'grid-4') {
    const effectiveTop = hasTitle ? TOP : SIDE
    const effectiveBottom = hasFooter ? BOTTOM : SIDE
    const colW = (WIDTH - SIDE * 2 - GAP) / 2
    const rowH = (HEIGHT - effectiveTop - effectiveBottom - GAP) / 2
    return [
      { x: SIDE, y: effectiveTop, width: colW, height: rowH },
      { x: SIDE + colW + GAP, y: effectiveTop, width: colW, height: rowH },
      { x: SIDE, y: effectiveTop + rowH + GAP, width: colW, height: rowH },
      { x: SIDE + colW + GAP, y: effectiveTop + rowH + GAP, width: colW, height: rowH },
    ]
  }

  if (layout.id === 'clean-4' || layout.id === 'tight-4') {
    const tightSide = layout.id === 'clean-4' ? 32 : 26
    const tightGap = 8
    const photoWidth = WIDTH - tightSide * 2
    const topMargin = hasTitle ? 94 : tightSide
    const bottomMargin = hasFooter ? 234 : tightSide
    const availableHeight = HEIGHT - topMargin - bottomMargin - tightGap * 3
    const photoHeight = Math.floor(availableHeight / 4)
    return Array.from({ length: 4 }, (_, index) => ({
      x: tightSide,
      y: topMargin + index * (photoHeight + tightGap),
      width: photoWidth,
      height: photoHeight,
    }))
  }

  if (layout.id === 'clean-3' || layout.id === 'tight-3') {
    const tightSide = layout.id === 'clean-3' ? 32 : 26
    const tightGap = 8
    const photoWidth = WIDTH - tightSide * 2
    const topMargin = hasTitle ? 96 : tightSide
    const bottomMargin = hasFooter ? 434 : tightSide
    const availableHeight = HEIGHT - topMargin - bottomMargin - tightGap * 2
    const photoHeight = Math.floor(availableHeight / 3)
    return Array.from({ length: 3 }, (_, index) => ({
      x: tightSide,
      y: topMargin + index * (photoHeight + tightGap),
      width: photoWidth,
      height: photoHeight,
    }))
  }

  if (layout.id === 'landscape-3') {
    const leftMargin = 36
    const gap = 8
    const photoY = hasTitle ? 100 : 70
    const photoHeight = hasTitle ? 400 : 460
    const rightMargin = (!hasFooter && !hasTitle) ? leftMargin : 394
    const photoWidth = Math.floor((1800 - leftMargin - rightMargin - gap * 2) / 3)
    return Array.from({ length: 3 }, (_, index) => ({
      x: leftMargin + index * (photoWidth + gap),
      y: photoY,
      width: photoWidth,
      height: photoHeight,
    }))
  }

  if (layout.id === 'landscape-4') {
    const leftMargin = 30
    const gap = 8
    const photoY = hasTitle ? 100 : 70
    const photoHeight = hasTitle ? 400 : 460
    const rightMargin = (!hasFooter && !hasTitle) ? leftMargin : 394
    const photoWidth = Math.floor((1800 - leftMargin - rightMargin - gap * 3) / 4)
    return Array.from({ length: 4 }, (_, index) => ({
      x: leftMargin + index * (photoWidth + gap),
      y: photoY,
      width: photoWidth,
      height: photoHeight,
    }))
  }

  const count = layout.requiredPhotos
  const effectiveTop = hasTitle ? TOP : SIDE
  const effectiveBottom = hasFooter ? BOTTOM : SIDE
  const photoHeight = (HEIGHT - effectiveTop - effectiveBottom - GAP * (count - 1)) / count
  return Array.from({ length: count }, (_, index) => ({
    x: SIDE,
    y: effectiveTop + index * (photoHeight + GAP),
    width: WIDTH - SIDE * 2,
    height: photoHeight,
  }))
}

console.log('Verifying Clean Border Layouts and Auto-Adjust Size Behavior...')

// 1. Test getTextFlags
const defaultFlags = getTextFlags()
assert.strictEqual(defaultFlags.hasTitle, true, 'Default hasTitle must be true for backward compat')
assert.strictEqual(defaultFlags.hasFooter, true, 'Default hasFooter must be true for backward compat')

const noTitleFlags = getTextFlags({ showTitle: false, title: 'My Title', showBrand: true })
assert.strictEqual(noTitleFlags.hasTitle, false, 'showTitle: false must disable title')
assert.strictEqual(noTitleFlags.hasFooter, true)

const blankTitleFlags = getTextFlags({ showTitle: true, title: '   ', showBrand: true })
assert.strictEqual(blankTitleFlags.hasTitle, false, 'blank title must disable title')

const noFooterFlags = getTextFlags({ showTitle: true, title: 'My Title', showBrand: false })
assert.strictEqual(noFooterFlags.hasTitle, true)
assert.strictEqual(noFooterFlags.hasFooter, false, 'showBrand: false must disable footer')

console.log('✓ getTextFlags logic verified')

// 2. Test clean-4 (Border 4 Cut) without title and brand
const clean4 = { id: 'clean-4', name: 'Border 4 Cut', requiredPhotos: 4 }
const clean4Regions = getPhotoRegions(clean4, { showTitle: false, showBrand: false })

assert.strictEqual(clean4Regions.length, 4)
assert.strictEqual(clean4Regions[0].x, 32, 'clean-4 left margin must be 32px')
assert.strictEqual(clean4Regions[0].y, 32, 'clean-4 top margin must be 32px')
assert.strictEqual(clean4Regions[0].width, 536, 'clean-4 photo width must be 536px')
assert.strictEqual(clean4Regions[0].height, 428, 'clean-4 photo height must be 428px')

// Verify hairline gaps
const gap01 = clean4Regions[1].y - (clean4Regions[0].y + clean4Regions[0].height)
const gap12 = clean4Regions[2].y - (clean4Regions[1].y + clean4Regions[1].height)
const gap23 = clean4Regions[3].y - (clean4Regions[2].y + clean4Regions[2].height)
assert.strictEqual(gap01, 8, 'gap between photo 0 and 1 must be 8px')
assert.strictEqual(gap12, 8, 'gap between photo 1 and 2 must be 8px')
assert.strictEqual(gap23, 8, 'gap between photo 2 and 3 must be 8px')

// Bottom margin
const bottomSpace = 1800 - (clean4Regions[3].y + clean4Regions[3].height)
assert.strictEqual(bottomSpace, 32, 'clean-4 bottom margin must be exactly 32px matching top margin')
console.log('✓ clean-4 layout matches user mockup (equal 32px borders, 8px gaps, 536x428 photos)')

// 3. Test clean-3 (Border 3 Cut) without title and brand
const clean3 = { id: 'clean-3', name: 'Border 3 Cut', requiredPhotos: 3 }
const clean3Regions = getPhotoRegions(clean3, { showTitle: false, showBrand: false })

assert.strictEqual(clean3Regions.length, 3)
assert.strictEqual(clean3Regions[0].x, 32)
assert.strictEqual(clean3Regions[0].y, 32)
assert.strictEqual(clean3Regions[0].width, 536)
assert.strictEqual(clean3Regions[0].height, 573)
const gap3_01 = clean3Regions[1].y - (clean3Regions[0].y + clean3Regions[0].height)
assert.strictEqual(gap3_01, 8)
console.log('✓ clean-3 layout matches border specifications (32px margins, 8px gaps, 536x573 photos)')

// 4. Test Auto-Adjust Behavior for Classic 4 Cut
const classic4 = { id: 'classic-4', name: 'Classic 4 Cut', requiredPhotos: 4 }
const c4WithAll = getPhotoRegions(classic4, { showTitle: true, title: 'Title', showBrand: true })
const c4NoTitle = getPhotoRegions(classic4, { showTitle: false, showBrand: true })
const c4NoFooter = getPhotoRegions(classic4, { showTitle: true, title: 'Title', showBrand: false })
const c4NoBoth = getPhotoRegions(classic4, { showTitle: false, showBrand: false })

assert(c4NoTitle[0].height > c4WithAll[0].height, 'Removing title must expand photo height')
assert(c4NoFooter[0].height > c4WithAll[0].height, 'Removing footer must expand photo height')
assert(c4NoBoth[0].height > c4NoTitle[0].height, 'Removing both must expand photo height more')
assert.strictEqual(c4WithAll[0].height, 358)
assert.strictEqual(c4NoBoth[0].height, 412.5)
console.log(`✓ Classic-4 auto-adjust: ${c4WithAll[0].height}px -> ${c4NoBoth[0].height}px (+54.5px per photo)`)

// 5. Test Auto-Adjust Behavior for Landscape 3 Cut
const landscape3 = { id: 'landscape-3', name: 'Landscape 3 Cut', requiredPhotos: 3 }
const l3WithAll = getPhotoRegions(landscape3, { showTitle: true, title: 'Title', showBrand: true })
const l3NoBoth = getPhotoRegions(landscape3, { showTitle: false, showBrand: false })

assert(l3NoBoth[0].width > l3WithAll[0].width, 'Removing title & footer must expand photo width')
assert(l3NoBoth[0].height > l3WithAll[0].height, 'Removing title & footer must expand photo height')
assert.strictEqual(l3WithAll[0].width, 451)
assert.strictEqual(l3NoBoth[0].width, 570)
console.log(`✓ Landscape-3 auto-adjust: width ${l3WithAll[0].width}px -> ${l3NoBoth[0].width}px (+119px), height ${l3WithAll[0].height}px -> ${l3NoBoth[0].height}px (+60px)`)

// 6. Test Auto-Adjust Behavior for 2x2 Grid
const grid4 = { id: 'grid-4', name: '2x2 Grid', requiredPhotos: 4 }
const g4WithAll = getPhotoRegions(grid4, { showTitle: true, title: 'Title', showBrand: true })
const g4NoBoth = getPhotoRegions(grid4, { showTitle: false, showBrand: false })

assert(g4NoBoth[0].height > g4WithAll[0].height, 'Removing title & footer must expand grid row height')
assert.strictEqual(g4WithAll[0].height, 738)
assert.strictEqual(g4NoBoth[0].height, 847)
console.log(`✓ 2x2 Grid auto-adjust: row height ${g4WithAll[0].height}px -> ${g4NoBoth[0].height}px (+109px)`)

console.log('\nAll Clean Border Layout and Auto-Adjust size verifications passed successfully!')
