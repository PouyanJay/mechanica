'use client';

import { useId, useState } from 'react';
import { ChevronDown, FlipVertical2, RotateCcw, ScanLine } from 'lucide-react';
import { DEFAULT_SECTION_PLANE, SECTION_PRESETS, type SectionPlaneState } from '@/lib/engine/section-plane';

type SectionControlsProps = {
  depth: number;
  plane: SectionPlaneState;
  onDepthChange: (depth: number) => void;
  onPlaneChange: (plane: SectionPlaneState) => void;
  onReset: () => void;
};

export default function SectionControls({ depth, plane, onDepthChange, onPlaneChange, onReset }: SectionControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const adjust = (values: Partial<SectionPlaneState>) => onPlaneChange({ ...plane, ...values, free: true, showGizmo: true });
  const showPlane = () => { if (!plane.showGizmo) onPlaneChange({ ...plane, showGizmo: true }); };
  const defaultOrientation = plane.yaw === DEFAULT_SECTION_PLANE.yaw && plane.pitch === DEFAULT_SECTION_PLANE.pitch && !plane.flipped;

  return (
    <div className={`section-controls${expanded ? ' section-controls-expanded' : ''}`}>
      <div className="console-slider section-depth">
        <label htmlFor={`${id}-depth`}>Section depth</label>
        <input id={`${id}-depth`} type="range" role="slider" min={0} max={100} step={1} value={depth} aria-valuenow={depth} aria-valuetext={`${Math.round(depth)} percent`} onPointerDown={showPlane} onChange={event => { showPlane(); onDepthChange(Number(event.target.value)); }} />
        <output htmlFor={`${id}-depth`}>{Math.round(depth)}%</output>
      </div>
      <div className="section-disclosure">
        <button type="button" className="section-expand" aria-expanded={expanded} aria-controls={`${id}-plane`} onClick={() => setExpanded(!expanded)}>
          <ScanLine size={15} aria-hidden="true" />Plane controls<ChevronDown size={14} aria-hidden="true" />
        </button>
        <button type="button" className="section-reset" onClick={onReset} title="Reset cutting plane" aria-label="Reset cutting plane"><RotateCcw size={14} aria-hidden="true" /><span>Reset</span></button>
      </div>
      <div id={`${id}-plane`} className="section-advanced" role="group" aria-label="Cutting plane controls" hidden={!expanded}>
        <div className="section-presets" role="group" aria-label="Plane orientation presets">
          {SECTION_PRESETS.map(preset => <button type="button" key={preset.id} aria-pressed={plane.yaw === preset.yaw && plane.pitch === preset.pitch && !plane.flipped} onClick={() => adjust({ yaw: preset.yaw, pitch: preset.pitch, flipped: false })}>{preset.label}</button>)}
        </div>
        <label className="section-angle" htmlFor={`${id}-yaw`}><span>Yaw</span><input id={`${id}-yaw`} type="range" min={-180} max={180} step={1} value={plane.yaw} aria-label="Yaw" aria-valuetext={`${plane.yaw} degrees`} onPointerDown={showPlane} onChange={event => adjust({ yaw: Number(event.target.value) })} /><output htmlFor={`${id}-yaw`}>{plane.yaw}°</output></label>
        <label className="section-angle" htmlFor={`${id}-pitch`}><span>Pitch</span><input id={`${id}-pitch`} type="range" min={-90} max={90} step={1} value={plane.pitch} aria-label="Pitch" aria-valuetext={`${plane.pitch} degrees`} onPointerDown={showPlane} onChange={event => adjust({ pitch: Number(event.target.value) })} /><output htmlFor={`${id}-pitch`}>{plane.pitch}°</output></label>
        <div className="section-actions">
          <button type="button" className="section-flip" aria-pressed={plane.flipped} onClick={() => adjust({ flipped: !plane.flipped })}><FlipVertical2 size={15} aria-hidden="true" />Flip cut side</button>
          <label className="section-gizmo"><input type="checkbox" checked={plane.showGizmo} onChange={event => onPlaneChange({ ...plane, showGizmo: event.target.checked })} /><span>Show cutting plane</span></label>
        </div>
        <p className="section-guidance">{defaultOrientation && !plane.free ? 'Default section opens the housings. Rotate or choose a preset to cut every component.' : 'Section depth moves the cut along the plane. Hide the plane to inspect the interior.'} The arrow points to the kept side.</p>
      </div>
    </div>
  );
}
