import React, { ReactNode } from "react";
import { getElementPosition } from "./helpers";

export function MeadowArtwork({
  count,
  roundsAnswered,
  tasksDone,
  walks,
}: {
  count: number;
  roundsAnswered?: number;
  tasksDone?: number;
  walks?: number;
}) {
  const elements: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const { x, y, size, opacity } = getElementPosition(i, 300, 150);
    elements.push(
      <circle
        key={i}
        cx={x}
        cy={y}
        r={size}
        fill="currentColor"
        opacity={opacity}
      />
    );
  }

  const secondaryText =
    walks !== undefined
      ? `${walks} walks`
      : tasksDone !== undefined
      ? `${tasksDone} tasks done`
      : undefined;

  const altText =
    roundsAnswered !== undefined && secondaryText !== undefined
      ? `Picture with ${roundsAnswered} rounds answered and ${secondaryText}.`
      : `Picture with ${count} elements.`;

  return (
    <svg
      viewBox="0 0 300 150"
      className="w-full h-auto text-accent-sage-hover"
      role="img"
      aria-label={altText}
    >
      <title>{altText}</title>
      <rect width="300" height="150" fill="transparent" />
      {elements}
    </svg>
  );
}