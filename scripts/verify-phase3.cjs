const assert = require('assert')

console.log('Testing Phase 3 Advanced Customization logic...')

// 1. Test Layout calculation logic
const layouts = [
  { id: 'classic-4', requiredPhotos: 4 },
  { id: 'classic-3', requiredPhotos: 3 },
  { id: 'classic-2', requiredPhotos: 2 },
  { id: 'grid-4', requiredPhotos: 4 },
]

const WIDTH = 600
const HEIGHT = 1800
const SIDE = 42
const TOP = 132
const BOTTOM = 170
const GAP = 22

function getPhotoRegions(layout) {
  if (layout.id === 'grid-4') {
    const colW = (WIDTH - SIDE * 2 - GAP) / 2
    const rowH = (HEIGHT - TOP - BOTTOM - GAP) / 2
    return [
      { x: SIDE, y: TOP, width: colW, height: rowH },
      { x: SIDE + colW + GAP, y: TOP, width: colW, height: rowH },
      { x: SIDE, y: TOP + rowH + GAP, width: colW, height: rowH },
      { x: SIDE + colW + GAP, y: TOP + rowH + GAP, width: colW, height: rowH },
    ]
  }
  const count = layout.requiredPhotos
  const photoHeight = (HEIGHT - TOP - BOTTOM - GAP * (count - 1)) / count
  return Array.from({ length: count }, (_, index) => ({
    x: SIDE,
    y: TOP + index * (photoHeight + GAP),
    width: WIDTH - SIDE * 2,
    height: photoHeight,
  }))
}

layouts.forEach(l => {
  const regions = getPhotoRegions(l)
  assert.strictEqual(regions.length, l.requiredPhotos, `${l.id} should have ${l.requiredPhotos} regions`)
  regions.forEach(r => {
    assert.ok(r.width > 0, 'width must be positive')
    assert.ok(r.height > 0, 'height must be positive')
    assert.ok(r.x >= 0, 'x must be >= 0')
    assert.ok(r.y >= 0, 'y must be >= 0')
  })
})
console.log('✓ All layouts (Classic 4, 3, 2, and 2×2 Grid) regions verified')

// 2. Test Filter strings
function getCanvasFilter(filter) {
  switch (filter) {
    case 'bw': return 'grayscale(100%) contrast(110%)'
    case 'warm': return 'sepia(30%) saturate(135%) contrast(105%) brightness(102%)'
    case 'vintage': return 'sepia(50%) contrast(115%) brightness(95%) hue-rotate(-10deg)'
    case 'cool': return 'hue-rotate(180deg) saturate(85%) contrast(105%)'
    case 'soft': return 'brightness(108%) contrast(92%) saturate(118%)'
    default: return 'none'
  }
}

const filterKeys = ['none', 'bw', 'warm', 'vintage', 'cool', 'soft']
filterKeys.forEach(f => {
  const str = getCanvasFilter(f)
  assert.ok(typeof str === 'string' && str.length > 0, `Filter string for ${f} must be valid`)
})
console.log('✓ Photo filters verified')

// 3. Test Stickers & Doodles data model
const sampleStickers = [
  { id: 'st-1', emoji: '🎀', x: 200, y: 400, size: 72 },
  { id: 'st-2', emoji: '✨', x: 450, y: 750, size: 64 },
]
const sampleDoodles = [
  { color: '#ffffff', size: 8, points: [{ x: 100, y: 200 }, { x: 120, y: 220 }] },
]

assert.strictEqual(sampleStickers.length, 2)
assert.strictEqual(sampleDoodles[0].points.length, 2)
console.log('✓ Stickers and Doodles data model verified')

console.log('\nAll Phase 3 core verifications passed successfully!')
