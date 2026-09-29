---
"webpack-dev-middleware": patch
---

Fixed an empty overlay that covered the page and could only be dismissed by
hand. A source reporting an empty list of problems — which is how a source
says it has nothing — was kept as a slot, so the union of every source's
problems was non-empty and the card mounted with nothing in it. Worse when
another source then cleared: the overlay stayed, showing only its dismiss
hint, on page `-1`. An empty list is now the source having nothing, and the
overlay closes when no source has anything left.

Fixed the building indicator staying on the page for good after a
multi-compiler build. A progress payload carries no compilation name, so the
client attributed it to whichever compilation most recently started building —
and a payload from a still-running compilation could re-mark a sibling that
had already finished, and would never report again, as building. Progress now
reports on the build that is running instead of starting one, so the badge
goes away once every compilation that started has reported back.
