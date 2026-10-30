(function () {
  "use strict";

  var ethers = window.ethers;
  var C = window.APP_CONFIG;
  var A = window.ARTIFACTS;

  var CHAIN = {
    id: 968,
    hex: "0x3c8",
    name: "BOT Chain Testnet",
    rpc: "https://rpc.bohr.life",
    explorer: "https://scan.botchain.ai",
    currency: { name: "BOT", symbol: "BOT", decimals: 18 }
  };

  var KEY = "botchain968:" + C.slug;
  var $ = function (s) { return document.querySelector(s); };

  var account = null, signer = null, mainAddr = "";
  try { mainAddr = localStorage.getItem(KEY) || ""; } catch (e) {}
  if (!mainAddr) mainAddr = C.address || "";

  var readProvider = new ethers.JsonRpcProvider(CHAIN.rpc, CHAIN.id, {
    staticNetwork: ethers.Network.from(CHAIN.id)
  });

  // ── Helpers ──────────────────────────────────────────────
  function h(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }

  var short = function (a) { return a.slice(0, 6) + "\u2026" + a.slice(-4); };
  var addrLink = function (a) {
    return h("a", {
      href: CHAIN.explorer + "/address/" + a,
      target: "_blank", rel: "noopener",
      class: "mono", text: short(a)
    });
  };

  function units(v) {
    var s = ethers.formatUnits(v, 18).split(".");
    var d = (s[1] || "").slice(0, 4).replace(/0+$/, "");
    return BigInt(s[0]).toLocaleString("en-US") + (d ? "." + d : "");
  }

  function fmt(kind, v) {
    if (v === undefined || v === null) return "\u2014";
    switch (kind) {
      case "token": return units(v);
      case "bps": return (Number(v) / 100).toFixed(1) + "%";
      case "ratio": return v >= (2n ** 200n) ? "\u221e" : Number(ethers.formatUnits(v, 18)).toFixed(3);
      case "time": return v === 0n ? "\u2014" : new Date(Number(v) * 1000).toLocaleString();
      case "bool": return v ? "Yes" : "No";
      case "list": return v.length ? Array.prototype.map.call(v, String).join(", ") : "none";
      default: return String(v);
    }
  }

  function fmtNamed(name, v) {
    if (typeof v === "bigint") {
      if (C.enums && C.enums[name]) return C.enums[name][Number(v)] || String(v);
      if ((C.amountFields || []).indexOf(name) > -1) return units(v);
      if ((C.timeFields || []).indexOf(name) > -1) return fmt("time", v);
      return String(v);
    }
    if (typeof v === "boolean") return fmt("bool", v);
    if (typeof v === "string" && ethers.isAddress(v)) return addrLink(v);
    if (v && typeof v === "object" && v.length !== undefined)
      return Array.prototype.map.call(v, String).join(", ") || "none";
    return String(v);
  }

  // ── Toast ────────────────────────────────────────────────
  function toast(msg, opts) {
    opts = opts || {};
    var box = $("#status");
    var d = h("div", { class: opts.err ? "err" : "" }, msg);
    if (opts.hash) {
      d.appendChild(document.createTextNode(" "));
      d.appendChild(h("a", {
        href: CHAIN.explorer + "/tx/" + opts.hash,
        target: "_blank", rel: "noopener", text: "view tx"
      }));
    }
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    if (!opts.sticky)
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, opts.err ? 9000 : 5000);
    return d;
  }
  var errText = function (e) {
    return (e && (e.shortMessage || e.reason || (e.info && e.info.error && e.info.error.message) || e.message)) || String(e);
  };

  // ── Wallet ───────────────────────────────────────────────
  async function switchChain(quiet) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN.hex }]
      });
    } catch (e) {
      if (e && (e.code === 4902 || e.code === -32603 || /unrecognized|not been added/i.test(e.message || ""))) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN.hex,
              chainName: CHAIN.name,
              nativeCurrency: CHAIN.currency,
              rpcUrls: [CHAIN.rpc],
              blockExplorerUrls: [CHAIN.explorer]
            }]
          });
        } catch (e2) { if (!quiet) throw e2; }
      } else if (e && e.code === 4001) {
        if (!quiet) throw e;
      } else { if (!quiet) throw e; }
    }
  }

  async function connect(quiet) {
    if (!window.ethereum) {
      if (!quiet) throw new Error("No wallet found. Install MetaMask or another EVM wallet, then reload.");
      return;
    }
    try {
      var accounts = await window.ethereum.request({
        method: quiet ? "eth_accounts" : "eth_requestAccounts"
      });
      if (!accounts || !accounts.length) return;
      await switchChain(quiet);
      signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      account = await signer.getAddress();
      await refreshBadge();
      await refreshAll();
    } catch (e) {
      if (!quiet) throw e;
    }
  }

  async function ensureWallet() {
    if (!signer) await connect(false);
    var id = await window.ethereum.request({ method: "eth_chainId" });
    if (parseInt(id, 16) !== CHAIN.id) {
      await switchChain(false);
      signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
    }
  }

  async function refreshBadge() {
    var b = $("#netBadge"), btn = $("#connectBtn");
    if (!account) {
      b.textContent = "Not connected"; b.className = "badge";
      btn.textContent = "Connect wallet"; return;
    }
    var id = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
    btn.textContent = short(account);
    if (id === CHAIN.id) { b.textContent = CHAIN.name + " (968)"; b.className = "badge ok"; }
    else { b.textContent = "Wrong network (" + id + ")"; b.className = "badge bad"; }
  }

  function runner() { return signer || readProvider; }
  function mainC() { return new ethers.Contract(mainAddr, A.main.abi, runner()); }
  function tokenC(addr) { return new ethers.Contract(addr, A.token.abi, runner()); }

  async function send(label, call) {
    await ensureWallet();
    var t = toast(label + ": confirm in your wallet\u2026", { sticky: true });
    try {
      var tx = await call();
      t.remove();
      var p = toast(label + ": pending\u2026", { sticky: true, hash: tx.hash });
      await tx.wait();
      p.remove();
      toast(label + " confirmed \u2713", { hash: tx.hash });
      await refreshAll();
    } catch (e) {
      t.remove();
      toast(label + " failed: " + errText(e), { err: true });
    }
  }

  // ── Inputs ───────────────────────────────────────────────
  function field(inp) {
    var id = "f_" + inp.id, ctl;
    if (inp.type === "bool") {
      ctl = h("select", { id: id });
      (inp.options || [["true", "Yes"], ["false", "No"]]).forEach(function (o) {
        ctl.appendChild(h("option", { value: o[0], text: o[1] }));
      });
    } else {
      ctl = h("input", {
        id: id,
        autocomplete: "off",
        inputmode: (inp.type === "amount" || inp.type === "uint" || inp.type === "days" || inp.type === "daysFromNow") ? "decimal" : "text",
        placeholder: inp.placeholder || (inp.type === "address" ? (inp.meDefault ? "0x\u2026 (blank = you)" : "0x\u2026") : ""),
        value: inp.default != null ? inp.default : ""
      });
    }
    return h("label", {}, h("span", { text: inp.label }), ctl);
  }

  function parse(inp, form) {
    var el = form.querySelector("#f_" + inp.id), v = (el.value || "").trim();
    if (inp.type === "bool") return v === "true";
    if (v === "" && !(inp.type === "address" && inp.meDefault)) throw new Error(inp.label + " is required");
    switch (inp.type) {
      case "amount": return ethers.parseUnits(v, 18);
      case "uint": return BigInt(v);
      case "days": return BigInt(v) * 86400n;
      case "daysFromNow": return BigInt(Math.floor(Date.now() / 1000)) + BigInt(v) * 86400n;
      case "address":
        if (v === "" || v.toLowerCase() === "me") {
          if (!account) throw new Error("Connect your wallet first");
          return account;
        }
        if (!ethers.isAddress(v)) throw new Error(inp.label + " is not a valid address");
        return v;
      default: return v;
    }
  }

  // ── Sections ─────────────────────────────────────────────
  function renderResult(fnName, res) {
    var outs = mainC().interface.getFunction(fnName).outputs;
    var dl = h("dl", { class: "kv" });
    if (outs.length === 1) {
      var d = h("dd"); d.append(fmtNamed(outs[0].name, res));
      dl.appendChild(h("dt", { text: outs[0].name || "result" })); dl.appendChild(d);
    } else {
      outs.forEach(function (o, i) {
        var d2 = h("dd"); d2.append(fmtNamed(o.name, res[i]));
        dl.appendChild(h("dt", { text: o.name || "#" + i })); dl.appendChild(d2);
      });
    }
    return dl;
  }

  function renderActions() {
    var box = $("#actions"); box.innerHTML = "";
    (C.actions || []).forEach(function (a) {
      var form = h("form", {},
        h("h3", { text: a.title }),
        a.desc ? h("p", { class: "desc", text: a.desc }) : null
      );
      var row = h("div", { class: "row" });
      (a.inputs || []).forEach(function (i) { row.appendChild(field(i)); });
      form.appendChild(row);
      var btn = h("button", { class: "btn primary", type: "submit", text: a.button || a.title });
      form.appendChild(btn);
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault(); btn.disabled = true;
        try {
          var args = (a.inputs || []).map(function (i) { return parse(i, form); });
          if (!mainAddr) throw new Error("Deploy or enter the contract address first");
          await send(a.title, function () { return mainC()[a.fn].apply(null, args); });
        } catch (e) { toast(errText(e), { err: true }); }
        btn.disabled = false;
      });
      box.appendChild(h("div", { class: "act" }, form));
    });
  }

  function renderViews() {
    var box = $("#views"); box.innerHTML = "";
    (C.views || []).forEach(function (v) {
      var out = h("div");
      var form = h("form", {},
        h("h3", { text: v.title }),
        v.desc ? h("p", { class: "desc", text: v.desc }) : null
      );
      var row = h("div", { class: "row" });
      (v.inputs || []).forEach(function (i) { row.appendChild(field(i)); });
      form.appendChild(row);
      var btn = h("button", { class: "btn ghost", type: "submit", text: v.button || "Look up" });
      form.appendChild(btn); form.appendChild(out);
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault(); out.innerHTML = "";
        try {
          if (!mainAddr) throw new Error("Deploy or enter the contract address first");
          var args = (v.inputs || []).map(function (i) { return parse(i, form); });
          var res = await mainC()[v.fn].apply(null, args);
          out.appendChild(renderResult(v.fn, res));
        } catch (e) { out.appendChild(h("p", { class: "desc", text: errText(e) })); }
      });
      box.appendChild(h("div", { class: "qry" }, form));
    });
  }

  // ── Stats with animated ring ──────────────────────────────
  var prevRatio = null;
  async function renderStats() {
    var box = $("#stats"); box.innerHTML = "";
    if (!mainAddr) {
      box.appendChild(h("div", { class: "empty-state" }, "No contract connected. Deploy or set an address to see live stats."));
      return;
    }
    var c = mainC();
    await Promise.all((C.stats || []).map(async function (s) {
      var isGold = s.label.indexOf("Price") > -1 || s.label.indexOf("GGOLD") > -1 || s.label.indexOf("reserve") > -1 || s.label.indexOf("ratio") > -1;
      var cell = h("div", { class: "stat" },
        h("div", { class: "stat-label", text: s.label }),
        h("div", { class: "stat-value loading" + (isGold ? " gold" : ""), text: "\u2026" })
      );
      box.appendChild(cell);
      try {
        if ((s.args || []).indexOf("me") > -1 && !account) {
          cell.lastChild.textContent = "Connect wallet"; return;
        }
        var res = await c[s.fn].apply(null, (s.args || []).map(function (x) { return x === "me" ? account : x; }));
        if (s.pick) res = res[s.pick];
        cell.lastChild.textContent = fmt(s.fmt, res);
        cell.lastChild.classList.remove("loading");

        if (s.fn === "backingRatioBps") {
          animateRing(Number(res));
        }
      } catch (e) {
        cell.lastChild.textContent = "n/a";
        cell.lastChild.classList.remove("loading");
      }
    }));
  }

  function animateRing(bps) {
    var pct = Math.min(100, Math.max(0, bps / 100));
    var ring = document.getElementById("ringFill");
    var val = document.getElementById("ringValue");
    var sub = document.getElementById("ringSub");
    if (!ring) return;
    var circ = 534; // 2 * PI * 85
    ring.style.strokeDashoffset = String(circ - (circ * pct / 100));
    if (val) val.textContent = pct.toFixed(1) + "%";
    if (sub) sub.textContent = bps >= 10000 ? "fully backed" : bps > 0 ? "partially backed" : "unbacked";
  }

  // ── Reserve trail ─────────────────────────────────────────
  async function renderReserveTrail() {
    var body = $("#reserveBody");
    if (!mainAddr) {
      body.innerHTML = '<div class="empty-state">No contract connected. Deploy or set an address to load the reserve trail.</div>';
      return;
    }
    body.innerHTML = '<div class="empty-state">Loading reserve records\u2026</div>';
    try {
      var c = mainC();
      var count;
      try {
        count = Number(await c.reserveCount());
      } catch (e) {
        body.innerHTML = '<div class="empty-state">Could not read reserve count (contract may not be deployed at the configured address).</div>';
        return;
      }
      if (count === 0) {
        body.innerHTML = '<div class="empty-state">No reserve records published yet. The admin can publish one from the Actions panel.</div>';
        return;
      }
      var list = h("div", { class: "reserve-list" });
      var max = Math.min(count, 10);
      for (var i = count - 1; i >= count - max; i--) {
        try {
          var r = await c.reserves(i);
          var grams = r[0], timestamp = r[1], ref = r[2];
          var item = h("div", { class: "reserve-item" },
            h("div", { class: "reserve-grams", text: units(grams) + " g" }),
            h("div", { class: "reserve-meta" },
              h("div", { class: "reserve-ref", text: String(ref) }),
              h("div", { class: "reserve-time", text: Number(timestamp) === 0 ? "pending" : new Date(Number(timestamp) * 1000).toLocaleString() })
            ),
            h("div", { class: "reserve-badge", text: "#" + (i + 1) })
          );
          list.appendChild(item);
        } catch (e) { /* skip */ }
      }
      body.innerHTML = "";
      body.appendChild(list);
    } catch (e) {
      body.innerHTML = '<div class="empty-state">Error loading reserves: ' + errText(e) + "</div>";
    }
  }

  // ── Tokens ────────────────────────────────────────────────
  async function renderTokens() {
    var box = $("#tokens"); box.innerHTML = "";
    if (!mainAddr || !(C.tokens || []).length) { box.style.display = "none"; return; }
    box.style.display = "";
    var head = h("div", { class: "card-head" }, h("h3", { text: "Test tokens" }));
    var body = h("div", { class: "tokens-body" });
    body.appendChild(h("p", { class: "desc", text: "Get free test tokens, then approve this app to spend them before minting or redeeming." }));
    box.appendChild(head);
    for (var i = 0; i < C.tokens.length; i++) {
      try {
        var addr = await mainC()[C.tokens[i]]();
        var t = tokenC(addr), sym = await t.symbol();
        var bal = account ? await t.balanceOf(account) : null;
        var al = account ? await t.allowance(account, mainAddr) : null;
        var row = h("div", { class: "tok" },
          h("span", { class: "n", text: sym }),
          h("span", { class: "m" },
            addrLink(addr),
            account ? "  \u00b7 balance " + units(bal) + " \u00b7 approved " + (al > 2n ** 200n ? "unlimited" : units(al)) : "  \u00b7 connect wallet to see balance"
          )
        );
        var btnGroup = h("div", { class: "tok-btns" });
        (function (t, sym) {
          btnGroup.appendChild(h("button", { class: "btn ghost sm", type: "button", text: "Get 1,000 " + sym, onclick: function () { send("Faucet " + sym, function () { return t.faucet(); }); } }));
          btnGroup.appendChild(h("button", { class: "btn ghost sm", type: "button", text: "Approve " + sym, onclick: function () { send("Approve " + sym, function () { return t.approve(mainAddr, ethers.MaxUint256); }); } }));
        })(t, sym);
        row.appendChild(btnGroup);
        body.appendChild(row);
      } catch (e) {
        body.appendChild(h("p", { class: "desc", text: "Could not read token " + C.tokens[i] + ": " + errText(e) }));
      }
    }
    box.appendChild(body);
  }

  // ── Refresh all ───────────────────────────────────────────
  async function refreshAll() {
    if (mainAddr && mainAddr !== "0x0000000000000000000000000000000000000000") {
      try {
        if ((await readProvider.getCode(mainAddr)) === "0x")
          toast("No contract found at that address on BOT Chain testnet.", { err: true });
      } catch (e) {}
    }
    await Promise.all([renderStats(), renderTokens(), renderReserveTrail()]);
  }

  // ── Deploy ────────────────────────────────────────────────
  async function deployAll() {
    try {
      await ensureWallet();
      var addrs = [], d = C.deploy;
      for (var i = 0; i < d.tokens.length; i++) {
        var t = d.tokens[i], m = toast("Deploying " + t.symbol + " (confirm in wallet)\u2026", { sticky: true });
        var tf = new ethers.ContractFactory(A.token.abi, A.token.bytecode, signer);
        var tc = await tf.deploy(t.name, t.symbol);
        await tc.waitForDeployment();
        addrs.push(await tc.getAddress());
        m.remove();
      }
      var args = d.args.map(function (a) {
        return typeof a === "string" && a.indexOf("$t") === 0 ? addrs[Number(a.slice(2))] : (a === "$me" ? account : a);
      });
      var m2 = toast("Deploying " + C.name + " (confirm in wallet)\u2026", { sticky: true });
      var f = new ethers.ContractFactory(A.main.abi, A.main.bytecode, signer);
      var c = await f.deploy.apply(f, args);
      await c.waitForDeployment();
      mainAddr = await c.getAddress(); m2.remove();
      try { localStorage.setItem(KEY, mainAddr); } catch (e) {}
      toast(C.name + " deployed at " + short(mainAddr) + " \u2713");
      hideDeployBar();
      await refreshAll();
    } catch (e) { toast("Deploy failed: " + errText(e), { err: true }); }
  }

  function showDeployBar() { $("#deployBar").classList.add("show"); }
  function hideDeployBar() { $("#deployBar").classList.remove("show"); }

  // ── Scroll helper ─────────────────────────────────────────
  window.scrollToSection = function (id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Boot ──────────────────────────────────────────────────
  document.title = C.name + " \u00b7 BOT Chain Testnet";
  document.documentElement.style.setProperty("--accent", C.accent);
  document.documentElement.style.setProperty("--gold", C.accent);
  $("#appName").textContent = C.name;
  $("#tagline").textContent = C.tagline;
  if (C.about) $("#heroAbout").textContent = C.about;

  $("#connectBtn").addEventListener("click", function () {
    connect(false).catch(function (e) { toast(errText(e), { err: true }); });
  });

  $("#deployBtn").addEventListener("click", deployAll);
  $("#refreshReserveBtn").addEventListener("click", renderReserveTrail);

  if (window.ethereum) {
    if (window.ethereum.on) {
      window.ethereum.on("accountsChanged", function () { signer = null; account = null; refreshBadge(); refreshAll(); });
      window.ethereum.on("chainChanged", function () { window.location.reload(); });
    }
    connect(true).catch(function () {});
  }

  renderActions(); renderViews();

  if (!mainAddr || mainAddr === "0x0000000000000000000000000000000000000000") {
    showDeployBar();
    renderStats();
    renderReserveTrail();
  } else {
    refreshAll();
  }
})();
