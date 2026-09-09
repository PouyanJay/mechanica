import { ENGINES, type EngineType, type ViewerState } from './engine-data';

export type WalkthroughStation = {
  id: string;
  title: string;
  body: string;
  parts: string[];
  hidden?: string[];
  camera: { position: [number, number, number]; target: [number, number, number] };
  /** Absolute crank or eccentric-shaft angle in radians, matching the builders. */
  mechanismAngle?: number;
};

const station = (id: string, title: string, body: string, parts: string[], x: number, mechanismAngle?: number): WalkthroughStation => ({
  id, title, body, parts, camera: { position: [x - 6, 5, 10], target: [x, 0, 0] }, mechanismAngle,
});
const compressor = station('compressor', 'Squeeze the air', 'Rows of compressor blades raise the pressure of the incoming air. Stationary vanes guide it into the next row before it reaches the combustor.', ['compressor'], -.6);
const combustor = station('combustor', 'Add heat', 'Fuel burns continuously in the annular combustor. Some of the compressed air supports the flame, while the rest helps cool the liner and mix the hot gas.', ['combustor'], 1.55);
const turbine = station('turbine', 'Turn heat into rotation', 'Hot gas expands through the turbine stages and turns their blades. Shafts carry this power back to the compressor.', ['turbine', 'shaft'], 2.95);
const jet = station('nozzle', 'Send the gas rearward', 'The exhaust nozzle guides the remaining gas into a fast rearward jet. Accelerating this gas contributes to forward thrust.', ['nozzle'], 4.45);
function shaftTour(propeller: boolean): WalkthroughStation[] {
  return [
    station('inlet', 'Bring air into the core', 'Air enters the compact core casing and reaches the compressor. This engine has no large bypass fan.', ['casing', 'compressor'], -2.7),
    compressor, combustor,
    station('turbine', 'Extract power in two stages', 'The gas-generator turbine drives the compressor. A separate power turbine extracts more energy to drive the output through a shaft.', ['turbine', 'shaft'], 2.95),
    station('output', propeller ? 'Drive the propeller' : 'Deliver shaft power', propeller ? 'Reduction gearing lowers the output speed before turning the propeller. The propeller moves a large mass of air and provides most of the thrust.' : 'A reduction gearbox delivers torque to the output flange. This shaft can drive an external load such as a rotor transmission.', ['fan', 'shaft'], -3.5),
    station('exhaust', 'Release the spent gas', 'The exhaust duct carries the gas away after the power turbine has extracted useful work. Most of the useful output leaves through the shaft.', ['nozzle'], 4.4),
  ];
}
function pistonTour(v8: boolean): WalkthroughStation[] {
  // Follow cylinder 1 in the first bank. Its axis is tilted by -PI/4 in the V8.
  const offset = v8 ? -Math.PI / 4 : 0;
  const stations = [
    station('intake', '1. Draw in a fresh charge', 'Follow cylinder 1 at the front of the engine. Its piston moves down as the intake valve admits a fresh charge through the intake runner.', ['pistons', 'valvetrain', 'manifolds'], -1.8, offset + Math.PI / 2),
    station('compression', '2. Compress the charge', 'The piston rises with both valves closed. The trapped charge is squeezed into the space below the cylinder head.', ['pistons', 'heads', 'valvetrain'], -1.8, offset + 3 * Math.PI / 2),
    station('power', '3. Push the piston down', 'A spark starts combustion near the top of the stroke. Expanding gas pushes the piston down, and the connecting rod transfers the force to the crankpin.', ['heads', 'pistons', 'rods'], -1.8, offset + 5 * Math.PI / 2),
    station('exhaust', '4. Clear the cylinder', 'The piston rises again with the exhaust valve open. Burned gas leaves through the exhaust runner, ready for the next intake stroke.', ['pistons', 'valvetrain', 'manifolds'], -1.8, offset + 7 * Math.PI / 2),
    station('crankshaft', 'Collect the work', v8 ? 'All eight connecting rods deliver force to a shared cross-plane crankshaft. The flywheel helps smooth the changing torque as the cylinders take turns doing work.' : 'Four connecting rods deliver force to a shared crankshaft. The outer pistons move together, opposite the middle pair, while the flywheel helps smooth the changing torque.', ['rods', 'crankshaft'], 0, offset + 5 * Math.PI / 2),
  ];
  return stations.map(s => ({ ...s, camera: { position: [s.camera.target[0] - 6, 6, 9] as [number, number, number], target: [s.camera.target[0], 1, 0] as [number, number, number] } }));
}
function rotaryStation(id: string, title: string, body: string, parts: string[], angle: number): WalkthroughStation {
  return { id, title, body, parts, hidden: ['endplates'], mechanismAngle: angle, camera: { position: [-8, 3, 5], target: [0, .2 * Math.cos(angle / 3), .4 * Math.sin(angle / 3)] } };
}

export const WALKTHROUGHS: Record<EngineType, WalkthroughStation[]> = {
  turbofan: [
    station('inlet', 'Welcome the incoming air', 'The inlet lip guides air toward the fan. The casing surrounds the entrance and supports the flow path.', ['fan', 'casing'], -3.6),
    station('fan', 'Split the flow', 'The fan moves a large volume of air. Some enters the core, while the rest travels around it through the bypass duct and contributes to thrust.', ['fan', 'casing'], -2.8),
    compressor, combustor,
    { ...turbine, body: 'Hot gas expands through the turbine stages and turns their blades. Concentric shafts drive the compressor and the large upstream fan.' }, jet,
  ],
  turbojet: [
    station('inlet', 'Guide air into the engine', 'The inlet and guide vanes direct incoming air toward the core. All of this air passes through the compressor because there is no separate bypass fan.', ['fan'], -3.1),
    compressor, combustor, turbine, jet,
  ],
  turboprop: shaftTour(true),
  turboshaft: shaftTour(false),
  v8: pistonTour(true),
  inline4: pistonTour(false),
  rotary: [
    // Follow the face between apexes 1 and 2 through one rotor revolution.
    rotaryStation('intake', '1. Fill one moving chamber', 'Follow the rotor face beside the intake port on the lower side of the housing. As its chamber grows, a fresh charge enters through the open port.', ['rotor', 'housing', 'ports'], 3 * Math.PI),
    rotaryStation('compression', '2. Shrink the chamber', 'The same face carries the charge away from the intake port. The chamber becomes smaller, while apex and side seals help keep the charge trapped.', ['rotor', 'seals', 'housing'], 4 * Math.PI),
    rotaryStation('ignition', '3. Ignite and expand', 'Near the spark plugs, the compressed charge ignites. Expanding gas pushes on the rotor face and turns the eccentric shaft.', ['ports', 'rotor', 'eccentric'], 5 * Math.PI),
    rotaryStation('exhaust', '4. Uncover the exhaust port', 'The same chamber reaches the exhaust port on the other lower side. Burned gas leaves as the chamber shrinks, making room for another cycle.', ['rotor', 'ports'], 7 * Math.PI),
    rotaryStation('output', 'Three shaft turns per rotor turn', 'The eccentric shaft carries the rotor on an offset journal. Timing gears constrain its motion so the shaft turns three times for each full rotor revolution.', ['eccentric', 'gears', 'rotor'], 9 * Math.PI),
  ],
};

export function enterStation(state: ViewerState, index: number): ViewerState {
  if (!state.walkthrough) return state;
  const stations = WALKTHROUGHS[state.engine];
  const next = Math.max(0, Math.min(stations.length - 1, index));
  return { ...state, hidden: stations[next].hidden ?? [], selected: stations[next].parts[0], selectedParts: stations[next].parts, selectedPiece: null,
    walkthrough: { ...state.walkthrough, station: next } };
}

export function startWalkthrough(state: ViewerState): ViewerState {
  return enterStation({ ...state, mode: 'cutaway', section: 58, explode: 0, cycling: false, playing: false,
    hidden: [], isolated: null, isolatedPiece: null, selectedPiece: null, camera: 'perspective', spin: false,
    flow: ENGINES[state.engine].flow, walkthrough: { station: 0, playing: true, previousFlow: state.walkthrough?.previousFlow ?? state.flow } }, 0);
}

export function exitWalkthrough(state: ViewerState): ViewerState {
  return state.walkthrough ? { ...state, flow: state.walkthrough.previousFlow, walkthrough: null } : state;
}

export function stepWalkthrough(state: ViewerState, delta: number): ViewerState {
  return state.walkthrough ? enterStation({ ...state, walkthrough: { ...state.walkthrough, playing: false } }, state.walkthrough.station + delta) : state;
}

export function advanceWalkthrough(state: ViewerState): ViewerState {
  if (!state.walkthrough?.playing) return state;
  if (state.walkthrough.station === WALKTHROUGHS[state.engine].length - 1) {
    return { ...state, walkthrough: { ...state.walkthrough, playing: false } };
  }
  return enterStation(state, state.walkthrough.station + 1);
}
