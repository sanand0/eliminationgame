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
  game = (
    await fetch(`https://raw.githubusercontent.com/sanand0/elimination_game/refs/heads/main/logs/${filename}`).then(
      (r) => r.text()
    )
  )
    .trim()
    .split("\n")
    .map(JSON.parse);
  const slider = document.getElementById("timelineScrubber");
  slider.max = game.length;
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
