(function () {
  "use strict";
  var ethers = window.ethers, C = window.APP_CONFIG, A = window.ARTIFACTS;
  var CHAIN = { id: 677, hex: "0x2a5", name: "BOT Chain Mainnet", rpc: "https://rpc.botchain.ai", explorer: "https://scan.botchain.ai", currency: { name: "BOT", symbol: "BOT", decimals: 18 } };
  var $ = function (s) { return document.querySelector(s); };
  var account = null, isOwner = false, txBusy = false, mainAddr = C.address;
  var readProvider = new ethers.JsonRpcProvider(CHAIN.rpc, CHAIN.id, { staticNetwork: ethers.Network.from(CHAIN.id) });
  var vault = new ethers.Contract(mainAddr, A.main.abi, readProvider);

  // ---------- helpers ----------
  function h(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null) continue; n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
    return n;
  }
  var short = function (a) { return a.slice(0, 6) + "…" + a.slice(-4); };
  function units(v) {
    var s = ethers.formatUnits(v, 18).split("."), d = (s[1] || "").slice(0, 4).replace(/0+$/, "");
    return BigInt(s[0]).toLocaleString("en-US") + (d ? "." + d : "");
  }
  function fmt(kind, v) {
    if (v === undefined || v === null) return "—";
    switch (kind) {
      case "bot": return units(v) + " BOT";
      case "grams": return units(v) + " g";
      case "bps": return (Number(v) / 100).toFixed(2) + "%";
      default: return String(v);
    }
  }
  var errText = function (e) { return (e && (e.shortMessage || e.reason || (e.info && e.info.error && e.info.error.message) || e.message)) || String(e); };
  function cleanRevert(e) {
    var m = errText(e), r = m.match(/reverted(?: with reason string)?:?\s*"?([^"\n]+)"?/i);
    return r ? r[1].trim() : m;
  }
  function withTimeout(p, ms, msg) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(msg)); }, ms); })]);
  }
  function safeUrl(u) {
    try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : ""; } catch (e) { return ""; }
  }

  window.scrollToSection = function (id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---------- toasts ----------
  function toast(msg, opts) {
    opts = opts || {};
    var box = $("#status"), d = h("div", { class: opts.err ? "err" : "" }, msg);
    if (opts.hash) { d.appendChild(document.createTextNode(" ")); d.appendChild(h("a", { href: CHAIN.explorer + "/tx/" + opts.hash, target: "_blank", rel: "noopener", text: "view tx" })); }
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    if (!opts.sticky) setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, opts.err ? 8000 : 5000);
    return d;
  }

  // ---------- wallet ----------
  async function switchChain() {
    var id = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
    if (id === CHAIN.id) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hex }] });
    } catch (e) {
      if (e && (e.code === 4902 || e.code === -32603 || /unrecognized|not been added/i.test(e.message || ""))) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN.hex, chainName: CHAIN.name, nativeCurrency: CHAIN.currency, rpcUrls: [CHAIN.rpc], blockExplorerUrls: [CHAIN.explorer] }] });
      } else throw e;
    }
  }

  async function connect(quiet) {
    if (!window.ethereum) {
      if (!quiet) throw new Error("No wallet found. Install MetaMask or another EVM wallet, then reload.");
      return;
    }
    var accounts = await withTimeout(
      window.ethereum.request({ method: quiet ? "eth_accounts" : "eth_requestAccounts" }),
      quiet ? 5000 : 60000,
      "Wallet did not respond. Open MetaMask from the toolbar and clear pending requests."
    );
    if (!accounts || !accounts.length) return;
    account = ethers.getAddress(accounts[0]);
    try { isOwner = (await vault.owner()).toLowerCase() === account.toLowerCase(); } catch (e) { isOwner = false; }
    await refreshBadge();
    renderActions();
    await refreshAll();
    if (!quiet) {
      // Switch network in the background so a hidden prompt can't freeze connect
      withTimeout(switchChain(), 60000, "switch").then(refreshBadge)
        .catch(function () { toast("Switch your wallet to BOT Chain (677) before sending transactions", { err: true }); });
    }
  }

  async function refreshBadge() {
    var b = $("#netBadge"), btn = $("#connectBtn");
    if (!account) { b.textContent = "Not connected"; b.className = "badge"; btn.textContent = "Connect wallet"; return; }
    btn.textContent = short(account);
    try {
      var id = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
      if (id === CHAIN.id) { b.textContent = CHAIN.name + " (677)"; b.className = "badge ok"; }
      else { b.textContent = "Wrong network (" + id + ")"; b.className = "badge bad"; }
    } catch (e) {}
  }

  // Estimate on our own RPC (reverts show the contract's message), then hand the wallet a complete tx
  async function send(label, fn, args, value) {
    if (!account) await connect(false);
    if (!account) throw new Error("Connect your wallet first");
    if (txBusy) throw new Error("Another transaction is still pending");
    txBusy = true;
    var t = null, p = null;
    try {
      await withTimeout(switchChain(), 60000, "Approve the switch to BOT Chain in your wallet");
      value = value || 0n;
      var data = vault.interface.encodeFunctionData(fn, args || []);
      var gas;
      try { gas = await readProvider.estimateGas({ from: account, to: mainAddr, data: data, value: value }); }
      catch (e) { throw new Error(cleanRevert(e)); }
      t = toast(label + ": confirm in your wallet…", { sticky: true });
      var hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: mainAddr, data: data, value: ethers.toQuantity(value), gas: ethers.toQuantity(gas * 12n / 10n) }]
      });
      t.remove(); t = null;
      p = toast(label + ": pending…", { sticky: true, hash: hash });
      var r = await readProvider.waitForTransaction(hash, 1, 180000);
      p.remove(); p = null;
      if (!r) throw new Error("not confirmed within 3 minutes, check the explorer");
      if (r.status !== 1) throw new Error("transaction reverted");
      toast(label + " confirmed ✓", { hash: hash });
      await refreshAll();
    } catch (e) {
      if (t) t.remove(); if (p) p.remove();
      throw new Error(label + " failed: " + errText(e));
    } finally { txBusy = false; }
  }

  // ---------- inputs ----------
  function field(inp) {
    var numeric = inp.type === "grams" || inp.type === "bot";
    var ph = inp.placeholder || (inp.type === "address" ? (inp.meDefault ? "0x… (blank = you)" : "0x…") : "");
    var ctl = h("input", { id: "f_" + inp.id, autocomplete: "off", inputmode: numeric ? "decimal" : "text", placeholder: ph, value: inp.default != null ? inp.default : "" });
    return h("label", {}, inp.label, ctl);
  }

  function parse(inp, form) {
    var v = (form.querySelector("#f_" + inp.id).value || "").trim();
    if (v === "" && !(inp.type === "address" && inp.meDefault)) throw new Error(inp.label + " is required");
    switch (inp.type) {
      case "grams":
      case "bot":
        var n = ethers.parseUnits(v, 18);
        if (n <= 0n) throw new Error(inp.label + " must be greater than 0");
        return n;
      case "address":
        if (v === "" || v.toLowerCase() === "me") { if (!account) throw new Error("Connect your wallet first"); return account; }
        if (!ethers.isAddress(v)) throw new Error(inp.label + " is not a valid address");
        if (BigInt(v) === 0n) throw new Error("Sending to the zero address would burn the tokens");
        return v;
      default: return v;
    }
  }

  // ---------- sections ----------
  function renderActions() {
    var box = $("#actions"); box.innerHTML = "";
    (C.actions || []).filter(function (a) { return !a.owner || isOwner; }).forEach(function (a) {
      var form = h("form", {}, h("h3", { text: a.title }), a.desc ? h("p", { class: "desc", text: a.desc }) : null);
      var row = h("div", { class: "row" });
      (a.inputs || []).forEach(function (i) { row.appendChild(field(i)); });
      form.appendChild(row);
      var btn = h("button", { class: "btn primary", type: "submit", text: a.button || a.title });
      form.appendChild(btn);
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault(); btn.disabled = true;
        try {
          var vals = (a.inputs || []).map(function (i) { return parse(i, form); });
          var args = [], value = 0n;
          (a.inputs || []).forEach(function (i, k) { if (a.valueInput === i.id) value = vals[k]; else args.push(vals[k]); });
          if (a.cost === "mint") {
            // The contract requires exactly grams × pricePerGram / 1e18
            value = args[0] * (await vault.pricePerGram()) / (10n ** 18n);
            if (!confirm("Mint " + units(args[0]) + " GGOLD for " + units(value) + " BOT?")) { btn.disabled = false; return; }
          }
          if (a.fn === "redeem") {
            var payout = args[0] * (await vault.pricePerGram()) / (10n ** 18n);
            if (!confirm("Redeem " + units(args[0]) + " GGOLD for " + units(payout) + " BOT?")) { btn.disabled = false; return; }
          }
          await send(a.title, a.fn, args, value);
        } catch (e) { toast(errText(e), { err: true }); }
        btn.disabled = false;
      });
      box.appendChild(h("div", { class: "card act" }, form));
    });
  }

  function renderViews() {
    var box = $("#views"); box.innerHTML = "";
    (C.views || []).forEach(function (v) {
      var out = h("div"), form = h("form", {}, h("h3", { text: v.title }), v.desc ? h("p", { class: "desc", text: v.desc }) : null);
      var row = h("div", { class: "row" });
      (v.inputs || []).forEach(function (i) { row.appendChild(field(i)); });
      form.appendChild(row);
      var btn = h("button", { class: "btn", type: "submit", text: v.button || "Look up" });
      form.appendChild(btn); form.appendChild(out);
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault(); out.innerHTML = "";
        try {
          var args = (v.inputs || []).map(function (i) { return parse(i, form); });
          var res = v.fn === "__quote"
            ? args[0] * (await vault.pricePerGram()) / (10n ** 18n)
            : await vault[v.fn].apply(null, args);
          out.appendChild(h("dl", { class: "kv" }, h("dt", { text: "Result" }), h("dd", { text: fmt(v.fmt, res) })));
        } catch (e) { out.appendChild(h("p", { class: "desc", text: errText(e) })); }
      });
      box.appendChild(h("div", { class: "card qry" }, form));
    });
  }

  async function renderStats() {
    var box = $("#stats"); box.innerHTML = "";
    await Promise.all((C.stats || []).map(async function (s) {
      var cell = h("div", { class: "stat" }, h("span", { text: s.label }), h("b", { text: "…" }));
      box.appendChild(cell);
      try {
        if ((s.args || []).indexOf("me") > -1 && !account) { cell.lastChild.textContent = "Connect wallet"; return; }
        var res = s.fn === "__balance"
          ? await readProvider.getBalance(mainAddr)
          : await vault[s.fn].apply(null, (s.args || []).map(function (x) { return x === "me" ? account : x; }));
        cell.lastChild.textContent = fmt(s.fmt, res);
      } catch (e) { cell.lastChild.textContent = "n/a"; }
    }));
  }

  async function renderRing() {
    var fill = document.getElementById("ringFill"), val = $("#ringValue"), sub = $("#ringSub");
    try {
      var bps = Number(await vault.backingRatioBps());
      var supply = await vault.totalSupply();
      var circ = 2 * Math.PI * 85;
      var pct = Math.min(bps / 10000, 1);
      fill.style.strokeDasharray = circ;
      fill.style.strokeDashoffset = circ * (1 - pct);
      val.textContent = (bps / 100).toFixed(1) + "%";
      sub.textContent = supply === 0n ? "no GGOLD minted yet" : (bps >= 10000 ? "fully backed" : "under-backed");
    } catch (e) {
      val.textContent = "—"; sub.textContent = "could not reach BOT Chain";
    }
  }

  async function renderReserves() {
    var body = $("#reserveBody");
    try {
      var n = Number(await vault.reserveCount());
      if (!n) { body.innerHTML = '<div class="empty-state">No reserve records published yet.</div>'; return; }
      var ids = Array.from({ length: n }, function (_, i) { return i; }).reverse().slice(0, 50);
      var rows = await Promise.all(ids.map(function (i) { return vault.reserves(i); }));
      body.innerHTML = "";
      rows.forEach(function (r, k) {
        var ref = r.ref || "", url = safeUrl(ref);
        if (!url && /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]+)$/.test(ref)) url = "https://ipfs.io/ipfs/" + ref;
        body.appendChild(h("div", { class: "reserve-row" },
          h("b", { text: "#" + ids[k] + " · " + fmt("grams", r.grams) }),
          h("span", { class: "desc", text: " — " + new Date(Number(r.timestamp) * 1000).toLocaleString() + " — " }),
          url ? h("a", { href: url, target: "_blank", rel: "noopener", text: ref.length > 40 ? ref.slice(0, 40) + "…" : ref })
              : h("span", { text: ref || "no reference" })
        ));
      });
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(h("div", { class: "empty-state", text: "Could not load reserves: " + errText(e) }));
    }
  }

  async function renderTokens() {
    var box = $("#tokens"); box.innerHTML = "";
    box.appendChild(h("h3", { text: "Your GGOLD" }));
    if (!account) { box.appendChild(h("p", { class: "desc", text: "Connect your wallet to see your balance." })); return; }
    try {
      var bal = await vault.balanceOf(account);
      box.appendChild(h("p", { class: "desc", text: "Balance: " + fmt("grams", bal) + " · token " }, h("a", { href: CHAIN.explorer + "/address/" + mainAddr, target: "_blank", rel: "noopener", text: short(mainAddr) })));
      box.appendChild(h("button", { class: "btn ghost sm", type: "button", text: "Add GGOLD to wallet", onclick: function () {
        window.ethereum.request({ method: "wallet_watchAsset", params: { type: "ERC20", options: { address: mainAddr, symbol: "GGOLD", decimals: 18 } } })
          .catch(function (e) { toast(errText(e), { err: true }); });
      } }));
    } catch (e) { box.appendChild(h("p", { class: "desc", text: "Could not read balance: " + errText(e) })); }
  }

  async function refreshAll() {
    try { if ((await readProvider.getCode(mainAddr)) === "0x") toast("No contract found at this address on BOT Chain mainnet.", { err: true }); } catch (e) {}
    await Promise.all([renderStats(), renderRing(), renderReserves(), renderTokens()]);
  }

  // ---------- boot ----------
  document.title = C.name + " · BOT Chain";
  $("#appName").textContent = C.name;
  $("#tagline").textContent = C.tagline;

  $("#connectBtn").addEventListener("click", function () {
    connect(false).catch(function (e) { toast(errText(e), { err: true }); });
  });
  $("#refreshReserveBtn").addEventListener("click", renderReserves);

  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on("accountsChanged", function () { window.location.reload(); });
    window.ethereum.on("chainChanged", function () { refreshBadge(); });
  }

  renderActions(); renderViews(); refreshAll();
  if (window.ethereum) connect(true).catch(function () {});
})();
