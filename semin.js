/* =========================================================
   세민전 방문 차량 예약 (행사 전용 신청 페이지)
   · 명수당 예약과 같은 DB — 행사 코드(EVENT)로 따로 받음
   · 날짜·시간대·정원·공개 여부는 DB(event_status)에서 받아 옴
   · 예약 확인·취소(이 페이지)와 실시간 예약확인증(pass.html)도 이 사이트 안에서 — 세민전 예약만 보여 줌
   ========================================================= */
(function () {
  "use strict";

  var EVENT = "semin";                                                   // events.code
  var PASS_KEY = "semin-pass-v1";                                        // 확인증용 { plate, phone } — 이 휴대폰에만 저장

  // ---------- 공통 ----------
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var DOW = ["일", "월", "화", "수", "목", "금", "토"];
  var norm = function (s) { return String(s || "").replace(/[\s\-·.]/g, "").toUpperCase(); };
  var PLATE_RE = /^([가-힣]{2})?\d{2,3}[가-힣]\d{4}$/;
  var pretty = function (s) { var n = norm(s), m = n.match(/^(.*?[가-힣])(\d{4})$/); return m ? m[1] + " " + m[2] : n; };
  var digits = function (s) { return String(s || "").replace(/\D/g, ""); };
  var fmtPhone = function (s) {
    var d = digits(s).slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + "-" + d.slice(3);
    return d.slice(0, 3) + "-" + d.slice(3, d.length - 4) + "-" + d.slice(-4);
  };
  var parseD = function (s) { var p = String(s).slice(0, 10).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  var dateLabel = function (s) { var d = parseD(s); return (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + DOW[d.getDay()] + ")"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var toMin = function (t) { var p = String(t).split(":"); return (+p[0]) * 60 + (+p[1]); };
  // 한국 시간 기준 오늘·지금 (휴대폰 시간대와 상관없이)
  var seoul = function () { var k = new Date(Date.now() + 9 * 3600 * 1000); return { date: k.getUTCFullYear() + "-" + pad(k.getUTCMonth() + 1) + "-" + pad(k.getUTCDate()), min: k.getUTCHours() * 60 + k.getUTCMinutes() }; };


  // ---------- DB ----------
  var cfg = window.APP_CONFIG || {};
  var configured = cfg.SUPABASE_URL && cfg.SUPABASE_URL.indexOf("YOUR-PROJECT") < 0 && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY.indexOf("YOUR-ANON-KEY") < 0;
  var sb = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  if (!sb) {
    $("setupNotice").hidden = false;
    $("setupNotice").textContent = "지금은 예약 신청을 받을 수 없어요. 잠시 후 다시 열어 주세요.";
  }

  var CANCEL_STARTED = "예약 시간이 시작된 후에는 취소할 수 없어요.";
  var ERR = {
    full: "방금 이 시간대가 마감됐어요. 다른 시간대를 골라 주세요.",
    duplicate: "이 차량은 이미 세민전 예약이 돼 있어요. 시간을 바꾸려면 [내 예약 확인]에서 취소한 뒤 다시 신청해 주세요.",
    dup_day: "이 차량은 이날 명수당 방문 예약이 이미 있어요. 같은 차량은 하루에 한 번만 예약할 수 있어요. 바꾸려면 [내 예약 확인]에서 취소한 뒤 다시 신청해 주세요.",
    regular: "정기 등록 차량이에요. 예약 없이 출입할 수 있어요.",
    too_many: "같은 인터넷 연결(와이파이·통신사)에서 짧은 시간에 예약이 많이 들어와 잠시 막혔어요. 잠시 후 다시 신청해 주세요.",
    slot_over: "이미 지난 시간대예요. 다른 시간대를 골라 주세요.",
    not_open: "지금은 세민전 예약을 받지 않아요.",
    ended: "세민전 예약이 끝났어요.",
    no_event: "지금은 세민전 예약을 받지 않아요.",
    bad_slot: "시간대를 골라 주세요.",
    bad_plate: "차량번호 형식을 확인해 주세요. 예: 12가3456",
    bad_name: "이름을 입력해 주세요.",
    bad_phone: "휴대폰 번호를 확인해 주세요. 예: 010-1234-5678",
  };

  // ---------- 화면 전환 ----------
  function show(view) {
    $("applyView").hidden = view !== "apply";
    $("doneView").hidden = view !== "done";
    $("mineView").hidden = view !== "mine";
    $("tabApply").setAttribute("aria-pressed", String(view !== "mine"));
    $("tabMine").setAttribute("aria-pressed", String(view === "mine"));
    try { history.replaceState(null, "", location.pathname + location.search + (view === "mine" ? "#mine" : "")); } catch (e) {}
    window.scrollTo(0, 0);
  }
  $("tabApply").addEventListener("click", function () { show("apply"); load(); });
  $("tabMine").addEventListener("click", function () { show("mine"); });
  $("againBtn").addEventListener("click", function () { show("apply"); load(); });
  var lastDone = {};
  // 실시간 예약확인증 — 차량번호·연락처를 이 휴대폰에 저장하고 확인증 페이지로
  function openPass(plate, phone) {
    try { localStorage.setItem(PASS_KEY, JSON.stringify({ plate: norm(plate), phone: digits(phone) })); } catch (e) {}
    location.href = "pass.html";
  }
  $("passBtn").addEventListener("click", function () { if (lastDone.plate) openPass(lastDone.plate, lastDone.phone); });
  $("toMineBtn").addEventListener("click", function () {
    $("mPlate").value = lastDone.plate || ""; $("mPhone").value = lastDone.phone ? fmtPhone(lastDone.phone) : "";
    show("mine"); if (lastDone.plate) loadMine();
  });

  // ---------- 행사 정보 · 시간대 (DB) ----------
  var ev = null, loaded = false, selSlot = "", reqNo = 0, openTimer = null;
  function load() {
    if (!sb) { render(); return Promise.resolve(); }
    var my = ++reqNo;
    $("slotList").setAttribute("aria-busy", "true");
    return sb.rpc("event_status", { p_code: EVENT }).then(function (res) {
      if (my !== reqNo) return;
      if (res.error) throw res.error;
      ev = res.data && res.data.ok ? res.data : null;
      loaded = true;
      clearTimeout(openTimer);                                     // 공개 시각이 되면 자동으로 다시 불러옴
      if (ev && ev.opens_at) {
        var at = new Date(String(ev.opens_at).replace(/(\.\d{3})\d+/, "$1"));
        if (!isNaN(at)) openTimer = setTimeout(load, Math.min(2147483000, Math.max(1000, at - new Date() + 1500)));
      }
      render();
    }).catch(function (e) {
      console.error(e);
      $("slotList").innerHTML = '<p class="muted">예약 현황을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p>';
    }).then(function () { $("slotList").removeAttribute("aria-busy"); });
  }
  // 공개 시각 "11/3(화) 14시" (한국 시간 기준)
  function openLabel(iso) {
    var at = new Date(String(iso).replace(/(\.\d{3})\d+/, "$1")), k = new Date(at.getTime() + 9 * 3600 * 1000);
    var dd = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
    return { day: (k.getUTCMonth() + 1) + "/" + k.getUTCDate() + "(" + DOW[dd.getUTCDay()] + ")", time: k.getUTCHours() + "시" + (k.getUTCMinutes() ? " " + k.getUTCMinutes() + "분" : "") };
  }
  var slotById = function (id) { var l = (ev && ev.slots) || []; for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i]; return null; };
  var slotPast = function (x) { var n = seoul(); return ev && String(ev.date).slice(0, 10) === n.date && n.min >= toMin(x.end); };

  function render() {
    var st = ev ? ev.state : "closed", sched = st === "sched", pre = sched ? openLabel(ev.opens_at) : null;
    var showForm = !!ev && (st === "open" || sched);
    $("applyForm").hidden = !showForm && loaded;
    $("closedNote").hidden = showForm || !loaded;
    if (!showForm && loaded) {
      $("closedTitle").textContent = st === "ended" ? "세민전 예약이 끝났어요" : "지금은 세민전 예약을 받지 않아요";
      $("closedText").textContent = st === "ended" ? "이용해 주셔서 감사합니다." : "예약이 열리면 이 페이지에서 신청할 수 있어요. 이미 한 예약은 [내 예약 확인]에서 볼 수 있어요.";
    }
    // 1. 날짜 (행사 날 하나)
    if (ev) {
      var v = String(ev.date).slice(0, 10), d = parseD(v), cls = d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : "";
      var t = seoul().date, full = !sched && ev.slots.length && ev.slots.every(function (x) { return x.state === "full" || x.state === "closed" || slotPast(x); }) && ev.slots.some(function (x) { return x.state === "full"; });
      $("dateStrip").innerHTML = '<div class="date-col"><button type="button" class="date-chip' + cls + (sched ? " sched" : "") + (full ? " full" : "") + '" role="radio" data-date="' + v + '" aria-checked="true"' +
        ' aria-label="' + esc(dateLabel(v) + " " + ev.title + (sched ? ", " + pre.day + " " + pre.time + " 오픈 예정" : full ? ", 예약 마감" : "")) + '">' +
        '<span class="dw">' + (v === t ? "오늘" : DOW[d.getDay()]) + '</span><span class="dd">' + d.getDate() + '</span><span class="dl">' + (d.getMonth() + 1) + '월</span></button>' +
        (sched ? '<span class="date-open" aria-hidden="true">' + pre.day + "<br>" + pre.time + " 오픈</span>"
          : full ? '<span class="date-full" aria-hidden="true">마감</span>' : '<span class="date-ev" aria-hidden="true">' + esc(ev.title) + '</span>') + '</div>';
      $("dateNote").textContent = sched ? pre.day + " " + pre.time + "에 열려요. 시간대는 그때부터 고를 수 있어요." : "";
      $("footSlots").textContent = ev.title + " 예약 시간대: " + ev.slots.filter(function (x) { return x.state !== "closed"; }).map(function (x) { return x.start + "~" + x.end; }).join(" · ");
    }
    renderSlots();
  }

  // 2. 시간대 (막대 · 좌석 수는 관리자 설정에 따라 공개)
  function renderSlots() {
    if (!sb) { $("slotList").innerHTML = '<p class="muted">지금은 예약 현황을 볼 수 없어요.</p>'; updateSummary(); return; }
    if (!ev) { $("slotList").innerHTML = loaded ? "" : '<p class="muted">예약 현황을 불러오는 중…</p>'; updateSummary(); return; }
    var sched = ev.state === "sched", plb = sched ? openLabel(ev.opens_at) : null, html = "";
    ev.slots.forEach(function (x) {
      var counts = x.capacity != null && x.booked != null;
      var past = slotPast(x), closed = x.state === "closed", soldOut = x.state === "full";
      var disabled = sched || past || closed || soldOut;
      if (disabled && String(selSlot) === String(x.id)) selSlot = "";
      var label = sched ? plb.day + " " + plb.time + " 오픈" : past ? "지난 시간" : closed ? "신청 안 받음" : soldOut ? "마감"
        : counts ? "남은 자리 " + Math.max(0, x.capacity - x.booked) + " / " + x.capacity
        : x.state === "few" ? "마감 임박" : "예약 가능";
      var pct = Math.max(0, Math.min(100, +x.fill || 0));
      var few = !disabled && x.state === "few", full = !sched && !past && soldOut;
      html += '<button type="button" class="slot' + (few ? " few" : "") + (sched ? " pre" : "") + (full ? " full" : "") + '" role="radio" data-slot="' + esc(x.id) + '" aria-checked="' + (String(selSlot) === String(x.id)) + '"' + (disabled ? " disabled" : "") + '>' +
        '<span class="time">' + esc(x.start) + ' ~ ' + esc(x.end) + '</span><span class="left">' + label + '</span>' +
        '<span class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></button>';
    });
    $("slotList").innerHTML = html || '<p class="muted">아직 시간대가 정해지지 않았어요.</p>';
    updateSummary();
  }
  $("slotList").addEventListener("click", function (e) {
    var b = e.target.closest(".slot"); if (!b || b.disabled) return;
    selSlot = b.dataset.slot;
    Array.prototype.forEach.call(document.querySelectorAll(".slot"), function (s) { s.setAttribute("aria-checked", String(s.dataset.slot === selSlot)); });
    setError(""); updateSummary();
  });

  // ---------- 3. 입력 ----------
  $("fPhone").addEventListener("input", function () { this.value = fmtPhone(this.value); });
  $("fPlate").addEventListener("blur", function () {
    var p = norm(this.value);
    if (!p) return;
    var ok = PLATE_RE.test(p);
    if (ok) this.value = pretty(p);
    $("plateHint").textContent = ok ? "예: 12가3456, 123가4567, 서울12가3456" : "형식을 확인해 주세요. 예: 12가3456";
    $("plateHint").className = "hint" + (ok ? "" : " err");
    updateSummary();
  });
  ["fPlate", "fName", "fPhone"].forEach(function (id) { $(id).addEventListener("input", updateSummary); });

  function updateSummary() {
    var s = $("summary"), sbt = $("submitBtn"), sched = ev && ev.state === "sched", pl = sched ? openLabel(ev.opens_at) : null;
    if (!sbt.dataset.busy) { sbt.disabled = !!sched; sbt.textContent = sched ? pl.day + " " + pl.time + " 오픈 예정" : "예약 신청"; }
    if (!ev) { s.textContent = loaded ? "" : "예약 정보를 불러오는 중…"; return; }
    var day = "<b>" + esc(ev.title) + " · " + dateLabel(ev.date) + "</b>";
    if (sched) { s.innerHTML = day + " · " + pl.day + " " + pl.time + "부터 신청할 수 있어요."; return; }
    var x = slotById(selSlot);
    if (!x) { s.innerHTML = day + " · 시간대를 골라 주세요."; return; }
    var p = norm($("fPlate").value);
    s.innerHTML = "<b>" + esc(ev.title) + " · " + dateLabel(ev.date) + " " + esc(x.start) + " ~ " + esc(x.end) + "</b>" + (PLATE_RE.test(p) ? " · " + esc(pretty(p)) : "");
  }
  function setError(t) { $("formError").textContent = t; }

  // ---------- 4. 신청 ----------
  $("applyForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var plate = norm($("fPlate").value), name = $("fName").value.trim(), phone = digits($("fPhone").value);
    if (!sb || !ev) return setError("지금은 예약 신청을 받을 수 없어요.");
    if (ev.state !== "open") return setError(ERR.not_open);
    if (!slotById(selSlot)) return setError(ERR.bad_slot);
    if (!PLATE_RE.test(plate)) { $("fPlate").focus(); return setError(ERR.bad_plate); }
    if (!name) { $("fName").focus(); return setError(ERR.bad_name); }
    if (!/^01\d{8,9}$/.test(phone)) { $("fPhone").focus(); return setError(ERR.bad_phone); }
    if (!$("fAgree").checked) return setError("개인정보 수집·이용에 동의해 주세요.");
    setError("");
    var btn = $("submitBtn"); btn.disabled = true; btn.textContent = "신청하는 중…"; btn.dataset.busy = "1";
    sb.rpc("request_event_reservation", { p_code: EVENT, p_slot: +selSlot, p_plate: plate, p_name: name, p_phone: phone })
      .then(function (res) {
        if (res.error) throw res.error;
        var r = res.data || {};
        if (!r.ok) {
          setError(ERR[r.error] || "신청하지 못했어요. 잠시 후 다시 시도해 주세요.");
          if (["full", "slot_over", "not_open", "ended", "bad_slot"].indexOf(r.error) >= 0) load();
          return;
        }
        lastDone = { plate: r.plate, phone: phone };
        $("dCode").textContent = r.code;
        $("dEvent").textContent = r.event || ev.title;
        $("dDate").textContent = dateLabel(String(r.date));
        $("dSlot").textContent = r.slot + " ~ " + r.end;
        $("dPlate").textContent = r.plate;
        $("fPlate").value = ""; selSlot = ""; $("fAgree").checked = false;
        show("done");
      })
      .catch(function (err) { console.error(err); setError("신청하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."); })
      .then(function () { delete btn.dataset.busy; btn.disabled = false; btn.textContent = "예약 신청"; updateSummary(); });
  });

  // ---------- 내 예약 확인·취소 (세민전 예약만) ----------
  $("mPhone").addEventListener("input", function () { this.value = fmtPhone(this.value); });
  function loadMine() {
    var plate = norm($("mPlate").value), phone = digits($("mPhone").value);
    $("mineError").textContent = "";
    if (!sb) { $("mineError").textContent = "지금은 조회할 수 없어요."; return; }
    if (!PLATE_RE.test(plate)) { $("mineError").textContent = ERR.bad_plate; return; }
    if (!/^01\d{8,9}$/.test(phone)) { $("mineError").textContent = ERR.bad_phone; return; }
    $("mineBtn").disabled = true;
    sb.rpc("my_reservations", { p_plate: plate, p_phone: phone }).then(function (res) {
      if (res.error) throw res.error;
      var list = (res.data || []).filter(function (r) { return !!r.event; });       // 명수당 예약은 빼고 세민전(행사) 예약만
      if (!list.length) { $("mineList").innerHTML = '<p class="muted">앞으로 예정된 세민전 예약이 없어요. 차량번호와 연락처가 신청할 때와 같은지 확인해 주세요.</p>'; return; }
      $("mineList").innerHTML = list.map(function (r) {
        // 예약한 시간대가 시작됐으면 취소 버튼 대신 안내
        var startAt = new Date(String(r.reserve_date).slice(0, 10) + "T" + String(r.reserve_time).slice(0, 5) + ":00+09:00");
        var started = Date.now() >= startAt.getTime();
        var when = String(r.reserve_time).slice(0, 5) + " ~ " + String(r.reserve_end || "").slice(0, 5);
        return '<div class="my-item' + (started ? " started" : "") + '" data-id="' + esc(r.id) + '"><span class="when">' + dateLabel(String(r.reserve_date)) + ' · ' + when + ' <span class="ev-tag">' + esc(r.event) + '</span></span>' +
          '<span class="acts"><button type="button" class="to-pass">확인증</button>' + (started ? '<span class="no-cancel" title="' + CANCEL_STARTED + '">취소 불가</span>' : '<button type="button" class="cancel">취소</button>') + '</span>' +
          (started ? '<span class="started-note">' + CANCEL_STARTED + '</span>' : '') +
          '<span class="meta"><span class="mini-plate" style="font-size:15px">' + esc(r.plate) + '</span> · 예약번호 <span class="mono">' + esc(r.code) + '</span></span></div>';
      }).join("");
    }).catch(function (e) { console.error(e); $("mineError").textContent = "조회하지 못했어요. 잠시 후 다시 시도해 주세요."; })
      .then(function () { $("mineBtn").disabled = false; });
  }
  $("mineForm").addEventListener("submit", function (e) { e.preventDefault(); loadMine(); });
  $("mineList").addEventListener("click", function (e) {
    if (e.target.closest(".to-pass")) { openPass($("mPlate").value, $("mPhone").value); return; }
    var b = e.target.closest(".cancel"); if (!b) return;
    if (!b.classList.contains("arm")) {          // 한 번 더 눌러야 취소 (실수 방지)
      b.classList.add("arm"); b.textContent = "정말 취소";
      setTimeout(function () { if (b.isConnected && b.classList.contains("arm")) { b.classList.remove("arm"); b.textContent = "취소"; } }, 4000);
      return;
    }
    var item = b.closest(".my-item");
    b.disabled = true; b.textContent = "취소 중…";
    sb.rpc("cancel_reservation", { p_id: item.dataset.id, p_phone: digits($("mPhone").value) }).then(function (res) {
      if (res.error) throw res.error;
      var d = res.data || {};
      if (d.error === "started") { b.replaceWith(Object.assign(document.createElement("span"), { className: "no-cancel", textContent: "취소 불가" })); item.classList.add("started"); $("mineError").textContent = CANCEL_STARTED; return; }
      if (!d.ok) throw new Error("not cancelled");
      item.classList.add("gone"); b.textContent = "취소됨";
    }).catch(function (e) { console.error(e); b.disabled = false; b.classList.remove("arm"); b.textContent = "취소"; $("mineError").textContent = "취소하지 못했어요. 잠시 후 다시 시도해 주세요."; });
  });

  // ---------- 시작 ----------
  updateSummary();
  load();
  if (/^#mine/.test(location.hash)) show("mine");                        // 확인증 화면 등에서 #mine 으로 들어오면 바로 조회 화면
  // 남은 자리·공개 여부 30초마다 새로 (지난 시간대 표시도 함께)
  setInterval(function () { if (!$("applyView").hidden && !document.hidden) load(); }, 30000);
})();
