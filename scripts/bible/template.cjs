// Библия Anotee — HTML-шаблон v2 (Native HTML).
// Плейсхолдеры: /*__TASKS__*/[] /*__CHRONICLE__*/[] /*__PROBLEMS__*/[] /*__ROADMAP__*/[] __META_DATE__ __META_COUNT__

function buildHtml(tasksJson, chronicleJson, problemsJson, roadmapJson, metaDate) {
  const html = `<!DOCTYPE html>
<html lang="ru" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101113">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Anotee — Библия проекта</title>
<style>
  :root{
    --bg:#f6f4ef; --panel:#fcfbf8; --text:#1c1d1f; --muted:#6d6f73; --faint:#9a9c9f;
    --line:#e4e1d8; --line2:#d8d4c8;
    --accent:#8a6d2f; --accent-ink:#ffffff; --accent-soft:#f1e9d6;
    --done:#37684a; --done-bg:rgba(55,104,74,.10); --done-ln:rgba(55,104,74,.35);
    --open:#a3541e; --open-bg:rgba(163,84,30,.10); --open-ln:rgba(163,84,30,.38);
    --prog:#6d4fa0; --prog-bg:rgba(109,79,160,.10); --prog-ln:rgba(109,79,160,.35);
    --p0:#a83a20; --p1:#96691d; --p2:#5f6368;
    --code-bg:#efede6; --tbl-zebra:rgba(0,0,0,.018);
  }
  html[data-theme="dark"]{
    --bg:#101113; --panel:#17181b; --text:#e8e6e0; --muted:#9aa0a6; --faint:#666b71;
    --line:rgba(255,255,255,.09); --line2:rgba(255,255,255,.14);
    --accent:#c9a24b; --accent-ink:#14120a; --accent-soft:#242018;
    --done:#8fbf9b; --done-bg:rgba(120,170,130,.10); --done-ln:rgba(143,191,155,.35);
    --open:#e0a173; --open-bg:rgba(224,161,115,.10); --open-ln:rgba(224,161,115,.38);
    --prog:#b39ddb; --prog-bg:rgba(150,120,200,.12); --prog-ln:rgba(179,157,219,.35);
    --p0:#e08a72; --p1:#d9b36d; --p2:#9aa0a6;
    --code-bg:#202226; --tbl-zebra:rgba(255,255,255,.015);
  }
  @media (prefers-color-scheme: dark){
    html[data-theme="auto"]{
      --bg:#101113; --panel:#17181b; --text:#e8e6e0; --muted:#9aa0a6; --faint:#666b71;
      --line:rgba(255,255,255,.09); --line2:rgba(255,255,255,.14);
      --accent:#c9a24b; --accent-ink:#14120a; --accent-soft:#242018;
      --done:#8fbf9b; --done-bg:rgba(120,170,130,.10); --done-ln:rgba(143,191,155,.35);
      --open:#e0a173; --open-bg:rgba(224,161,115,.10); --open-ln:rgba(224,161,115,.38);
      --prog:#b39ddb; --prog-bg:rgba(150,120,200,.12); --prog-ln:rgba(179,157,219,.35);
      --p0:#e08a72; --p1:#d9b36d; --p2:#9aa0a6;
      --code-bg:#202226; --tbl-zebra:rgba(255,255,255,.015);
    }
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    background:var(--bg); color:var(--text);
    font:15px/1.55 system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing:antialiased;
    padding-left:env(safe-area-inset-left); padding-right:env(safe-area-inset-right);
  }
  .mono{font-family:ui-monospace, 'Cascadia Mono', Consolas, 'SF Mono', monospace}
  .wrap{max-width:1220px; margin:0 auto; padding:0 20px}
  a{color:var(--accent); text-decoration:none; border-bottom:1px solid transparent}
  a:hover{border-bottom-color:var(--accent)}

  header.site{border-bottom:1px solid var(--line); background:var(--panel); padding-top:env(safe-area-inset-top)}
  .site-in{display:flex; align-items:baseline; gap:16px; flex-wrap:wrap; padding:18px 0 14px}
  .brand{font-family:Georgia,'PT Serif',serif; font-size:26px; font-weight:600; letter-spacing:.02em}
  .brand .bn{color:var(--accent)}
  .tagline{color:var(--muted); font-size:13px}
  .site-right{margin-left:auto; display:flex; align-items:center; gap:10px; flex-wrap:wrap}
  .meta-line{color:var(--faint); font-size:12px}
  .btn{
    font:600 12px/1 system-ui,sans-serif; letter-spacing:.02em;
    background:transparent; color:var(--text); border:1px solid var(--line2); border-radius:3px;
    padding:7px 10px; cursor:pointer; white-space:nowrap;
  }
  .btn:hover{border-color:var(--accent); color:var(--accent)}
  a.btn{border-bottom:1px solid var(--line2)}

  nav.tabs{border-bottom:1px solid var(--line); background:var(--panel)}
  .tabs-in{display:flex; gap:2px; overflow-x:auto; -webkit-overflow-scrolling:touch}
  .tab{
    appearance:none; background:none; border:none; border-bottom:2px solid transparent;
    font:600 13px/1.2 system-ui,sans-serif; color:var(--muted); padding:12px 14px; cursor:pointer; white-space:nowrap;
  }
  .tab:hover{color:var(--text)}
  .tab.on{color:var(--accent); border-bottom-color:var(--accent)}
  .tab .cnt{font-weight:400; color:var(--faint); margin-left:6px; font-size:11px}

  main{padding:22px 0 60px}
  section.tabsec{display:none}
  section.tabsec.on{display:block}
  h2.sechead{font-family:Georgia,'PT Serif',serif; font-weight:600; font-size:22px; margin:2px 0 4px}
  p.secsub{color:var(--muted); font-size:13px; margin:0 0 16px; max-width:80ch}

  .stats{display:flex; gap:22px; flex-wrap:wrap; margin:14px 0 16px}
  .stat b{display:block; font-family:Georgia,serif; font-size:24px; font-weight:600}
  .stat span{font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint)}
  .stat.s-done b{color:var(--done)} .stat.s-open b{color:var(--open)} .stat.s-prog b{color:var(--prog)}

  .toolbar{
    display:flex; gap:8px; flex-wrap:wrap; align-items:center;
    padding:12px; border:1px solid var(--line); border-radius:4px; background:var(--panel);
    position:sticky; top:0; z-index:5;
  }
  .toolbar input[type="search"], .toolbar select{
    font:13px system-ui,sans-serif; color:var(--text); background:var(--bg);
    border:1px solid var(--line2); border-radius:3px; padding:7px 8px; min-width:0;
  }
  .toolbar input[type="search"]{flex:1 1 200px}
  .toolbar select{max-width:180px}
  .toolbar .sp{flex:1 1 auto}
  .shown{color:var(--faint); font-size:12px}

  table.tasks{width:100%; border-collapse:collapse; margin-top:14px; background:var(--panel); border:1px solid var(--line)}
  table.tasks th, table.tasks td{border-bottom:1px solid var(--line); padding:8px 9px; text-align:left; vertical-align:top}
  table.tasks th{
    font:600 11px/1.3 system-ui,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:var(--muted);
    cursor:pointer; user-select:none; white-space:nowrap; background:var(--panel);
  }
  table.tasks th:hover{color:var(--accent)}
  table.tasks tbody tr:nth-child(odd){background:var(--tbl-zebra)}
  th .arr{color:var(--accent); font-size:10px}
  td.c-id{white-space:nowrap}
  .tid{font-family:ui-monospace,monospace; font-size:12px; font-weight:600; color:var(--text)}
  .tid.none{color:var(--faint)}
  .tname{font-weight:510}
  .note{color:var(--muted); font-size:12px; margin-top:3px; max-width:70ch}
  .hash{font-size:12px}
  .muted{color:var(--faint)}

  .badge{display:inline-block; font:600 10.5px/1 system-ui,sans-serif; letter-spacing:.05em; padding:4px 7px; border-radius:3px; border:1px solid var(--line2); color:var(--muted); white-space:nowrap}
  .b-done{color:var(--done); background:var(--done-bg); border-color:var(--done-ln)}
  .b-open{color:var(--open); background:var(--open-bg); border-color:var(--open-ln)}
  .b-prog{color:var(--prog); background:var(--prog-bg); border-color:var(--prog-ln)}
  .b-p0{color:var(--p0); border-color:var(--p0)}
  .b-p1{color:var(--p1); border-color:var(--p1)}
  .b-p2{color:var(--p2); border-color:var(--line2)}
  .b-t{color:var(--muted)}
  .b-model{color:var(--accent); border-color:var(--accent)}
  .b-review{color:var(--muted); background:transparent}
  .b-feature{color:var(--done); border-color:var(--done-ln)}
  .b-bug{color:var(--p0); border-color:var(--p0)}
  .b-improvement{color:var(--p1); border-color:var(--p1)}

  .cards{display:none; grid-template-columns:1fr; gap:10px; margin-top:14px}
  .card{border:1px solid var(--line); border-radius:4px; background:var(--panel); padding:12px}
  .card .row1{display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px}
  .card .tname{font-size:14px}
  .card .meta{display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; color:var(--faint); font-size:12px}

  /* Канбан */
  .kanban{display:none; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; margin-top:14px; align-items:start}
  .kb-col{border:1px solid var(--line); border-radius:4px; background:var(--panel); min-height:80px}
  .kb-head{display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid var(--line); font:600 12px/1 system-ui,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:var(--muted)}
  .kb-head .n{color:var(--faint); font-weight:400}
  .kb-body{padding:10px; display:flex; flex-direction:column; gap:8px}
  .kb-card{border:1px solid var(--line); border-radius:4px; background:var(--bg); padding:10px}
  .kb-card .tname{font-size:13px}
  .kb-card .row1{display:flex; gap:6px; flex-wrap:wrap; margin-bottom:5px}
  .kb-card .meta{display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; color:var(--faint); font-size:11.5px}

  body[data-view="cards"] table.tasks{display:none}
  body[data-view="cards"] .cards{display:grid}
  body[data-view="kanban"] table.tasks{display:none}
  body[data-view="kanban"] .kanban{display:grid}
  @media (max-width:780px){
    table.tasks{display:none}
    body[data-view="table"] .cards{display:grid}
    body[data-view="cards"] .cards{display:grid}
    body[data-view="kanban"] .kanban{display:grid; grid-template-columns:1fr}
    body[data-view="kanban"] .cards{display:none}
    .toolbar{position:static}
    .site-in{padding:14px 0 10px}
  }

  .empty{padding:22px; border:1px dashed var(--line2); border-radius:4px; color:var(--muted); text-align:center; margin-top:14px}

  /* Хроника */
  .chron{margin-top:6px; border-top:1px solid var(--line)}
  .chron .it{display:flex; gap:18px; padding:14px 0; border-bottom:1px solid var(--line)}
  .chron .d{flex:0 0 92px; color:var(--accent); font-family:ui-monospace,monospace; font-size:12px; padding-top:2px}
  .chron .tt{font-weight:600; margin-bottom:2px}
  .chron .tx{color:var(--muted); font-size:13px; max-width:80ch}

  /* Дорожная карта */
  .rm-board{display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; align-items:start; margin-top:14px}
  @media (max-width:960px){ .rm-board{grid-template-columns:1fr 1fr} }
  @media (max-width:640px){ .rm-board{grid-template-columns:1fr} }
  .rm-col{border:1px solid var(--line); border-radius:4px; background:var(--panel)}
  .rm-head{padding:10px 12px; border-bottom:1px solid var(--line); font:600 12px/1 system-ui,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); display:flex; justify-content:space-between}
  .rm-body{padding:10px; display:flex; flex-direction:column; gap:8px}
  .rm-card{border:1px solid var(--line); border-radius:4px; background:var(--bg); padding:11px}
  .rm-card .row1{display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px}
  .rm-card .tname{font-size:13.5px; font-weight:600}
  .rm-card .desc{color:var(--muted); font-size:12.5px; margin-top:4px}
  .rm-card .meta{display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; color:var(--faint); font-size:11.5px; align-items:center}
  .rm-task{font:600 11px/1 system-ui,sans-serif; padding:3px 7px; border:1px solid var(--accent); color:var(--accent); border-radius:3px; cursor:pointer; background:transparent}
  .rm-task:hover{background:var(--accent-soft)}
  .rm-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:4px 0 0;flex-wrap:wrap}
  .rm-livenote{color:var(--faint);font-size:12px}
  .stat.s-p0 b{color:var(--p0)} .stat.s-p1 b{color:var(--p1)} .stat.s-p2 b{color:var(--p2)}

  /* Руководство */
  .guide h3{font-family:Georgia,serif; font-size:17px; margin:22px 0 8px}
  .guide p, .guide li{color:var(--text); font-size:14px; max-width:85ch}
  .guide li{margin:4px 0}
  .guide code{background:var(--code-bg); padding:1px 5px; border-radius:3px; font-family:ui-monospace,monospace; font-size:12.5px}
  .kv{border:1px solid var(--line); border-radius:4px; background:var(--panel); margin:10px 0; overflow:hidden}
  .kv .r{display:flex; gap:14px; padding:9px 12px; border-bottom:1px solid var(--line); font-size:13px}
  .kv .r:last-child{border-bottom:none}
  .kv .k{flex:0 0 210px; color:var(--muted)}
  @media (max-width:700px){ .kv .k{flex-basis:120px} .chron .d{flex-basis:70px} }

  details.prob{border:1px solid var(--line); border-radius:4px; background:var(--panel); margin:8px 0}
  details.prob summary{cursor:pointer; padding:11px 13px; font-weight:600; font-size:14px; list-style:none}
  details.prob summary::-webkit-details-marker{display:none}
  details.prob summary:before{content:"+ "; color:var(--accent); font-weight:700}
  details.prob[open] summary:before{content:"– "}
  details.prob .pbody{padding:0 13px 13px; font-size:13.5px}
  details.prob .pbody b{color:var(--muted); font-weight:600}

  footer.site{border-top:1px solid var(--line); color:var(--faint); font-size:12px; padding:18px 0 26px; background:var(--panel)}
  footer.site .wrap{display:flex; gap:14px; flex-wrap:wrap; align-items:baseline}
</style>
</head>
<body data-view="table">
<header class="site">
  <div class="wrap site-in">
    <div class="brand">ANOTEE <span class="bn">·</span> Библия проекта</div>
    <div class="tagline">Все задачи, решения и знания — в одном месте</div>
    <div class="site-right">
      <span class="meta-line">Собрано: __META_DATE__ · задач: __META_COUNT__</span>
      <button class="btn" id="themeBtn" type="button">◐ Тема</button>
      <button class="btn" id="viewBtn" type="button">≣ Карточки</button>
    </div>
  </div>
</header>

<nav class="tabs">
  <div class="wrap tabs-in" id="tabs">
    <button class="tab on" data-tab="tasks" type="button">Задачи<span class="cnt" id="cntAll"></span></button>
    <button class="tab" data-tab="roadmap" type="button">Дорожная карта<span class="cnt" id="cntRoad"></span></button>
    <button class="tab" data-tab="chron" type="button">Хроника</button>
    <button class="tab" data-tab="storage" type="button">Хранилище (R2)</button>
    <button class="tab" data-tab="problems" type="button">Проблемы<span class="cnt" id="cntProb"></span></button>
    <button class="tab" data-tab="process" type="button">Процесс</button>
  </div>
</nav>

<main class="wrap">

  <section class="tabsec on" id="tab-tasks">
    <h2 class="sechead">Задачи проекта: T-01 → последняя</h2>
    <p class="secsub">Полный реестр задач из трекера и истории коммитов. Сортировка — клик по заголовку столбца; фильтры и поиск — ниже. Вид переключается: таблица → карточки → канбан (кнопка «Вид» сверху). «Модель» и «Обновлено» ведут агенты: дата и время каждого изменения фиксируются при записи. «—» в номере — раунды без формального T-номера; «без №» — свежие записи, ждущие номера.</p>
    <div class="stats" id="stats"></div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Поиск: название, область, примечание…" autocomplete="off">
      <select id="fStatus"><option value="">Статус: любой</option></select>
      <select id="fPriority"><option value="">Приоритет: любой</option></select>
      <select id="fArea"><option value="">Область: любая</option></select>
      <select id="fType"><option value="">Тип: любой</option></select>
      <select id="fOwner"><option value="">Исполнитель: любой</option></select>
      <select id="fModel"><option value="">Модель: любая</option></select>
      <button class="btn" id="resetBtn" type="button">Сброс</button>
      <span class="sp"></span>
      <span class="shown" id="shown"></span>
    </div>
    <table class="tasks" id="tbl">
      <thead><tr>
        <th data-k="num">№ <span class="arr"></span></th>
        <th data-k="name">Задача <span class="arr"></span></th>
        <th data-k="area">Область <span class="arr"></span></th>
        <th data-k="t">Тип <span class="arr"></span></th>
        <th data-k="priority">Приоритет <span class="arr"></span></th>
        <th data-k="status">Статус <span class="arr"></span></th>
        <th data-k="owner">Исполнитель <span class="arr"></span></th>
        <th data-k="model">Модель <span class="arr"></span></th>
        <th data-k="updated">Обновлено <span class="arr"></span></th>
        <th data-k="hash">Коммит <span class="arr"></span></th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
    <div class="cards" id="cards"></div>
    <div class="kanban" id="kanban">
      <div class="kb-col"><div class="kb-head"><span>Открыто</span><span class="n" id="kbOpen">0</span></div><div class="kb-body" id="kbOpenBody"></div></div>
      <div class="kb-col"><div class="kb-head"><span>В работе</span><span class="n" id="kbProg">0</span></div><div class="kb-body" id="kbProgBody"></div></div>
      <div class="kb-col"><div class="kb-head"><span>Сделано</span><span class="n" id="kbDone">0</span></div><div class="kb-body" id="kbDoneBody"></div></div>
    </div>
    <div class="empty" id="empty" hidden>Ничего не найдено — измени фильтры.</div>
  </section>

  <section class="tabsec" id="tab-roadmap">
    <h2 class="sechead">Дорожная карта</h2>
    <p class="secsub">Входящий поток идей, фич и багов (в том числе с сайта). Порядок работы: новый пункт появляется в «На рассмотрении» → планируется → берётся в работу (связывается с задачей T-XX, кнопка «→ задача») → завершается. Агенты ведут эту доску вместе с реестром задач (см. «Процесс»).</p>
    <div class="rm-toolbar">
      <span class="rm-livenote" id="rmLiveNote">Посты с сайта подгружаются вживую.</span>
      <button class="btn" id="rmRefresh" type="button">↻ Обновить с сайта</button>
    </div>
    <div class="rm-board" id="rmBoard"></div>
  </section>

  <section class="tabsec" id="tab-chron">
    <h2 class="sechead">Хроника проекта</h2>
    <p class="secsub">Ключевые вехи разработки Anotee — от августовского аудита до текущего раунда.</p>
    <div class="chron" id="chronList"></div>
  </section>

  <section class="tabsec" id="tab-storage">
    <h2 class="sechead">Хранилище: Cloudflare R2 — пошагово</h2>
    <p class="secsub">Anotee — BYOS-приложение (Bring Your Own Storage): файлы проектов хранятся в вашем собственном бакете. Ниже — рабочий путь настройки и разбор частых ошибок.</p>
    <div class="guide">
      <h3>Три разные сущности — не путать</h3>
      <div class="kv">
        <div class="r"><div class="k">API-токен <span class="mono">(cfat_…)</span></div><div>Нужен приложению только для автозаполнения: Account ID, Endpoint, список бакетов. В базе не сохраняется.</div></div>
        <div class="r"><div class="k">Access Key ID</div><div>Идентификатор пары ключей R2 (верхняя строка на странице Success). Сохраняется в настройках.</div></div>
        <div class="r"><div class="k">Secret Access Key</div><div>Секрет пары (нижняя строка; показывается один раз). Нужен вместе с Access Key ID для загрузки файлов.</div></div>
      </div>

      <h3>Шаги настройки (рабочий путь, ~2 минуты)</h3>
      <ol>
        <li>Создайте пару ключей: <code>dash.cloudflare.com → R2 → API → Create Account API token</code> → права <b>Admin Read &amp; Write</b> → <b>Create</b>.</li>
        <li>На странице Success скопируйте <b>Access Key ID</b> и <b>Secret Access Key</b> (Secret показывается один раз).</li>
        <li>В Anotee: <b>Настройки → Хранилище</b> → выберите <b>Cloudflare R2</b> → заполните поля (Account ID определится сам из R2-ссылки) → выберите бакет.</li>
        <li>Нажмите <b>«Сохранить и активировать»</b>, затем <b>«Проверить»</b> — должен быть зелёный статус.</li>
        <li>Загрузите тестовое видео — файл появится в бакете и будет проигрываться в плеере.</li>
      </ol>

      <h3>Частые ошибки</h3>
      <div class="kv">
        <div class="r"><div class="k">Invalid request headers (6003)</div><div>Некорректный заголовок авторизации при обращении к Cloudflare API — обновите страницу (исправлено в коде).</div></div>
        <div class="r"><div class="k">«У токена нет права Account API Tokens: Edit»</div><div>Автосоздание R2-ключей доступно только user-токену с этим правом; для account-токена (<span class="mono">cfat_</span>) — штатный ручной путь (шаги 1–2).</div></div>
        <div class="r"><div class="k">403 при загрузке/просмотре</div><div>CORS бакета: «Проверить настройки S3» → «Исправить автоматически (применить CORS)».</div></div>
        <div class="r"><div class="k">401</div><div>Сессия истекла — обновите страницу, войдите заново.</div></div>
        <div class="r"><div class="k">Secret Key required</div><div>В поле Secret попала маска <span class="mono">********</span> при отсутствии сохранённого конфига — введите Secret заново.</div></div>
      </div>

      <h3>Как это устроено под капотом</h3>
      <p>Настройки хранятся в таблице <code>storage_config</code> (одна строка на пользователя — прод-схема). Файлы загружаются напрямую в ваш бакет по presigned-URL (AWS SDK v3, ForcePathStyle, регион auto; чек-суммы — WHEN_REQUIRED — иначе R2 отвечает 403). Просмотр — по presigned-GET; гостевые ссылки подписываются на сервере от имени владельца.</p>
    </div>
  </section>

  <section class="tabsec" id="tab-problems">
    <h2 class="sechead">Проблемы и решения</h2>
    <p class="secsub">База знаний: симптом → причина → решение. По мотивам реальных инцидентов проекта.</p>
    <div id="probList"></div>
  </section>

  <section class="tabsec" id="tab-process">
    <h2 class="sechead">Процесс работы</h2>
    <p class="secsub">Как устроена разработка, проверка и релиз Anotee.</p>
    <div class="guide">
      <h3>Ветки и релиз</h3>
      <ul>
        <li><b>chore/multiagent-prep</b> — рабочая ветка AutoCoder: каждая правка = коммит + пуш в ветку.</li>
        <li><b>main</b> — приёмка: владелец мёржит PR после проверки на dev.</li>
        <li><b>production</b> — прод-ветка; мёрж <b>main → production делает только владелец вручную</b> после приёмки. Прод не трогается агентами.</li>
        <li>Приёмка: <b>dev.anotee.com</b> (Ctrl+Shift+R при проверке обновлений).</li>
      </ul>
      <h3>Проверки перед пушем</h3>
      <ul>
        <li><code>npx tsc --noEmit</code> — типы (инвариант: 0 ошибок).</li>
        <li><code>npm run verify</code> — lint + unit-тесты + аудит инвариантов.</li>
        <li><code>npx playwright test</code> — полный e2e, вкл. мобильные проекты.</li>
        <li><code>npm run build</code> — сборка (включая библию) + Service Worker.</li>
      </ul>
      <h3>Учёт в Библии проекта (для всех агентов)</h3>
      <ul>
        <li>Источник данных — <code>docs/bible/*.json</code>; страница собирается командой <code>npm run bible:build</code> в <code>public/bible.html</code> (она же — раздел «Библия» в админке).</li>
        <li>Каждая задача/изменение: запись в <code>docs/bible/tasks.json</code> — с <b>датой и временем</b> обновления и <b>моделью</b>, выполнявшей работу (поле <code>model</code>, например <span class="mono">zai-auto</span>).</li>
        <li>Новые баги/фичи (в том числе с сайта) — в <code>docs/bible/roadmap.json</code>; при взятии в работу пункт связывается с задачей (поле <code>taskId</code>).</li>
        <li>Перед завершением задачи — обновить библию и пересобрать: <code>node scripts/bible-add.cjs … && npm run bible:build</code>.</li>
      </ul>
      <h3>Сервисы проекта</h3>
      <div class="kv">
        <div class="r"><div class="k">Хостинг</div><div>Vercel (деплой из main; dev-домен и прод-домен)</div></div>
        <div class="r"><div class="k">Авторизация</div><div>Clerk (организации, роли; токены короткоживущие — см. «гонка токена»)</div></div>
        <div class="r"><div class="k">Хранилище</div><div>BYOS: Cloudflare R2 / S3-совместимые (Selectel, Yandex) / Google Drive</div></div>
        <div class="r"><div class="k">БД</div><div>Vercel Postgres (проекты — JSONB; storage_config — настройки хранилища)</div></div>
        <div class="r"><div class="k">Платежи</div><div>ЮKassa / Prodamus — <b>webhook-подпись не внедрена (T-01, P0)</b></div></div>
        <div class="r"><div class="k">Supabase</div><div>Не используется — решение зафиксировано (проблема была в коде, не в БД)</div></div>
      </div>
    </div>
  </section>

</main>

<footer class="site">
  <div class="wrap">
    <span>Anotee — Библия проекта · собрано __META_DATE__</span>
    <span>Источники: git (main), docs/TASKS.md, docs/bible</span>
    <span>Собрано AutoClaw</span>
  </div>
</footer>

<script>
'use strict';
var TASKS = /*__TASKS__*/[];
var CHRONICLE = /*__CHRONICLE__*/[];
var PROBLEMS = /*__PROBLEMS__*/[];
var ROADMAP = /*__ROADMAP__*/[];

var ST_LABEL = { done:'Сделано', open:'Открыто', progress:'В работе' };
var ST_CLS = { done:'b-done', open:'b-open', progress:'b-prog' };
var RM_ST = [
  { key:'under_review', label:'На рассмотрении' },
  { key:'planned', label:'Запланировано' },
  { key:'in_progress', label:'В работе' },
  { key:'completed', label:'Завершено' }
];
var RM_TYPE = { feature:'фича', bug:'баг', improvement:'улучшение' };

var state = { q:'', st:'', pr:'', ar:'', tp:'', ow:'', md:'', k:'num', dir:1 };
var VIEWS = ['table','cards','kanban'];
var viewIdx = 0;

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function tNum(t){ return (t.num == null ? 99999 : t.num); }
function prioVal(t){ return t.priority === 'P0' ? 0 : t.priority === 'P1' ? 1 : t.priority === 'P2' ? 2 : 9; }
function stVal(t){ return t.status === 'open' ? 0 : t.status === 'progress' ? 1 : 2; }
function upd(t){ return t.updated || t.date || ''; }
function updShow(t){ return upd(t) || '—'; }

function cmp(a,b){
  var r = 0;
  switch(state.k){
    case 'num': r = tNum(a) - tNum(b); break;
    case 'name': r = a.name.localeCompare(b.name,'ru'); break;
    case 'area': r = (a.area||'').localeCompare(b.area||'','ru'); break;
    case 't': r = (a.t||'').localeCompare(b.t||''); break;
    case 'priority': r = prioVal(a) - prioVal(b); break;
    case 'status': r = stVal(a) - stVal(b); break;
    case 'owner': r = (a.owner||'').localeCompare(b.owner||'','ru'); break;
    case 'model': r = (a.model||'').localeCompare(b.model||'','ru'); break;
    case 'updated': r = (upd(a)||'9999').localeCompare(upd(b)||'9999'); break;
    case 'hash': r = (a.hash||'').localeCompare(b.hash||''); break;
  }
  if (r === 0) r = tNum(a) - tNum(b);
  return r * state.dir;
}

function filtered(){
  var out = [], i, t, hay;
  for (i = 0; i < TASKS.length; i++){
    t = TASKS[i];
    if (state.q){
      hay = (t.id + ' ' + t.name + ' ' + (t.area||'') + ' ' + (t.note||'') + ' ' + (t.hash||'') + ' ' + (t.model||'')).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) continue;
    }
    if (state.st && t.status !== state.st) continue;
    if (state.pr && t.priority !== state.pr) continue;
    if (state.ar && t.area !== state.ar) continue;
    if (state.tp && t.t !== state.tp) continue;
    if (state.ow && t.owner !== state.ow) continue;
    if (state.md && t.model !== state.md) continue;
    out.push(t);
  }
  out.sort(cmp);
  return out;
}

function badges(t){
  var pr = t.priority ? '<span class="badge ' + (t.priority === 'P0' ? 'b-p0' : t.priority === 'P1' ? 'b-p1' : 'b-p2') + '">' + esc(t.priority) + '</span>' : '';
  var st = '<span class="badge ' + (ST_CLS[t.status]||'') + '">' + (ST_LABEL[t.status]||t.status||'') + '</span>';
  var md = t.model ? '<span class="badge b-model">' + esc(t.model) + '</span>' : '';
  return pr + st + md;
}

function rowHtml(t){
  var id = t.id ? '<span class="tid">' + esc(t.id) + '</span>' : '<span class="tid none">—</span>';
  var note = t.note ? '<div class="note">' + esc(t.note) + '</div>' : '';
  var hash = t.hash ? '<a class="mono hash" target="_blank" rel="noopener" href="https://github.com/enver-isliamov/Anotee.app/commit/' + esc(t.hash) + '">' + esc(t.hash) + '</a>' : '<span class="muted">—</span>';
  var pr = t.priority ? '<span class="badge ' + (t.priority === 'P0' ? 'b-p0' : t.priority === 'P1' ? 'b-p1' : 'b-p2') + '">' + esc(t.priority) + '</span>' : '<span class="muted">—</span>';
  var st = '<span class="badge ' + (ST_CLS[t.status]||'') + '">' + (ST_LABEL[t.status]||t.status||'') + '</span>';
  var ow = t.owner === 'Владелец' ? '<span class="badge b-open">Владелец</span>' : esc(t.owner||'AutoCoder');
  var md = t.model ? '<span class="badge b-model">' + esc(t.model) + '</span>' : '<span class="muted">—</span>';
  return '<tr>'
    + '<td class="c-id">' + id + '</td>'
    + '<td><div class="tname">' + esc(t.name) + '</div>' + note + '</td>'
    + '<td>' + esc(t.area||'') + '</td>'
    + '<td><span class="badge b-t">' + esc(t.t||'') + '</span></td>'
    + '<td>' + pr + '</td>'
    + '<td>' + st + '</td>'
    + '<td>' + ow + '</td>'
    + '<td>' + md + '</td>'
    + '<td class="mono" style="font-size:12px;white-space:nowrap">' + esc(updShow(t)) + '</td>'
    + '<td>' + hash + '</td>'
    + '</tr>';
}

function cardHtml(t){
  var id = t.id ? '<span class="tid">' + esc(t.id) + '</span>' : '<span class="tid none">без №</span>';
  var note = t.note ? '<div class="note">' + esc(t.note) + '</div>' : '';
  var hash = t.hash ? '<a class="mono hash" target="_blank" rel="noopener" href="https://github.com/enver-isliamov/Anotee.app/commit/' + esc(t.hash) + '">' + esc(t.hash) + '</a>' : '';
  var ow = t.owner === 'Владелец' ? '<span>исполнитель: владелец</span>' : '<span>исполнитель: AutoCoder</span>';
  var md = t.model ? '<span class="badge b-model">' + esc(t.model) + '</span>' : '';
  return '<div class="card">'
    + '<div class="row1">' + id + badges(t) + '<span class="badge b-t">' + esc(t.t||'') + '</span><span class="badge b-t">' + esc(t.area||'') + '</span></div>'
    + '<div class="tname">' + esc(t.name) + '</div>' + note
    + '<div class="meta">' + ow + md + (upd(t) ? '<span class="mono">' + esc(updShow(t)) + '</span>' : '') + (hash ? '<span>' + hash + '</span>' : '') + '</div>'
    + '</div>';
}

function kbCardHtml(t){
  var id = t.id ? '<span class="tid">' + esc(t.id) + '</span>' : '<span class="tid none">без №</span>';
  return '<div class="kb-card">'
    + '<div class="row1">' + id + badges(t) + '</div>'
    + '<div class="tname">' + esc(t.name) + '</div>'
    + '<div class="meta"><span>' + esc(t.area||'') + '</span>' + (upd(t) ? '<span class="mono">' + esc(updShow(t)) + '</span>' : '') + '</div>'
    + '</div>';
}

function applySortUI(){
  var ths = document.querySelectorAll('#tbl th');
  for (var i = 0; i < ths.length; i++){
    var th = ths[i];
    var arr = th.querySelector('.arr');
    if (!arr) continue;
    arr.textContent = th.getAttribute('data-k') === state.k ? (state.dir === 1 ? '▲' : '▼') : '';
  }
}

function render(){
  var list = filtered();
  var i, rows = [], cards = [], openRows = [], progRows = [], doneRows = [];
  for (i = 0; i < list.length; i++){
    var t = list[i];
    rows.push(rowHtml(t));
    cards.push(cardHtml(t));
    if (t.status === 'open') openRows.push(kbCardHtml(t));
    else if (t.status === 'progress') progRows.push(kbCardHtml(t));
    else doneRows.push(kbCardHtml(t));
  }
  document.getElementById('tbody').innerHTML = rows.join('');
  document.getElementById('cards').innerHTML = cards.join('');
  document.getElementById('kbOpenBody').innerHTML = openRows.join('');
  document.getElementById('kbProgBody').innerHTML = progRows.join('');
  document.getElementById('kbDoneBody').innerHTML = doneRows.join('');
  document.getElementById('kbOpen').textContent = openRows.length;
  document.getElementById('kbProg').textContent = progRows.length;
  document.getElementById('kbDone').textContent = doneRows.length;
  document.getElementById('empty').hidden = list.length !== 0;
  document.getElementById('shown').textContent = 'Показано: ' + list.length + ' из ' + TASKS.length;
  applySortUI();
}

function statRow(){
  var total = TASKS.length, done = 0, open = 0, prog = 0, p0 = 0, p1 = 0, p2 = 0, i, t;
  for (i = 0; i < TASKS.length; i++){
    t = TASKS[i];
    if (t.status === 'done') done++; else if (t.status === 'open') open++; else prog++;
    if (t.priority === 'P0') p0++; else if (t.priority === 'P1') p1++; else if (t.priority === 'P2') p2++;
  }
  document.getElementById('stats').innerHTML =
    '<div class="stat"><b>' + total + '</b><span>всего задач</span></div>' +
    '<div class="stat s-done"><b>' + done + '</b><span>сделано</span></div>' +
    '<div class="stat s-open"><b>' + open + '</b><span>открыто</span></div>' +
    '<div class="stat s-prog"><b>' + prog + '</b><span>в работе</span></div>' +
    '<div class="stat s-p0"><b>' + p0 + '</b><span>P0 приоритет</span></div>' +
    '<div class="stat s-p1"><b>' + p1 + '</b><span>P1</span></div>' +
    '<div class="stat s-p2"><b>' + p2 + '</b><span>P2</span></div>';
  document.getElementById('cntAll').textContent = total;
}

function fillSelect(id, values, labels){
  var sel = document.getElementById(id);
  for (var i = 0; i < values.length; i++){
    var o = document.createElement('option');
    o.value = values[i];
    o.textContent = labels ? labels[values[i]] || values[i] : values[i];
    sel.appendChild(o);
  }
}

function uniq(key){
  var seen = {}, out = [], i, v;
  for (i = 0; i < TASKS.length; i++){
    v = TASKS[i][key] || '';
    if (v && !seen[v]){ seen[v] = 1; out.push(v); }
  }
  out.sort(function(a,b){ return a.localeCompare(b,'ru'); });
  return out;
}

function initFilters(){
  fillSelect('fStatus', ['open','progress','done'], ST_LABEL);
  fillSelect('fPriority', ['P0','P1','P2']);
  fillSelect('fArea', uniq('area'));
  fillSelect('fType', uniq('t'));
  fillSelect('fOwner', ['AutoCoder','Владелец']);
  fillSelect('fModel', uniq('model'));
}

function initChronicle(){
  var html = [], i, c;
  for (i = 0; i < CHRONICLE.length; i++){
    c = CHRONICLE[i];
    html.push('<div class="it"><div class="d">' + esc(c.d) + '</div><div><div class="tt">' + esc(c.title) + '</div><div class="tx">' + esc(c.text) + '</div></div></div>');
  }
  document.getElementById('chronList').innerHTML = html.join('');
}

function initProblems(){
  var html = [], i, p;
  for (i = 0; i < PROBLEMS.length; i++){
    p = PROBLEMS[i];
    html.push('<details class="prob"><summary>' + esc(p.sym) + '</summary><div class="pbody"><p><b>Причина:</b> ' + esc(p.cause) + '</p><p><b>Решение:</b> ' + esc(p.fix) + '</p></div></details>');
  }
  document.getElementById('probList').innerHTML = html.join('');
  document.getElementById('cntProb').textContent = PROBLEMS.length;
}

function rmStatusOf(p){
  if (p.status === 'completed' || p.status === 'closed') return 'completed';
  return p.status || 'under_review';
}

function rmStatusOf(p){
  if (p.status === 'completed' || p.status === 'closed') return 'completed';
  return p.status || 'under_review';
}

var livePosts = [];

// Пост с сайта → карточка (пометка «с сайта», счётчик голосов)
function toLive(p){
  var s = String(p.status || 'under_review');
  if (s === 'closed') s = 'completed';
  return {
    id: 'САЙТ-' + String(p.id || '').slice(0, 6),
    title: p.title, description: p.description, type: p.type,
    status: s,
    votes: Array.isArray(p.voterIds) ? p.voterIds.length : 0,
    taskId: '', source: 'сайт', live: true,
    updated: String(p.createdAt || '').slice(0, 10)
  };
}

function rmCardHtml(it){
  var typeCls = it.type === 'bug' ? 'b-bug' : it.type === 'feature' ? 'b-feature' : 'b-improvement';
  var task = it.taskId ? '<button class="rm-task" data-goto="' + esc(it.taskId) + '" type="button">→ задача ' + esc(it.taskId) + '</button>' : '';
  var votes = (it.votes ? '<span>▲ ' + it.votes + '</span>' : '');
  var live = it.live ? '<span class="badge b-model">с сайта</span>' : '';
  return '<div class="rm-card">'
    + '<div class="row1"><span class="badge ' + typeCls + '">' + esc(RM_TYPE[it.type] || it.type || '') + '</span>' + live + (it.id ? '<span class="tid">' + esc(it.id) + '</span>' : '') + '</div>'
    + '<div class="tname">' + esc(it.title) + '</div>'
    + '<div class="desc">' + esc(it.description || '') + '</div>'
    + '<div class="meta">' + task + votes + '<span class="mono">' + esc(it.updated || '') + '</span>' + (it.source ? '<span>' + esc(it.source) + '</span>' : '') + '</div>'
    + '</div>';
}

function renderRoadmap(){
  var cols = {}, i, p;
  for (i = 0; i < RM_ST.length; i++) cols[RM_ST[i].key] = [];
  // серверные (с сайта) — первыми в своей колонке
  for (i = 0; i < livePosts.length; i++){
    var k1 = rmStatusOf(livePosts[i]);
    if (!cols[k1]) cols[k1] = [];
    cols[k1].push(livePosts[i]);
  }
  for (i = 0; i < ROADMAP.length; i++){
    p = ROADMAP[i];
    var k = rmStatusOf(p);
    if (!cols[k]) cols[k] = [];
    cols[k].push(p);
  }
  var html = [];
  for (i = 0; i < RM_ST.length; i++){
    var col = RM_ST[i];
    var cards = [], items = cols[col.key] || [];
    for (var j = 0; j < items.length; j++) cards.push(rmCardHtml(items[j]));
    html.push('<div class="rm-col"><div class="rm-head"><span>' + col.label + '</span><span class="n">' + items.length + '</span></div><div class="rm-body">' + cards.join('') + '</div></div>');
  }
  document.getElementById('rmBoard').innerHTML = html.join('');
  var btns = document.querySelectorAll('.rm-task');
  for (var b = 0; b < btns.length; b++){
    (function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-goto');
        document.querySelector('.tab[data-tab="tasks"]').click();
        state.q = id;
        document.getElementById('q').value = id;
        render();
      });
    })(btns[b]);
  }
}

function stampHM(){
  var d = new Date(), p = function(n){ return String(n).padStart(2, '0'); };
  return p(d.getHours()) + ':' + p(d.getMinutes());
}

function fetchLive(){
  var btn = document.getElementById('rmRefresh');
  var note = document.getElementById('rmLiveNote');
  if (btn) { btn.disabled = true; btn.textContent = '… обновление'; }
  fetch('/api/data?action=roadmap', { cache: 'no-store' })
    .then(function(r){ if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function(d){
      var list = (d && d.posts) ? d.posts : [];
      livePosts = [];
      for (var i = 0; i < list.length; i++) livePosts.push(toLive(list[i]));
      if (note) note.textContent = livePosts.length ? ('Загружено с сайта: ' + livePosts.length + ' · ' + stampHM()) : 'На сайте пока нет постов — показана встроенная доска.';
      document.getElementById('cntRoad').textContent = ROADMAP.length + livePosts.length;
      renderRoadmap();
    })
    .catch(function(){
      if (note) note.textContent = 'Живые посты недоступны (откройте страницу на сайте Anotee) — показана встроенная доска.';
    })
    .then(function(){ if (btn) { btn.disabled = false; btn.textContent = '↻ Обновить с сайта'; } });
}

function initRoadmap(){
  document.getElementById('cntRoad').textContent = ROADMAP.length;
  renderRoadmap();
  var btn = document.getElementById('rmRefresh');
  if (btn) btn.addEventListener('click', fetchLive);
  fetchLive();
}

function initTabs(){
  var tabs = document.querySelectorAll('.tab');
  function show(id){
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === id);
    var secs = document.querySelectorAll('.tabsec');
    for (var j = 0; j < secs.length; j++) secs[j].classList.toggle('on', secs[j].id === 'tab-' + id);
    window.scrollTo(0,0);
  }
  for (var i = 0; i < tabs.length; i++){
    (function(btn){ btn.addEventListener('click', function(){ show(btn.getAttribute('data-tab')); }); })(tabs[i]);
  }
}

function initToolbar(){
  document.getElementById('q').addEventListener('input', function(e){ state.q = e.target.value; render(); });
  var map = [['fStatus','st'],['fPriority','pr'],['fArea','ar'],['fType','tp'],['fOwner','ow'],['fModel','md']];
  map.forEach(function(m){
    document.getElementById(m[0]).addEventListener('change', function(e){ state[m[1]] = e.target.value; render(); });
  });
  document.getElementById('resetBtn').addEventListener('click', function(){
    state.q=''; state.st=''; state.pr=''; state.ar=''; state.tp=''; state.ow=''; state.md='';
    document.getElementById('q').value='';
    map.forEach(function(m){ document.getElementById(m[0]).value=''; });
    render();
  });
  var ths = document.querySelectorAll('#tbl th');
  for (var i = 0; i < ths.length; i++){
    (function(th){
      th.addEventListener('click', function(){
        var k = th.getAttribute('data-k');
        if (state.k === k) state.dir = -state.dir; else { state.k = k; state.dir = 1; }
        render();
      });
    })(ths[i]);
  }
}

function initTheme(){
  var root = document.documentElement;
  var btn = document.getElementById('themeBtn');
  btn.addEventListener('click', function(){
    var cur = root.getAttribute('data-theme');
    root.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
  });
}

function initView(){
  var btn = document.getElementById('viewBtn');
  function apply(){
    var v = VIEWS[viewIdx];
    document.body.setAttribute('data-view', v);
    btn.textContent = v === 'table' ? '≣ Карточки' : v === 'cards' ? '▦ Канбан' : '☰ Таблица';
  }
  btn.addEventListener('click', function(){
    viewIdx = (viewIdx + 1) % VIEWS.length;
    apply();
  });
  apply();
}

statRow(); initFilters(); initChronicle(); initProblems(); initRoadmap(); initTabs(); initToolbar(); initTheme(); initView(); render();
</script>
</body>
</html>`;
  return html
    .replace('/*__TASKS__*/[]', tasksJson)
    .replace('/*__CHRONICLE__*/[]', chronicleJson)
    .replace('/*__PROBLEMS__*/[]', problemsJson)
    .replace('/*__ROADMAP__*/[]', roadmapJson)
    .split('__META_DATE__').join(metaDate);
}

module.exports = { buildHtml };
