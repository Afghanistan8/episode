// The Episode mark: a frame, a second frame behind it, and three readers.
//
// Two offset rectangles are the file -- more than one view of the same thing.
// The three dots along the base are the panel: the same file, read separately.
// Nothing here is anyone's logo but Episode's.

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      <rect
        x="2.5"
        y="4.5"
        width="15"
        height="11"
        rx="1"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <rect
        x="7.5"
        y="2.5"
        width="16"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M10 11.5l3.2-3.4 2.2 2.3 2-2.1 3.1 3.2"
        stroke="currentColor"
        strokeOpacity="0.75"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="22" r="1.6" fill="currentColor" fillOpacity="0.85" />
      <circle cx="13" cy="22" r="1.6" fill="currentColor" fillOpacity="0.55" />
      <circle cx="20" cy="22" r="1.6" fill="currentColor" fillOpacity="0.85" />
    </svg>
  );
}

/** One glyph per category, drawn rather than named, so the four read at a glance. */
export function CategoryGlyph({ category }: { category: number }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true" role="presentation">
      {category === 1 && (
        <>
          {/* property: a pitched roof over a floor, with a water line */}
          <path d="M3 10.5 12 4l9 6.5" {...common} />
          <path d="M5.5 10.5V20h13v-9.5" {...common} />
          <path d="M5.5 16.5h13" {...common} strokeOpacity={0.5} />
        </>
      )}
      {category === 2 && (
        <>
          {/* vehicle: a cab, a box and two wheels */}
          <path d="M2.5 15.5V9h8.5v6.5" {...common} />
          <path d="M11 11h4.5l3 3v1.5" {...common} />
          <path d="M2.5 15.5h16" {...common} strokeOpacity={0.5} />
          <circle cx="7" cy="18" r="2" {...common} />
          <circle cx="16" cy="18" r="2" {...common} />
        </>
      )}
      {category === 3 && (
        <>
          {/* cargo: a container, ribbed, sitting askew */}
          <path d="M3 7.5h18v11H3z" {...common} />
          <path d="M7.5 7.5v11M12 7.5v11M16.5 7.5v11" {...common} strokeOpacity={0.45} />
        </>
      )}
      {category === 4 && (
        <>
          {/* interruption: a quay, a hull and no gang -- a flat, stopped line */}
          <path d="M2.5 17.5h19" {...common} />
          <path d="M5 17.5l1.5-5h11l1.5 5" {...common} />
          <path d="M9 9.5V6.5h6" {...common} strokeOpacity={0.5} />
          <path d="M3 21h18" {...common} strokeOpacity={0.3} />
        </>
      )}
    </svg>
  );
}
