# aozora-obsidian Bench Harness

このディレクトリは **bench-first 規律** の中核(`docs/architecture-refresh/00-current-naive-points.md` §0.5、`docs/adr/0003-architecture-refresh-bench-first.md`)。Architectural Refresh ラウンドで採用候補の改善を **数値で実証** するための一次資料を集積する。

## 何をどう計測するか

| 対象 | 何を測る | bench file |
|---|---|---|
| WASM 境界 | init / `Document.new` / `to_html` / `serialize` / `diagnostics_json` / dispose の各 step、source size 100B / 1KB / 10KB / 100KB / 1MB | `wasm-boundary.bench.ts` |
| CodeMirror decoration | live preview の build / update 時間、viewport 100 / 1000 段落 | `codemirror-decoration.bench.ts`(Phase 4 で追加) |
| Reading view post-processor | per-paragraph cost、ruby / bouten / 字下げ / 外字混在ケース | `post-processor.bench.ts`(Phase 5 で追加) |
| Encoding 判定 | BOM 一致 / BOM 無し SJIS / BOM 無し UTF-8 / corrupted の latency | `encoding-detection.bench.ts`(Phase 9 で追加) |
| Reactivity layer | 5 つの設定変更を順次行うシナリオの rerender 回数 + 累積時間 | `reactivity.bench.ts`(Phase 6 で追加) |
| Effect overhead | `Effect.runSync` / `Effect.runPromise` のオーバーヘッド vs 手書き Result | `effect-overhead.bench.ts`(Phase 7 で追加) |
| Gaiji rendering | 1000 字の外字を含む source の render time + memory | `gaiji-rendering.bench.ts`(Phase 8 で追加) |
| Parse cache | 同 source を 5 回 parse する scenario の cumulative time | `parse-cache.bench.ts`(Phase 11 で追加) |

## 実行

すべて Docker 経由(host で bun を直接呼ばない、CLAUDE.md 規律):

```sh
just bench                                 # 全 bench を実行
just bun -- vitest bench bench/wasm-boundary.bench.ts  # 単独実行
```

結果は `bench/last-run.json` に出力(vitest の `outputJson` 設定経由)。

## baseline と比較

`bench/baseline.json` は git に commit されている canonical baseline。新たな採用候補を試した後、結果が baseline より改善 / 劣化 / 中立かを `scripts/bench-compare.mjs` で確認:

```sh
just bun -- node scripts/bench-compare.mjs   # baseline.json と last-run.json を diff
```

improvement(中央値が ±5% 以上動いた箇所)を ADR `docs/adr/000N-...` に引用、採用 / 却下を確定。

## baseline 更新ルール

baseline は **意図的な renderer / lexer 更新** 時のみ更新する。renderer の挙動を変えていないのに baseline を bump するのは「数値を後付けで合わせる」行為であり禁止。具体的には以下の 3 条件すべて満たすときのみ baseline.json を更新:

1. WASM 側(aozora workspace)に意図的な実装変更がある(`aozora-pin.txt` の SHA を bump している)
2. 改善 / 劣化のいずれもベンチで再現可能(同じ Docker image、同じ corpus で 3 回連続)
3. 該当する ADR が起草されている(なぜ baseline を更新するか、何が変わったか)

## CI への組み込み

`.github/workflows/build.yml` に warn-only step として組み込まれる(Phase -1 で追加予定)。shared GitHub runner の variance を考慮して **hard-fail はしない**。bench result は `actions/upload-artifact@v7` で workflow artefact に持続化、回帰の trend を確認可能。

回帰の hard-fail 化は 30 日以上 baseline 推移を観察してから、別 ADR で graduate する(現ラウンド外、roadmap "Now (v0.1.x)" に記載予定)。

## なぜ bench-first か

memory `feedback_data_driven_systemize.md` 参照。

要旨: 採用候補(Aho-Corasick / Lezer / signals / Effect-ts / FST / Bloom 等)を「これがモダンっぽい」「これが業界標準」というノリで選ぶと、実際のワークロードで効かない場合に判断を誤る。**aozora-obsidian は青空文庫レンダラという特殊なドメインなので、汎用的な ベストプラクティスがそのまま当たるとは限らない**。bench で改善を実証してから採用する。

これは aozora 本体ワークスペースの `aozora-bench` crate と同じ規律(criterion 駆動、PGO profile source 兼用)。aozora-obsidian の TS / WASM 境界 bench はそれを TS 側に持ち込んだもの。
