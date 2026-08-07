import { renderLoadError, renderNotFound, renderRoleDetail, renderScriptDetail, renderTermDetail } from "./catalog-details.js";
import { ensureCatalogDetail, ensureFullCatalog, loadBootstrapCatalog, loadHomeCatalog } from "./catalog-data.js";
import { renderHome } from "./catalog-home.js";
import {
  renderRoleIndex,
  renderRoles,
  renderScriptIndex,
  renderScripts,
  renderTermIndex,
  resetRoleRenderLimit,
  resetScriptRenderLimit,
  showMoreRoles,
  showMoreScripts,
  syncFilterButtons,
} from "./catalog-indexes.js";
import { handleNotesAction, handleNotesFieldChange } from "./notes-actions.js";
import { deleteSavedGames, toggleGameFavorite } from "./notes/notes-game-actions.js";
import { createDefaultSetupDraft, ensureNotesState, flushNotesState } from "./notes-state.js";
import { renderNotesPage } from "./notes/notes-shell.js";
import { app, state } from "./state.js";

let savedSwipeState = null;
let suppressSavedSwipeClick = false;
let roleSearchTimer = null;
let scriptSearchTimer = null;

export function scrollToHash() {
  if (!window.location.hash) {
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  requestAnimationFrame(() => {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView();
    }
  });
}

export async function renderRoute() {
  const previousPath = state.currentPath;
  const segments = window.location.pathname.split("/").filter(Boolean);
  const isNotesRoute = segments.length === 1 && segments[0] === "notes";
  state.currentPath = window.location.pathname;

  document.body.classList.toggle("notes-route", isNotesRoute);

  if (!segments.length) {
    await loadHomeCatalog();
    renderHome();
    return;
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  if (segments.length === 1 && segments[0] === "scripts") {
    await loadBootstrapCatalog();
    renderScriptIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "roles") {
    await loadBootstrapCatalog();
    renderRoleIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "terms") {
    await loadBootstrapCatalog();
    renderTermIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "notes") {
    await ensureFullCatalog();
    const notes = ensureNotesState();
    const shouldCreate = new URLSearchParams(window.location.search).get("create") === "1";

    if (shouldCreate) {
      notes.ui.creatingGame = true;
      notes.ui.screen = "setup";
      notes.ui.setupDraft = createDefaultSetupDraft();
      window.history.replaceState({}, "", "/notes");
    } else if (previousPath !== "/notes") {
      if (notes.ui.screen !== "setup") {
        notes.ui.screen = "home";
      }
    }
    renderNotesPage();
    return;
  }

  if (segments.length === 2 && segments[0] === "scripts") {
    await ensureCatalogDetail("scripts", segments[1]);
    renderScriptDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "roles") {
    await ensureCatalogDetail("roles", segments[1]);
    renderRoleDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "terms") {
    await ensureCatalogDetail("terms", segments[1]);
    renderTermDetail(segments[1]);
    return;
  }

  renderNotFound();
}

function navigateTo(url) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (url !== current) {
    window.history.pushState({}, "", url);
  }
  renderRoute().catch((error) => {
    console.error(error);
    renderLoadError();
  });
}

async function loadInitialCatalog() {
  app.innerHTML = `
    <section class="section" aria-live="polite" aria-busy="true">
      <div class="empty-state">正在加载资料…</div>
    </section>
  `;
  try {
    await renderRoute();
  } catch (error) {
    console.error(error);
    renderLoadError();
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) {
    return;
  }

  const url = new URL(link.href);
  if (url.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  navigateTo(`${url.pathname}${url.search}${url.hash}`);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".filter");
  if (!button) {
    return;
  }

  state.activeFilter = button.dataset.filter;
  resetRoleRenderLimit();
  syncFilterButtons();
  renderRoles();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-catalog-action]");
  if (!button) {
    return;
  }

  event.preventDefault();
  if (button.dataset.catalogAction === "more-scripts") {
    showMoreScripts();
  } else if (button.dataset.catalogAction === "more-roles") {
    showMoreRoles();
  }
});

document.addEventListener("click", (event) => {
  if (suppressSavedSwipeClick && event.target.closest(".notes-saved-item")) {
    suppressSavedSwipeClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const button = event.target.closest("[data-notes-action]");
  if (!button) {
    return;
  }

  if (button.type !== "checkbox") {
    event.preventDefault();
  }
  handleNotesAction(button);
});

document.addEventListener("input", (event) => {
  if (event.target.id === "scriptSearchInput") {
    state.scriptQuery = event.target.value;
    resetScriptRenderLimit();
    window.clearTimeout(scriptSearchTimer);
    scriptSearchTimer = window.setTimeout(renderScripts, 180);
    return;
  }

  if (event.target.id === "searchInput") {
    resetRoleRenderLimit();
    window.clearTimeout(roleSearchTimer);
    roleSearchTimer = window.setTimeout(renderRoles, 180);
    return;
  }

  if (event.target.closest(".notes-setup, .notes-shell, .notes-home")) {
    handleNotesFieldChange(event.target);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "scriptStatusFilter") {
    state.scriptStatusFilter = event.target.value;
    resetScriptRenderLimit();
    renderScripts();
    return;
  }

  if (event.target.id === "scriptLevelFilter") {
    state.scriptLevelFilter = event.target.value;
    resetScriptRenderLimit();
    renderScripts();
    return;
  }

  if (event.target.id === "scriptSort") {
    state.scriptSort = event.target.value;
    resetScriptRenderLimit();
    renderScripts();
    return;
  }

  if (event.target.closest(".notes-setup, .notes-shell, .notes-home")) {
    handleNotesFieldChange(event.target, true);
  }
});

document.addEventListener("pointerdown", (event) => {
  const swipe = event.target.closest("[data-swipe-game-id]");
  if (
    !swipe ||
    event.target.closest(".notes-saved-check, .notes-saved-star, .notes-saved-delete")
  ) {
    return;
  }

  savedSwipeState = {
    swipe,
    gameId: swipe.dataset.swipeGameId,
    startX: event.clientX,
    startY: event.clientY,
    deltaX: 0,
    dragging: false,
    pointerId: event.pointerId,
  };
});

document.addEventListener("pointermove", (event) => {
  if (!savedSwipeState || savedSwipeState.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - savedSwipeState.startX;
  const deltaY = event.clientY - savedSwipeState.startY;
  if (!savedSwipeState.dragging && Math.abs(deltaX) < 12) {
    return;
  }

  if (!savedSwipeState.dragging && Math.abs(deltaY) > Math.abs(deltaX)) {
    savedSwipeState = null;
    return;
  }

  savedSwipeState.dragging = true;
  savedSwipeState.deltaX = Math.max(-120, Math.min(120, deltaX));
  savedSwipeState.swipe.classList.add("is-swiping");
  savedSwipeState.swipe.style.transform = `translateX(${savedSwipeState.deltaX}px)`;
});

document.addEventListener("pointerup", (event) => {
  if (!savedSwipeState || savedSwipeState.pointerId !== event.pointerId) {
    return;
  }

  const { swipe, gameId, deltaX, dragging } = savedSwipeState;
  savedSwipeState = null;
  swipe.classList.remove("is-swiping");
  swipe.style.transform = "";

  if (dragging) {
    suppressSavedSwipeClick = true;
  }

  if (!dragging || Math.abs(deltaX) < 72) {
    return;
  }

  const notes = ensureNotesState();
  if (deltaX > 0) {
    toggleGameFavorite(notes, gameId);
  } else {
    deleteSavedGames(notes, [gameId], "删除这个对局？");
  }
});

window.addEventListener("popstate", () => {
  renderRoute().catch((error) => {
    console.error(error);
    renderLoadError();
  });
});

window.addEventListener("pagehide", flushNotesState);

export function startApp() {
  loadInitialCatalog();
}
