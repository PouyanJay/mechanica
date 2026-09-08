# Handoff and tooling record

## Provenance

The seven-engine application was completed at commit d8977a252908095e4c665b9cfda33c7906340920. This handoff adds documentation, local command aliases, repository skills, and a source export script. An inherited CSS test was corrected to check unused utilities in the vendor source and actual app styles in compiled output, respecting Tailwind's demand-driven compilation. Engine geometry and interaction behavior are unchanged. The export script writes an EXPORT-MANIFEST.json into each archive recording the packaged commit.

The user supplied [Human Atlas](https://github.com/ashemag/human-atlas) as the interaction reference. Engine geometry and disassembly code were authored for Engine Atlas. No Human Atlas source or model assets are bundled.

## Agents and skills

One coding assistant performed implementation. No separate subagents were spawned, and the application contains no agent service or LLM call.

The authoring environment supplied Sites building and hosting workflows for development and private publication, Library for file delivery/retrieval, and shell/Git tooling for source edits and checks. Skill Creator and official OpenAI documentation supported this handoff. Those managed environment services require their own account and host integrations; they are not application source.

These portable skills were newly authored for the handoff:

| Skill | Project knowledge |
| --- | --- |
| engine-models | Registry, geometry builders, mechanism invariants, integration |
| engine-explosion | Continuous slider, identity, exact reassembly, packing |
| engine-validation | Numeric checks, compilation, visual review coverage |

These skills and the shared agent guidance are kept as local, untracked files so the repository itself carries no agent tooling. They are instruction-based skills for a compatible coding agent, with no extra MCP or agent runtime required.

## Validation

The engine suite covers 42 inventory configurations, reverse slider determinism, phase continuity, radial finite transforms, identity, isolation, repeated exact reassembly, piston linkages, and rotary apex motion. It executes actual builders with a lightweight DOM stub. It does not render WebGL pixels or benchmark frame rate.

The handoff was checked on Linux with Node 24. Production compilation, engine checks, and the existing HTML/component checks were run. Skill manifests were structurally validated. Native Windows/macOS and hosting outside the original Sites environment were not tested.

## Download

All tracked application source, configuration, public assets, components, tests, scripts, and retained vendor licenses are included. Restore dependencies with npm ci and package-lock.json.

The export omits Git history, dependencies, generated output, caches, credentials, and local environment files. Its only source transformation removes project_id from the hosting manifest. The extra export manifest records that transformation, the source commit, and per-file SHA-256 checksums.
