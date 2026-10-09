const assert = require('assert')

console.log('Verifying Minimal Spacing and Landscape Strip Layouts...')

const WIDTH = 600
const HEIGHT = 1800

function getStripDimensions(layout) {
  if (layout.orientation === 'landscape' || layout.id.startsWith('landscape')) {
    return { width: 1800, height: 600 }
  }
  return { width: 600, height: 1800 }
}

function getPhotoRegions(layout) {
  if (layout.id === 'tight-4') {
    const tightSide = 26
    const tightGap = 8
    const tightTop = 94
    const photoWidth = WIDTH - tightSide * 2 // 548
    const photoHeight = 362
    return Array.from({ length: 4 }, (_, index) => ({
      x: tightSide,
      y: tightTop + index * (photoHeight + tightGap),
      width: photoWidth,
      height: photoHeight,
    }))
  }

  if (layout.id === 'tight-3') {
    const tightSide = 26
    const tightGap = 8
    const tightTop = 96
    const photoWidth = WIDTH - tightSide * 2 // 548
    const photoHeight = 418
    return Array.from({ length: 3 }, (_, index) => ({
      x: tightSide,
      y: tightTop + index * (photoHeight + tightGap),
      width: photoWidth,
      height: photoHeight,
    }))
  }

  if (layout.id === 'landscape-3') {
    const leftMargin = 36
    const gap = 8
    const photoWidth = 450
    const photoHeight = 400
    const photoY = 100
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
    const photoWidth = 336
    const photoHeight = 400
    const photoY = 100
    return Array.from({ length: 4 }, (_, index) => ({
      x: leftMargin + index * (photoWidth + gap),
      y: photoY,
      width: photoWidth,
      height: photoHeight,
    }))
  }

  return []
}

// 1. Test dimensions
assert.deepStrictEqual(getStripDimensions({ id: 'tight-4', requiredPhotos: 4 }), { width: 600, height: 1800 })
assert.deepStrictEqual(getStripDimensions({ id: 'tight-3', requiredPhotos: 3 }), { width: 600, height: 1800 })
assert.deepStrictEqual(getStripDimensions({ id: 'landscape-3', requiredPhotos: 3, orientation: 'landscape' }), { width: 1800, height: 600 })
assert.deepStrictEqual(getStripDimensions({ id: 'landscape-4', requiredPhotos: 4, orientation: 'landscape' }), { width: 1800, height: 600 })
console.log('✓ Strip dimensions verified')

// 2. Test tight-4 layout
const tight4 = getPhotoRegions({ id: 'tight-4', requiredPhotos: 4 })
assert.strictEqual(tight4.length, 4)
assert.strictEqual(tight4[0].width, 548)
assert.strictEqual(tight4[0].height, 362)
assert.strictEqual(tight4[1].y - (tight4[0].y + tight4[0].height), 8, 'tight-4 gap must be exactly 8px')
assert.ok(tight4[3].y + tight4[3].height < 1800 - 200, 'tight-4 must leave >= 200px bottom room for branding & QR')
console.log('✓ Tight-4 layout verified (8px hairline gaps, 548x362 photos, ample footer)')

// 3. Test tight-3 layout
const tight3 = getPhotoRegions({ id: 'tight-3', requiredPhotos: 3 })
assert.strictEqual(tight3.length, 3)
assert.strictEqual(tight3[0].width, 548)
assert.strictEqual(tight3[0].height, 418)
assert.strictEqual(tight3[1].y - (tight3[0].y + tight3[0].height), 8, 'tight-3 gap must be exactly 8px')
assert.ok(tight3[2].y + tight3[2].height < 1800 - 350, 'tight-3 must leave bottom room')
console.log('✓ Tight-3 layout verified (8px hairline gaps, 548x418 photos)')

// 4. Test landscape-3 layout
const land3 = getPhotoRegions({ id: 'landscape-3', requiredPhotos: 3, orientation: 'landscape' })
assert.strictEqual(land3.length, 3)
assert.strictEqual(land3[0].width, 450)
assert.strictEqual(land3[0].height, 400)
assert.strictEqual(land3[1].x - (land3[0].x + land3[0].width), 8, 'landscape-3 gap must be exactly 8px')
assert.ok(land3[2].x + land3[2].width < 1800 - 350, 'landscape-3 must leave >= 350px right room for branding & QR')
console.log('✓ Landscape-3 layout verified (horizontal 6x2 in, 450x400 photos, right branding area)')

// 5. Test landscape-4 layout
const land4 = getPhotoRegions({ id: 'landscape-4', requiredPhotos: 4, orientation: 'landscape' })
assert.strictEqual(land4.length, 4)
assert.strictEqual(land4[0].width, 336)
assert.strictEqual(land4[0].height, 400)
assert.strictEqual(land4[1].x - (land4[0].x + land4[0].width), 8, 'landscape-4 gap must be exactly 8px')
assert.ok(land4[3].x + land4[3].width < 1800 - 350, 'landscape-4 must leave >= 350px right room for branding & QR')
console.log('✓ Landscape-4 layout verified (horizontal 6x2 in, 336x400 photos, right branding area)')

console.log('All minimal-gap and landscape layout tests passed successfully!')
