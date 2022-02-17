import Icon from "./lib/Icon.astro";
import SpriteProvider from "./lib/SpriteProvider.astro";
import SpriteComponent from "./lib/Sprite.astro";
import Sheet from "./lib/Spritesheet.astro";

const deprecate = (component: any, message: string) => {
  return (...args: any[]) => {
    console.warn(message);
    return component(...args);
  };
};

const Spritesheet = deprecate(
  Sheet,
  `Direct access to <Spritesheet /> has been deprecated! Please wrap your contents in <Sprite.Provider> instead!`
);
const SpriteSheet = deprecate(
  Sheet,
  `Direct access to <SpriteSheet /> has been deprecated! Please wrap your contents in <Sprite.Provider> instead!`
);

const Sprite = Object.assign(SpriteComponent, { Provider: SpriteProvider });

export {
  Icon as default,
  Icon,
  Spritesheet,
  SpriteSheet,
  SpriteProvider,
  Sprite,
};
