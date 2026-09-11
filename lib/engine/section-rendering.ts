import * as T from 'three';
import { updateSectionPlane, type SectionPlaneState } from './section-plane';

/** Shared planes and shading uniform, updated without replacing material arrays or shaders. */
export class SectionRendering {
  readonly hardwarePlane = new T.Plane(new T.Vector3(0, -1, 0), 1e6);
  readonly interior = { value: 0 };
  readonly housingPlanes: T.Plane[];
  readonly hardwarePlanes = [this.hardwarePlane];

  constructor(readonly plane: T.Plane) {
    this.housingPlanes = [plane];
  }

  configureMaterial(material: T.MeshStandardMaterial, legacy: boolean) {
    material.userData.sectionLegacy = legacy;
    material.clippingPlanes = legacy ? this.housingPlanes : this.hardwarePlanes;
    material.side = T.DoubleSide;
    material.clipShadows = true;
    material.onBeforeCompile = shader => {
      shader.uniforms.sectionInterior = this.interior;
      shader.fragmentShader = 'uniform float sectionInterior;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        // A matte inner surface distinguishes a section from an open, bright shell.
        if (sectionInterior > 0.5 && !gl_FrontFacing) {
          outgoingLight = diffuseColor.rgb * 0.28 + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `);
    };
    material.customProgramCacheKey = () => 'mechanica-section-interior-v1';
  }

  update(bounds: T.Box3, depth: number, state: SectionPlaneState, active: boolean) {
    updateSectionPlane(this.plane, bounds, depth, state);
    this.hardwarePlane.copy(this.plane);
    if (!active) this.plane.constant = 1e6;
    if (!active || !state.free) this.hardwarePlane.constant = 1e6;
    this.interior.value = active && state.free ? 1 : 0;
  }
}

/** An annotation only: it stays outside the engine, picking list, bounds and inventory. */
export class SectionGizmo {
  readonly root = new T.Group();
  private readonly quad: T.Mesh;
  private readonly outline: T.LineLoop;
  private readonly arrow: T.ArrowHelper;
  private readonly center = new T.Vector3();
  private readonly size = new T.Vector3();
  private readonly forward = new T.Vector3(0, 0, 1);

  constructor() {
    this.root.name = 'section-plane-gizmo';
    this.root.visible = false;
    this.quad = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
      color: 0xdca27d, transparent: true, opacity: .09, side: T.DoubleSide,
      depthTest: false, depthWrite: false, forceSinglePass: true,
    }));
    this.outline = new T.LineLoop(new T.BufferGeometry().setFromPoints([
      new T.Vector3(-.5, -.5, 0), new T.Vector3(.5, -.5, 0),
      new T.Vector3(.5, .5, 0), new T.Vector3(-.5, .5, 0),
    ]), new T.LineBasicMaterial({ color: 0xdca27d, transparent: true, opacity: .7, depthTest: false, depthWrite: false }));
    this.arrow = new T.ArrowHelper(this.forward, new T.Vector3(), 1, 0xe7b38d, .2, .12);
    this.arrow.line.geometry = this.arrow.line.geometry.clone();
    this.arrow.cone.geometry = this.arrow.cone.geometry.clone();
    this.root.add(this.quad, this.outline, this.arrow);
    this.root.traverse(object => {
      object.renderOrder = 20;
      object.raycast = () => {};
      if (object instanceof T.Mesh || object instanceof T.Line) {
        const material = object.material as T.Material;
        material.depthTest = false;
        material.depthWrite = false;
      }
    });
  }

  update(plane: T.Plane, bounds: T.Box3, visible: boolean) {
    this.root.visible = visible;
    if (!visible) return;
    bounds.getCenter(this.center);
    bounds.getSize(this.size);
    plane.projectPoint(this.center, this.root.position);
    this.root.quaternion.setFromUnitVectors(this.forward, plane.normal);
    const side = this.size.length() * 1.08;
    this.quad.scale.set(side, side, 1);
    this.outline.scale.copy(this.quad.scale);
    this.arrow.setLength(Math.max(.6, side * .13), side * .035, side * .025);
  }
}
