# Plan Composer — Project Requirements

## 1. Project Overview

**Plan Composer** is an interactive dashboard where users build, organize, and optimize plans by combining movable pieces such as activities, locations, time blocks, and resources.

The main focus is the user experience of creating and rearranging a plan—not just viewing information in dashboard cards.

### Example use case

A user planning a weekend trip can add places, activities, meals, and travel periods to a timeline. If they move one activity, the schedule updates, and the map and plan summary reflect the changes.

The same system could later support event planning, daily schedules, project plans, or study schedules.

---

## 2. Functional Requirements

### A. Dashboard Overview

- View existing plans.
- Create a new plan.
- See each plan's name, date, status, and progress.
- Duplicate, rename, archive, or delete plans.

### B. Plan Editor

- Add, edit, remove, and reorder activities.
- Assign start times and durations.
- Group activities by day or category.
- Display conflicts and overlapping time blocks.
- Undo and redo changes.

### C. Drag-and-Drop Workspace

- Drag items from an activity library into the plan.
- Rearrange items on the timeline.
- Move activities between days.
- Show a clear preview of where an item will land.
- Provide visual feedback for invalid placements.

### D. Map View

- Display planned locations on a map.
- Connect locations in itinerary order.
- Select a location on the map to highlight its activity.
- Update map markers when the itinerary changes.

**MVP note:** Use sample locations or a static map illustration initially. A live map integration is optional.

### E. Live Plan Summary

- Total planned duration.
- Number of activities and locations.
- Free time remaining.
- Estimated budget, if relevant.
- Warnings for scheduling conflicts.

### F. Persistence and Export

- Save plans and restore them later.
- Autosave edits.
- Export a plan as a printable document.
- Optionally share a read-only plan link.

---

## 3. UI/UX Requirements

### Three-Panel Editor

Use a workspace with three main areas:

- **Left panel:** Activity library.
- **Center panel:** Timeline or plan canvas.
- **Right panel:** Selected item's properties.

Users should be able to work without constantly opening new pages.

### Immediate Feedback

Every action should feel responsive. Dragging an activity should visibly update the schedule, totals, and relevant map markers.

### Multiple Synchronized Views

Allow users to switch between timeline, list, and map views without losing edits or selections.

### Thoughtful Interface States

Design more than the ideal populated screen. Include:

- Empty plans and first-use guidance.
- Loading states.
- Drag targets and drop previews.
- Validation errors.
- Save confirmation and save failures.
- Delete confirmations.
- Disabled and unavailable actions.

### Accessibility and Usability

- Provide clear labels and understandable icons.
- Maintain readable contrast and typography.
- Use consistent spacing and interaction patterns.
- Ensure important actions are discoverable.
- Provide keyboard-accessible alternatives for essential drag-and-drop actions.
- Make the workspace usable on smaller screens with responsive panels or a simplified layout.

---

## 4. Suggested Screens

| Screen | Purpose |
|---|---|
| Dashboard Home | Browse and manage plans |
| Create Plan | Set a name, dates, and plan type |
| Plan Editor | Build and arrange the plan |
| Activity Library | Search, filter, and add items |
| Map and Timeline | Explore the plan spatially and chronologically |
| Preview and Export | Review the finished plan |

The editor can be one main workspace with panels and overlays instead of a separate page for every function.

---

## 5. Data Requirements

A basic version only needs a few entities.

### Plan

- ID
- Name
- Type
- Start date
- End date
- Settings

### Activity

- ID
- Title
- Category
- Duration
- Location
- Estimated cost

### Scheduled Item

- Activity reference
- Date
- Start time
- Duration
- Order

### Location

- Name
- Coordinates or sample map position

### Preferences

- Timeline display settings
- Units
- Default view

Use sample data initially. Live maps, route optimization, external travel APIs, accounts, and collaboration are optional extensions—not prerequisites.

---

## 6. Minimum Viable Product (MVP)

Build these features first, in order:

1. **Create and edit plans** — Basic dashboard and plan setup.
2. **Add and edit activities** — Activity library and properties panel.
3. **Drag-and-drop timeline** — Reordering and moving scheduled items.
4. **Automatic schedule calculations** — Durations, overlaps, and free time.
5. **Synchronized map preview** — Sample locations and markers.
6. **Autosave and restore** — Persist edits between sessions.

### Features to Defer

Leave these out of the first version:

- AI-generated itineraries.
- Real-time traffic.
- Bookings.
- Collaborative editing.
- Complex route optimization.

These features add substantial work without being necessary to demonstrate excellent UI/UX.

---

## 7. What Makes the Project Distinctive?

The real differentiator is not the travel-planning domain. It is the interaction model:

- Users **compose** a plan instead of filling out a long form.
- The interface maintains consistency across multiple views.
- Complex information remains understandable as the plan grows.
- The workspace responds intelligently to user actions.

This creates a project with enough complexity to demonstrate product design, interaction design, and frontend execution while keeping the initial scope manageable.

---

## 8. Suggested Success Criteria

Consider the MVP successful when a user can:

- Create a plan without assistance.
- Add and rearrange activities using the timeline.
- Understand scheduling conflicts from the interface.
- Switch between timeline, list, and map views without losing context.
- See summaries update after changes.
- Refresh or reopen the app and recover saved plans.
- Complete essential actions using accessible controls.

The primary goal is a polished, coherent planning experience—not the largest possible feature set.
