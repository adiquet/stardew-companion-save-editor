import type { SpriteRef } from '../sprites.ts';

/** Pixel-art icon cut from a sprite sheet; renders nothing without a sprite. */
export function ItemIcon({ sprite, scale = 2 }: { sprite: SpriteRef | null; scale?: number }) {
  if (!sprite) return null;
  const { sheet, index } = sprite;
  const col = index % sheet.cols;
  const row = Math.floor(index / sheet.cols);
  return (
    <span
      className="item-icon"
      style={{
        width: sheet.cellW * scale,
        height: sheet.cellH * scale,
        backgroundImage: `url(${sheet.url})`,
        backgroundPosition: `-${col * sheet.cellW * scale}px -${row * sheet.cellH * scale}px`,
        backgroundSize: `${sheet.cols * sheet.cellW * scale}px auto`,
      }}
    />
  );
}
