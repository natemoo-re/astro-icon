# astro-icon

## 0.8.0

### Minor Changes

- [#42](https://github.com/natemoo-re/astro-icon/pull/42) [`ae0a7f7`](https://github.com/natemoo-re/astro-icon/commit/ae0a7f72358dee39a133663423b499e4525c06cb) Thanks [@germanz](https://github.com/germanz)! - Pass props to custom resolvers

### Patch Changes

- [#56](https://github.com/natemoo-re/astro-icon/pull/56) [`60c7304`](https://github.com/natemoo-re/astro-icon/commit/60c7304368a7ca88fa2190bc8bfac5e8229e0f50) Thanks [@dwightjack](https://github.com/dwightjack)! - Fix Chrome not rendering icons using SVG gradients

* [#64](https://github.com/natemoo-re/astro-icon/pull/64) [`2c75a4a`](https://github.com/natemoo-re/astro-icon/commit/2c75a4a6bc675492bee96aeac89c05f610f28831) Thanks [@stramel](https://github.com/stramel)! - Update Sprite context to track usages using `Astro.request`

- [#61](https://github.com/natemoo-re/astro-icon/pull/61) [`41b0b76`](https://github.com/natemoo-re/astro-icon/commit/41b0b769a736420cbe2fe1ece44c71f16bcd0281) Thanks [@jasikpark](https://github.com/jasikpark)! - Update README to drop SVGO workaround recommendation

* [#59](https://github.com/natemoo-re/astro-icon/pull/59) [`1a5ff6b`](https://github.com/natemoo-re/astro-icon/commit/1a5ff6bf59460ba1dc13b33339748c8d86891102) Thanks [@stramel](https://github.com/stramel)! - Use `node:` prefix on standard node dependencies

## 0.7.3

### Patch Changes

- [#46](https://github.com/natemoo-re/astro-icon/pull/46) [`31b6eae`](https://github.com/natemoo-re/astro-icon/commit/31b6eaef63d229586933c5081e551c9b688360fb) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Another Vite 3 fix

## 0.7.2

### Patch Changes

- [#44](https://github.com/natemoo-re/astro-icon/pull/44) [`3b5c5ff`](https://github.com/natemoo-re/astro-icon/commit/3b5c5ff5597678e95f0374ce2f974796af2f2e6b) Thanks [@FredKSchott](https://github.com/FredKSchott)! - Small fix for vite 3

## 0.7.1

### Patch Changes

- [`147001e`](https://github.com/natemoo-re/astro-icon/commit/147001eb2db7e6cbb8d0433be56fb86f79cf3a42) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Fix `Sprite` component for Astro v1.0.0

## 0.7.0

### Minor Changes

- [#32](https://github.com/natemoo-re/astro-icon/pull/32) [`4cfc1ba`](https://github.com/natemoo-re/astro-icon/commit/4cfc1badfb5978829c1dfeb5b56491238a3a8e74) Thanks [@tony-sull](https://github.com/tony-sull)! - Removes the deprecation warning for assert in import.meta.globEager

### Patch Changes

- [`3b29d89`](https://github.com/natemoo-re/astro-icon/commit/3b29d893bbb385c8e6e8fa51b421fefa17b050ac) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Improve warning when no sprites are found rather than throwing an error

## 0.6.1

### Patch Changes

- [#30](https://github.com/natemoo-re/astro-icon/pull/30) [`940539b`](https://github.com/natemoo-re/astro-icon/commit/940539bf81ad205c9ca02082c1f5e2526570acfe) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Update package.json to include Astro keywords

## 0.6.0

### Minor Changes

- [#26](https://github.com/natemoo-re/astro-icon/pull/26) [`21bfa28`](https://github.com/natemoo-re/astro-icon/commit/21bfa288c6c3606f5797a22350d8018cd7589a0a) Thanks [@matthewp](https://github.com/matthewp)! - `astro-icon` is now compatible with Astro's `--experimental-static-build` flag

* [#26](https://github.com/natemoo-re/astro-icon/pull/26) [`21bfa28`](https://github.com/natemoo-re/astro-icon/commit/21bfa288c6c3606f5797a22350d8018cd7589a0a) Thanks [@matthewp](https://github.com/matthewp)! - # Breaking Changes

  - `astro-icon@0.6.0` is compatible with `astro@0.23.x` and up, but will no longer work in lower versions.

  - The `createIconPack` export has been moved from `astro-icon` to `astro-icon/pack`.

    You will likely see a Vite error that `createIconPack` is not defined until you update your import statement.

    ```diff
    - import { createIconPack } from "astro-icon";
    + import { createIconPack } from "astro-icon/pack";

    export default createIconPack({ package: "heroicons", dir: "outline" })
    ```

## 0.5.3

### Patch Changes

- [`d998134`](https://github.com/natemoo-re/astro-icon/commit/d99813407e9bb0c043a7ff8d499031b667dfd894) Thanks [@natemoo-re](https://github.com/natemoo-re)! - Fix issue with default `size` prop.

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
