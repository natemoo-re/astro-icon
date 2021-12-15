# astro-icon

## 0.5.2

### Patch Changes

- [#16](https://github.com/natemoo-re/astro-icon/pull/16) [`9ff5e7d`](https://github.com/natemoo-re/astro-icon/commit/9ff5e7d50ec94e2e0b9552c14b2bcd243fb2c48a) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Fix parallelism issue when fetching icons from the Icon service in a map

## 0.5.1

### Patch Changes

- [`0217a71`](https://github.com/natemoo-re/astro-icon/commit/0217a716c7278e30a04de45f72e7a3cce5c65180) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Automatically prefix IDs using SVGO

* [`330e465`](https://github.com/natemoo-re/astro-icon/commit/330e4654e160bcea8affd672e67afe69c2919cb2) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Fail builds when icons cannot be fetched

## 0.5.0

### Minor Changes

- [`e61559b`](https://github.com/natemoo-re/astro-icon/commit/e61559be5b530d0cc1e3479490ff23fd06158ef5) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Adds `<Sprite.Provider>` component. This will render `<Spritesheet>` internally, after all `<Sprite>` components have been rendered, solving a race condition.

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

## 0.4.0

### Minor Changes

- [#7](https://github.com/natemoo-re/astro-icon/pull/7) [`3715ead`](https://github.com/natemoo-re/astro-icon/commit/3715ead35e090650d1ffe4af0493dcc3863c1255) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Add support for custom icon packs from local or remote sources.

  Add built-in icon packs powered by [Iconify](https://iconify.design/)! You can search for supported on icons on [Icônes](https://icones.js.org/).

## 0.3.0

### Minor Changes

- [`62559e0`](https://github.com/natemoo-re/astro-icon/commit/62559e09db40482ab2fc6b4fdc001a6e38e9b7ad) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Improve SpriteSheet component by automatically including only referenced icon files

## 0.2.2

### Patch Changes

- [`e201b6e`](https://github.com/natemoo-re/astro-icon/commit/e201b6e997c6b1cb25de2cc7d72524df0a816a55) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Improve documentation

## 0.2.1

### Patch Changes

- Fix issue with published package

## 0.2.0

### Minor Changes

- [`52bb8ff`](https://github.com/natemoo-re/astro-icon/commit/52bb8ff24e1dd1c26f6eadc2bb08d8e7f1ec3573) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Add `<Sprite>` and `<SpriteSheet>` components that take advantage of `<use>`
