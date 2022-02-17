---
"astro-icon": minor
---

# Breaking Changes

- `astro-icon@0.6.0` is compatible with `astro@0.23.x` and up, but will no longer work in lower versions.

- The `createIconPack` export has been moved from `astro-icon` to `astro-icon/pack`.

    You will likely see a Vite error that `createIconPack` is not defined until you update your import statement.

    ```diff
    - import { createIconPack } from "astro-icon";
    + import { createIconPack } from "astro-icon/pack";

    export default createIconPack({ package: "heroicons", dir: "outline" })
    ```
