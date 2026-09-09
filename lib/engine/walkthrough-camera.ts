import * as T from 'three';
import type { WalkthroughStation } from './walkthroughs';

/** Retain a station's viewing direction and target while fitting every model corner. */
export function fitWalkthroughCamera(bounds: T.Box3, view: WalkthroughStation['camera'], aspect: number, fov = 34) {
  const target = new T.Vector3(...view.target);
  const offset = new T.Vector3(...view.position).sub(target);
  const direction = offset.clone().normalize();
  const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), direction).normalize();
  const up = new T.Vector3().crossVectors(direction, right).normalize();
  const tangent = Math.tan(T.MathUtils.degToRad(fov / 2));
  let distance = offset.length();
  for (let i = 0; i < 8; i++) {
    const corner = new T.Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z).sub(target);
    const depth = corner.dot(direction);
    distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / (tangent * Math.max(.1, aspect) * .8), depth + Math.abs(corner.dot(up)) / (tangent * .8));
  }
  return { position: target.clone().addScaledVector(direction, distance), target };
}
