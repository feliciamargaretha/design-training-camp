// Palette Drill: the eight grayscale screens. Every colorable element carries
// data-r="<role>". Same-role elements change together unless split.
// A status element names a fallback role (data-fb) for briefs without that status.
(function () {
  // Role: label, kind (fill | text | line | icon), default stop index in light
  // and dark mode, and flags the checks use.
  const ROLES = {
    bg: { label: "Background", kind: "fill", l: 1, d: 9, surface: "bg" },
    surface: { label: "Cards", kind: "fill", l: 0, d: 8, surface: "card" },
    text: { label: "Main text", kind: "text", l: 9, d: 0 },
    text2: { label: "Secondary text", kind: "text", l: 6, d: 3 },
    line: { label: "Dividers", kind: "line", l: 2, d: 7 },
    btn: { label: "Main button", kind: "fill", l: 8, d: 1, control: true },
    btnText: { label: "Main button label", kind: "text", l: 0, d: 9 },
    btn2: { label: "Second button outline", kind: "line", l: 4, d: 5, control: true },
    btn2Text: { label: "Second button label", kind: "text", l: 8, d: 1 },
    icon: { label: "Icons", kind: "icon", l: 6, d: 3, control: true },
    tile: { label: "Icon tiles", kind: "fill", l: 2, d: 7 },
    chip: { label: "Chips", kind: "fill", l: 2, d: 7 },
    chipText: { label: "Chip labels", kind: "text", l: 8, d: 1 },
    chipOn: { label: "Selected chip", kind: "fill", l: 8, d: 1, control: true },
    chipOnText: { label: "Selected chip label", kind: "text", l: 0, d: 9 },
    input: { label: "Input borders", kind: "line", l: 4, d: 5, control: true },
    inputBg: { label: "Inputs", kind: "fill", l: 0, d: 8 },
    link: { label: "Links", kind: "text", l: 8, d: 2 },
    bar: { label: "Highlight (bars, progress)", kind: "fill", l: 7, d: 3 },
    track: { label: "Tracks", kind: "fill", l: 2, d: 7 },
    navBg: { label: "Tab bar", kind: "fill", l: 0, d: 8 },
    navActive: { label: "Active tab icon", kind: "icon", l: 9, d: 0, control: true },
    side: { label: "Sidebar", kind: "fill", l: 1, d: 9 },
    sideActive: { label: "Active nav item", kind: "fill", l: 2, d: 7 },
    art: { label: "Picture area", kind: "fill", l: 3, d: 7 },
    artShape: { label: "Shape in picture", kind: "fill", l: 6, d: 4 },
    badge: { label: "Badge", kind: "fill", l: 8, d: 1 },
    badgeText: { label: "Badge label", kind: "text", l: 0, d: 9 },
    frame: { label: "Featured plan outline", kind: "line", l: 8, d: 1 },
    statusA: { label: "Status A text", kind: "text", l: 7, d: 2, status: "a" },
    statusAFill: { label: "Status A pill", kind: "fill", l: 1, d: 7, status: "a" },
    statusB: { label: "Status B text", kind: "text", l: 7, d: 2, status: "b" },
    statusBFill: { label: "Status B pill", kind: "fill", l: 1, d: 7, status: "b" },
    statusBLine: { label: "Status B outline", kind: "line", l: 7, d: 2, status: "b", control: true },
  };

  const ICONS = {
    home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
    search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16 16l4 4",
    card: "M3 6h18v12H3zM3 10h18",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6",
    arrow: "M5 12h14M13 6l6 6-6 6",
    back: "M19 12H5M11 6l-6 6 6 6",
    plus: "M12 5v14M5 12h14",
    bell: "M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    check: "M5 12l5 5L20 7",
    star: "M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z",
    send: "M4 12l16-8-6 16-3-7z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    play: "M7 4l13 8-13 8z",
    heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = (r, style, text, fb) => '<span data-r="' + r + '"' + (fb ? ' data-fb="' + fb + '"' : "") + ' style="display:block;' + style + '">' + esc(text) + "</span>";
  const F = (r, style, inner, fb) => '<div data-r="' + r + '"' + (fb ? ' data-fb="' + fb + '"' : "") + ' style="' + style + '">' + (inner || "") + "</div>";
  const L = (r, style, inner) => '<div data-r="' + r + '" style="border-style:solid;border-width:0;' + style + '">' + (inner || "") + "</div>";
  const D = (style, inner) => '<div style="' + style + '">' + (inner || "") + "</div>";
  const I = (name, r, size) =>
    '<svg data-r="' + (r || "icon") + '" width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none"><path d="' + (ICONS[name] || ICONS.star) + '"/></svg>';
  const row = "display:flex;align-items:center;";
  const col = "display:flex;flex-direction:column;";
  const statusBar = D("height:44px;" + row + "justify-content:space-between;padding:0 24px", T("text", "font-size:15px;font-weight:600", "9:41") + T("text", "font-size:12px;font-weight:600", "●●● ▮"));
  const tabBar = (icons) => F("navBg", "position:absolute;left:0;right:0;bottom:0;height:82px;" + row + "justify-content:space-around;padding-bottom:22px",
    L("line", "position:absolute;left:0;right:0;top:0;border-top-width:1px") + icons.map((n, i) => I(n, i ? "icon" : "navActive", 24)).join(""));
  const btn = (text, style) => F("btn", row + "justify-content:center;height:52px;border-radius:14px;" + (style || ""), T("btnText", "font-size:16px;font-weight:600", text));
  const btn2 = (text, style) => L("btn2", row + "justify-content:center;height:52px;border-radius:14px;border-width:1.5px;" + (style || ""), T("btn2Text", "font-size:16px;font-weight:600", text));
  const pill = (kind, text) => kind === "a" ? F("statusAFill", "display:inline-flex;padding:3px 9px;border-radius:99px", T("statusA", "font-size:12px;font-weight:600", text, "chipText"), "chip")
    : kind === "b" ? F("statusBFill", "display:inline-flex;padding:3px 9px;border-radius:99px", T("statusB", "font-size:12px;font-weight:600", text, "chipText"), "chip")
    : F("chip", "display:inline-flex;padding:3px 9px;border-radius:99px", T("chipText", "font-size:12px;font-weight:600", text));
  const sideNav = (c, w) => F("side", "width:" + (w || 232) + "px;flex:none;" + col + "padding:20px 14px;gap:4px;position:relative",
    L("line", "position:absolute;top:0;bottom:0;right:0;border-right-width:1px") +
    D(row + "gap:10px;padding:0 8px 18px", F("tile", "width:28px;height:28px;border-radius:8px") + T("text", "font-size:15px;font-weight:600", c.workspace)) +
    c.nav.map((n, i) => i === 0
      ? F("sideActive", row + "gap:10px;padding:8px;border-radius:8px", I(n[0], "icon", 18) + T("text", "font-size:14px;font-weight:500", n[1]))
      : D(row + "gap:10px;padding:8px", I(n[0], "icon", 18) + T("text2", "font-size:14px", n[1]))).join(""));

  const TEMPLATES = {
    "mobile-list": {
      name: "Mobile list", platform: "ios", w: 390, h: 844, statuses: 2,
      copy: {
        title: "Home", cards: [["GBP", "£2,140.50"], ["EUR", "€860.12"], ["USD", "$415.00"]], section: "Recent", more: "See all",
        rows: [["Sam Ortega", "Today", "+€120.00", "a"], ["Rent", "Yesterday", "−£950.00"], ["Lena Park", "Mon", "+$80.00", "a"], ["Card top-up", "Sun", "−€40.00", "b"], ["Groceries", "Sat", "−£32.10"]],
        cta: "Send", nav: ["home", "card", "send", "user"],
      },
      html: (c) => F("bg", "position:relative;width:390px;height:844px;overflow:hidden",
        statusBar +
        D(row + "justify-content:space-between;padding:8px 20px 16px", T("text", "font-size:30px;font-weight:700;letter-spacing:-.02em", c.title) + F("tile", "width:40px;height:40px;border-radius:20px;" + row + "justify-content:center", I("user", "icon", 20))) +
        D(row + "gap:10px;padding:0 20px", c.cards.map((k) => F("surface", "flex:1;border-radius:16px;padding:14px;" + col + "gap:10px",
          F("tile", "width:28px;height:28px;border-radius:14px") + T("text2", "font-size:12px;font-weight:600", k[0]) + T("text", "font-size:17px;font-weight:700", k[1]))).join("")) +
        D(row + "justify-content:space-between;padding:24px 20px 10px", T("text", "font-size:18px;font-weight:600", c.section) + T("link", "font-size:14px;font-weight:600", c.more)) +
        F("surface", "margin:0 20px;border-radius:16px;padding:0 14px", c.rows.map((r, i) =>
          (i ? L("line", "border-top-width:1px") : "") +
          D(row + "gap:12px;padding:12px 0", F("tile", "width:38px;height:38px;border-radius:19px;flex:none;" + row + "justify-content:center", I(i % 2 ? "card" : "arrow", "icon", 18)) +
            D(col + "flex:1", T("text", "font-size:15px;font-weight:600", r[0]) + T("text2", "font-size:13px", r[1])) +
            (r[3] === "a" ? T("statusA", "font-size:15px;font-weight:600", r[2], "text") : r[3] === "b" ? T("statusB", "font-size:15px;font-weight:600", r[2], "text") : T("text", "font-size:15px;font-weight:600", r[2])))).join("")) +
        btn(c.cta, "position:absolute;left:20px;right:20px;bottom:100px") +
        tabBar(c.nav)),
    },

    "mobile-detail": {
      name: "Mobile detail", platform: "ios", w: 390, h: 844, statuses: 2,
      copy: {
        title: "Details", kicker: "Overview", big: "8,240", bigLabel: "Total this week", change: "+12% vs last week", changeB: "2 missed",
        chips: ["Week", "Month", "Year"], stats: [["42", "Sessions"], ["6.5h", "Time"], ["4", "Streak"]], chartTitle: "Daily", bars: [40, 65, 30, 80, 55, 90, 70],
        note: "A short line of supporting text that explains what this number means.", cta: "Start", cta2: "Share",
      },
      html: (c) => F("bg", "position:relative;width:390px;height:844px;overflow:hidden",
        statusBar +
        D(row + "justify-content:space-between;padding:6px 20px 14px", I("back", "icon", 24) + T("text", "font-size:17px;font-weight:600", c.title) + I("heart", "icon", 24)) +
        D(col + "padding:6px 20px 0;gap:4px", T("text2", "font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em", c.kicker) +
          T("text", "font-size:46px;font-weight:700;letter-spacing:-.03em;line-height:1.1", c.big) + T("text2", "font-size:15px", c.bigLabel) +
          D(row + "gap:8px;margin-top:8px", pill("a", c.change) + pill("b", c.changeB))) +
        D(row + "gap:8px;padding:18px 20px 0", c.chips.map((t, i) => i === 1
          ? F("chipOn", "padding:8px 16px;border-radius:99px", T("chipOnText", "font-size:14px;font-weight:600", t))
          : F("chip", "padding:8px 16px;border-radius:99px", T("chipText", "font-size:14px;font-weight:500", t))).join("")) +
        F("surface", "margin:16px 20px 0;border-radius:18px;padding:16px", T("text", "font-size:15px;font-weight:600;margin-bottom:12px", c.chartTitle) +
          D(row + "align-items:flex-end;gap:10px;height:120px", c.bars.map((v) => F("track", "flex:1;height:100%;border-radius:8px;" + col + "justify-content:flex-end;overflow:hidden", F("bar", "height:" + v + "%;border-radius:8px"))).join(""))) +
        D(row + "gap:10px;padding:12px 20px 0", c.stats.map((s) => F("surface", "flex:1;border-radius:16px;padding:12px 14px", T("text", "font-size:20px;font-weight:700", s[0]) + T("text2", "font-size:13px", s[1]))).join("")) +
        T("text2", "font-size:14px;line-height:1.45;padding:14px 20px 0", c.note) +
        D("position:absolute;left:20px;right:20px;bottom:34px;" + row + "gap:10px", btn2(c.cta2, "flex:1") + btn(c.cta, "flex:2"))),
    },

    "mobile-form": {
      name: "Mobile form", platform: "ios", w: 390, h: 844, statuses: 2,
      copy: {
        title: "New", step: "Step 2 of 3", progress: 66, heading: "Fill in the details", sub: "It takes about a minute.",
        fields: [["Amount", "250.00", "a", "Looks good"], ["Recipient", "", "b", "Enter a name"], ["Reference", "Optional"]],
        choiceLabel: "Speed", choices: ["Standard", "Fast", "Instant"], noteText: "A short reassuring note about fees, timing or privacy.", cta: "Continue",
      },
      html: (c) => F("bg", "position:relative;width:390px;height:844px;overflow:hidden",
        statusBar +
        D(row + "justify-content:space-between;padding:6px 20px 12px", I("back", "icon", 24) + T("text", "font-size:17px;font-weight:600", c.title) + T("link", "font-size:15px;font-weight:600", "Help")) +
        D("padding:0 20px", F("track", "height:6px;border-radius:3px;overflow:hidden", F("bar", "height:100%;width:" + c.progress + "%;border-radius:3px")) + T("text2", "font-size:13px;margin-top:8px", c.step)) +
        D(col + "padding:18px 20px 6px;gap:6px", T("text", "font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1.15", c.heading) + T("text2", "font-size:15px", c.sub)) +
        D(col + "padding:10px 20px 0;gap:14px", c.fields.map((f) => D(col + "gap:6px",
          T("text2", "font-size:13px;font-weight:600", f[0]) +
          L(f[2] === "b" ? "statusBLine" : "input", "border-width:1.5px;border-radius:12px", F("inputBg", "border-radius:10px;height:50px;" + row + "padding:0 14px", T(f[1] ? "text" : "text2", "font-size:16px;font-weight:" + (f[1] ? 600 : 400), f[1] || "Type here"))) +
          (f[2] === "a" ? D(row + "gap:6px", I("check", "statusA", 16) + T("statusA", "font-size:13px;font-weight:600", f[3], "text2"))
            : f[2] === "b" ? T("statusB", "font-size:13px;font-weight:600", f[3], "text2") : ""))).join("")) +
        D(col + "padding:16px 20px 0;gap:8px", T("text2", "font-size:13px;font-weight:600", c.choiceLabel) +
          D(row + "gap:8px", c.choices.map((t, i) => i === 1
            ? F("chipOn", "flex:1;text-align:center;padding:12px 0;border-radius:12px", T("chipOnText", "font-size:14px;font-weight:600", t))
            : F("chip", "flex:1;text-align:center;padding:12px 0;border-radius:12px", T("chipText", "font-size:14px;font-weight:500", t))).join(""))) +
        F("surface", "margin:16px 20px 0;border-radius:14px;padding:12px 14px;" + row + "gap:10px", I("bell", "icon", 20) + T("text2", "font-size:13px;line-height:1.4", c.noteText)) +
        btn(c.cta, "position:absolute;left:20px;right:20px;bottom:34px")),
    },

    "mobile-onboarding": {
      name: "Mobile onboarding", platform: "ios", w: 390, h: 844, statuses: 0,
      copy: { skip: "Skip", heading: "A big promise in a few words", sub: "One or two lines that tell people what they get and why it's worth it.", cta: "Get started", cta2: "I already have an account", step: 1 },
      html: (c) => F("bg", "position:relative;width:390px;height:844px;overflow:hidden",
        statusBar +
        D(row + "justify-content:flex-end;padding:4px 20px 0", T("link", "font-size:15px;font-weight:600", c.skip)) +
        F("art", "margin:16px 20px 0;height:380px;border-radius:28px;position:relative;overflow:hidden",
          F("artShape", "position:absolute;width:210px;height:210px;border-radius:50%;left:70px;top:70px") +
          F("surface", "position:absolute;left:24px;right:24px;bottom:24px;border-radius:18px;padding:14px;" + row + "gap:12px",
            F("tile", "width:40px;height:40px;border-radius:12px;" + row + "justify-content:center", I("star", "icon", 20)) +
            D(col + "gap:6px;flex:1", F("track", "height:9px;border-radius:5px;width:80%") + F("track", "height:9px;border-radius:5px;width:55%")))) +
        D(row + "justify-content:center;gap:6px;padding:22px 0 0", [0, 1, 2, 3].map((i) => F(i === c.step ? "bar" : "track", "height:8px;border-radius:4px;width:" + (i === c.step ? 24 : 8) + "px")).join("")) +
        D(col + "padding:20px 28px 0;gap:10px;text-align:center", T("text", "font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.15", c.heading) + T("text2", "font-size:16px;line-height:1.45", c.sub)) +
        D("position:absolute;left:20px;right:20px;bottom:34px;" + col + "gap:10px", btn(c.cta) + btn2(c.cta2))),
    },

    "desktop-table": {
      name: "Desktop table", platform: "web", w: 1280, h: 800, statuses: 2,
      copy: {
        workspace: "Workspace", nav: [["list", "Items"], ["home", "Inbox"], ["chart", "Reports"], ["grid", "Projects"], ["user", "Team"]],
        title: "All items", search: "Search", cta: "New item", tabs: ["All", "Active", "Done"], cols: ["Name", "Status", "Owner", "Updated"],
        rows: [["Set up billing alerts", "Done", "a"], ["Redesign the export flow", "In progress"], ["Fix login timeout", "Blocked", "b"], ["Write release notes", "Done", "a"], ["Audit team permissions", "In progress"], ["Migrate old reports", "Blocked", "b"], ["Add keyboard shortcuts", "Todo"], ["Clean up unused tags", "Done", "a"]],
      },
      html: (c) => F("bg", "position:relative;width:1280px;height:800px;overflow:hidden;display:flex",
        sideNav(c) +
        D(col + "flex:1;padding:24px 32px;gap:18px",
          D(row + "gap:14px", T("text", "font-size:24px;font-weight:700;flex:1;letter-spacing:-.01em", c.title) +
            L("input", "border-width:1px;border-radius:9px;width:260px", F("inputBg", "border-radius:8px;height:38px;" + row + "gap:8px;padding:0 12px", I("search", "icon", 16) + T("text2", "font-size:14px", c.search))) +
            F("btn", row + "gap:6px;height:38px;padding:0 16px;border-radius:9px", I("plus", "btnText", 16) + T("btnText", "font-size:14px;font-weight:600", c.cta))) +
          D(row + "gap:8px", c.tabs.map((t, i) => i === 0 ? F("chipOn", "padding:6px 14px;border-radius:8px", T("chipOnText", "font-size:13px;font-weight:600", t)) : F("chip", "padding:6px 14px;border-radius:8px", T("chipText", "font-size:13px;font-weight:500", t))).join("")) +
          F("surface", "border-radius:12px;padding:0 18px;position:relative",
            D(row + "height:44px;gap:16px", D("width:18px") + c.cols.map((h, i) => T("text2", "font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;" + (i ? "width:140px" : "flex:1"), h)).join("")) +
            c.rows.map((r, i) => L("line", "border-top-width:1px") + D(row + "height:52px;gap:16px",
              L("input", "width:18px;height:18px;border-width:1.5px;border-radius:5px") +
              T("text", "font-size:14px;font-weight:500;flex:1", r[0]) +
              D("width:140px", pill(r[2], r[1])) +
              D("width:140px;" + row + "gap:8px", F("tile", "width:24px;height:24px;border-radius:12px") + T("text2", "font-size:13px", ["Ana", "Ben", "Chen", "Dee"][i % 4])) +
              T("text2", "font-size:13px;width:140px", (i + 1) * 2 + "h ago"))).join("")))),
    },

    "desktop-dashboard": {
      name: "Desktop dashboard", platform: "web", w: 1280, h: 800, statuses: 2,
      copy: {
        workspace: "Workspace", nav: [["home", "Home"], ["chart", "Reports"], ["card", "Payments"], ["user", "Customers"], ["grid", "Settings"]],
        title: "Overview", range: "Last 30 days", cta: "Export",
        kpis: [["Revenue", "$48,210", "+8.2%", "a"], ["Customers", "1,284", "+3.1%", "a"], ["Refunds", "$1,020", "+14%", "b"], ["Avg. order", "$37.50", "−0.4%"]],
        chartTitle: "Daily volume", bars: [35, 48, 42, 60, 52, 70, 64, 58, 76, 68, 82, 74, 90, 86],
        listTitle: "Recent", list: [["Northwind Co.", "$1,240.00"], ["Acme Labs", "$860.00"], ["Blue Fern", "$420.50"], ["Oak & Iron", "$310.00"]],
      },
      html: (c) => F("bg", "position:relative;width:1280px;height:800px;overflow:hidden;display:flex",
        sideNav(c) +
        D(col + "flex:1;padding:24px 32px;gap:18px",
          D(row + "gap:12px", T("text", "font-size:24px;font-weight:700;flex:1;letter-spacing:-.01em", c.title) +
            F("chip", "padding:8px 14px;border-radius:9px", T("chipText", "font-size:13px;font-weight:500", c.range)) +
            F("btn", "height:38px;padding:0 16px;border-radius:9px;" + row, T("btnText", "font-size:14px;font-weight:600", c.cta))) +
          D(row + "gap:14px", c.kpis.map((k) => F("surface", "flex:1;border-radius:12px;padding:16px 18px;" + col + "gap:6px",
            T("text2", "font-size:13px;font-weight:500", k[0]) + T("text", "font-size:26px;font-weight:700;letter-spacing:-.01em", k[1]) +
            (k[3] === "a" ? T("statusA", "font-size:13px;font-weight:600", k[2], "text2") : k[3] === "b" ? T("statusB", "font-size:13px;font-weight:600", k[2], "text2") : T("text2", "font-size:13px;font-weight:600", k[2])))).join("")) +
          D(row + "gap:14px;align-items:stretch;flex:1",
            F("surface", "flex:2;border-radius:12px;padding:18px;" + col, T("text", "font-size:15px;font-weight:600;margin-bottom:14px", c.chartTitle) +
              D("flex:1;position:relative;" + row + "align-items:flex-end;gap:10px",
                [0, 1, 2, 3].map((i) => L("line", "position:absolute;left:0;right:0;border-top-width:1px;top:" + i * 33 + "%")).join("") +
                c.bars.map((v) => F("bar", "flex:1;border-radius:5px 5px 0 0;position:relative;height:" + v + "%")).join(""))) +
            F("surface", "flex:1;border-radius:12px;padding:18px;" + col, T("text", "font-size:15px;font-weight:600;margin-bottom:6px", c.listTitle) +
              c.list.map((r, i) => (i ? L("line", "border-top-width:1px") : "") + D(row + "gap:10px;padding:12px 0",
                F("tile", "width:32px;height:32px;border-radius:9px;" + row + "justify-content:center", I("card", "icon", 16)) +
                T("text", "font-size:14px;font-weight:500;flex:1", r[0]) + T("text", "font-size:14px;font-weight:600", r[1]))).join(""))))),
    },

    "landing-hero": {
      name: "Landing hero", platform: "web", w: 1280, h: 760, statuses: 0,
      copy: {
        brand: "Brand", links: ["Product", "Solutions", "Pricing", "Docs"], login: "Log in", navCta: "Sign up",
        eyebrow: "New", heading: "A headline that sells the whole product", sub: "One supporting sentence that says who it's for and what changes for them.",
        cta: "Get started free", cta2: "Book a demo", note: "Free for small teams. No card needed.", logos: ["Northwind", "Acme", "Globex", "Initech", "Umbrella"],
      },
      html: (c) => F("bg", "position:relative;width:1280px;height:760px;overflow:hidden",
        D(row + "gap:32px;padding:22px 64px", D(row + "gap:10px;flex:1", F("tile", "width:30px;height:30px;border-radius:8px") + T("text", "font-size:18px;font-weight:700", c.brand)) +
          c.links.map((l) => T("text2", "font-size:15px;font-weight:500", l)).join("") + T("link", "font-size:15px;font-weight:600", c.login) +
          F("btn", "padding:10px 18px;border-radius:10px", T("btnText", "font-size:14px;font-weight:600", c.navCta))) +
        L("line", "border-top-width:1px") +
        D(row + "gap:56px;padding:56px 64px 0;align-items:center",
          D(col + "flex:1;gap:20px",
            F("chip", "align-self:flex-start;padding:6px 12px;border-radius:99px", T("chipText", "font-size:13px;font-weight:600", c.eyebrow)) +
            T("text", "font-size:56px;font-weight:700;line-height:1.04;letter-spacing:-.035em", c.heading) +
            T("text2", "font-size:19px;line-height:1.5", c.sub) +
            D(row + "gap:12px;margin-top:6px", btn(c.cta, "padding:0 24px") + btn2(c.cta2, "padding:0 24px")) +
            T("text2", "font-size:13px", c.note)) +
          F("art", "width:520px;height:440px;border-radius:24px;position:relative;overflow:hidden;flex:none",
            F("artShape", "position:absolute;width:300px;height:300px;border-radius:50%;right:-60px;top:-60px") +
            F("surface", "position:absolute;left:40px;right:40px;top:70px;bottom:50px;border-radius:16px;padding:20px;" + col + "gap:12px",
              D(row + "gap:10px", F("tile", "width:34px;height:34px;border-radius:9px") + F("track", "height:10px;border-radius:5px;width:40%")) +
              [92, 78, 85, 60].map((w) => F("track", "height:10px;border-radius:5px;width:" + w + "%")).join("") +
              D(row + "gap:10px;margin-top:auto", F("bar", "height:90px;flex:1;border-radius:10px") + F("track", "height:90px;flex:1;border-radius:10px") + F("track", "height:90px;flex:1;border-radius:10px"))))) +
        D(row + "gap:56px;padding:44px 64px 0;justify-content:space-between", c.logos.map((l) => T("text2", "font-size:20px;font-weight:700;letter-spacing:-.02em", l)).join(""))),
    },

    pricing: {
      name: "Pricing section", platform: "web", w: 1280, h: 820, statuses: 0,
      copy: {
        eyebrow: "Pricing", heading: "Plans that grow with you", sub: "Start free. Upgrade when your team needs more.", toggle: ["Monthly", "Yearly"],
        plans: [["Free", "$0", "For trying it out", ["Up to 3 projects", "Basic sharing", "Community help"], "Start free"],
          ["Pro", "$12", "For growing teams", ["Unlimited projects", "Advanced sharing", "Version history", "Priority help"], "Get Pro"],
          ["Business", "$45", "For larger companies", ["Everything in Pro", "Admin controls", "SSO", "Audit log"], "Contact sales"]],
        popular: "Most popular", per: "per user / month",
      },
      html: (c) => F("bg", "position:relative;width:1280px;height:820px;overflow:hidden;" + col + "align-items:center;padding-top:56px",
        F("chip", "padding:6px 12px;border-radius:99px", T("chipText", "font-size:13px;font-weight:600", c.eyebrow)) +
        T("text", "font-size:48px;font-weight:700;letter-spacing:-.03em;margin-top:16px", c.heading) +
        T("text2", "font-size:18px;margin-top:10px", c.sub) +
        F("track", "margin-top:24px;border-radius:12px;padding:4px;" + row, F("chipOn", "padding:8px 18px;border-radius:9px", T("chipOnText", "font-size:14px;font-weight:600", c.toggle[0])) + D("padding:8px 18px", T("text2", "font-size:14px;font-weight:500", c.toggle[1]))) +
        D(row + "gap:20px;margin-top:36px;align-items:stretch", c.plans.map((p, i) => {
          const inner = D(col + "gap:8px;padding:28px;height:100%",
            D(row + "justify-content:space-between", T("text", "font-size:20px;font-weight:700", p[0]) + (i === 1 ? F("badge", "padding:4px 10px;border-radius:99px", T("badgeText", "font-size:12px;font-weight:700", c.popular)) : "")) +
            T("text2", "font-size:14px", p[2]) +
            D(row + "align-items:baseline;gap:6px;margin:10px 0 6px", T("text", "font-size:44px;font-weight:700;letter-spacing:-.03em", p[1]) + T("text2", "font-size:13px", c.per)) +
            (i === 1 ? btn(p[4], "height:46px") : btn2(p[4], "height:46px")) +
            L("line", "border-top-width:1px;margin:14px 0 6px") +
            p[3].map((f) => D(row + "gap:10px;padding:5px 0", I("check", "icon", 18) + T("text", "font-size:14px", f))).join(""));
          return i === 1
            ? L("frame", "width:340px;border-width:2px;border-radius:22px", F("surface", "border-radius:20px;height:100%", inner))
            : F("surface", "width:340px;border-radius:20px;margin:2px 0", inner);
        }).join(""))),
    },
  };

  // The roles a template uses, given how many statuses the brief has.
  function render(id, brief) {
    const t = TEMPLATES[id];
    const c = Object.assign({}, t.copy, brief.copy || {});
    const wrap = document.createElement("div");
    wrap.innerHTML = t.html(c);
    const root = wrap.firstElementChild;
    const statuses = (brief.statuses || []).length;
    root.querySelectorAll("[data-r]").forEach((el, i) => {
      let r = el.dataset.r;
      const def = ROLES[r];
      if (def && def.status && (def.status === "a" ? statuses < 1 : statuses < 2)) {
        r = el.dataset.fb || (def.kind === "line" ? "input" : def.kind === "fill" ? "chip" : "text2");
        el.dataset.r = r;
      }
      el.dataset.el = "e" + i;
    });
    return root;
  }

  function roleLabel(r, brief) {
    const def = ROLES[r];
    if (!def) return r;
    if (def.status) {
      const name = (brief.statuses || [])[def.status === "a" ? 0 : 1] || "Status";
      return name + (def.kind === "fill" ? " · pill" : def.kind === "line" ? " · outline" : " · text");
    }
    return def.label;
  }

  window.PDTemplates = { ROLES, TEMPLATES, render, roleLabel };
})();
