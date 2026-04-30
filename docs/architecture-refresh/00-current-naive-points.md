# Phase 0 — 現状の批判的批評

> このドキュメントは Architectural Refresh ラウンドの起点。`aozora-obsidian` の TS 側を **「素朴な箇所」「上流(aozora workspace)に既にある資産」** の 2 軸で対照させ、後続 phase で何をどこへ寄せるかの設計判断を残す。
>
> このドキュメント自体が「使い捨ての調査メモ」ではなく、永続資産。データ駆動・仕組み化・規律ある統合の方針(memory `feedback_data_driven_systemize.md`)に従い、ADR や採用カタログと相互参照して未来の判断の根拠になる形でメンテする。

## 0.1 既存 aozora workspace crate の inventory

`/home/yasunobu/projects/aozora/crates/` の各 crate の責務を、aozora-obsidian 側でそのまま活用できる視点で整理する。

| crate | 責務 | aozora-obsidian での活用余地 |
|---|---|---|
| `aozora-scan` | SIMD friendly trigger-byte scanner。`aho_corasick::packed::Searcher` の Teddy backend(Langdale 2015、BurntSushi 2019 port)+ x86_64 AVX2 structural-bitmap(simdjson 由来、Langdale & Lemire 2019)+ DFA fallback の **3-backend dispatcher**。スループット 10-20 GiB/s。出力は sorted `Vec<u32>` of trigger offsets | **TS 側の正規表現 lexer(`src/livepreview.ts`)を上流で完全代替**。Aho-Corasick を JS / WASM 側で「自前で足す」必要は無い |
| `aozora-lex` | borrowed-AST 出力の orchestrator。`aozora-scan` の trigger 列 → 全 phase 通して bumpalo arena 上に AST を構築、`lex_into_arena` 1 関数が public entry | WASM 側の `Document.parse()` の中身がこれ。**aozora-obsidian が自分で lexer を書く必要は無い** |
| `aozora-lexer` | Pure-functional 4 phase pipeline(sanitize / events / pair / classify)。PUA sentinel scheme(`U+E000..U+F8FF` の 4 種でブロック・インライン Aozora span をマーク) | 直接呼ばない。`aozora-lex` 経由でアクセス |
| `aozora-encoding` | Shift_JIS decode + 外字解決。`encoding_rs` ベース、NFC normalization は caller 側、エラーは fail-fast(`DecodeError::ShiftJisInvalid`)、buffer 再利用 API(`decode_sjis_into`)あり | **TS 側の `src/encoding.ts` を上流で完全代替可能**。BOM 判定だけ JS 側に残し、本体は WASM に委譲 |
| `aozora-veb` | Eytzinger layout のキャッシュフレンドリーな順序付き集合(Khuong & Morin 2017)。`aozora-syntax` の registry(byte position → AozoraNode)が利用 | aozora-obsidian が直接使う場面は薄い。WASM 側で透過的に活躍 |
| `aozora-syntax` | borrowed AST 型(`AozoraNode<'_>`、Container / Bouten / Indent / Heading 等の `Copy`-able payload)、`borrowed::Interner` で deduplication | TS 側が AST を理解する必要があるなら、ここから生成された型の slice を WASM で受け取る |
| `aozora-render` | HTML / serialization renderer | `Document.to_html()` / `Document.serialize()` がこの crate 越しに動いている |
| `aozora-bench` | criterion + corpus-driven bench harness。**PGO profile source も兼ねる**(`cargo run --release --bin aozora_pgo_train`)。`crime_and_punishment.rs` と `synthetic_corpus.rs` の 2 bench、`phase3_subsystems` example で per-phase wall measurement | **計測仕組みは上流に存在**。aozora-obsidian の bench は「TS 層 + WASM 境界」のみを切り出した薄い harness を `bench/` に置けばよい |
| `aozora-trace` | samply gecko-format trace loader + DWARF symbolicator + 6 分析(`hot_leaves`/`hot_inclusive`/`library_distribution`/`rollup`/`matching_stacks`/`folded_stacks`/`compare`)。symbol cache 持続化、再分析はミリ秒 | **profile 仕組みも上流に存在**。aozora-obsidian の最適化判断は `aozora-trace` の出力に基づく ADR を残す |
| `aozora-corpus` | corpus walker(filesystem / archive 両対応、`with_load_pool` で並列ロード) | aozora-obsidian の bench 用テキストもここから引っ張る |
| `aozora-test-utils` | proptest 戦略 + 共通 test config。non-published | property test を Rust 側で書くなら必ずここを使う |
| `aozora-cli` / `aozora-ffi` / `aozora-py` / `aozora-book` / `aozora-spec` / `aozora-xtask` 他 | (aozora-obsidian の現ラウンドでは直接関与しない) | — |

**結論**: aozora workspace は既に **lexer / parser / renderer / encoding / 順序付き集合 / bench / profile / corpus / test utils** をすべて持っている、成熟したエコシステム。`aozora-obsidian` がやるべきは **TS 側に散らばった重複実装(正規表現 lexer、BOM-only encoding 判定、JSON 手書き parser、try/catch 散在)を一掃し、WASM 経由で上流に委譲すること**。新規アルゴリズム(Aho-Corasick、Markov 推定、FST 等)を「自前で足す」のは原則的に乱立行為であり、避ける。

## 0.2 aozora-obsidian TS 側の naive points 一覧

各 src ファイルについて、アーキテクチャ的に素朴な箇所と、上流のどの crate / どのアルゴリズムで置換すべきかを記録。

### `src/main.ts` — Plugin lifecycle / settings 反映

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `90-97` | `updateSettings()` で `applyLivePreviewToggle()` / `applyTxtRegistration()` / `rerenderAllPreviews()` を **直列ハードコード呼び出し** | 設定 → 派生値 → UI / extension の依存グラフを宣言的に表現すべき。「writingMode を変えたら preview を rerender する」「enableLivePreview を変えたら compartment を reconfigure する」「detectAozoraTxt or txtGlob を変えたら拡張子登録を toggle する」という対応関係がコードに分散している | reactivity layer を導入(候補: `@preact/signals-core`、ただし bench で必要性を検証してから)。`computed` 派生 + `effect` 副作用 + topological sort で循環検出 |
| `19-34` | `CmEditorView` / `InternalMarkdownView` / `InternalViewRegistry` / `InternalApp` を**手書き構造型**で Obsidian 内部 API に到達 | Obsidian 内部 API への依存は不可避だが、cast 点が広いため境界を 1 箇所に集中させたい | 全 internal API 接触を `src/obsidian/internal.ts` に集約、それ以外の場所は public API のみ参照 |
| `42-67` | `onload()` 内に WASM init / processor 登録 / extension 登録 / settings UI 登録が **手続き的に並ぶ** | startup シーケンスの順序依存が明示されていない、初期化失敗時のリカバリ経路がない | Effect / Resource 風の構成で初期化グラフを宣言。失敗経路は Result/Either で扱う(候補: `effect-ts`、要 bench 検証) |

### `src/settings.ts` — 設定タブ + 型

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `8-15` | `interface AozoraSettings` を**手書き** | runtime validation がない。`loadData()` で読んだ JSON が schema に合うか保証されていない(`main.ts:77` の `Partial<AozoraSettings>` cast は型 assertion でしかない) | `zod` で `SettingsSchema` を定義し `Settings = z.infer<typeof SettingsSchema>` で型派生。`loadData()` 結果を `SettingsSchema.parse()` で検証 |
| `78-103` | 各設定項目が `new Setting(containerEl).addToggle/addDropdown/addTextArea` の **大量の手続き** | 同じパターンが繰り返し、設定追加のたびに 7-15 行 | settings の declarative description(field, kind, default, validator, ui-hint)から UI を生成する factory に集約 |
| `4-6` | `WritingMode` / `Encoding` / `GaijiFallback` が **bare string union** | branded types でないため、別の string union との混同や、stringly-typed 比較ミスを型で防げない | `Brand<'WritingMode', 'horizontal' | 'vertical'>` 等の branded union 化(zod 経由で自動生成可) |

### `src/encoding.ts` — エンコーディング判別

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `46-60` | BOM のみで判定、BOM 無しは `defaultEncoding` 設定にそのまま fallback | aozora.gr.jp の SJIS テキストは **BOM 無しが多数派**。利用者が `defaultEncoding=utf8` のまま SJIS を開くと文字化け | **`aozora-encoding` crate に Markov n-gram 推定を追加 → WASM 経由で TS が利用** という方向。ただし「Markov 必要かどうか」は事前に bench で計測すべき(SJIS / UTF-8 識別だけなら byte distribution heuristic で 100% 行くケースもある) |
| `21-23` | `UTF8_BOM` / `UTF16_LE_BOM` / `UTF16_BE_BOM` を **手書き定数で startsWith 判定** | 機能的には正しいが、aozora-encoding crate と二重実装になっており規律的に乱立 | aozora-encoding の `BOM_*` 定数(あれば追加)を re-export。なければ aozora-encoding 側に追加し TS は WASM 経由で参照 |
| `46` | `decodeAozoraBytes` が **全部入り関数**(BOM 判定 → エンコーディング選択 → TextDecoder 呼出 → DecodeResult 構築) | 各段階で別の責務、エラー経路の表現も Result<DecodeResult, DecodeError> 化したい | Effect/Result chain に分解、aozora-encoding の `DecodeError` を JS 側にもエクスポートして type-safe に扱う |

### `src/aozora-wasm.ts` — WASM ラッパー

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `39-75` | diagnostics の JSON を **手書き parser**(`isAozoraDiagnosticKind` / `readNumber` / `readString` / `parseDiagnostic`) | aozora-spec crate の `Diagnostic` enum と二重実装。WASM 出力 JSON と TS 型の整合性は **runtime に検証されない** | aozora-spec の `Diagnostic` を serde-wasm-bindgen 経由で **構造化エクスポート**(JSON 文字列でなく `JsValue` か `serde_wasm_bindgen::to_value`)し、TS 側は zod schema で受ける。手書き parser は廃止 |
| `82-131` | `AozoraDocumentHandle` クラスが **disposed flag を手書き**、`assertLive()` で例外を投げる | 使用後解放を忘れると WASM heap leak。型システムで「dispose されていない handle のみメソッド呼べる」を表現したい | linear types の simulation(branded handle + Effect.scoped で自動 dispose)。`using doc = await parser.parse(...)` 構文(ECMAScript Stage 3 の Explicit Resource Management、現在の TypeScript は対応済)を活用 |
| `100-112` | `diagnostics()` が **`JSON.parse(json)` → array チェック → map(parseDiagnostic)** という 3 段階 | エラー時に黙って空配列を返す(`catch {} return []`)— silent failure の典型 | Result<readonly Diagnostic[], DiagnosticParseError> を返す形に。silent failure は禁止 |

### `src/wasm-loader.ts` — WASM ローダ

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `25-30` | `ready()` の memoization が **`Promise.undefined?` の手書き判定** | concurrent caller が複数 init を同時 trigger するケースがハンドルされていない(現状は `instantiateWasm` 中に呼ばれた 2 個目の `ready()` も同じ promise を返すので大丈夫だが、その安全性が型で保証されていない) | `once()` / `lazy()` の標準的な抽象に置換、もしくは Effect.cached |
| `38-44` | WASM init を **単一 wasm ファイル前提**で行う | 将来的に core / 外字辞書 / encoding 推定器を section split したいが、現コードは 1 ファイル前提 | `WasmSectionLoader` 抽象に分離。section ごとに `adapter.readBinary` で個別 lazy load |
| `52-72` | エラーメッセージが **string template による手書き診断** | i18n に乗せにくい、構造化されていない | `WasmLoadError` ADT(MissingManifestDir / ArtifactMissing / InstantiationFailed)化 |

### `src/processor.ts` — Reading view code-block processor

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `50` | `container.innerHTML = doc.toHtml()` で **renderer 出力をそのまま注入** | renderer の出力は信頼できる(aozora-render から、type-checked AST 経由)が、Obsidian Plugin guidelines のレビュアが頻繁に指摘する。XSS は実害ゼロでも cosmetic に変える価値あり | renderer 出力を `DOMParser.parseFromString(html, 'text/html')` でパースし、`<body>` の子ノードを `Element.replaceChildren(...children)` で挿入。意味的に同じ、レビュア triggers を回避 |
| `43-61` | `try/catch` で WASM 失敗を全部捕まえて **fallback バナー + raw source 表示** に倒す | 失敗の原因(MissingManifestDir / ArtifactMissing / WasmInitError / ParseError)で UI 体験を切り分けたい | Effect.catchTags で error tag ごとに UI 分岐、Diagnostic UX 層と統合 |
| `73-79` | `renderFallback` が **手書きの DOM 構築** | 単純だが UX が「raw source を `<pre>` に投げる」だけ、診断情報を活用していない | aozora の `Diagnostic` を hover popover や inline marker で render、これは Phase 10 の Diagnostic UX layer と統合 |

### `src/inline-processor.ts` — Reading view inline processor

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `21` | `SENTINEL_PATTERN = /[｜《※]|［＃|〔/u` で **手書き正規表現スキャン** | aozora-scan が SIMD で 10-20 GiB/s 出るのに、TS 側で正規表現を回している。同じ責務の二重実装 | aozora-scan の trigger offset 列を WASM 経由で受け取り、TS 側はそれを単に「ここに sentinel があるか?」のチェックに使う |
| `46-58` | 各 text node ごとに **WASM `parser.parse(node.data)` を発行** | テキストノード数だけ `Document::new` + arena 確保 + lex/parse を回す。1 段落の post-processor 処理コストが node 数に線形 | 全テキストノードを 1 つの Document として一括 parse、結果を span で切り分けて配置。aozora-syntax の registry(byte position → node)が活躍する |
| `52` | `document.createRange().createContextualFragment(inlineHtml)` で **HTML 文字列を DOM に変換** | XSS の信頼境界(processor.ts と同じ)。実害ゼロだがレビュア triggers | DOMParser + replaceChildren に置換 |
| `62-71` | `document.createTreeWalker(root, NodeFilter.SHOW_TEXT)` で **全テキストノード走査** | 実装としては正しいが、aozora-scan の trigger offset 列との連携経路がない。スキャン結果を 2 度 utilize できていない | scan 結果を block 単位の text node range にマップする方針に統一 |

### `src/livepreview.ts` — Live Preview decorator

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `36-41` | `RUBY_PATTERN` / `BOUTEN_PATTERN` / `GAIJI_PATTERN` / `ANNOTATION_PATTERN` の **4 つの手書き正規表現** | aozora-scan + aozora-lex に既に同等以上の精度のスキャンがある。**正規表現は誤検出する**(例: ruby `｜漢字《かんじ》` と `［＃...］` の入れ子は本来 lex 段階で context-sensitive に判別すべき) | CodeMirror 6 `LanguageSupport` を Lezer Tree から構築し、syntax highlight / decoration を Tree 由来に置換。Lezer Tree の token は WASM 経由の token stream から build。**livepreview.ts はファイルごと削除候補** |
| `95-111` | `buildDecorations()` が **viewport 全体を毎更新で rebuild** | 1 文字編集でも viewport 全 token を再スキャン。CodeMirror 6 が提供する incremental 機構を活用していない | Lezer の persistent tree + CodeMirror の `Decoration.set` の incremental update に乗り換え |
| `91-93` | `selectionTouches()` が **range × decoration の O(R × D) 線形比較** | range 数 × decoration 数。viewport が広いと支配的にコストになる | Interval tree / range set で O(log n + k) 検索に。CodeMirror 自体の `RangeSet` も同等の機構を持つので使えるなら活用 |
| `36-37` | RUBY_PATTERN の **alternation 順序**(明示的 `｜` 区切り→暗黙的漢字検出)が手書きで脆い | 明示的区切りと自動推定が同じ正規表現に入っており、優先順位の保証が脆い。Aozora 仕様に厳密でない | aozora 本体の lex pipeline で sanitize → events → pair → classify する正しい仕様判定を借りる |
| `145-146` | `《《...》》` の inner span を **手計算で `+ 2` / `- 2` オフセット** | hard-coded の 2 byte が 3 byte UTF-8 codepoint の事実と矛盾しないことを保証する型がない(BMP の二重括弧は実は 2 codepoint で UTF-8 では 6 bytes、JS 文字列は UTF-16 で 2 code unit) | byte offset と char offset を Brand types で区別、混同を型で防ぐ |

### `src/txt-detector.ts` — `.txt` 自動認識

| 行 | naive point | 解くべき性質 | 改善方針 |
|---|---|---|---|
| `42` | `globs.some((glob) => minimatch(file.path, glob))` で **glob リストを毎回線形探索** | glob が増えると O(N × M)、しかし実際には 1〜10 個程度で支配的にはならない | 現状の負荷では問題なし。bench で必要性を検証してから `Trie` 化を検討。**bench なしの先行最適化はしない**(memory `feedback_data_driven_systemize`) |
| `47-49` | 4 KiB 読込の `arrayBuffer` から `head = new Uint8Array(arrayBuffer, 0, sliceLen)` で **前頭 sniff** | 前頭 4 KiB で `底本：` が見つからないファイル(本文が長く footer に bibliographic がある稀なケース)を取り逃がす | sniff 範囲を設定可能に、もしくは tail 4 KiB も見る option を追加(bench で hit rate を計測してから) |
| `49` | `decodeAozoraBytes(head, deps.defaultEncoding)` が **encoding を sniff の前段で決定** | SJIS テキストを utf-8 default で読むと文字化けし、`底本：` を取り逃がす可能性 | encoding 推定を sniff の中で行う(BOM だけで決まらない場合の safety net)。aozora-encoding の Markov 推定を活用 |

## 0.3 計測仕組みの現状

aozora workspace 側は **既に完備**:

- **bench**: `aozora-bench` crate(criterion + corpus walker + PGO profile source)。`crime_and_punishment.rs` 1 ベンチで 2 MB の現代日本語を full parse、`synthetic_corpus.rs` で stress test、`phase3_subsystems` example で per-phase wall measurement
- **profile**: `aozora-trace` crate(samply gecko-format loader + DWARF symbolicator + 6 分析 hot_leaves/hot_inclusive/library_distribution/rollup/matching_stacks/folded_stacks/compare、symbol cache 持続化)
- **PGO**: `aozora_pgo_train` binary で corpus 全件パース、PGO + BOLT pipeline 用 profile を収集
- **proptest**: `aozora-test-utils` で共有 strategy

aozora-obsidian 側に欠けているのは:

- **JS / TS 層の bench harness**(WASM 境界の overhead、CodeMirror decoration の build 時間、reading-view post-processor の per-paragraph cost)— **これは aozora-obsidian 固有なので、ここで作る**
- **mobile profiling pipeline**(現ラウンド外、roadmap に記載)
- **CI への bench 結果集約**(aozora-bench の出力を artefact として持続化、回帰検出)

**重要**: aozora-obsidian の bench harness は aozora-bench と同じ規律で作る。使い捨てスクリプトにしない、`bench/` ディレクトリで永続化、CI で artefact upload、baseline は git に commit。

## 0.4 Naive points → 上流マッピング(Phase 計画への影響)

| TS naive point | 上流での解決経路 | 修正後の Phase |
|---|---|---|
| `livepreview.ts` の 4 正規表現 | aozora-scan の trigger offset + aozora-lex の Token を WASM 経由で受ける → CodeMirror Lezer LanguageSupport | Phase 5 で **Lezer 化**、`livepreview.ts` 削除 |
| `inline-processor.ts` の SENTINEL_PATTERN | 同上(既存 aozora-scan で代替)| Phase 4 で `inline-processor.ts` を Lezer Tree ベースに置換 |
| `encoding.ts` の BOM-only 判定 | aozora-encoding crate に Markov 推定を追加(必要性は bench で検証) | Phase 9 を「aozora-encoding 拡張 + WASM 経由」に変更 |
| `aozora-wasm.ts` の手書き JSON parser | `serde-wasm-bindgen` で構造化、zod schema | Phase 1 + Phase 7 で対応 |
| `main.ts` の direct call cascade | signals + topological + lenses(必要性は bench で検証) | Phase 6 を「signals 仮説 + bench で検証」に変更 |
| WASM 境界の Result 化 | effect-ts または手書き ADT(必要性は bench で検証) | Phase 7 を「effect-ts 仮説 + bench で検証」に変更 |
| inline-processor の per-text-node WASM round-trip | aozora-syntax registry + 一括 parse + span 切り出し | Phase 4 のサブタスク |
| innerHTML / createContextualFragment | DOMParser + replaceChildren | Phase 4 内で同時に対処 |
| livepreview の selectionTouches O(R×D) | CodeMirror RangeSet または Interval tree | Phase 10(Interval tree)で対応 |
| aozora.wasm の単一ファイル前提 | section split + lazy load | Phase 12(必要性は bench で aozora.wasm size の閾値を見る) |

## 0.5 計画の修正方針(Phase 構造の見直し)

**従来 Plan の問題**:

1. **Aho-Corasick / SIMD lexer を「自前で aozora-wasm に追加」と書いた** — aozora-scan が既に Teddy + structural-bitmap + DFA の 3 backend で 10-20 GiB/s 出している。乱立行為。**Phase 2 を撤回し**、「aozora-scan の出力を WASM 経由で TS に流すパイプを敷く」に置換
2. **採用候補(Lezer / signals / Effect / FST / Bloom 等)を bench なしで採用と書いた** — 全採用候補は **仮説扱い**。各 phase で bench を先に追加し、**改善が数値で示されたものだけ** 採用。**示されなかったら採用しない**
3. **Phase 0 が一回限りの「naive 列挙」で終わっていた** — 永続資産化のため、本ドキュメントが ADR と相互参照される形になるよう構造化(本書の章番号は ADR 番号と対応するインデックスとして維持)

**新しい原則**:

- **Bench-first**: 各 phase は bench (`bench/*.bench.ts`) を先に追加 → 現状の数値を baseline として記録 → 仮説採用 → bench で改善を測定 → ADR に「採用 / 却下」と理由を記録
- **Reuse-first**: 新規実装の前に必ず aozora workspace に既存資産がないかを確認。**新規 crate / 新規 dependency / 新規 algorithm の追加は、既存で解決できないことが bench か明示的な理由で示されたとき限定**
- **Systemise**: 一回限りのスクリプト・調査メモを書くたびに、「これを継続的に使える形にどう仕組み化するか?」を問う。bench harness、profile pipeline、ADR、採用カタログ、依存グラフ図はすべて永続資産

**新しい Phase 構造の骨格**(詳細は次回更新で plan ファイル全体に反映):

- **Phase -1**: bench 基盤整備(`bench/wasm-boundary.bench.ts`, `bench/codemirror-decoration.bench.ts`, `bench/post-processor.bench.ts`)+ baseline 計測 + CI artefact upload
- **Phase 0**: 本ドキュメント(完了)
- **Phase 1**: Type-level foundation(Brand / Result / zod 設定 schema)— 依存なし、全 phase の前提
- **Phase 2 (差替)**: aozora-wasm の token stream API を `aozora-scan` 由来の trigger offset + `aozora-lex` 由来の Token から構築。新規 lexer は書かない
- 以降の Phase は bench で改善を実証する形に書き換え

## 0.6 ADR としての位置付け

本ドキュメントは Architectural Refresh シリーズの起点。連番:

- `docs/architecture-refresh/00-current-naive-points.md`(本書)
- `docs/architecture-refresh/01-data-structure-catalog.md`(Plan の Part I/II の永続版、Phase ごとに更新)
- `docs/architecture-refresh/02-layer-design.md`(各 layer の責務 + 依存グラフ図 dot)
- `docs/architecture-refresh/03-tradeoffs.md`(採用 / 却下の根拠、bench 数値とリンク)
- `docs/adr/0003-architecture-refresh-bench-first.md`(本ドキュメントから生成、原則を ADR に固定化)
- `docs/adr/0004-aozora-scan-as-upstream-lexer.md`(aozora-scan を直接利用する決定、bench 結果込み)
- ... 各 phase の判断ごとに ADR を打つ

## 0.7 残作業

すべて完了:

- [x] Plan ファイル更新(bench-first / reuse-first / systemise 規律)
- [x] Phase -1 bench 基盤整備 → `bench/{wasm-boundary, lezer-tree}.bench.ts`, `scripts/bench-compare.mjs`, `bench/baseline.json`
- [x] Phase 2 を `Document::nodes_json` + `aozora-scan` 直接利用に差替え → ADR 0004
- [x] 永続化されたカタログ: `01-data-structure-catalog.md`
- [x] ADR 連番:
  - [0003 — bench-first discipline](../adr/0003-architecture-refresh-bench-first.md)
  - [0004 — aozora-scan as upstream lexer](../adr/0004-aozora-scan-as-upstream-lexer.md)
  - [0005 — reject effect-ts; augment hand-rolled Result](../adr/0005-effect-layer-handrolled-result.md)
  - [0006 — defer gaiji layer to upstream](../adr/0006-gaiji-layer-defer-to-upstream.md)
  - [0007 — defer encoding detector to corpus data](../adr/0007-encoding-detector-defer-to-data.md)
  - [0008 — defer WASM section split](../adr/0008-bundle-defer-section-split.md)
  - [0009 — test discipline review](../adr/0009-test-discipline-review.md)
- [x] レイヤー設計図: [02-layer-design.md](./02-layer-design.md)
- [x] 拒否 / 延期登録: [03-tradeoffs.md](./03-tradeoffs.md)
- [x] Bench 運用ガイド: [04-bench-operations.md](./04-bench-operations.md)

ラウンド外(release-prep ラウンドへ):

- [ ] Plugin lifecycle 統合(Phase 5 LanguageSupport + Phase 6 reactive store の `main.ts` への結線)
- [ ] iOS / Android 実機 QA
- [ ] Marketplace 申請(`aozora-pin.txt`、CHANGELOG split、GitHub Release zip)
- [ ] 日本語 README / デモ vault / getting-started 動線
