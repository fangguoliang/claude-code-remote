# Multi-Session Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all active terminal sessions after page refresh or re-login, instead of just one.

**Architecture:** Add three new functions to the Pinia store to retrieve all restorable tabs, then modify the restoration function in TerminalView.vue to iterate through all tabs instead of returning just one.

**Tech Stack:** Vue 3, Pinia, TypeScript, sessionStorage, localStorage

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `packages/web/src/stores/terminal.ts` | Modify | Add 3 new functions and export them |
| `packages/web/src/views/TerminalView.vue` | Modify | Replace single-tab restoration with multi-tab loop |

---

### Task 1: Add new functions to terminal.ts

**Files:**
- Modify: `packages/web/src/stores/terminal.ts:352-364` (after `getLastHistoryTab`)

- [ ] **Step 1: Add three new functions**

Insert after line 364 (after `getLastHistoryTab` function):

```typescript
  // Get all session tabs for multi-session restoration (page refresh)
  function getAllSessionTabs(): Tab[] {
    const session = loadSessionData();
    return session?.tabs || [];
  }

  // Get all history tabs for multi-session restoration (login)
  function getAllHistoryTabsForRestore(): Tab[] {
    return historyTabs.value;
  }

  // Get the stored active tab ID (for preserving active tab after restoration)
  function getStoredActiveTabId(): string | null {
    const session = loadSessionData();
    return session?.activeTabId || null;
  }
```

- [ ] **Step 2: Add exports to return statement**

Modify the return statement (lines 437-468) to include the new functions. Add after `getLastHistoryTab`:

```typescript
    getLastActiveTab,
    getLastHistoryTab,
    getAllSessionTabs,
    getAllHistoryTabsForRestore,
    getStoredActiveTabId,
    clearCurrentSession,
```

- [ ] **Step 3: Run TypeScript type check**

Run: `cd packages/web && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/stores/terminal.ts
git commit -m "feat(store): add multi-session restoration functions

- getAllSessionTabs: returns all tabs from sessionStorage
- getAllHistoryTabsForRestore: returns all history tabs
- getStoredActiveTabId: returns the stored active tab ID

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Modify restoreLastSession() in TerminalView.vue

**Files:**
- Modify: `packages/web/src/views/TerminalView.vue:225-248`

- [ ] **Step 1: Replace restoreLastSession function**

Replace the entire `restoreLastSession` function (lines 225-248) with:

```typescript
// Restore all sessions from storage
// Priority: 1) sessionStorage (page refresh), 2) localStorage history (login)
function restoreLastSession() {
  // Priority: 1) sessionStorage (page refresh), 2) localStorage history (login)
  let tabsToRestore = terminalStore.getAllSessionTabs();
  let activeIdToRestore: string | null = null;

  if (tabsToRestore.length === 0) {
    tabsToRestore = terminalStore.getAllHistoryTabsForRestore();
  } else {
    // Get the active tab ID from sessionStorage (only for page refresh scenario)
    activeIdToRestore = terminalStore.getStoredActiveTabId();
  }

  if (tabsToRestore.length === 0) return;

  // Restore all tabs
  for (const tab of tabsToRestore) {
    terminalStore.restoreTab(tab);
  }

  // Restore correct active tab (the last restoreTab() sets it to that tab)
  if (activeIdToRestore && tabsToRestore.some(t => t.id === activeIdToRestore)) {
    terminalStore.setActiveTab(activeIdToRestore);
  }

  console.log('Restored', tabsToRestore.length, 'sessions');
}
```

- [ ] **Step 2: Run TypeScript type check**

Run: `cd packages/web && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/views/TerminalView.vue
git commit -m "feat(view): restore all terminal sessions on refresh/login

- Replace single-tab restoration with multi-tab loop
- Preserve active tab after restoration
- Remove agent online check (tabs show disconnected state)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Manual Testing

**Files:**
- None (manual browser testing)

- [ ] **Step 1: Test page refresh with multiple sessions**

1. Start the development server: `cd packages/web && pnpm dev`
2. Open browser to `http://localhost:5173`
3. Login and create 2+ terminal sessions
4. Refresh the page
5. **Expected:** All sessions are restored, correct tab is active

- [ ] **Step 2: Test login with history**

1. Clear sessionStorage (DevTools > Application > Session Storage > Clear)
2. Refresh the page (should redirect to login)
3. Login again
4. **Expected:** All history sessions are restored

- [ ] **Step 3: Test offline agent handling**

1. Stop the agent service
2. Refresh the page
3. **Expected:** Tabs are created but show "disconnected" state

- [ ] **Step 4: Final commit (if needed)**

If any fixes were needed during testing:

```bash
git add -A
git commit -m "fix: address issues found during testing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Notes

- The existing `restoreTab()` function already handles duplicate detection by `sessionId`
- TerminalTab.vue already shows "disconnected" state for offline agents
- MAX_HISTORY (10 tabs) provides a reasonable limit for login restoration