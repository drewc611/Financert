/* The second series, told apart without colour (BACKLOG F48).
 *
 * Both bar charts carry exactly two series, and until now hue was the only
 * thing separating them: unreadable printed in grey, and worst on the gap
 * chart, where the two hues *are* the finding and red/green is the pair
 * roughly one man in twelve cannot separate. The second series now also
 * carries a 45-degree hatch — in the chart, and in the legend swatch beside
 * it (`.swatch[data-hatch]` in styles.css draws the same stripes in CSS).
 *
 * The stripe is drawn in --surface rather than white: on the dark theme a
 * white stripe reads as a hole in the bar rather than as texture.
 */
export default function Hatch({ id, color }) {
  return (
    <defs>
      {/* userSpaceOnUse, so the stripe spacing is the same on every bar
          regardless of how wide that bar happens to be. */}
      <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill={color} />
        <line x1="0" y1="0" x2="0" y2="7" stroke="var(--surface)" strokeWidth="2.5" opacity="0.6" />
      </pattern>
    </defs>
  )
}
