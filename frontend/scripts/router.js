import { renderLoadError, renderNotFound, renderRoleDetail, renderScriptDetail, renderTermDetail } from "./catalog-details.js";
import { renderHome } from "./catalog-home.js";
import { renderRoleIndex, renderRoles, renderScriptIndex, renderTermIndex, syncFilterButtons } from "./catalog-indexes.js";
import { handleNotesAction, handleNotesFieldChange } from "./notes-actions.js";
import { deleteSavedGames, toggleGameFavorite } from "./notes/notes-game-actions.js";
import { ensureNotesState } from "./notes-state.js";
import { renderNotesPage } from "./notes/notes-shell.js";
import { state } from "./state.js";

let savedSwipeState = null;
let suppressSavedSwipeClick = false;

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

export function renderRoute() {
  const previousPath = state.currentPath;
  const segments = window.location.pathname.split("/").filter(Boolean);
  const isNotesRoute = segments.length === 1 && segments[0] === "notes";
  state.currentPath = window.location.pathname;

  document.body.classList.toggle("notes-route", isNotesRoute);

  if (!segments.length) {
    renderHome();
    return;
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  if (segments.length === 1 && segments[0] === "scripts") {
    renderScriptIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "roles") {
    renderRoleIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "terms") {
    renderTermIndex();
    return;
  }

  if (segments.length === 1 && segments[0] === "notes") {
    if (previousPath !== "/notes") {
      const notes = ensureNotesState();
      if (notes.ui.screen !== "setup") {
        notes.ui.screen = "home";
      }
    }
    renderNotesPage();
    return;
  }

  if (segments.length === 2 && segments[0] === "scripts") {
    renderScriptDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "roles") {
    renderRoleDetail(segments[1]);
    return;
  }

  if (segments.length === 2 && segments[0] === "terms") {
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
  renderRoute();
}

async function loadEncyclopedia() {
  try {
    const response = await fetch("/api/encyclopedia");
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    state.rules = data.rules || [];
    state.scripts = data.scripts || [];
    state.roles = data.roles || [];
    state.terms = data.terms || [];
    renderRoute();
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
  syncFilterButtons();
  renderRoles();
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
  if (event.target.id === "searchInput") {
    renderRoles();
    return;
  }

  if (event.target.closest(".notes-setup, .notes-shell, .notes-home")) {
    handleNotesFieldChange(event.target);
  }
});

document.addEventListener("change", (event) => {
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
    deleteSavedGames(notes, [gameId], "删除这个对局记录？这只会清除本机保存。");
  }
});

window.addEventListener("popstate", renderRoute);

export function startApp() {
  loadEncyclopedia();
}
