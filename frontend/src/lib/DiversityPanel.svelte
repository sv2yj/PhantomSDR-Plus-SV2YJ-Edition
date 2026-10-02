<script>
  // Receive-diversity control panel.
  //
  // Self-contained on purpose: it owns its own expand/collapse state and its
  // own persisted endpoint, so adding it to a layout costs one line and no
  // new state in App.svelte.  See diversity.js for what the combiner does.
  import { onDestroy } from "svelte";
  import copy from "copy-to-clipboard";
  import {
    startDiversity,
    stopDiversity,
    getDiversityStatus,
    setDiversityCalib,
  } from "./backend.js";
  // The list format and the address rules live in one module, shared with the
  // mobile page — a list built on a phone is the same list this panel offers.
  import {
    LS_URL,
    LS_TYPE,
    LS_CAL,
    dedupe,
    toList,
    emptyHistory,
    loadHistory,
    saveHistory as persistHistory,
    remembered,
    hintFor,
    normalise,
    exportBlob,
    qrTooLarge,
    qrDataUrl,
    browseUrl,
  } from "../diversityList.js";

  let expanded = false;
  let endpoint = "";
  let type = "phantom";
  let calibDb = 0;
  let running = false;
  let status = { active: false, state: "idle", locked: false };
  let poller = null;

  // Every receiver used, kept PER TYPE: a Kiwi address is never a useful
  // suggestion when the selector says WebSDR, and one shared list would
  // mostly offer the wrong ones.  The list is not capped — it is a few
  // hundred bytes an entry, and a station worth keeping should not be
  // pushed out by one tried once.  See diversityList.js for the shape.
  let history = emptyHistory();

  try {
    endpoint = localStorage.getItem(LS_URL) || "";
    calibDb = Number(localStorage.getItem(LS_CAL) || 0) || 0;
    type = localStorage.getItem(LS_TYPE) || "phantom";
  } catch (_) {}
  history = loadHistory();

  // Most recent first, no duplicates. Storing what was TYPED rather than
  // the normalised URL: that is what goes back into the box.  A name
  // already given to this address is carried over, so re-using a receiver
  // does not strip its label.
  function remember(value) {
    if (!(value || "").trim()) return;
    history[type] = remembered(history, type, value);
    saveHistory();
  }

  function saveHistory() {
    history = history;
    persistHistory(history);
  }

  function forgetAll() {
    history[type] = [];
    saveHistory();
  }

  // Drop one entry. Clearing the box too when it held that address avoids
  // the odd state where the field shows something the list no longer offers.
  function forgetOne(entry) {
    history[type] = (history[type] || []).filter((e) => e.addr !== entry.addr);
    if ((endpoint || "").trim() === entry.addr) endpoint = "";
    saveHistory();
  }

  // Editing happens INSIDE the panel, never through window.prompt/confirm.
  // A modal dialog blocks the main thread, and the main thread is where
  // audio frames arrive and are pushed into the playback worklet — so a
  // prompt left open for a few seconds silences the receiver until it is
  // dismissed.  Two inputs in the row cost nothing and keep the audio up.
  let editIndex = -1; // row being edited, -1 for none
  let adding = false; // the blank row at the top
  let editName = "";
  let editAddr = "";
  let notice = ""; // what an alert() used to say

  function beginAdd() {
    adding = true;
    editIndex = -1;
    editName = "";
    editAddr = "";
    notice = "";
  }

  function beginEdit(i, entry) {
    adding = false;
    editIndex = i;
    editName = entry.name;
    editAddr = entry.addr;
    notice = "";
  }

  function cancelEdit() {
    adding = false;
    editIndex = -1;
    editName = "";
    editAddr = "";
  }

  // Add by hand, or edit in place keeping the row's position: an address
  // that only needs a port corrected should not have to be retyped.
  function commitEdit() {
    const next = { name: editName.trim(), addr: editAddr.trim() };
    if (!next.addr) return;
    const list = (history[type] || []).slice();
    if (adding) {
      // Straight to the top, where a just-used address goes; re-adding one
      // already listed moves it there under the new name rather than twice.
      history[type] = dedupe([next, ...list]);
      if (!(endpoint || "").trim()) endpoint = next.addr;
    } else {
      const old = list[editIndex];
      if (!old) return cancelEdit();
      // Edited onto an address already listed: the other one goes, rather
      // than leaving the same host twice under two names.
      const clash = list.findIndex((e) => e.addr === next.addr);
      if (clash >= 0 && clash !== editIndex) list.splice(clash, 1);
      const at = list.findIndex((e) => e.addr === old.addr);
      if (at < 0) return cancelEdit();
      list[at] = next;
      history[type] = dedupe(list);
      if ((endpoint || "").trim() === old.addr) endpoint = next.addr;
    }
    saveHistory();
    cancelEdit();
  }

  function onEditKey(ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      commitEdit();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      cancelEdit();
    }
  }

  // Focus the first field as the row appears, so an add is type-and-Enter.
  function focusOnShow(node) {
    node.focus();
    node.select();
  }

  function useOne(entry) {
    endpoint = entry.addr;
  }

  // Order is the operator's, not the browser's: the list is offered in the
  // order it is stored, so putting the two receivers actually used at the
  // top is worth more than strict most-recent-first.  remember() still
  // brings a re-used address to the front, which only ever affects one
  // already in play.
  function moveEntry(from, to) {
    const list = (history[type] || []).slice();
    if (from < 0 || from >= list.length) return;
    if (to < 0 || to >= list.length || to === from) return;
    const [e] = list.splice(from, 1);
    list.splice(to, 0, e);
    history[type] = list;
    saveHistory();
  }

  // Drag to reorder, with the arrows doing the same thing for anyone who
  // would rather not drag.  dragFrom is kept here rather than read back out
  // of dataTransfer because Firefox will not let a dragover handler read it.
  let dragFrom = -1;
  let dragOver = -1;

  function onDragStart(i, ev) {
    if (running) return;
    dragFrom = i;
    try {
      ev.dataTransfer.effectAllowed = "move";
      // Firefox starts no drag at all without some payload set.
      ev.dataTransfer.setData("text/plain", String(i));
    } catch (_) {}
  }

  function onDragOver(i, ev) {
    if (dragFrom < 0) return;
    ev.preventDefault();
    dragOver = i;
    try {
      ev.dataTransfer.dropEffect = "move";
    } catch (_) {}
  }

  function onDrop(i, ev) {
    ev.preventDefault();
    const from = dragFrom;
    dragFrom = -1;
    dragOver = -1;
    if (from >= 0) moveEntry(from, i);
  }

  function onDragEnd() {
    dragFrom = -1;
    dragOver = -1;
  }

  // Switching type swaps in that type's most recent address, but only when
  // the box is empty or still holds an address belonging to the type being
  // left — never overwrite something half-typed.
  //
  // prevType is tracked by hand rather than read from `suggestions`: the
  // select's bind:value has already written the new type by the time change
  // fires, and depending on when Svelte recomputes a reactive statement is
  // the kind of thing that works until it does not.
  let prevType = type;
  function onTypeChange() {
    const leaving = history[prevType] || [];
    const current = (endpoint || "").trim();
    if (current === "" || leaving.some((e) => e.addr === current)) {
      const first = (history[type] || [])[0];
      endpoint = first ? first.addr : "";
    }
    prevType = type;
  }

  // Backup and restore. localStorage dies with the browser's site data, and
  // a list of named receivers is worth more than the minutes it took to
  // type: a plain JSON file carries it to another browser or machine.
  const FILE_TAG = "phantomsdr-diversity-addresses";

  function exportHistory() {
    const doc = {
      format: FILE_TAG,
      version: 2,
      saved: new Date().toISOString(),
      from: location.host,
      history,
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_TAG + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can beat the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  let importInput = null;
  let pendingImport = null; // parsed file waiting for merge-or-replace

  // A phone is a different browser, so it starts with an empty list even
  // though the same receivers are saved here. A QR code is the one path that
  // needs nothing else: the phone's camera reads it and the Div tab on
  // /mobile takes the text.
  let qrUrl = "";
  let qrText = "";
  let qrError = "";

  async function showQr() {
    notice = "";
    pendingImport = null;
    cancelEdit();
    qrText = exportBlob(history);
    qrUrl = "";
    qrError = "";
    if (qrTooLarge(qrText)) {
      qrError =
        "Too many receivers for a QR code that a phone can still read — copy the text instead.";
      return;
    }
    try {
      qrUrl = await qrDataUrl(qrText);
    } catch (e) {
      qrError = "Could not draw the QR code — copy the text instead.";
    }
  }

  // navigator.clipboard exists only in a SECURE CONTEXT, and this receiver is
  // served over plain http — so on anything but localhost it is undefined and
  // the copy throws. copy-to-clipboard falls back to a hidden selection plus
  // document.execCommand("copy"), which works on an insecure origin.
  function copyQrText() {
    notice = copy(qrText)
      ? "Copied to the clipboard."
      : "Copy failed — select the text and copy it by hand.";
  }

  async function importHistory(ev) {
    const file = ev.target && ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    cancelEdit();
    notice = "";
    pendingImport = null;
    let doc;
    try {
      doc = JSON.parse(await file.text());
    } catch (_) {
      notice = "That file is not readable JSON.";
      return;
    }
    // Accept either the file this panel writes or a bare {type: [...]} map,
    // so a hand-written list works too.
    const incoming =
      doc && typeof doc === "object" && doc.history ? doc.history : doc;
    if (!incoming || typeof incoming !== "object") {
      notice = "That file holds no saved receivers.";
      return;
    }
    const parsed = {};
    let found = 0;
    for (const k of Object.keys(history)) {
      parsed[k] = toList(incoming[k]);
      found += parsed[k].length;
    }
    if (!found) {
      notice = "That file holds no saved receivers.";
      return;
    }
    // Asked in the panel rather than with confirm(), for the same reason
    // the editor is inline: a modal dialog stops the audio.
    pendingImport = { parsed, found };
    showSaved = true;
  }

  function applyImport(merge) {
    if (!pendingImport) return;
    const { parsed } = pendingImport;
    for (const k of Object.keys(history)) {
      history[k] = dedupe(
        merge ? parsed[k].concat(history[k] || []) : parsed[k],
      );
    }
    pendingImport = null;
    saveHistory();
    if (!(endpoint || "").trim()) {
      const first = (history[type] || [])[0];
      endpoint = first ? first.addr : "";
    }
  }

  // The entry diversity is actually running against, so the list can say
  // which one it is. Matched on the address, because that is what Start was
  // given and what the box still holds while running.
  $: liveAddr = running ? (endpoint || "").trim() : "";

  $: suggestions = history[type] || [];
  $: anySaved = Object.keys(history).some((k) => (history[k] || []).length > 0);
  let showSaved = false;

  // The combiner reports in stream time and only updates a few times a
  // second; 500 ms is plenty and keeps this off the audio path.
  function startPolling() {
    if (poller) return;
    poller = setInterval(() => {
      try {
        status = getDiversityStatus();
        running = !!status.active;
      } catch (_) {}
    }, 500);
  }
  function stopPolling() {
    if (poller) clearInterval(poller);
    poller = null;
  }

  function toggle() {
    if (running) {
      stopDiversity();
      stopPolling();
      running = false;
      status = { active: false, state: "idle", locked: false };
      return;
    }
    const url = normalise(endpoint, type);
    if (!url) return;
    try {
      localStorage.setItem(LS_URL, endpoint);
      localStorage.setItem(LS_CAL, String(calibDb));
      localStorage.setItem(LS_TYPE, type);
    } catch (_) {}
    if (startDiversity(url, { remoteCalibDb: calibDb, type })) {
      // Only on a start that was accepted: a rejected address is not one
      // worth offering again.
      remember(endpoint);
      running = true;
      startPolling();
    }
  }

  function onCalib() {
    setDiversityCalib(calibDb);
    try {
      localStorage.setItem(LS_CAL, String(calibDb));
    } catch (_) {}
  }

  onDestroy(() => {
    stopPolling();
    try {
      stopDiversity();
    } catch (_) {}
  });

  $: dotClass = !running
    ? "bg-gray-500"
    : status.locked
      ? status.live === "remote"
        ? "bg-cyan-400 animate-pulse"
        : "bg-emerald-400 animate-pulse"
      : "bg-amber-400 animate-pulse";

  // Two states are what matters at a glance: still working on it, or good to
  // go. Which site is currently live is what the coloured dot is for — green
  // for this receiver, cyan for the remote — and the detail rows below carry
  // the rest.
  $: waiting = running && (status.state !== "ready" || !status.locked);
  $: summary = !running ? "off" : waiting ? "Please wait…" : "Ready";
  $: summaryClass = !running
    ? "text-gray-400"
    : waiting
      ? "text-amber-400"
      : "text-emerald-400";

  // A failure is not "please wait" — it will never finish on its own, and
  // saying so in amber would be a lie the user waits on.
  $: summaryFull =
    running && (status.state === "error" || status.state === "closed")
      ? status.state + (status.errorText ? " — " + status.errorText : "")
      : summary;

  const dB = (v) => (v === undefined || v === null ? "—" : v.toFixed(1));
</script>

<div class="w-full rounded-lg p-4 mt-2 text-left decoder-window decoder-panel">
  <button
    class="w-full flex justify-between items-center text-xs bg-transparent border-0 p-0 cursor-pointer"
    on:click={() => (expanded = !expanded)}
    title="Combine this receiver with a second one to ride through fades"
  >
    <h4 class="text-white font-semibold flex items-center gap-2">
      <span class="inline-block w-2 h-2 rounded-full {dotClass}"></span>
      Receive Diversity
    </h4>
    <span class="flex items-center gap-1">
      <span
        class="{running &&
        (status.state === 'error' || status.state === 'closed')
          ? 'text-red-400'
          : summaryClass} truncate max-w-[16rem]">{summaryFull}</span
      >
      <span class="text-gray-400">{expanded ? "▾" : "▸"}</span>
    </span>
  </button>

  {#if expanded}
    <div class="mt-3 flex flex-col gap-2 text-xs text-gray-300">
      <div class="flex items-center gap-2">
        <label class="whitespace-nowrap text-gray-400" for="div-type"
          >Second RX</label
        >
        <select
          id="div-type"
          bind:value={type}
          on:change={onTypeChange}
          disabled={running}
          class="glass-select text-white text-xs px-1 py-1 rounded-md cursor-pointer focus:outline-none"
        >
          <option value="phantom">PhantomSDR+</option>
          <option value="kiwi">KiwiSDR</option>
          <option value="uber">UberSDR</option>
          <option value="websdr">WebSDR</option>
        </select>
        <input
          id="div-endpoint"
          type="text"
          bind:value={endpoint}
          disabled={running}
          placeholder={hintFor(type)}
          list="div-endpoint-history"
          autocomplete="off"
          class="flex-1 min-w-0 bg-gray-900 text-white rounded px-2 py-1 border border-gray-700 focus:outline-none recess-window"
        />
        <!-- Every address used with THIS receiver type. A datalist
             rather than a select: the field still takes a new address typed
             straight in, and the browser filters the list as you type. -->
        <datalist id="div-endpoint-history">
          {#each suggestions as e}
            <option value={e.addr}>{e.name}</option>
          {/each}
        </datalist>
        <button
          class="px-1 bg-transparent border-0 cursor-pointer {showSaved
            ? 'text-cyan-400'
            : 'text-gray-500 hover:text-gray-300'}"
          title={suggestions.length
            ? suggestions.length +
              (suggestions.length === 1
                ? " saved receiver"
                : " saved receivers") +
              " for this receiver type — click to name, edit, back up or restore"
            : "Saved receivers — back up or restore"}
          on:click={() => (showSaved = !showSaved)}>☰</button
        >
        <button
          class="px-2 py-1 rounded border transition-colors {running
            ? 'bg-red-900 hover:bg-red-800 text-red-100 border-red-700'
            : 'bg-green-900 hover:bg-green-800 text-green-100 border-green-700'}"
          on:click={toggle}
        >
          {running ? "Stop" : "Start"}
        </button>
      </div>

      <!-- Saved addresses, editable. The datalist above is for picking one
           quickly while typing; this is for tidying the list itself, which a
           datalist gives no way to do. -->
      {#if showSaved}
        <div
          class="flex flex-col gap-1 rounded p-2 bg-gray-900 recess-window text-[11px]"
        >
          <div class="flex items-center justify-between text-gray-400">
            <span
              >Saved for {type === "phantom"
                ? "PhantomSDR+"
                : type === "kiwi"
                  ? "KiwiSDR"
                  : type === "uber"
                    ? "UberSDR"
                    : "WebSDR"} — {suggestions.length}</span
            >
            <span class="flex items-center gap-3 whitespace-nowrap">
              <button
                class="font-bold text-gray-300 hover:text-green-400 bg-transparent border-0 cursor-pointer"
                title="Add a receiver by hand"
                on:click={beginAdd}>add</button
              >
              {#if suggestions.length}
                <button
                  class="font-bold text-gray-300 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                  title="Forget them all"
                  on:click={forgetAll}>clear all</button
                >
              {/if}
            </span>
          </div>
          <!-- The editor: two fields in the row itself.  See the comment on
               beginAdd() for why this is not a prompt(). -->
          {#if adding}
            <div class="flex items-center gap-1">
              <input
                use:focusOnShow
                bind:value={editName}
                on:keydown={onEditKey}
                placeholder="name  (optional)"
                class="flex-1 min-w-0 bg-gray-800 text-green-400 rounded px-1 py-0.5 border border-gray-700 focus:outline-none"
              />
              <input
                bind:value={editAddr}
                on:keydown={onEditKey}
                placeholder={hintFor(type)}
                class="flex-1 min-w-0 bg-gray-800 text-gray-200 font-mono rounded px-1 py-0.5 border border-gray-700 focus:outline-none"
              />
              <button
                class="px-1 bg-transparent border-0 cursor-pointer {editAddr.trim()
                  ? 'text-green-400 hover:text-green-300'
                  : 'text-gray-700 cursor-default'}"
                title="Save"
                disabled={!editAddr.trim()}
                on:click={commitEdit}>✓</button
              >
              <button
                class="px-1 text-gray-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                title="Cancel"
                on:click={cancelEdit}>✕</button
              >
            </div>
          {/if}
          <!-- Two rows per receiver: the name it was given, and the address
               it actually dials.  The name is optional, so the first row is
               a placeholder until one is typed.  Nothing caps the list, so
               it scrolls rather than pushing the rest of the panel down. -->
          <div class="flex flex-col gap-1 max-h-64 overflow-y-auto" role="list">
            {#each suggestions as e, i}
              {#if editIndex === i}
                <div class="flex items-center gap-1">
                  <input
                    use:focusOnShow
                    bind:value={editName}
                    on:keydown={onEditKey}
                    placeholder="name  (optional)"
                    class="flex-1 min-w-0 bg-gray-800 text-green-400 rounded px-1 py-0.5 border border-gray-700 focus:outline-none"
                  />
                  <input
                    bind:value={editAddr}
                    on:keydown={onEditKey}
                    placeholder={hintFor(type)}
                    class="flex-1 min-w-0 bg-gray-800 text-gray-200 font-mono rounded px-1 py-0.5 border border-gray-700 focus:outline-none"
                  />
                  <button
                    class="px-1 bg-transparent border-0 cursor-pointer {editAddr.trim()
                      ? 'text-green-400 hover:text-green-300'
                      : 'text-gray-700 cursor-default'}"
                    title="Save"
                    disabled={!editAddr.trim()}
                    on:click={commitEdit}>✓</button
                  >
                  <button
                    class="px-1 text-gray-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                    title="Cancel"
                    on:click={cancelEdit}>✕</button
                  >
                </div>
              {:else}
                <div
                  class="flex items-start gap-1 rounded {dragOver === i &&
                  dragFrom !== i
                    ? 'bg-gray-800 outline outline-1 outline-cyan-600'
                    : ''} {dragFrom === i ? 'opacity-40' : ''}"
                  draggable={!running}
                  on:dragstart={(ev) => onDragStart(i, ev)}
                  on:dragover={(ev) => onDragOver(i, ev)}
                  on:drop={(ev) => onDrop(i, ev)}
                  on:dragend={onDragEnd}
                  role="listitem"
                >
                  <!-- Arrows first, so the pair reads as one control column
                     and the drag handle is the whole row. -->
                  <span class="flex flex-col leading-none pt-px">
                    <button
                      class="px-1 text-[9px] bg-transparent border-0 {i === 0
                        ? 'text-gray-700 cursor-default'
                        : 'text-gray-500 hover:text-cyan-300 cursor-pointer'}"
                      title="Move up"
                      disabled={i === 0}
                      on:click={() => moveEntry(i, i - 1)}>▲</button
                    >
                    <button
                      class="px-1 text-[9px] bg-transparent border-0 {i ===
                      suggestions.length - 1
                        ? 'text-gray-700 cursor-default'
                        : 'text-gray-500 hover:text-cyan-300 cursor-pointer'}"
                      title="Move down"
                      disabled={i === suggestions.length - 1}
                      on:click={() => moveEntry(i, i + 1)}>▼</button
                    >
                  </span>
                  <button
                    class="flex-1 min-w-0 text-left bg-transparent border-0 cursor-pointer p-0 leading-tight"
                    title="Put this address in the box  (drag the row to reorder)"
                    disabled={running}
                    on:click={() => useOne(e)}
                  >
                    <span
                      class="block truncate {e.addr === liveAddr
                        ? 'font-bold on-air'
                        : ''} {e.name
                        ? 'text-green-400'
                        : 'text-gray-600 italic'}">{e.name || "unnamed"}</span
                    >
                    <span class="block truncate font-mono text-gray-500"
                      >{e.addr}</span
                    >
                  </button>
                  <!-- An anchor rather than a button, so a middle click or
                       long press behaves the way the listener expects. -->
                  <a
                    class="px-1 py-px no-underline opacity-70 hover:opacity-100 transition-opacity"
                    href={browseUrl(e.addr)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open this receiver's own page in a new tab"
                    draggable="false">🌍</a
                  >
                  <button
                    class="px-1 text-gray-500 hover:text-amber-400 bg-transparent border-0 cursor-pointer"
                    title="Edit the name and address"
                    on:click={() => beginEdit(i, e)}>✎</button
                  >
                  <button
                    class="px-1 text-gray-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                    title="Remove this receiver"
                    on:click={() => forgetOne(e)}>✕</button
                  >
                </div>
              {/if}
            {/each}
          </div>

          <!-- What a failed import used to say through alert(). -->
          {#if notice}
            <div
              class="flex items-center justify-between gap-2 rounded px-1 py-0.5 bg-red-950 text-red-300"
            >
              <span class="truncate">{notice}</span>
              <button
                class="px-1 text-red-400 hover:text-red-200 bg-transparent border-0 cursor-pointer"
                title="Dismiss"
                on:click={() => (notice = "")}>✕</button
              >
            </div>
          {/if}

          <!-- Merge or replace, asked here instead of with confirm(). -->
          {#if pendingImport}
            <div
              class="flex items-center justify-between gap-2 rounded px-1 py-0.5 bg-gray-800 text-gray-300"
            >
              <span class="truncate"
                >{pendingImport.found}
                {pendingImport.found === 1 ? "receiver" : "receivers"} in that file</span
              >
              <span class="flex items-center gap-2 whitespace-nowrap">
                <button
                  class="font-bold text-gray-300 hover:text-green-400 bg-transparent border-0 cursor-pointer"
                  title="Keep what is saved and add the file's receivers to it"
                  on:click={() => applyImport(true)}>merge</button
                >
                <button
                  class="font-bold text-gray-300 hover:text-amber-400 bg-transparent border-0 cursor-pointer"
                  title="Throw away every saved receiver and use the file's"
                  on:click={() => applyImport(false)}>replace</button
                >
                <button
                  class="px-1 text-gray-500 hover:text-red-400 bg-transparent border-0 cursor-pointer"
                  title="Cancel"
                  on:click={() => (pendingImport = null)}>✕</button
                >
              </span>
            </div>
          {/if}

          <!-- The QR sheet. Scan it with the phone's camera, then paste the
               text into Import on the /mobile page's Div tab. -->
          {#if qrUrl || qrError}
            <div
              class="flex flex-col items-center gap-1 rounded p-2 bg-gray-900 recess-window"
            >
              {#if qrUrl}
                <img
                  src={qrUrl}
                  alt="Saved receivers as a QR code"
                  class="w-full max-w-[240px] rounded"
                  style="image-rendering: pixelated;"
                />
              {/if}
              {#if qrError}
                <div class="text-amber-400">{qrError}</div>
              {/if}
              <textarea
                readonly
                rows="3"
                class="w-full bg-gray-800 text-gray-300 font-mono text-[10px] rounded p-1 border border-gray-700 focus:outline-none"
                value={qrText}
              ></textarea>
              <div class="flex items-center gap-3 text-gray-400">
                <button
                  class="font-bold text-gray-300 hover:text-cyan-300 bg-transparent border-0 cursor-pointer"
                  on:click={copyQrText}>copy text</button
                >
                <button
                  class="text-gray-500 hover:text-gray-300 bg-transparent border-0 cursor-pointer"
                  on:click={() => {
                    qrUrl = "";
                    qrError = "";
                  }}>close</button
                >
              </div>
              <div class="text-gray-500 text-center leading-snug">
                Scan it on the phone, then paste into <b>Import</b> on the Div tab
                of the /mobile page.
              </div>
            </div>
          {/if}

          <!-- Backup and restore. The saved list lives in this browser's
               storage, which clearing site data wipes; this is how it
               survives that, and how it moves to another machine. -->
          <div
            class="flex items-center justify-between gap-2 pt-1 border-t border-gray-700 text-gray-400"
          >
            <span class="truncate"
              >{anySaved
                ? "Backup covers all four receiver types"
                : "Nothing saved yet — restore a backup file"}</span
            >
            <span class="flex items-center gap-2 whitespace-nowrap">
              {#if anySaved}
                <button
                  class="text-gray-400 hover:text-cyan-300 bg-transparent border-0 cursor-pointer"
                  title="Save every list to a file you can keep"
                  on:click={exportHistory}>⭳ export</button
                >
              {/if}
              <button
                class="text-gray-400 hover:text-cyan-300 bg-transparent border-0 cursor-pointer"
                title="Read the lists back from a file"
                on:click={() => importInput && importInput.click()}
                >⭱ import</button
              >
              {#if anySaved}
                <button
                  class="text-gray-400 hover:text-cyan-300 bg-transparent border-0 cursor-pointer"
                  title="Show the lists as a QR code, to carry them to a phone"
                  on:click={qrUrl || qrError
                    ? () => {
                        qrUrl = "";
                        qrError = "";
                      }
                    : showQr}>▦ QR</button
                >
              {/if}
            </span>
          </div>
          <input
            bind:this={importInput}
            type="file"
            accept="application/json,.json"
            class="hidden"
            on:change={importHistory}
          />
        </div>
      {/if}

      <div class="flex items-center gap-2">
        <label
          class="whitespace-nowrap text-gray-400"
          for="div-calib"
          title="Added to the remote's SNR before comparison. A lossy remote codec floors its own noise, so its SNR reads lower than it really is. Leave at 0 for another PhantomSDR-Plus."
          >Remote SNR trim</label
        >
        <input
          id="div-calib"
          type="range"
          min="-15"
          max="15"
          step="0.5"
          bind:value={calibDb}
          on:input={onCalib}
          class="flex-1"
        />
        <span class="w-12 text-right font-mono">{calibDb.toFixed(1)} dB</span>
      </div>

      {#if running}
        <div
          class="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] rounded p-2 bg-gray-900 recess-window"
        >
          <span class="text-gray-400">link</span>
          <span
            >{status.state}{status.errorText
              ? " — " + status.errorText
              : ""}{status.closeCode
              ? ` (${status.closeCode}${status.closeReason ? " " + status.closeReason : ""})`
              : ""}</span
          >
          <span class="text-gray-400">aligned</span>
          <span
            >{status.locked
              ? (status.delayMs / 1000).toFixed(2) + " s"
              : "searching"}</span
          >
          <span class="text-gray-400">corr</span>
          <span>{status.locked ? dB(status.corrPeak * 100) + " %" : "—"}</span>
          <span class="text-gray-400">remote audio</span>
          <span class={status.remoteSamples ? "" : "text-amber-400"}
            >{status.remoteSamples
              ? (status.remoteSamples / 1000).toFixed(0) +
                "k @ " +
                status.remoteRateIn +
                " Hz"
              : "none"}</span
          >
          <span class="text-gray-400">SNR local</span><span
            >{dB(status.snrLocalDb)} dB</span
          >
          <span class="text-gray-400">SNR remote</span><span
            >{dB(status.snrRemoteDb)} dB</span
          >
          <span class="text-gray-400">switches</span><span
            >{status.switches ?? 0}</span
          >
          {#if status.inRange === false && status.state === "ready"}
            <span class="col-span-2 text-amber-400"
              >remote does not cover this frequency</span
            >
          {/if}
        </div>
        <p class="text-[11px] text-gray-500 leading-snug">
          Decoders keep using the local receiver — a site switch mid-slot breaks
          coherent decoding. Diversity feeds the speaker only.
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* The receiver currently on air. A fade rather than a hard on/off: it has
     to be noticeable in the corner of the eye without pulling attention off
     the waterfall, and a square blink at this size reads as a fault. */
  .on-air {
    animation: on-air-blink 1.4s ease-in-out infinite;
  }

  @keyframes on-air-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  /* Anything that blinks needs this: for a listener who has asked the system
     to reduce motion, the bold weight alone says which one is running. */
  @media (prefers-reduced-motion: reduce) {
    .on-air {
      animation: none;
    }
  }
</style>
