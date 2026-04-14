# CiscoLearn

A browser-based learning platform for Cisco IOS and Packet Tracer. No installation required — open any HTML file directly in a browser.

## Modules

| # | Page | Description |
|---|------|-------------|
| 01 | `commands.html` | Searchable Cisco IOS command library with descriptions and examples |
| 02 | `subnetting.html` | Interactive subnetting trainer with randomized questions and instant feedback |
| 03 | `explainer.html` | Paste any Cisco config and get a plain-English explanation line by line |
| 04 | `guides.html` | Step-by-step Packet Tracer configuration guides (beginner → advanced) |
| 05 | `quiz.html` | Multiple-choice quiz with topic filters, scoring, and answer review |

## Getting Started

1. Clone or download the repository
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox)
3. No server, no dependencies, no build step required

## File Structure

```
CiscoLearn/
├── index.html           # Landing page
├── commands.html        # Command library
├── subnetting.html      # Subnetting trainer
├── explainer.html       # Config explainer
├── guides.html          # PT guides
├── quiz.html            # Quiz
├── style.css            # Shared dark theme
├── nav.js               # Shared navigation bar
└── README.md
```

## Design

Dark editorial theme — Cormorant Garamond for headings, DM Sans for body text, JetBrains Mono for code and labels.

## Related

- [cisco-config-generator](https://github.com/cgarmann/cisco-config-generator) — Generate full Cisco Packet Tracer configurations visually
