/* ==========================================================
   Body Scent — shared script (used by every page)
   Each section runs only if its elements exist on the page:
     product.html -> #filter-bar, #product-list
     order.html   -> #orderForm, #customerName, #contact, #items, #total, #note
     admin.html   -> #ordersTable tbody
   ========================================================== */

(function () {
  "use strict";

  /* ---------- Config ---------- */
  var PRODUCTS_URL = "products.json";

  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbzXjPndLjnmAWRmpWh9gjd0bMBdjdiTvONqzkHqoowue1kVQOqIXW1WefPTXxMix2h6Bg/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhDtLGUQSwWn2qo9YFbH0UFFxdP3r2ZV7nJ10PsBkUPEer1qpwt5chZ4e7SClFfcNRyex3KBQGgpDV/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABELS = { spray: "สเปรย์ฉีดตัว", rollon: "โรลออน" };

  /* ---------- Small helpers ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(value) {
    var n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("th-TH");
  }

  /* ==========================================================
     1) product.html — product cards + mood filter
     ========================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var validMoods = MOODS.map(function (m) { return m.key; });

    function getMoodFromUrl() {
      var mood = (new URLSearchParams(window.location.search).get("mood") || "")
        .trim()
        .toLowerCase();
      return validMoods.indexOf(mood) !== -1 ? mood : "all";
    }

    function buildFilterBar(active) {
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var btn = el("button", "filter-btn");
        btn.type = "button";
        btn.dataset.mood = m.key;
        if (m.key !== "all") {
          var dotWrap = el("span");
          dotWrap.dataset.mood = m.key;
          dotWrap.appendChild(el("span", "mood-dot"));
          btn.appendChild(dotWrap);
        }
        btn.appendChild(document.createTextNode(m.label));
        btn.addEventListener("click", function () {
          applyFilter(m.key);
        });
        filterBar.appendChild(btn);
      });
      setActiveButton(active);
    }

    function setActiveButton(mood) {
      Array.prototype.forEach.call(filterBar.children, function (btn) {
        var isActive = btn.dataset.mood === mood;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function buildCard(p) {
      var fullName = p.size ? p.name + " " + p.size : p.name;
      var orderUrl =
        "order.html?item=" + encodeURIComponent(fullName) +
        "&price=" + encodeURIComponent(p.price);

      var card = el("article", "product-card");
      card.dataset.mood = p.mood;

      var imgWrap = el("div", "product-card__image");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = fullName;
      img.loading = "lazy";
      imgWrap.appendChild(img);

      var body = el("div", "product-card__body");

      var meta = el("div", "product-card__meta");
      meta.appendChild(el("span", "mood-dot"));
      var moodName = p.mood.charAt(0).toUpperCase() + p.mood.slice(1);
      var metaText = moodName + " · " + (TYPE_LABELS[p.type] || p.type);
      meta.appendChild(el("span", null, metaText));

      var name = el("h3", "product-card__name", p.name);

      var size = el("p", "product-card__desc", p.size ? "ขนาด " + p.size : "");
      if (!p.size) size.hidden = true;

      var footer = el("div", "product-card__footer");
      var price = el("span", "price", "฿" + formatPrice(p.price));
      var buy = el("a", "btn btn--small", "สั่งซื้อ");
      buy.href = orderUrl;
      footer.appendChild(price);
      footer.appendChild(buy);

      body.appendChild(meta);
      body.appendChild(name);
      if (!size.hidden) body.appendChild(size);
      body.appendChild(footer);

      card.appendChild(imgWrap);
      card.appendChild(body);
      return card;
    }

    function render(mood) {
      list.textContent = "";
      var shown = products.filter(function (p) {
        return mood === "all" || p.mood === mood;
      });
      if (!shown.length) {
        list.appendChild(el("p", null, "ยังไม่มีสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function applyFilter(mood) {
      setActiveButton(mood);
      render(mood);
      // keep the URL in sync so the filtered view can be shared
      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        if (mood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", mood);
        window.history.replaceState(null, "", url);
      }
    }

    var initialMood = getMoodFromUrl();
    buildFilterBar(initialMood);
    list.appendChild(el("p", null, "กำลังโหลดสินค้า..."));

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render(initialMood);
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = "";
        list.appendChild(el("p", null, "โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
      });
  }

  /* ==========================================================
     2) order.html — prefill form + submit to Apps Script
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsField = document.getElementById("items");
    var totalField = document.getElementById("total");

    // Prefill from ?item=...&price=...
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    if (itemsField && item) itemsField.value = item;
    if (totalField && price) totalField.value = price;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: document.getElementById("items").value.trim(),
        total: document.getElementById("total").value.trim(),
        note: document.getElementById("note").value.trim()
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        if (submitBtn) submitBtn.disabled = false;
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
    });
  }

  /* ==========================================================
     3) admin.html — orders table from published CSV
     ========================================================== */

  // Minimal CSV parser: handles quoted fields, escaped quotes ("")
  // and line breaks inside quotes. Returns an array of rows.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    // last field / row without trailing newline
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    // drop completely empty rows
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ""; });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLS = 6;

    function showMessage(text) {
      tbody.textContent = "";
      var tr = document.createElement("tr");
      var td = el("td", null, text);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // first row = header

        if (!rows.length) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // Sheet rows are appended in time order, so reverse = newest first
        rows.reverse();

        tbody.textContent = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          // columns: timestamp, customerName, contact, items, total, note
          for (var c = 0; c < COLS; c++) {
            var value = r[c] !== undefined ? r[c] : "";
            if (c === 4 && value !== "" && !isNaN(Number(value))) {
              value = formatPrice(value);
            }
            tr.appendChild(el("td", null, value));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- Init ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
