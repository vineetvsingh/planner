# Plan Composer

An interactive planner for trips, events and schedules. Drag activities from a library onto a day-by-day timeline, and see the conflicts, free time, budget and route update as you go.

Everything runs in the browser. Plans are saved to local storage, so there's no account or server.

## Features

- **Dashboard:** create, duplicate, rename, archive and delete plans. Each card shows the plan's dates, status, progress and any scheduling conflicts.
- **Three-panel editor:** an activity library, the plan itself, and a details panel with a live summary.
- **Timeline, List and Map views** of the same plan, kept in sync. Selecting an activity in one view highlights it in the others.
- **Drag and drop:** move activities from the library into the plan, between times and between days. A preview shows where the activity will land, and invalid drops are flagged.
- **Schedule analysis:**
  - overlapping activities, activities outside your planning hours and activities that run past midnight;
  - suggested free slots, with a "Move to" fix for each conflict;
  - free time per day, budget used and remaining, time per category, and distance travelled.
- **Map:** each day's stops connected in itinerary order, with the distances in km or miles.
- **Undo and redo** for every edit.
- **Saving and sharing:**
  - autosave, with a backup offered if saving fails;
  - recovery of damaged saved data;
  - edits in one tab appear in your other open tabs.
- **Export:**
  - a printable page, which can also be saved as a PDF;
  - a read-only share link (the plan is compressed into the link itself);
  - plan files you can download and import again.
- **Accessibility:** every drag action has a keyboard alternative, and changes are announced to screen readers. Light and dark themes are included, and the layout adapts down to phone width.

### Keyboard shortcuts

Focus an activity on the timeline with <kbd>Tab</kbd>, then:

| Keys | Action |
| --- | --- |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Move 15 minutes |
| <kbd>←</kbd> / <kbd>→</kbd> | Move to the previous or next day |
| <kbd>Shift</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> | Shorten or lengthen |
| <kbd>Delete</kbd> | Remove |
| <kbd>Enter</kbd> | Open details |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | Print the plan |

On macOS, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>. To add a library item without dragging, Tab to its **+** button.

## Getting started

You need [Node.js](https://nodejs.org/) 20.19 or newer (or 22.12 or newer).

```bash
git clone https://github.com/vineetvsingh/planner.git
cd planner
npm install
npm run dev
```

Then open http://localhost:5173 and choose **Try a sample trip** to explore a ready-made weekend in Lisbon.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the development server with hot reload |
| `npm run build` | Type-checks the code and builds for production into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Lints the code with oxlint |

## Deploying

`npm run build` produces a static site in `dist/` that can be hosted anywhere.

The app uses client-side routes such as `/plans/:id` and `/share`. Configure your host to serve `index.html` for any unknown path; otherwise reloading a page, or opening a share link, returns a 404. On Netlify, for example, add a `public/_redirects` file containing `/* /index.html 200`.

## Tech stack

- [React 19](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/), built with [Vite](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/) components
- [Zustand](https://zustand.docs.pmnd.rs/) for state and local-storage persistence
- [dnd kit](https://dndkit.com/) for drag and drop
- [React Router](https://reactrouter.com/), [date-fns](https://date-fns.org/), [Sonner](https://sonner.emilkowal.ski/) and [Lucide](https://lucide.dev/) icons

## Project structure

```
src/
├── pages/        Dashboard, plan editor, print view and shared-plan view
├── components/
│   ├── editor/   Library, timeline, list, map, details and summary panels
│   ├── plans/    Plan cards, dialogs and the actions menu
│   └── ui/       shadcn/ui components
├── store/        Plans, preferences, save status and screen-reader announcements
├── lib/          Scheduling, conflict analysis, map geometry, plan files and sample data
└── hooks/        Shared React hooks
```

`requirements.md` contains the original product brief.

## Limitations

- Plans live in this browser's local storage. To move them to another browser or device, use **Back up all** on the dashboard, then import the file there.
- The map is a stylised schematic of Lisbon for the sample locations, not a real map. Distances are straight-line estimates.
