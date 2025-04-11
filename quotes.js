const $quotes = document.querySelector("#quotes");
const $behaviors = document.querySelector("#behaviors");

await fetch("quotes.json")
  .then((r) => r.json())
  .then((sections) => {
    sections.forEach((section) => {
      // Add section header
      $quotes.innerHTML += `<li><div class="dropdown-header fw-bold">${section.name}</div></li>`;

      // Add quotes under header
      section.quotes.forEach((quote) => {
        $quotes.innerHTML += `<li><a class="dropdown-item small" href="#?game=${quote.game}&step=${quote.step}">${quote.quote}</a></li>`;
      });

      // Add divider after each section except last
      if (section !== sections[sections.length - 1]) $quotes.innerHTML += '<li><hr class="dropdown-divider"></li>';
    });

    $behaviors.innerHTML = sections
      .map(({ name, what, quotes }) => {
        const { game, step, quote } = quotes[Math.floor(Math.random() * quotes.length)];
        return /* html */ `
          <div class="col py-3">
            <div class="demo card h-100">
              <div class="card-body">
                <h5 class="card-title">${name}</h5>
                <p class="card-text">${what}</p>
                <a href="#?game=${game}&step=${step}" class="text-decoration-none text-danger">${quote}</a>
              </div>
            </div>
          </div>`;
      })
      .join("");
  });
