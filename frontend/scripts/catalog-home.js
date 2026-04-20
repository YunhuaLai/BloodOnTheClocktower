function getRoleTypeSummary() {
  return Object.entries(typeLabels)
    .map(([type, label]) => {
      const count = state.roles.filter((role) => role.type === type).length;
      return count ? `${label} ${count}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function renderHomeDirectory() {
  const cards = [
    {
      eyebrow: "角色百科",
      title: "角色目录",
      href: "/roles",
      count: state.roles.length,
      countLabel: "个角色",
      text: "按身份筛选，或直接搜索能力、板子和关键词。",
      action: "查角色",
    },
    {
      eyebrow: "剧本 / 板子",
      title: "板子目录",
      href: "/scripts",
      count: state.scripts.length,
      countLabel: "个板子",
      text: "先看每个板子的节奏、适合人群和常见坑。",
      action: "看板子",
    },
    {
      eyebrow: "关键词 / 术语",
      title: "术语目录",
      href: "/terms",
      count: state.terms.length,
      countLabel: "个术语",
      text: "把中毒、醉酒、疯狂等容易混淆的词先对齐。",
      action: "查术语",
    },
    {
      eyebrow: "局内记录",
      title: "记录局",
      href: "/notes",
      count: getNotesGameCount(),
      countLabel: "个本地记录",
      text: "把座位、声明、标签和每天得到的信息按局保存下来。",
      action: "开始记录",
    },
  ];

  return cards
    .map(
      (card) => `
        <a class="directory-card" href="${card.href}" data-link>
          <p class="eyebrow">${escapeHtml(card.eyebrow)}</p>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.text)}</p>
          <div class="directory-meta">
            <strong>${card.count}</strong>
            <span>${escapeHtml(card.countLabel)}</span>
          </div>
          <span class="card-action">${escapeHtml(card.action)}</span>
        </a>
      `,
    )
    .join("");
}

function renderHome() {
  document.title = "血染钟楼百科";
  app.innerHTML = `
    <section class="workspace" id="overview">
      <div class="intro-panel">
        <p class="eyebrow">社交推理 · 说书人 · 阵营博弈</p>
        <h1>查规则、看板子、找角色，一局开始前够用了。</h1>
        <p class="lead">
          开局前先定位问题：查角色能力、挑今晚的板子，或把容易混淆的术语对齐。
        </p>
        <div class="home-actions" aria-label="常用入口">
          <a class="primary-link" href="/roles" data-link>直接查角色</a>
          <a class="secondary-link" href="/scripts" data-link>看板子目录</a>
          <a class="secondary-link" href="/notes" data-link>记录这一局</a>
        </div>
        <div class="quick-stats" aria-label="资料概览">
          <div>
            <strong>${state.scripts.length}</strong>
            <span>个板子</span>
          </div>
          <div>
            <strong>${state.roles.length}</strong>
            <span>个角色</span>
          </div>
          <div>
            <strong>${state.terms.length}</strong>
            <span>个术语</span>
          </div>
          <div>
            <strong>${Object.keys(typeLabels).length}</strong>
            <span>类阵营/身份</span>
          </div>
        </div>
      </div>

      <div class="image-strip" aria-label="氛围图">
        <img
          src="/assets/clock-tower-night.jpg"
          alt="夜色中的钟楼"
          width="1200"
          height="1600"
          decoding="async"
          fetchpriority="high"
        />
        <img
          src="/assets/medieval-town-night.jpg"
          alt="夜晚的中世纪街巷"
          width="1280"
          height="887"
          loading="lazy"
          decoding="async"
        />
        <img
          src="/assets/candle-book.jpg"
          alt="烛光下的旧书"
          width="1280"
          height="853"
          loading="lazy"
          decoding="async"
        />
      </div>
    </section>

    <section class="section directory-section" aria-labelledby="directoryTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">从哪开始</p>
          <h2 id="directoryTitle">先选一个方向</h2>
        </div>
        <p class="section-note">遇到角色、板子、术语，直接进对应目录。</p>
      </div>
      <div class="directory-grid">
        ${renderHomeDirectory()}
      </div>
    </section>

    <section class="section rules-section" aria-labelledby="rulesTitle">
      <div class="section-heading">
        <div>
          <p class="eyebrow">先懂这几个词</p>
          <h2 id="rulesTitle">游戏速览</h2>
        </div>
        <p class="section-note">点开当下需要的规则点，先把开局会用到的概念看明白。</p>
      </div>
      <div class="rule-grid" id="ruleGrid"></div>
    </section>
  `;

  renderRules();
  scrollToHash();
}
