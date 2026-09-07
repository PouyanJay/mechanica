#!/usr/bin/env python3
"""Export a committed Engine Atlas checkout without account-specific identity."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tarfile
import zipfile


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/export-repository.py /absolute/path/output.zip')
    root = Path(__file__).resolve().parent.parent
    destination = Path(sys.argv[1]).expanduser()
    if not destination.is_absolute() or destination.suffix.lower() != '.zip':
        raise SystemExit('Provide an absolute output path ending in .zip.')
    if destination.exists():
        raise SystemExit('Output already exists. Choose a new path.')

    def git(*args):
        return subprocess.check_output(['git', '-C', str(root), *args])

    if git('status', '--porcelain').strip():
        raise SystemExit('Commit or resolve checkout changes before exporting.')
    commit = git('rev-parse', 'HEAD').decode().strip()
    source = git('archive', '--format=tar', commit)
    files = {}
    modes = {}
    forbidden = {'.git', 'node_modules', 'dist', '.next', '.wrangler', '.sites-runtime'}
    with tarfile.open(fileobj=io.BytesIO(source), mode='r:') as archive:
        for member in archive.getmembers():
            if member.isdir():
                continue
            path = PurePosixPath(member.name)
            if not member.isfile() or path.is_absolute() or '..' in path.parts:
                raise SystemExit(f'Unsupported archive entry: {member.name}')
            if forbidden.intersection(path.parts) or path.name.startswith('.env') or path.suffix == '.pem':
                raise SystemExit(f'Unexpected private or generated file: {member.name}')
            payload = archive.extractfile(member).read()
            if member.name == '.openai/hosting.json':
                config = json.loads(payload)
                config.pop('project_id', None)
                payload = (json.dumps(config, indent=2) + '\n').encode()
            files[member.name] = payload
            modes[member.name] = member.mode

    manifest = {
        'project': 'Engine Atlas',
        'source_commit': commit,
        'format': 'portable-source-snapshot',
        'transformations': ['Removed project_id from .openai/hosting.json'],
        'files': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())},
    }
    files['EXPORT-MANIFEST.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, payload in sorted(files.items()):
            item = zipfile.ZipInfo('engine-atlas/' + name, date_time=(2026, 1, 1, 0, 0, 0))
            item.create_system = 3
            item.external_attr = (0o100000 | modes.get(name, 0o644)) << 16
            item.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(item, payload)
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Archive integrity check failed.')
        for name, expected in manifest['files'].items():
            actual = hashlib.sha256(archive.read('engine-atlas/' + name)).hexdigest()
            if actual != expected:
                raise SystemExit(f'Checksum mismatch: {name}')
    print(f'Exported {len(files)} files from {commit}')
    print(f'{destination} ({destination.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
