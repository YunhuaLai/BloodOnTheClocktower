function scrollToHash() {
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

function renderRoute() {
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
  const button = event.target.closest("[data-notes-action]");
  if (!button) {
    return;
  }

  event.preventDefault();
  handleNotesAction(button);
});

document.addEventListener("input", (event) => {
  if (event.target.id === "searchInput") {
    renderRoles();
    return;
  }

  if (event.target.closest(".notes-setup, .notes-shell")) {
    handleNotesFieldChange(event.target);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.closest(".notes-setup, .notes-shell")) {
    handleNotesFieldChange(event.target, true);
  }
});

window.addEventListener("popstate", renderRoute);

loadEncyclopedia();
