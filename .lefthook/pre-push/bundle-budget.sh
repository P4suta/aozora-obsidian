#!/bin/sh
BUDGET=$((2 * 1024 * 1024))
TOTAL=0
for f in main.js aozora.wasm; do
	if [ -f "${f}" ]; then
		BYTES=$(wc -c <"${f}" | tr -d '[:space:]')
		TOTAL=$((TOTAL + BYTES))
		echo "  ${f}: ${BYTES} bytes"
	fi
done
echo "Total bundle: ${TOTAL} bytes (budget ${BUDGET} bytes)"
if [ "${TOTAL}" -gt "${BUDGET}" ]; then
	echo "FAIL: bundle exceeds 2 MiB budget"
	exit 1
fi
