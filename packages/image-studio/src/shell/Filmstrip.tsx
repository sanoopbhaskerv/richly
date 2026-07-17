import { AddIcon } from '../controls/icons';

const thumbnails = ['current', 'waterfall', 'van', 'ridge', 'valley'];

/** Props for the project-image filmstrip. */
export interface FilmstripProps {
  /** Opens the host-owned file picker or project asset browser. */
  readonly onAddImage?: () => void;
}

/** MVP filmstrip showing the active image plus visual slots for local demo projects. */
export function Filmstrip(props: FilmstripProps) {
  return (
    <footer className="ris-filmstrip" aria-label="Project images">
      {thumbnails.map((item, index) => (
        <button
          type="button"
          key={item}
          className={index === 0 ? 'ris-filmstrip-item ris-selected' : 'ris-filmstrip-item'}
          aria-label={index === 0 ? 'Current image selected' : `Image ${index + 1}`}
        >
          <span className={`ris-thumb ris-thumb-${index}`} />
        </button>
      ))}
      <button
        type="button"
        className="ris-filmstrip-add"
        aria-label="Add image"
        onClick={props.onAddImage}
      >
        <AddIcon />
      </button>
    </footer>
  );
}
