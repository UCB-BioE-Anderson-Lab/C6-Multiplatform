#!/bin/bash
# The Python half of the test suite. The renderers are Python because .xlsx parsing needs
# openpyxl; their tests have to be too.
#
# A SKIP IS NOT A PASS. If the interpreter cannot import openpyxl this exits 1 and says why,
# rather than printing nothing and letting `npm test` go green over untested code.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-python3}"
if ! "$PY" -c "import openpyxl" 2>/dev/null; then
  echo "  python tests NOT RUN: '$PY' cannot import openpyxl." >&2
  echo "  Set PYTHON to an interpreter that can — the renderers need it too." >&2
  exit 1
fi
fail=0
for t in "$HERE"/test_*.py; do
  echo "  $(basename "$t")"
  "$PY" "$t" || fail=1
done
exit $fail
