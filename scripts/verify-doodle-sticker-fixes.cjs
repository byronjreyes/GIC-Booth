const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing Doodle & Sticker Fixes...');

const appContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
const stylesContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8');

// 1. Verify draggable={false} on result-strip
assert(appContent.includes('draggable={false}'), 'Result strip must have draggable={false}');
assert(stylesContent.includes('-webkit-user-drag: none'), 'CSS must disable -webkit-user-drag on result-strip');
assert(stylesContent.includes('pointer-events: none'), 'CSS must have pointer-events: none on result-strip');
assert(!stylesContent.includes('container-type: inline-size'), 'preview-canvas-wrapper must NOT have container-type: inline-size as it collapses intrinsic width');

// 2. Verify clean preview and draggable stickers overlay
assert(appContent.includes('cleanPreview'), 'App.tsx must use cleanPreview to avoid ghost stickers during drag');
assert(appContent.includes('stickers-overlay'), 'App.tsx must render stickers-overlay');
assert(appContent.includes('draggable-sticker'), 'App.tsx must render draggable-sticker elements');
assert(stylesContent.includes('.draggable-sticker'), 'styles.css must have .draggable-sticker rule');
assert(stylesContent.includes('.sticker-delete-badge'), 'styles.css must have .sticker-delete-badge rule');

// 3. Verify debounce on video generation
assert(appContent.includes('videoDebounceTimer'), 'App.tsx must have videoDebounceTimer ref');
assert(appContent.includes('debounceVideoMs'), 'composeResult must support debounceVideoMs');
assert(!appContent.includes('setShareProgress(0)'), 'composeResult must NOT blindly reset share progress to 0% on every call');

// 4. Verify pointer handlers for dragging, rotating, and resizing
assert(appContent.includes('handleStickerPointerDown'), 'handleStickerPointerDown must be implemented');
assert(appContent.includes('handleStickerPointerMove'), 'handleStickerPointerMove must be implemented');
assert(appContent.includes('handleStickerPointerUp'), 'handleStickerPointerUp must be implemented');
assert(appContent.includes('handleRotatePointerDown'), 'handleRotatePointerDown must be implemented');
assert(appContent.includes('handleRotatePointerMove'), 'handleRotatePointerMove must be implemented');
assert(appContent.includes('handleResizePointerDown'), 'handleResizePointerDown must be implemented');
assert(appContent.includes('handleResizePointerMove'), 'handleResizePointerMove must be implemented');
assert(stylesContent.includes('.sticker-rotate-handle'), 'styles.css must have .sticker-rotate-handle rule');
assert(stylesContent.includes('.sticker-resize-badge'), 'styles.css must have .sticker-resize-badge rule');

const compContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'compositor.ts'), 'utf8');
// 5. Verify active state retention and handle spacing
assert(appContent.includes('setSelectedStickerId(sticker.id)'), 'Clicking sticker must activate it');
assert(stylesContent.includes('min-width: 52px'), 'Active sticker must have min-width to avoid handle overlapping');
assert(stylesContent.includes('top: -12px') && stylesContent.includes('left: -12px'), 'Delete badge must be placed at top-left to separate from rotate handle');

console.log('✓ All doodle, sticker drag, rotate, resize, and active state fixes verified successfully!');
