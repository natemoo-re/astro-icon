---
"astro-icon": minor
---

Adds `<Sprite.Provider>` component. This will render `<Spritesheet>` internally, after all `<Sprite>` components have been rendered, solving a race condition.

Deprecates `<Spritesheet>`, to be replaced with `<Sprite.Provider>` component.

**Migrating from `<Spritesheet>` to `<Sprite.Provider>`**

- Remove `Spritesheet` component.
- Wrap your site content in `<Sprite.Provider>`. This also works inside of a layout component!

```diff
 ---
- import { Sprite, Spritesheet } from 'astro-icon';
+ import { Sprite } from 'astro-icon';
 ---
 
 <body>
+  <Sprite.Provider>
     <Sprite name="icon" />
-    <Spritesheet />
+  </Sprite.Provider>
 </body>
```
