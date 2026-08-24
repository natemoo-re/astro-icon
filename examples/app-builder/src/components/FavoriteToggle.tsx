import { useState, type ReactNode } from "react";

interface Props {
  userName: string;
  children: ReactNode;
}

// astro-icon icons render server-side in Astro, never inside this component -
// the icon reaches React only as pre-rendered markup passed through the
// default slot (`children`). This island owns the toggle state; it never
// needs to know astro-icon exists.
export default function FavoriteToggle({ userName, children }: Props) {
  const [favorited, setFavorited] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={favorited}
      onClick={() => setFavorited((current) => !current)}
      className={
        favorited ? "text-yellow-400" : "text-gray-400 hover:text-gray-500"
      }
    >
      <span className="sr-only">
        {favorited
          ? `Remove ${userName} from favorites`
          : `Add ${userName} to favorites`}
      </span>
      {children}
    </button>
  );
}
