import { state } from "./state.js";

const detailRequests = {
  roles: new Map(),
  scripts: new Map(),
  terms: new Map(),
};

let bootstrapRequest = null;
let fullCatalogRequest = null;

function replaceById(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    items.push(nextItem);
    return nextItem;
  }

  items[index] = {
    ...items[index],
    ...nextItem,
  };
  return items[index];
}

async function fetchJson(pathname, { notFoundNull = false } = {}) {
  const response = await fetch(pathname);
  if (notFoundNull && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }

  return response.json();
}

function applyCatalogData(data, { full = false } = {}) {
  state.rules = data.rules || [];
  state.scripts = data.scripts || [];
  state.roles = data.roles || [];
  state.terms = data.terms || [];
  state.catalog.bootstrapLoaded = true;
  state.catalog.fullLoaded = Boolean(full);
}

export async function loadBootstrapCatalog() {
  if (state.catalog.bootstrapLoaded) {
    return;
  }

  if (!bootstrapRequest) {
    bootstrapRequest = fetchJson("/api/bootstrap")
      .then((data) => {
        if (!state.catalog.fullLoaded) {
          applyCatalogData(data);
        }
      })
      .catch((error) => {
        bootstrapRequest = null;
        throw error;
      });
  }

  return bootstrapRequest;
}

export async function ensureFullCatalog() {
  if (state.catalog.fullLoaded) {
    return;
  }

  if (!fullCatalogRequest) {
    fullCatalogRequest = fetchJson("/api/encyclopedia")
      .then((data) => {
        applyCatalogData(data, { full: true });
        detailRequests.roles.clear();
        detailRequests.scripts.clear();
        detailRequests.terms.clear();
      })
      .catch((error) => {
        fullCatalogRequest = null;
        throw error;
      });
  }

  return fullCatalogRequest;
}

function getCollection(kind) {
  if (kind === "roles") {
    return state.roles;
  }

  if (kind === "scripts") {
    return state.scripts;
  }

  return state.terms;
}

function hasFullDetail(kind, item) {
  if (!item) {
    return false;
  }

  if (kind === "roles") {
    return Boolean(item.detail && item.abilityData);
  }

  if (kind === "scripts") {
    return Boolean(item.detail);
  }

  return Boolean(item.detail);
}

export async function ensureCatalogDetail(kind, id) {
  await loadBootstrapCatalog();

  const collection = getCollection(kind);
  const existing = collection.find((item) => item.id === id);
  if (hasFullDetail(kind, existing)) {
    return existing;
  }

  const requests = detailRequests[kind];
  if (!requests.has(id)) {
    requests.set(
      id,
      fetchJson(`/api/${kind}/${encodeURIComponent(id)}`, { notFoundNull: true }).then((item) =>
        item ? replaceById(collection, item) : null,
      ),
    );
  }

  return requests.get(id);
}
