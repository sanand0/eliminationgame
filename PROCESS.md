# Process

## I spec-ed a data visualization

- The [Elimination Game](https://github.com/lechmazur/elimination_game/) is like LLMs playing Survivor. Fascinating!
- It [helps Straive's business](https://chatgpt.com/share/67f4b6a6-cd2c-800c-952a-9cce8cd8a768) pitch multi-agent capabilities:
  - Understanding AI safety and alignment
  - Teaching material on group dynamics and negotiation
  - Scenario-based data-driven decision making to avoid groupthink
  - Model interactions across reviewers, authors, editors to model bias, integrity, review best practices
  - Research tool for multi-agent simulations
- [ChatGPT shared visualization ideas](https://chatgpt.com/share/67f4bbf9-5084-800c-b42b-95abf8ab9e52) but I [liked Gemini's more](https://g.co/gemini/share/52ad507ea19e).

Based on this, I drew out a visual and explained it to O1 Pro asking it how to break down the task.

![Design Sketch](img/design-sketch.webp)

```
The URL looks like /#?game=286&line=4 indicating that game 286.jsonl must be loaded and line 4 is the current step we're in.

The navbar has:

- An app title
- A game state dashboard with the game number (dropdown), round (number), stage (e.g. voting, alliances, etc.), players (number of players still active)
- A timeline scrubber (a range slider) allowing users to jump to the specific line. This changes the URL which then triggers a change in app state.
- A light/dark theme picker

The stage on the left as a set of models arranged in a circle. Each model/player has a unique and distinct color, a number inside it indicating the player number, a label above it indicating the model name (e.g. GPT-4o), a set of red dots below it when it receives an elimination vote, an arrow pointing from one model to another when a model talks to, plans an alliance with, or votes to eliminate another model. The arrow color depends on the action. When a model performs any action (speaking publicly / privately, voting, allying, etc.) the conversation or action summary is displayed in a semi-transparent overlay at the center of the circle. Eliminated models are shown with a 10% opacity. Allied models are redrawn next to each other with a line connecting them.

The sidebar on the right has 3 collapsible sections.

1. CHAT: Shows the history of each model's public or private conversations. Each conversation begins with a circle with the model/player number in the same color as on the stage, followed by the model name. For private conversations, this is followed by an arrow pointing to the target model/player's numbered & colored circle. This is followed by the text of the conversation. Private conversations are in a light red background.

2. ALLIANCES. This is a tabular representation where columns are models that form an alliance. Each row represents a round. The cells contain the model the model in the column header allied with. All models are numbered and colored. If a model in the column header was eliminated, the cell is empty. If it did not ally, the cell shows an empty grey circle. If 3+ consecutive cells show the same model in a column (i.e. the model did not switch alliances), we can replace the middle cells with a vertical line.

3. ELIMINATIONS. This tabular representation works exactly the same way as alliances, except it captures eliminations. Each column represents a model that voted for elimination. Each row represents a round. The cell contains the model the model in the column header voted to eliminate. All models are numbered and colored. If a model in the column header was eliminated, the cell is empty. If 3+ consecutive cells show the same model in a column (i.e. a model consistently voted against the same model), we can replace the middle cells with a vertical line.

I'd like to use an AI code generator to generate this visualization. Giving the entire spec at once is too much for it to build. I'd like to see the output step by step as well and propose changes. How might I break up this task?
```

Based on its recommendation (which was detailed), I'll use this sequence:

- Scaffolding
- Implement the Timeline Scrubber & URL Sync
- Core Stage Visualization (Circle of Players)
- Arrow/Line Visualization for Actions
- Sidebar 1: CHAT Section
- Sidebar 2: ALLIANCES Section
- Sidebar 3: ELIMINATIONS Section
- Refinements, Theming, & Final Touches

## Create a scaffolding

I ran this prompt on GitHub Copilot - Edit mode - Claude 3.5 Sonnet:

```
Create an index.html using Bootstrap via CDN. Scaffold it with a navbar

The navbar has:

- An app title (Elimination Game)
- A game state dashboard with the Game (dropdown), Round (number), Stage (e.g. voting, alliances, etc.), and Players (number of players still active)
- A timeline scrubber (a range slider) allowing users to jump to the specific line. This changes the URL which then triggers a change in app state.
- A light/dark theme picker. Here is the code for the theme picker. Use the same CDN likns overall

<!-- Include Bootstrap 5.3+ and Bootstrap icons -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/js/bootstrap.bundle.min.js"></script>

<nav class="navbar navbar-expand-lg bg-body-tertiary">
  <div class="container-fluid">
    <a class="navbar-brand" href="#">Navbar</a>

    <!-- Copy this dropdown anywhere in your page, e.g. inside a navbar -->
    <div class="position-relative" role="group" aria-label="Toggle dark mode" title="Toggle Dark Mode">
      <button class="dark-theme-toggle btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Open navigation menu">
        <i class="bi bi-circle-half"></i> <span class="d-lg-none ms-2">Toggle theme</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><button class="dropdown-item" data-bs-theme-value="light"><i class="me-2 bi bi-sun-fill"></i> Light</button></li>
        <li><button class="dropdown-item" data-bs-theme-value="dark"><i class="me-2 bi bi-moon-stars-fill"></i> Dark</button></li>
        <li><button class="dropdown-item" data-bs-theme-value="auto"><i class="me-2 bi bi-circle-half"></i> Auto</button></li>
      </ul>
    </div>

  </div>
</nav>

<script src="https://cdn.jsdelivr.net/npm/@gramex/ui@0.3.1/dist/dark-theme.js" type="module"></script>

Below the navbar is a section with a stage on the left and sidebar on the right. The stageon the left will contain a large responsive square SVG. The sidebar on the right contains 3 collapsible cards: Chat, Alliances, Eliminations.
```

It generated this scaffolding.

![Scaffolding 1](img/scaffolding-1.webp)

## Improve the scaffolding

```
- Make the navbar always dark
- The sidebar cards must be independently collapsible
- For the Game, Round, Stage, and Players, show the label above the value. The label must be small and the value must be large.
- Use only me-* margins on the navbar to ensure that there is no left margin mis-aligning the elements at low width. Also place the elements inside a collapsible navbar section at low widths
- The stage must have a bottom margin to avoid touching the sidebar's top on low-width screens
```

![Scaffolding 2](img/scaffolding-2.webp)

```
Prefer Bootstrap classes over <style> wherever possible.
Style the "Game" to look exactly like the round, stage, and players. The size of the label and value should match for all 4 elements perfectly.
Ensure that the labels round, stage, players will be visible in light mode against the dark navbar.
```

At this point, I made 3 manual edits because I felt I could do these better than the LLM:

1. Forced the Elimination Game to break into 2 lines
1. Replaced `fs-5` with `fs-4` to get the values have the exact same size, and removed redundant styling on the game selection
1. Format document with... HTML Language Features

![Scaffolding 3](img/scaffolding-3.webp)
