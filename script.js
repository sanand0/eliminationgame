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
  lines.filter(l => l.type === 'conversation' && l.round === 1 && l.subround === 1)
    .forEach(l => {
      const player = `P${l.player_id.match(/Player(\d+)/)[1]}`;
      const model = l.player_id.split('_').pop();
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
      if (event.type === 'preference_result') {
        event.matched_pairs.forEach(([p1, p2]) => {
          const p1short = p1.replace('Player', 'P');
          const p2short = p2.replace('Player', 'P');
          currentAlliances[p1short] = p2short;
          currentAlliances[p2short] = p1short;
        });
      }

      // Track votes for current round
      if (event.type === 'vote' && event.public_vote) {
        const voter = event.voter_id.match(/Player(\d+)/)[1];
        const target = event.target_id.match(/Player(\d+)/)?.[1];
        if (target) {
          currentVotes[`P${voter}`] = `P${target}`;
        }
      }

      // Update eliminated players on elimination
      if (event.type === 'elimination') {
        const player = `P${event.eliminated_player.match(/Player(\d+)/)[1]}`;
        eliminated[player] = event.round;
      }

      return {
        step,
        round: event.round || currentRound,
        subround: event.subround || 1,
        event,
        eliminated: { ...eliminated },
        alliances: [...roundAlliances],
        votes: [...roundVotes]
      };
    })
  };
  console.log(game);
  const slider = document.getElementById('timelineScrubber');
  slider.max = game.steps.length - 1;
  slider.value = 1;
  updateHash(filename, 1);
};

const colors = {
  P1: '#e6194B', // Red
  P2: '#3cb44b', // Green
  P3: '#4363d8', // Blue
  P4: '#f58231', // Orange
  P5: '#911eb4', // Purple
  P6: '#42d4f4', // Cyan
  P7: '#f032e6', // Magenta
  P8: '#9A6324'  // Brown
};

import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";

const badge = (player) => html`
  <span class="badge" style="background-color:${colors[player]}">${player?.slice(1)}</span>
`;

const playerBadge = (playerId) => {
  if (!playerId || !game) return '';
  const match = playerId.match(/Player(\d+)/);
  return match ? badge(`P${match[1]}`) : '';
};

const chatMessage = (event) => {
  switch (event.type) {
    case 'conversation':
      return html`<div class="d-flex gap-2 mb-2">
        ${playerBadge(event.player_id)} <div>${event.message}</div>
      </div>`;
    case 'private':
      return html`<div class="d-flex gap-2 mb-2 bg-danger-subtle rounded p-2">
        ${playerBadge(event.speaker_id)} 🢂 ${playerBadge(event.target_id)} <div>${event.message}</div>
      </div>`;
    case 'preference_proposal':
      return html`<div class="d-flex gap-2 mb-2">
        ${badge(event.proposer)} 😍 ${badge(event.target)} #${event.rank_of_target}
      </div>`;
    case 'preference_outcome':
      return html`<div class="d-flex gap-2 mb-2">
        ${badge(event.target)}
        ${event.rejected ? html`❌ ${badge(event.rejected)}` :
          html`❤️ ${badge(event.accepted)} ${event.replaced ? html`❌ ${badge(event.replaced)}` : ''}`}
      </div>`;
    case 'preference_result':
      return html`<div class="text-muted small mb-2">Alliances formed</div>`;
    case 'private_vote_reason':
    case 'private_revote_reason':
    case 'private_jury_reason':
      return html`<div class="d-flex gap-2 mb-2 bg-warning-subtle rounded p-2">
        ${playerBadge(event.voter_id)} 👎 ${playerBadge(event.target_id)} <div>${event.reason}</div>
      </div>`;
    case 'vote':
      return html`<div class="d-flex gap-2 mb-2">
        ${playerBadge(event.voter_id)} 👎 ${playerBadge(event.target_id)}
      </div>`;
    case 'elimination':
      return html`<div class="text-muted small mb-2">Elimination starts</div>`;
    case 'final_results':
      return html`<div class="d-flex gap-2 mb-2">
        Winners: ${event.winners.map(w => playerBadge(w))}
      </div>`;
  }
};

const tableRow = (round, data, eliminated) => html`
  <tr>
    <td>${round}</td>
    ${Object.keys(colors).map(p => html`
      <td class="${eliminated[p] < round ? 'bg-secondary bg-opacity-25' : ''}">${badge(data[p])}</td>
    `)}
  </tr>
`;

const table = (step, type) => {
  const data = game.steps[step][type];
  if (!data?.length) return '';

  return html`
    <div class="table-responsive">
      <table class="table table-sm mb-0">
        <thead>
          <tr>
            <th>Round</th>
            ${Object.keys(colors).map(p => html`<th>${badge(p)}</th>`)}
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

const handleHashChange = () => redraw(+new URLSearchParams(location.hash.slice(2)).get("step") || 1);

const redraw = step => {
  render(html`Step ${step}`, document.getElementById('step'));
  render(table(step, 'alliances'), document.getElementById('alliancesSection').querySelector('.accordion-body'));
  render(table(step, 'votes'), document.getElementById('eliminationsSection').querySelector('.accordion-body'));

  // Render chat history up to current step
  const chatHistory = game.steps.slice(0, step + 1).map(s => chatMessage(s.event));
  render(html`
    <div style="max-height: 15em; overflow-y: auto">
      ${chatHistory}
    </div>
  `, document.getElementById('chatSection').querySelector('.accordion-body'));
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
  if (gameFile) {
    select.value = gameFile;
    await loadGame(gameFile);
  }
};

init();
