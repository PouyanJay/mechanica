import * as T from 'three';

export type SectionPlaneState = {
  yaw: number;
  pitch: number;
  flipped: boolean;
  showGizmo: boolean;
  /** The simple default opens housings; free sections also cut the internal hardware. */
  free: boolean;
};

export const DEFAULT_SECTION_DEPTH = 52;
export const DEFAULT_SECTION_PLANE: SectionPlaneState = {
  yaw: 0, pitch: 0, flipped: false, showGizmo: false, free: false,
};

export const SECTION_PRESETS = [
  { id: 'top', label: 'Top', yaw: 0, pitch: 0 },
  { id: 'side', label: 'Side', yaw: 0, pitch: -90 },
  { id: 'front', label: 'Front', yaw: 90, pitch: 0 },
  // A diagonal longitudinal section still contains the engine's X axis.
  { id: 'axis', label: 'Along axis', yaw: 0, pitch: -45 },
] as const;

/** Spherical angles with the original downward normal as the zero orientation. */
export function sectionNormal(yaw: number, pitch: number, normal = new T.Vector3()) {
  const azimuth = T.MathUtils.degToRad(yaw);
  const elevation = T.MathUtils.degToRad(pitch);
  normal.set(-Math.sin(azimuth) * Math.cos(elevation), -Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation));
  // Keep cardinal presets exact, including the two poles.
  for (const axis of ['x', 'y', 'z'] as const) if (Math.abs(normal[axis]) < 1e-12) normal[axis] = 0;
  return normal.normalize();
}

/** Sweep the entire projected model extent with the original 0.2 unit endpoint margin. */
export function updateSectionPlane(plane: T.Plane, bounds: T.Box3, depth: number, state: SectionPlaneState) {
  const n = sectionNormal(state.yaw, state.pitch, plane.normal);
  const fraction = T.MathUtils.clamp(depth, 0, 100) / 100;
  if (state.yaw === 0 && state.pitch === 0) {
    plane.constant = T.MathUtils.lerp(bounds.min.y - .2, bounds.max.y + .2, fraction);
  } else {
    const middle = n.x * (bounds.min.x + bounds.max.x) / 2 + n.y * (bounds.min.y + bounds.max.y) / 2 + n.z * (bounds.min.z + bounds.max.z) / 2;
    const radius = Math.abs(n.x) * (bounds.max.x - bounds.min.x) / 2 + Math.abs(n.y) * (bounds.max.y - bounds.min.y) / 2 + Math.abs(n.z) * (bounds.max.z - bounds.min.z) / 2;
    plane.constant = -middle + T.MathUtils.lerp(-radius - .2, radius + .2, fraction);
  }
  // Negating both terms swaps the removed half-space without moving the section.
  if (state.flipped) plane.negate();
  return plane;
}
