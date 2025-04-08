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

  // Track active players and alliance/vote history
  const active = Object.fromEntries(Object.keys(players).map(p => [p, true]));
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

      // Update active players on elimination
      if (event.type === 'elimination') {
        const eliminated = event.eliminated_player.match(/Player(\d+)/)[1];
        active[`P${eliminated}`] = false;
      }

      return {
        step,
        round: event.round || currentRound,
        subround: event.subround || 1,
        event,
        active: { ...active },
        alliances: [...roundAlliances],
        votes: [...roundVotes]
      };
    })
  };

  const slider = document.getElementById('timelineScrubber');
  slider.max = game.steps.length;
  slider.value = 1;
  updateHash(filename, 1);
};

const updateHash = (filename, step) => {
  const hash = `#?game=${filename}&step=${step}`;
  if (location.hash !== hash) {
    history.replaceState(null, "", hash);
    handleHashChange();
  }
};

const handleHashChange = () => redraw(+new URLSearchParams(location.hash.slice(2)).get("step") || 1);

const redraw = (step) => (document.getElementById("step").textContent = `Step ${step}`);

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
