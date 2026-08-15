/* Financert dashboard.
 *
 * Deliberately a plain, non-module script with no build step, so index.html
 * works when opened straight off the filesystem. It asks the API first and
 * falls back to the snapshot embedded in fallback-data.js when the backend is
 * not running — the badge in the header always says which one you are looking
 * at, because a dashboard that silently shows stale numbers is worse than one
 * that shows none.
 */

(function () {
  "use strict";

  var API_BASE = "http://localhost:8000";
  var API_TIMEOUT_MS = 900;

  var state = {
    overview: null,
    live: false,
    loading: false,
    error: null,
    venueFilter: null,
    signalFilter: null,
  };

  // ------------------------------------------------------------ formatting

  function money(value) {
    var n = Number(value || 0);
    var abs = Math.abs(n);
    if (abs >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    if (abs === 0) return "—";
    return "$" + Math.round(n);
  }

  function count(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function shortDate(value) {
    if (!value) return "—";
    var parts = String(value).slice(0, 10).split("-");
    if (parts.length !== 3) return value;
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[Number(parts[1]) - 1] + " " + Number(parts[2]);
  }

  function titleCase(text) {
    return String(text || "").replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  var VENUE_NAME = {
    congress: "Congress",
    insider: "Corporate insiders",
    polymarket: "Polymarket",
  };

  var VENUE_BLURB = {
    congress: "U.S. House STOCK Act filings",
    insider: "SEC Form 4 filings",
    polymarket: "Prediction-market holdings",
  };

  var SIGNAL_TONE = {
    divergence: "var(--warn)",
    consensus_long: "var(--long)",
    consensus_short: "var(--short)",
    cluster: "var(--polymarket)",
    late_disclosure: "var(--warn)",
  };

  var SIGNAL_NAME = {
    divergence: "Divergence",
    consensus_long: "Consensus buy",
    consensus_short: "Consensus sell",
    cluster: "Crowding",
    late_disclosure: "Late disclosure",
  };

  // --------------------------------------------------------------- helpers

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function venueTag(venue) {
    return el("span", "tag tag-" + venue, VENUE_NAME[venue] || venue);
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setEmpty(node, message, colspan) {
    clear(node);
    if (node.tagName === "TBODY") {
      var row = el("tr");
      var cell = el("td", "empty", message);
      cell.colSpan = colspan || 6;
      row.appendChild(cell);
      node.appendChild(row);
    } else {
      node.appendChild(el("div", "empty", message));
    }
  }

  // ------------------------------------------------------------------ load

  function fetchWithTimeout(url) {
    // AbortController keeps a hung backend from stalling the page: after
    // API_TIMEOUT_MS we give up and render the embedded snapshot instead.
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, API_TIMEOUT_MS);

    return fetch(url, { signal: controller.signal })
      .then(function (response) {
        clearTimeout(timer);
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .catch(function (error) {
        clearTimeout(timer);
        throw error;
      });
  }

  function setLoading(isLoading) {
    state.loading = isLoading;

    var badge = document.getElementById("data-mode");
    var button = document.getElementById("refresh-btn");

    button.disabled = isLoading;
    button.setAttribute("aria-busy", isLoading ? "true" : "false");
    button.textContent = isLoading ? "Loading…" : "Reload";

    if (isLoading) {
      badge.className = "badge badge-muted";
      badge.textContent = "connecting…";
      // Only skeleton the first load. On a manual reload the existing data is
      // still on screen and still true, so replacing it with placeholders
      // would be a downgrade.
      if (!state.overview) renderSkeletons();
    }
  }

  function renderSkeletons(cardCount) {
    var host = document.getElementById("signals");
    clear(host);
    for (var index = 0; index < (cardCount || 6); index += 1) {
      var card = el("div", "skeleton");
      card.setAttribute("aria-hidden", "true");
      ["w-30", "w-100", "w-80", "w-60"].forEach(function (width) {
        card.appendChild(el("div", "skeleton-line " + width));
      });
      host.appendChild(card);
    }
  }

  function load() {
    if (state.loading) return Promise.resolve();
    setLoading(true);

    return fetchWithTimeout(API_BASE + "/api/overview")
      .then(function (data) {
        state.overview = data;
        state.live = true;
        state.error = null;
      })
      .catch(function (error) {
        var snapshot = window.FINANCERT_FALLBACK || null;
        state.live = false;
        if (snapshot) {
          // Degraded, not broken: the snapshot is real data, just not current.
          state.overview = snapshot;
          state.error = null;
        } else {
          state.overview = null;
          state.error = error && error.name === "AbortError" ? "timeout" : "unreachable";
        }
      })
      .then(function () {
        setLoading(false);
        render();
      });
  }

  // ---------------------------------------------------------------- render

  function render() {
    var data = state.overview;
    var badge = document.getElementById("data-mode");

    if (!data) {
      badge.className = "badge badge-error";
      badge.textContent = state.error === "timeout" ? "timed out" : "unreachable";
      renderErrorState();
      return;
    }

    if (state.live) {
      badge.className = "badge badge-live";
      badge.textContent = "live API";
    } else {
      badge.className = "badge badge-fallback";
      badge.textContent = "offline snapshot";
    }

    renderStats(data);
    renderVenues(data);
    renderSignalFilters(data);
    renderSignals(data);
    renderConviction(data);
    renderContested(data);
    renderVenueFilters(data);
    renderActivity(data);
  }

  function renderErrorState() {
    var host = document.getElementById("signals");
    clear(host);

    var block = el("div", "state-block");
    block.appendChild(el("div", "state-title", "Can't reach the API"));
    block.appendChild(
      el(
        "p",
        "state-detail",
        state.error === "timeout"
          ? "The API at localhost:8000 didn't respond in time, and no offline snapshot is bundled."
          : "Nothing is serving localhost:8000, and no offline snapshot is bundled. Start it with `make run` in backend/, or run `make seed && make fallback` to build a snapshot."
      )
    );

    var retry = el("button", "ghost-btn", "Try again");
    retry.type = "button";
    retry.addEventListener("click", load);
    block.appendChild(retry);

    host.appendChild(block);

    // Wipe the summary rather than leaving stale figures standing next to an
    // error that says we have no data.
    ["stat-usd", "stat-positions", "stat-actors", "stat-window"].forEach(function (id) {
      document.getElementById(id).textContent = "—";
    });
    clear(document.getElementById("venue-row"));
    clear(document.getElementById("signal-filters"));
    clear(document.getElementById("venue-filters"));
    setEmpty(document.getElementById("conviction-body"), "No data.", 5);
    setEmpty(document.getElementById("contested-body"), "No data.", 4);
    setEmpty(document.getElementById("activity-body"), "No data.", 6);
  }

  function renderStats(data) {
    document.getElementById("stat-usd").textContent = money(data.total_usd_tracked);
    document.getElementById("stat-positions").textContent = count(data.total_positions);
    document.getElementById("stat-actors").textContent = count(data.total_actors);
    document.getElementById("stat-window").textContent = count(data.lookback_days) + "d";
  }

  function renderVenues(data) {
    var row = document.getElementById("venue-row");
    clear(row);

    (data.venues || []).forEach(function (venue) {
      var card = el("div", "venue-card" + (venue.position_count ? "" : " is-empty"));
      card.style.setProperty("--accent-venue", "var(--" + venue.venue + ")");

      card.appendChild(el("h3", null, VENUE_NAME[venue.venue] || venue.venue));

      var meta = el("div", "venue-meta");
      meta.appendChild(el("span", null, count(venue.position_count) + " moves"));
      meta.appendChild(el("span", "dim", "  ·  "));
      meta.appendChild(el("span", null, count(venue.actor_count) + " people"));
      meta.appendChild(el("span", "dim", "  ·  "));
      meta.appendChild(el("span", null, money(venue.usd_tracked)));
      card.appendChild(meta);

      var sub = VENUE_BLURB[venue.venue] || "";
      if (!venue.position_count) {
        sub += " — nothing ingested yet";
      } else if (venue.last_activity_at) {
        sub += " — latest " + shortDate(venue.last_activity_at);
      }
      card.appendChild(el("div", "venue-sub", sub));
      row.appendChild(card);
    });
  }

  function renderSignalFilters(data) {
    var host = document.getElementById("signal-filters");
    clear(host);

    var kinds = [];
    (data.top_signals || []).forEach(function (signal) {
      if (kinds.indexOf(signal.kind) === -1) kinds.push(signal.kind);
    });
    if (kinds.length < 2) return;

    makeChip(host, "All", state.signalFilter === null, function () {
      state.signalFilter = null;
      renderSignalFilters(data);
      renderSignals(data);
    });

    kinds.forEach(function (kind) {
      makeChip(host, SIGNAL_NAME[kind] || kind, state.signalFilter === kind, function () {
        state.signalFilter = kind;
        renderSignalFilters(data);
        renderSignals(data);
      });
    });
  }

  function makeChip(host, label, pressed, onClick) {
    var chip = el("button", "chip", label);
    chip.type = "button";
    chip.setAttribute("aria-pressed", pressed ? "true" : "false");
    chip.addEventListener("click", onClick);
    host.appendChild(chip);
    return chip;
  }

  function renderSignals(data) {
    var host = document.getElementById("signals");
    clear(host);

    var signals = (data.top_signals || []).filter(function (signal) {
      return !state.signalFilter || signal.kind === state.signalFilter;
    });

    if (!signals.length) {
      setEmpty(host, "No signals yet. Ingest more data, then recompute.");
      return;
    }

    signals.forEach(function (signal) {
      var tone = SIGNAL_TONE[signal.kind] || "var(--text-dim)";
      var card = el("article", "signal");
      card.style.setProperty("--tone", tone);

      var top = el("div", "signal-top");
      top.appendChild(el("span", "signal-kind", SIGNAL_NAME[signal.kind] || signal.kind));

      var strength = el("div", "strength");
      var bar = el("span", "strength-bar");
      var fill = el("span");
      fill.style.width = Math.round((signal.strength || 0) * 100) + "%";
      bar.appendChild(fill);
      strength.appendChild(bar);
      strength.appendChild(el("span", null, (signal.strength || 0).toFixed(2)));
      top.appendChild(strength);
      card.appendChild(top);

      card.appendChild(el("h3", "signal-headline", signal.headline));
      if (signal.detail) card.appendChild(el("p", "signal-detail", signal.detail));

      var foot = el("div", "signal-foot");
      String(signal.venues || "")
        .split(",")
        .filter(Boolean)
        .forEach(function (venue) {
          foot.appendChild(venueTag(venue));
        });
      if (signal.actor_count) {
        foot.appendChild(el("span", "tag", signal.actor_count + (signal.actor_count === 1 ? " person" : " people")));
      }
      card.appendChild(foot);

      host.appendChild(card);
    });
  }

  function subjectCell(subject) {
    var cell = el("td");
    var wrap = el("div", "subject-cell");
    var key = String(subject.subject_key || "");
    // Polymarket keys are "pm:<slug>" and unbracketed names are "NAME:<...>";
    // neither is a symbol, so show the human label as the primary line.
    var isTicker = key && key.indexOf(":") === -1;
    wrap.appendChild(el("span", "subject-key", isTicker ? key : titleCase(subject.subject_label || key)));
    if (isTicker && subject.subject_label) {
      wrap.appendChild(el("span", "subject-label", titleCase(subject.subject_label)));
    }
    cell.appendChild(wrap);
    return cell;
  }

  function renderConviction(data) {
    var body = document.getElementById("conviction-body");
    clear(body);

    var rows = data.most_conviction || [];
    if (!rows.length) {
      setEmpty(body, "Nothing scored yet.", 5);
      return;
    }

    rows.forEach(function (subject) {
      var tr = el("tr");
      tr.appendChild(subjectCell(subject));

      var conviction = Number(subject.conviction || 0);
      var convictionCell = el("td", "num " + (conviction >= 0 ? "long" : "short"));
      convictionCell.textContent = (conviction >= 0 ? "+" : "") + conviction.toFixed(2);
      tr.appendChild(convictionCell);

      var consensus = Number(subject.consensus || 0);
      var leanCell = el("td", "num");
      leanCell.appendChild(leanBar(subject.long_weight, subject.short_weight));
      leanCell.appendChild(el("div", "dim", (consensus >= 0 ? "+" : "") + (consensus * 100).toFixed(0) + "%"));
      tr.appendChild(leanCell);

      tr.appendChild(el("td", "num", count(subject.actor_count)));

      var venuesCell = el("td");
      String(subject.venues || "")
        .split(",")
        .filter(Boolean)
        .forEach(function (venue) {
          venuesCell.appendChild(venueTag(venue));
          venuesCell.appendChild(document.createTextNode(" "));
        });
      tr.appendChild(venuesCell);

      body.appendChild(tr);
    });
  }

  function leanBar(longWeight, shortWeight) {
    var total = Number(longWeight || 0) + Number(shortWeight || 0);
    var bar = el("span", "lean-bar");
    var longPct = total > 0 ? (Number(longWeight || 0) / total) * 100 : 0;
    var buy = el("i", "b");
    buy.style.width = longPct + "%";
    var sell = el("i", "s");
    sell.style.width = 100 - longPct + "%";
    bar.appendChild(buy);
    bar.appendChild(sell);
    return bar;
  }

  function renderContested(data) {
    var body = document.getElementById("contested-body");
    clear(body);

    var rows = data.most_contested || [];
    if (!rows.length) {
      setEmpty(body, "No contested subjects — nothing has money on both sides yet.", 4);
      return;
    }

    rows.forEach(function (subject) {
      var tr = el("tr");
      tr.appendChild(subjectCell(subject));

      var split = el("td", "num");
      split.appendChild(leanBar(subject.long_weight, subject.short_weight));
      var totals = el("div", "dim");
      totals.textContent = money(subject.usd_long) + " / " + money(subject.usd_short);
      split.appendChild(totals);
      tr.appendChild(split);

      tr.appendChild(el("td", "num", count(subject.actor_count)));

      var venuesCell = el("td");
      String(subject.venues || "")
        .split(",")
        .filter(Boolean)
        .forEach(function (venue) {
          venuesCell.appendChild(venueTag(venue));
          venuesCell.appendChild(document.createTextNode(" "));
        });
      tr.appendChild(venuesCell);

      body.appendChild(tr);
    });
  }

  function renderVenueFilters(data) {
    var host = document.getElementById("venue-filters");
    clear(host);

    makeChip(host, "All sources", state.venueFilter === null, function () {
      state.venueFilter = null;
      renderVenueFilters(data);
      renderActivity(data);
    });

    (data.venues || []).forEach(function (venue) {
      if (!venue.position_count) return;
      makeChip(host, VENUE_NAME[venue.venue] || venue.venue, state.venueFilter === venue.venue, function () {
        state.venueFilter = venue.venue;
        renderVenueFilters(data);
        renderActivity(data);
      });
    });
  }

  function renderActivity(data) {
    var body = document.getElementById("activity-body");
    clear(body);

    var rows = (data.recent_positions || []).filter(function (position) {
      return !state.venueFilter || position.venue === state.venueFilter;
    });

    if (!rows.length) {
      setEmpty(body, "No activity for this source.", 6);
      return;
    }

    rows.forEach(function (position) {
      var tr = el("tr");

      // --- who
      var who = el("td");
      var whoWrap = el("div", "who-cell");
      whoWrap.appendChild(el("span", "who-name", position.actor_name));
      var role = [position.actor_title, position.actor_affiliation].filter(Boolean).join(" · ");
      if (role) whoWrap.appendChild(el("span", "who-role", role));
      whoWrap.appendChild(venueTag(position.venue));
      who.appendChild(whoWrap);
      tr.appendChild(who);

      // --- move
      var isBuy = Number(position.direction) > 0;
      var move = el("td");
      var moveText = el("span", "move " + (isBuy ? "long" : "short"));
      moveText.textContent = (isBuy ? "▲ " : "▼ ") + (position.raw_label || (isBuy ? "Buy" : "Sell"));
      move.appendChild(moveText);
      if (position.notes) move.appendChild(el("div", "note", position.notes));
      tr.appendChild(move);

      // --- subject
      var subject = el("td");
      var wrap = el("div", "subject-cell");
      var key = String(position.subject_key || "");
      var isTicker = key && key.indexOf(":") === -1;
      var primary = isTicker ? key : titleCase(position.subject_label || key);
      if (position.source_url) {
        var link = el("a", "src", primary);
        link.href = position.source_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        wrap.appendChild(link);
      } else {
        wrap.appendChild(el("span", "subject-key", primary));
      }
      if (isTicker && position.subject_label) {
        wrap.appendChild(el("span", "subject-label", titleCase(position.subject_label)));
      }
      subject.appendChild(wrap);
      tr.appendChild(subject);

      // --- size. Bracketed sources get a range, exact sources a single figure.
      var size = el("td", "num");
      if (position.usd_low != null && position.usd_high != null && position.usd_low !== position.usd_high) {
        size.textContent = money(position.usd_low) + "–" + money(position.usd_high);
      } else {
        size.textContent = money(position.usd_estimate);
      }
      tr.appendChild(size);

      tr.appendChild(el("td", "num", shortDate(position.transacted_at)));

      // --- disclosure lag
      var lag = el("td", "num");
      if (position.disclosure_lag_days == null) {
        lag.textContent = "—";
        lag.className = "num dim";
      } else {
        lag.textContent = position.disclosure_lag_days + "d";
        // 45 days is the STOCK Act ceiling; past it, flag it.
        if (position.venue === "congress" && position.disclosure_lag_days > 45) {
          lag.className = "num late";
          lag.title = "Past the STOCK Act's 45-day disclosure deadline";
        }
      }
      tr.appendChild(lag);

      body.appendChild(tr);
    });
  }

  // ------------------------------------------------------------------ boot

  document.getElementById("refresh-btn").addEventListener("click", load);
  load();
})();
