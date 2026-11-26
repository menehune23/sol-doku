# Sol-doku

A sci-fi Sudoku played with [Sol](https://github.com/menehune23/sol) letters.

**Play:** https://menehune23.github.io/sol-doku/

- Procedurally generated puzzles with a unique solution, in Easy, Medium, Hard and Expert.
- Each puzzle uses 9 random Sol letters, shown in Sol order.
- An optional Sol guide shows the selected letter's Solat and an example word.
- Notes, undo, hints, timer and errors, each optional in Settings.
- Games save in your browser's local storage.

## Run locally

```
python3 server.py   # serves static/ on http://localhost:8011
```

The `gh-pages` branch is `static/` split out with `git subtree split --prefix static`.

## Credits

The Sol font is from [menehune23/sol](https://github.com/menehune23/sol) under the SIL Open Font License v1.1.
