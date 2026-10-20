# ratchet-demo

A frozen copy of `tests/baseline/` with the **linted** rules applied — i.e. what your existing
suite looks like the day you turn the rules on. `eslint-suppressions.json` at the repo root
holds its 39 violations.

    node scripts/ratchet.mjs report     # who owns each one
    node scripts/ratchet.mjs tighten    # prune fixed ones; fail on new ones
