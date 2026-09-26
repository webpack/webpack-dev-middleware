---
"webpack-dev-middleware": patch
---

Keep an uncaught runtime error in the overlay when a build succeeds — a successful compilation says nothing about an error the page threw on its own, and it used to dismiss one raised moments earlier by an entry that threw while it was still evaluating. A rebuild still clears it, since that replaces the code the error came from
