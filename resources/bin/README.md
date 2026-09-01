# PortPilot binary directory

This directory contains the bundled `witr` static binaries, downloaded by
`scripts/download-witr.js` from https://github.com/pranshuparmar/witr/releases.

Each `.vsix` is published with only the binary matching its target platform
(see `scripts/build-platform.sh`), keeping the package size small.

Binaries are .gitignored; CI populates this folder before `vsce package`.
