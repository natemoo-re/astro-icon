---
"astro-icon": patch
---

Makes the `astro-icon` integration's `include` settings optional. By default, all icons for any detected `@iconify-json/*` dependencies will be included. This makes migration much easier for existing static site users, while offering the same amount of control for server rendered users.
