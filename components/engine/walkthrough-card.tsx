'use client';

import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

type WalkthroughCardProps = {
  station: { title: string; body: string };
  componentNames: string[];
  index: number;
  total: number;
  playing: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlaying: () => void;
  onExit: () => void;
};

export default function WalkthroughCard({
  station, componentNames, index, total, playing,
  onPrevious, onNext, onTogglePlaying, onExit,
}: WalkthroughCardProps) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="walkthrough-card" aria-label="Engine walkthrough">
      <div className="walkthrough-header">
        <span>Guided walkthrough</span>
        <button type="button" className="walkthrough-exit" onClick={onExit} aria-label="Exit walkthrough" title="Exit walkthrough (Escape)">
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="walkthrough-station" aria-live="polite" aria-atomic="true">
        <div className="walkthrough-step">Station {index + 1} of {total}</div>
        <h2 ref={title} tabIndex={-1}>{station.title}</h2>
        <p>{station.body}</p>
        <div className="walkthrough-components">
          <span>Highlighted components</span>
          <ul>{componentNames.map(name => <li key={name}>{name}</li>)}</ul>
        </div>
      </div>
      <progress className="walkthrough-progress" value={index + 1} max={total} aria-label="Walkthrough progress" />
      <div className="walkthrough-controls">
        <button type="button" onClick={onPrevious} disabled={index === 0} aria-label="Previous station" title="Previous station (Left arrow)">
          <ChevronLeft size={17} aria-hidden="true" /><span>Back</span>
        </button>
        <button type="button" className="walkthrough-play" onClick={onTogglePlaying} aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'} title={playing ? 'Pause walkthrough (Space)' : 'Play walkthrough (Space)'}>
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}<span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button type="button" onClick={onNext} disabled={index === total - 1} aria-label="Next station" title="Next station (Right arrow)">
          <span>Next</span><ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <p className="walkthrough-keyboard">Arrow keys to step · Space to pause · Esc to exit</p>
    </section>
  );
}
