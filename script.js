let game = null;

const parseTimestamp = (filename) => {
  const [_, date, time] = filename.match(/_(\d{8})_(\d{6})/) ?? [];
  if (!date) return null;
  return new Date(
    +date.slice(0, 4),
    +date.slice(4, 6) - 1,
    +date.slice(6),
    +time.slice(0, 2),
    +time.slice(2, 4),
    +time.slice(4)
  );
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const loadGame = async (filename) => {
  const lines = (
    await fetch(`https://raw.githubusercontent.com/sanand0/elimination_game/refs/heads/main/logs/${filename}`).then(
      (r) => r.text()
    )
  )
    .trim()
    .split("\n")
    .map(JSON.parse);

  // Extract players from first few lines
  const players = {};
  lines
    .filter((l) => l.type === "conversation" && l.round === 1 && l.subround === 1)
    .forEach((l) => {
      const player = `P${l.player_id.match(/Player(\d+)/)[1]}`;
      const model = l.player_id.split("_").slice(2).join("_").replace(/_/g, "-");
      players[player] = { id: l.player_id, model };
    });

  // Track eliminated players and alliance/vote history
  const eliminated = {};
  const roundAlliances = [];
  const roundVotes = [];
  let currentRound = 1;
  let currentAlliances = {};
  let currentVotes = {};

  // Transform each line into a step
  game = {
    game: filename,
    players,
    steps: lines.map((event, step) => {
      // Update round history when round changes
      if (event.round > currentRound) {
        roundAlliances[currentRound - 1] = { ...currentAlliances };
        roundVotes[currentRound - 1] = { ...currentVotes };
        currentRound = event.round;
        currentAlliances = {};
        currentVotes = {};
      }

      // Track alliances for current round
      if (event.type === "preference_outcome") {
        if (event.rejected) {
          // Do nothing for rejected proposals
        } else {
          // Remove existing alliances
          for (let player of [event.accepted, event.target])
            if (currentAlliances[player] && currentAlliances[currentAlliances[player]])
              delete currentAlliances[currentAlliances[player]];
          // Add new alliance
          currentAlliances[event.accepted] = event.target;
          currentAlliances[event.target] = event.accepted;
        }
      }

      // Track votes for current round
      if (event.type === "vote" && event.public_vote) {
        const voter = event.voter_id.match(/Player(\d+)/)[1];
        const target = event.target_id.match(/Player(\d+)/)?.[1];
        if (target) currentVotes[`P${voter}`] = `P${target}`;
      }

      // Update eliminated players on elimination
      if (event.type === "elimination") {
        const player = `P${event.eliminated_player.match(/Player(\d+)/)[1]}`;
        eliminated[player] = event.round;
      }

      // Update eliminated players after jury round
      if (event.type == "final_results")
        for (const player in players)
          if (event.winners.indexOf(players[player].id) < 0) eliminated[player] = eliminated[player] ?? currentRound;

      return {
        step,
        round: event.round || currentRound,
        subround: event.subround || 1,
        event,
        eliminated: { ...eliminated },
        alliances: [...roundAlliances, { ...currentAlliances }],
        votes: [...roundVotes, { ...currentVotes }],
      };
    }),
  };
  const slider = document.getElementById("timelineScrubber");
  slider.max = game.steps.length - 1;
  slider.value = 0;
  updateHash(filename, slider.value);
};

const colors = {
  P1: "#e6194B", // Red
  P2: "#3cb44b", // Green
  P3: "#4363d8", // Blue
  P4: "#f58231", // Orange
  P5: "#911eb4", // Purple
  P6: "#42d4f4", // Cyan
  P7: "#f032e6", // Magenta
  P8: "#9A6324", // Brown
};

const stages = {
  conversation: { text: "Public chat", class: "text-bg-success" },
  private: { text: "Private chat", class: "text-bg-info" },
  preference_proposal: { text: "Alliances", class: "text-bg-warning" },
  preference_outcome: { text: "Alliances", class: "text-bg-warning" },
  preference_result: { text: "Alliances", class: "text-bg-warning" },
  private_vote_reason: { text: "Voting", class: "text-bg-danger" },
  private_revote_reason: { text: "Voting", class: "text-bg-danger" },
  private_jury_reason: { text: "Voting", class: "text-bg-danger" },
  vote: { text: "Voting", class: "text-bg-danger" },
  elimination: { text: "Elimination", class: "text-bg-secondary" },
  final_results: { text: "Done", class: "text-bg-dark" },
};

import { render, html, svg } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";

const RADIUS = 300; // SVG viewport radius
const PLAYER_RADIUS = 25; // Player circle radius
const CENTER_RADIUS = 135; // Center text container radius

// Get player positions in a circle
const getPositions = () => {
  const positions = {};
  const n = Object.keys(game.players).length;
  Object.keys(game.players).forEach((p, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions[p] = {
      x: RADIUS + RADIUS * 0.6 * Math.cos(angle),
      y: RADIUS + RADIUS * 0.6 * Math.sin(angle),
    };
  });
  return positions;
};

// Draw arrow between points with optional color and highlight
const drawArrow = (x1, y1, x2, y2, color = "black", highlight = false) => {
  const id = `arrow-${color}`.replace(/[^a-zA-Z0-9-]/g, "-");
  // Calculate midpoint
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return svg`
    <defs>
      <marker id="${id}" viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
      </marker>
    </defs>
    <line x1="${x1}" y1="${y1}" x2="${mx}" y2="${my}"
          stroke="${color}" stroke-width="${highlight ? 3 : 1}"
          marker-end="url(#${id})"
          opacity="${highlight ? 0.8 : 0.4}"/>
    <line x1="${mx}" y1="${my}" x2="${x2}" y2="${y2}"
          stroke="${color}" stroke-width="${highlight ? 3 : 1}"
          opacity="${highlight ? 0.8 : 0.4}"/>
  `;
};

const drawStage = (step) => {
  const state = game.steps[step];
  const positions = getPositions();

  // Helper to render model name as badge
  const modelBadge = (id) => {
    if (!id) return "";
    const match = id.match(/Player(\d+)/);
    return match ? badge(`P${match[1]}`) : "";
  };

  // Draw background arrows for alliances and votes
  const backgroundArrows = [];

  // Draw alliances
  const currentAlliances = state.alliances.at(-1) || {};
  Object.entries(currentAlliances).forEach(([from, to]) => {
    const f = positions[from];
    const t = positions[to];
    if (f && t) backgroundArrows.push(drawArrow(f.x, f.y, t.x, t.y, "rgba(0, 128, 0, 0.5)", false));
  });

  // Draw votes
  const currentVotes = state.votes.at(-1) || {};
  Object.entries(currentVotes).forEach(([from, to]) => {
    const f = positions[from];
    const t = positions[`P${to}`];
    if (f && t) backgroundArrows.push(drawArrow(f.x, f.y, t.x, t.y, "red", false));
  });

  // Prepare highlights and arrows based on event type
  let highlights = [];
  let arrows = [];
  let centerText = "";

  // Add speaker info to centerText
  const getHeaderText = () => {
    const e = state.event;
    switch (e.type) {
      case "conversation":
        return modelBadge(e.player_id);
      case "private":
        return html`${modelBadge(e.speaker_id)} <i class="bi bi-arrow-right"></i> ${modelBadge(e.target_id)}`;
      case "preference_proposal":
        return html`${modelBadge(game.players[e.proposer].id)} 😍 ${modelBadge(game.players[e.target].id)}`;
      case "preference_outcome":
        return e.rejected
          ? html`${modelBadge(game.players[e.target].id)} ❌ ${modelBadge(game.players[e.rejected].id)}`
          : html`${modelBadge(game.players[e.target].id)} ❤️ ${modelBadge(game.players[e.accepted].id)}`;
      case "private_vote_reason":
      case "private_revote_reason":
      case "private_jury_reason":
      case "vote":
        return html`${modelBadge(e.voter_id)} <i class="bi bi-arrow-right text-danger"></i> ${modelBadge(e.target_id)}`;
      default:
        return "";
    }
  };

  switch (state.event.type) {
    case "conversation": {
      const match = state.event.player_id.match(/Player(\d+)/);
      if (match) {
        const p = `P${match[1]}`;
        const pos = positions[p];
        highlights.push(svg`
          <circle cx="${pos.x}" cy="${pos.y}" r="${PLAYER_RADIUS * 2.5}"
                  fill="var(--bs-body-color)" opacity="0.2"/>
        `);
      }
      centerText = state.event.message;
      break;
    }
    case "private": {
      const [sp, tp] = [state.event.speaker_id, state.event.target_id].map((id) => {
        const match = id.match(/Player(\d+)/);
        return match ? `P${match[1]}` : null;
      });
      if (sp && tp) {
        const s = positions[sp],
          t = positions[tp];
        arrows.push(drawArrow(s.x, s.y, t.x, t.y, "#666666", true));
        highlights.push(svg`
          <circle cx="${s.x}" cy="${s.y}" r="${PLAYER_RADIUS * 2.5}"
                  fill="var(--bs-body-color)" opacity="0.2"/>
        `);
      }
      centerText = state.event.message;
      break;
    }
    case "preference_proposal": {
      const [s, t] = [positions[state.event.proposer], positions[state.event.target]];
      arrows.push(drawArrow(s.x, s.y, t.x, t.y, "#ffd700", true));
      centerText = html`${modelBadge(game.players[state.event.proposer].id)} proposes to
      ${modelBadge(game.players[state.event.target].id)}`;
      break;
    }
    case "preference_outcome": {
      const pos = positions[state.event.target];
      if (state.event.rejected) {
        const rpos = positions[state.event.rejected];
        arrows.push(drawArrow(pos.x, pos.y, rpos.x, rpos.y, "red", true));
        centerText = html`${modelBadge(game.players[state.event.target].id)} rejects
        ${modelBadge(game.players[state.event.rejected].id)}`;
      } else {
        const apos = positions[state.event.accepted];
        arrows.push(drawArrow(pos.x, pos.y, apos.x, apos.y, "green", true));
        if (state.event.replaced) {
          const rpos = positions[state.event.replaced];
          arrows.push(drawArrow(pos.x, pos.y, rpos.x, rpos.y, "red", true));
          centerText = html`${modelBadge(game.players[state.event.target].id)} accepts
          ${modelBadge(game.players[state.event.accepted].id)} replacing
          ${modelBadge(game.players[state.event.replaced].id)}`;
        } else {
          centerText = html`${modelBadge(game.players[state.event.target].id)} accepts
          ${modelBadge(game.players[state.event.accepted].id)}`;
        }
      }
      break;
    }
    case "preference_result":
      centerText = "Alliances formed";
      break;
    case "private_vote_reason":
    case "private_revote_reason":
    case "private_jury_reason":
    case "vote": {
      const [sp, tp] = [state.event.voter_id, state.event.target_id].map((id) => {
        const match = id?.match(/Player(\d+)/);
        return match ? `P${match[1]}` : null;
      });
      if (sp && tp) {
        const s = positions[sp],
          t = positions[tp];
        arrows.push(drawArrow(s.x, s.y, t.x, t.y, "red", true));
      }
      centerText = state.event.type.includes("reason")
        ? state.event.reason
        : html`${modelBadge(state.event.voter_id)} voted against ${modelBadge(state.event.target_id)}`;
      break;
    }
    case "elimination":
      centerText = "Elimination starts";
      break;
    case "final_results":
      centerText = html`Winner: ${state.event.winners.map((w) => modelBadge(w))}`;
      break;
  }

  return html`
    <svg viewBox="0 0 ${RADIUS * 2} ${RADIUS * 2}" class="w-100 h-100" width="1000">
      ${backgroundArrows} ${highlights} ${arrows}

      <!-- Draw players -->
      ${Object.entries(game.players).map(([p, data]) => {
        const pos = positions[p];
        const opacity = state.eliminated[p] ? 0.05 : 1;
        return svg`
          <g opacity="${opacity}">
            <circle cx="${pos.x}" cy="${pos.y}" r="${PLAYER_RADIUS}"
                    fill="${colors[p]}"/>
            <text x="${pos.x}" y="${pos.y}"
                  text-anchor="middle" dominant-baseline="middle"
                  fill="white" font-size="${PLAYER_RADIUS}">
              ${p.slice(1)}
            </text>
            <text x="${pos.x}" y="${pos.y - PLAYER_RADIUS - 5}"
                  text-anchor="middle" fill="currentColor"
                  font-size="12">
              ${data.model}
            </text>
          </g>
        `;
      })}

      <!-- Center text -->
      <foreignObject
        x="${RADIUS - CENTER_RADIUS}"
        y="${RADIUS - CENTER_RADIUS}"
        width="${CENTER_RADIUS * 2}"
        height="${CENTER_RADIUS * 2}"
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          class="conversation d-flex align-items-center justify-content-center h-100 p-4"
        >
          <div class="text-center">
            ${getHeaderText() ? html`<h6 class="mb-2">${getHeaderText()}</h6>` : ""} ${centerText}
          </div>
        </div>
      </foreignObject>
    </svg>
  `;
};

const badge = (player) => html`
  <span
    class="badge"
    style="background-color:${colors[player]}"
    data-bs-toggle="tooltip"
    title="${game.players[player]?.model}"
  >
    ${player?.slice(1)}
  </span>
`;

const playerBadge = (playerId) => {
  if (!playerId || !game) return "";
  const match = playerId.match(/Player(\d+)/);
  return match ? badge(`P${match[1]}`) : "";
};

const chatMessage = (event, step) => {
  const message = html`<div
    class="d-flex align-items-start gap-2 mb-2 p-2"
    role="button"
    @click=${() => updateHash(game.game, step)}
  >
    // ...existing message content...
  </div>`;
  switch (event.type) {
    case "conversation":
      return html`<div class="d-flex align-items-start gap-2 mb-2 p-2">
        ${playerBadge(event.player_id)}
        <div class="text-break">${event.message}</div>
      </div>`;
    case "private":
      return html`<div class="d-flex align-items-start gap-2 mb-2 p-2">
        ${playerBadge(event.speaker_id)}
        <span data-bs-toggle="tooltip" title="private message to">🢂</span>
        ${playerBadge(event.target_id)}
        <div class="text-break">${event.message}</div>
      </div>`;
    case "preference_proposal":
      return html`<div class="d-flex align-items-center gap-2 mb-2 p-2">
        ${badge(event.proposer)}
        <span data-bs-toggle="tooltip" title="proposed to">😍</span>
        ${badge(event.target)} #${event.rank_of_target}
      </div>`;
    case "preference_outcome":
      return html`<div class="d-flex align-items-center gap-2 mb-2 p-2">
        ${badge(event.target)}
        ${event.rejected
          ? html`<span data-bs-toggle="tooltip" title="rejected">❌</span> ${badge(event.rejected)}`
          : html`<span data-bs-toggle="tooltip" title="accepted">❤️</span> ${badge(event.accepted)}
              ${event.replaced
                ? html`<span data-bs-toggle="tooltip" title="replaced">❌</span> ${badge(event.replaced)}`
                : ""}`}
      </div>`;
    case "preference_result":
      return html`<div class="text-muted small mb-2">Alliances formed</div>`;
    case "private_vote_reason":
    case "private_revote_reason":
    case "private_jury_reason":
      return html`<div class="d-flex align-items-start gap-2 mb-2 p-2">
        ${playerBadge(event.voter_id)}
        <span data-bs-toggle="tooltip" title="voted to eliminate">👎</span>
        ${playerBadge(event.target_id)}
        <div class="text-break">${event.reason}</div>
      </div>`;
    case "vote":
      return html`<div class="d-flex gap-2 mb-2">
        ${playerBadge(event.voter_id)} 👎 ${playerBadge(event.target_id)}
      </div>`;
    case "elimination":
      return html`<div class="text-muted small mb-2">Elimination starts</div>`;
    case "final_results":
      return html`<div class="d-flex gap-2 mb-2">Winners: ${event.winners.map((w) => badge(w))}</div>`;
  }
};

const tableRow = (round, data, eliminated) => html`
  <tr>
    <td class="text-end">${round}</td>
    ${Object.keys(colors).map(
      (p) => html`
        <td class="text-center ${eliminated[p] < round ? "bg-secondary bg-opacity-25" : ""}">${badge(data[p])}</td>
      `
    )}
  </tr>
`;

const table = (step, type) => {
  const data = game.steps[step][type];
  if (!data?.length) return "";

  return html`
    <div class="table-responsive">
      <table class="table table-sm mb-0">
        <thead class="table-dark">
          <tr>
            <th class="text-end">#</th>
            ${Object.keys(colors).map((p) => html`<th class="text-center">${badge(p)}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${data.map((row, i) => tableRow(i + 1, row, game.steps[step].eliminated))}
        </tbody>
      </table>
    </div>
  `;
};

const updateHash = (filename, step) => {
  const hash = `#?game=${filename}&step=${step}`;
  if (location.hash !== hash) {
    history.replaceState(null, "", hash);
    handleHashChange();
  }
};

const handleHashChange = () => redraw(+new URLSearchParams(location.hash.slice(2)).get("step") || 0);

const redraw = (step) => {
  const state = game.steps[step];
  const stage = stages[state.event.type];
  const activePlayers = Object.keys(game.players).length - Object.keys(state.eliminated).length;

  document.getElementById("roundVal").textContent = state.round;
  document.getElementById("stageVal").textContent = stage.text;
  document.getElementById("stageVal").className = `fs-4 fw-bold badge ${stage.class}`;
  document.getElementById("playersVal").textContent = activePlayers;

  render(drawStage(step), document.getElementById("step"));
  render(table(step, "alliances"), document.getElementById("alliancesSection").querySelector(".accordion-body"));
  render(table(step, "votes"), document.getElementById("eliminationsSection").querySelector(".accordion-body"));

  const chatHistory = game.steps.slice(0, step + 1).map((s) => chatMessage(s.event));
  render(
    html` <div style="max-height: 15em; overflow-y: auto" class="pe-2">${chatHistory}</div> `,
    document.getElementById("chatSection").querySelector(".accordion-body")
  );

  // Initialize tooltips
  document
    .querySelectorAll('[data-bs-toggle="tooltip"]')
    .forEach((el) => new bootstrap.Tooltip(el, { placement: "top" }));
};

const init = async () => {
  const select = document.getElementById("gameSelect");
  const games = (await fetch("logs.txt").then((r) => r.text())).trim().split("\n");

  select.replaceChildren();
  select.insertAdjacentHTML(
    "beforeend",
    `
        <option value="">Select game...</option>
        ${games
          .map((filename) => {
            const date = parseTimestamp(filename);
            return date ? `<option value="${filename}">${dateFormatter.format(date)}</option>` : "";
          })
          .join("")}
    `
  );

  select.addEventListener("change", (e) => e.target.value && loadGame(e.target.value));
  document
    .getElementById("timelineScrubber")
    .addEventListener("input", (e) => game && updateHash(select.value, e.target.value));
  window.addEventListener("hashchange", handleHashChange);

  const gameFile = new URLSearchParams(location.hash.slice(2)).get("game");
  const step = +new URLSearchParams(location.hash.slice(2)).get("step") || 0;
  if (gameFile) {
    select.value = gameFile;
    await loadGame(gameFile);
    document.getElementById("timelineScrubber").value = step;
    updateHash(gameFile, step);
    redraw(step);
  }
};

init();
