const page = document.body.dataset.page;

if (page === "support") {
  initializeSupport();
} else if (page === "release-notes") {
  initializeReleaseNotes();
} else if (page === "known-issues") {
  initializeKnownIssues();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function initializeSupport() {
  const status = document.querySelector("#support-status");
  try {
    const config = await fetchJson("./app-config.json");
    if (config.supportUrl) {
      const link = document.createElement("a");
      link.href = config.supportUrl;
      link.textContent = config.supportUrl;
      status.replaceChildren("Support: ", link);
    } else if (config.supportEmail) {
      const address = String(config.supportEmail);
      const link = document.createElement("a");
      link.href = `mailto:${address}`;
      link.textContent = address;
      status.replaceChildren("Support: ", link);
    } else {
      status.textContent =
        "The creator has not configured a public support contact yet. During controlled beta testing, use the invitation channel supplied by the creator.";
    }
  } catch {
    status.textContent =
      "The support configuration could not be loaded. Use the invitation channel supplied by the creator.";
  }
}

async function initializeReleaseNotes() {
  const container = document.querySelector("#release-list");
  try {
    const payload = await fetchJson("./release-notes.json");
    container.replaceChildren();

    for (const release of payload.releases ?? []) {
      const section = document.createElement("section");
      section.className = "release";

      const title = document.createElement("strong");
      title.textContent =
        `v${release.version} · ${release.channel}`;

      const date = document.createElement("small");
      date.textContent = release.date;

      const list = document.createElement("ul");
      for (const change of release.changes ?? []) {
        const item = document.createElement("li");
        item.textContent = change;
        list.append(item);
      }

      section.append(title, date, list);
      container.append(section);
    }
  } catch {
    container.textContent = "Release notes could not be loaded.";
  }
}

async function initializeKnownIssues() {
  const container = document.querySelector("#issue-list");
  try {
    const payload = await fetchJson("./known-issues.json");
    container.replaceChildren();

    for (const issue of payload.issues ?? []) {
      const article = document.createElement("article");
      article.className = "issue";

      const title = document.createElement("strong");
      title.textContent = `${issue.id}: ${issue.title}`;

      const meta = document.createElement("p");
      meta.textContent =
        `Severity: ${issue.severity} · Status: ${issue.status}`;

      const workaround = document.createElement("p");
      workaround.textContent = issue.workaround;

      article.append(title, meta, workaround);
      container.append(article);
    }
  } catch {
    container.textContent = "Known issues could not be loaded.";
  }
}
