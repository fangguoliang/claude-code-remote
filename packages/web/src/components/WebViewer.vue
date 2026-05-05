<template>
  <!-- Fullscreen viewer -->
  <div
    v-if="webViewerStore.state === 'fullscreen'"
    class="web-viewer fullscreen"
    :class="{ landscape: webViewerStore.isLandscape }"
  >
    <!-- Portrait layout: header top, controls bottom -->
    <template v-if="!webViewerStore.isLandscape">
      <div class="viewer-header">
        <button class="btn-minimize" @click="minimize">—</button>
        <span class="viewer-title">{{ displayUrl }}</span>
        <button class="btn-close" @click="close">×</button>
      </div>
      <div class="viewer-content">
        <iframe
          ref="iframeRef"
          :src="webViewerStore.proxyUrl ?? undefined"
          :style="iframeStyle"
          frameborder="0"
          scrolling="yes"
          allowfullscreen
        ></iframe>
      </div>
      <div class="viewer-controls">
        <button
          :class="{ active: webViewerStore.viewport === 'mobile' }"
          @click="setViewport('mobile')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="1" ry="1"/><path d="M12 18h.01"/></svg>
          手机</button>
        <button
          :class="{ active: webViewerStore.viewport === 'tablet' }"
          @click="setViewport('tablet')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="1" ry="1"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/><path d="M16 18h.01"/></svg>
          平板</button>
        <button
          :class="{ active: webViewerStore.viewport === 'desktop' }"
          @click="setViewport('desktop')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="5" rx="1"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
          桌面</button>
      </div>
    </template>

    <!-- Landscape layout: controls on right side -->
    <template v-else>
      <div class="viewer-content landscape-content">
        <iframe
          ref="iframeRef"
          :src="webViewerStore.proxyUrl ?? undefined"
          :style="iframeStyle"
          frameborder="0"
          scrolling="yes"
          allowfullscreen
        ></iframe>
      </div>
      <div class="viewer-controls landscape-controls">
        <button class="btn-minimize" @click="minimize">—</button>
        <button
          :class="{ active: webViewerStore.viewport === 'mobile' }"
          @click="setViewport('mobile')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="1" ry="1"/><path d="M12 18h.01"/></svg>
        </button>
        <button
          :class="{ active: webViewerStore.viewport === 'tablet' }"
          @click="setViewport('tablet')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="1" ry="1"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/><path d="M16 18h.01"/></svg>
        </button>
        <button
          :class="{ active: webViewerStore.viewport === 'desktop' }"
          @click="setViewport('desktop')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="5" rx="1"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
        </button>
        <button class="btn-close" @click="close">×</button>
      </div>
    </template>
  </div>

  <!-- Minimized floating bar -->
  <div
    v-if="webViewerStore.state === 'minimized'"
    class="web-viewer minimized-bar"
  >
    <span class="minimized-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      {{ displayUrl }}
    </span>
    <button class="btn-restore" @click="restore">恢复</button>
    <button class="btn-close-minimized" @click="close">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useWebViewerStore, type ViewportType } from '../stores/webViewer';

const webViewerStore = useWebViewerStore();
const iframeRef = ref<HTMLIFrameElement | null>(null);

// Display URL (truncate if too long)
const displayUrl = computed(() => {
  const url = webViewerStore.url || '';
  return url.length > 30 ? url.substring(0, 30) + '...' : url;
});

// iframe style for scaling in landscape mode
const iframeStyle = computed(() => {
  // Desktop viewport: show actual size with scrollbars
  if (webViewerStore.viewport === 'desktop') {
    const viewport = webViewerStore.currentViewportSize;
    return {
      width: `${viewport.width}px`,
      height: `${viewport.height}px`,
      minWidth: '100%',
      minHeight: '100%',
    };
  }

  if (!webViewerStore.isLandscape) {
    // Portrait (mobile): actual size display (fit to container)
    return {
      width: '100%',
      height: '100%',
    };
  }

  // Tablet landscape: scaled to fit screen
  const viewport = webViewerStore.currentViewportSize;
  const controlBarWidth = 48;
  const screenWidth = window.innerWidth - controlBarWidth;
  const screenHeight = window.innerHeight;

  // Calculate scale ratio
  const scaleX = screenWidth / viewport.width;
  const scaleY = screenHeight / viewport.height;
  const scale = Math.min(scaleX, scaleY);

  return {
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  };
});

// Viewport switching with fullscreen control
async function setViewport(viewport: ViewportType) {
  webViewerStore.setViewport(viewport);

  if (webViewerStore.VIEWPORTS[viewport].orientation === 'landscape') {
    await enterFullscreenLandscape();
  } else {
    await exitFullscreen();
  }
}

// Enter landscape fullscreen mode
async function enterFullscreenLandscape() {
  try {
    await document.documentElement.requestFullscreen();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orientation = screen.orientation as any;
    if (orientation?.lock) {
      await orientation.lock('landscape');
    }
  } catch {
    // Browser doesn't support, ignore
  }
}

// Exit fullscreen mode
async function exitFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orientation = screen.orientation as any;
  if (orientation?.unlock) {
    orientation.unlock();
  }
}

// Minimize (preserve iframe)
function minimize() {
  webViewerStore.setMinimized();
  exitFullscreen();
}

// Restore from minimized state
async function restore() {
  webViewerStore.setVisible(true);
  if (webViewerStore.isLandscape) {
    await enterFullscreenLandscape();
  }
}

// Close (release resources)
async function close() {
  await exitFullscreen();
  webViewerStore.clear();
}

// Watch for fullscreen changes
watch(() => webViewerStore.state, (newState, oldState) => {
  if (newState === 'fullscreen' && oldState !== 'minimized') {
    // Just opened - enter fullscreen if landscape
    if (webViewerStore.isLandscape) {
      enterFullscreenLandscape();
    }
  }
});
</script>

<style scoped>
.web-viewer {
  position: fixed;
  background: transparent;
  z-index: 1000;
}

/* Fullscreen mode */
.web-viewer.fullscreen {
  inset: 0;
  display: flex;
  background: var(--bg-page);
}

.web-viewer.fullscreen:not(.landscape) {
  flex-direction: column;
}

.web-viewer.fullscreen.landscape {
  flex-direction: row;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background: rgba(22, 33, 62, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text-primary);
  height: 48px;
  border-bottom: 1px solid var(--border-subtle);
}

.viewer-title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background: #fff;
}

.landscape-content {
  flex: 1;
  overflow: auto;
  background: #fff;
  align-items: flex-start;
  justify-content: flex-start;
}

.viewer-content iframe {
  border: none;
  display: block;
  width: 100%;
  height: 100%;
  color-scheme: light dark;
}

.viewer-controls {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2);
  background: rgba(22, 33, 62, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-subtle);
}

.viewer-controls:not(.landscape-controls) {
  justify-content: center;
  height: 56px;
}

.landscape-controls {
  flex-direction: column;
  width: 48px;
  padding: var(--space-3) var(--space-2);
  align-items: center;
  gap: var(--space-3);
  border-top: none;
  border-left: 1px solid var(--border-subtle);
}

.viewer-controls button {
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.landscape-controls button {
  padding: var(--space-2);
  width: 36px;
  height: 36px;
}

.viewer-controls button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.viewer-controls button:hover:not(.active) {
  background: var(--bg-surface-hover);
}

.btn-close, .btn-minimize {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 20px;
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.btn-close:hover, .btn-minimize:hover {
  background: var(--accent-subtle);
  color: var(--accent);
}

.landscape-controls .btn-close {
  margin-top: auto;
}

.landscape-controls .btn-minimize {
  margin-bottom: var(--space-2);
}

/* Minimized bar */
.minimized-bar {
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background: rgba(22, 33, 62, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-default);
  color: var(--text-primary);
}

.minimized-title {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-restore {
  background: var(--accent);
  border: none;
  color: var(--text-on-accent);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
  transition: background var(--transition-fast);
  min-height: 44px;
}

.btn-restore:hover {
  background: var(--accent-hover);
}

.btn-close-minimized {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.btn-close-minimized:hover {
  color: var(--error);
  background: var(--accent-subtle);
}
</style>