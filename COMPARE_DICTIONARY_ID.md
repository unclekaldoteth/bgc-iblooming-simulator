# Kamus Compare

Dokumen ini menjelaskan halaman `Compare` dengan bahasa Indonesia yang sederhana.

## Apa Itu Compare

Compare menaruh beberapa completed run result secara side-by-side.

Compare tidak membuat simulasi baru. Compare membaca result yang sudah selesai dan membantu tim memilih setup yang paling kuat.

## Compare Harus Menjawab Apa

- Result mana yang lebih aman secara finansial?
- Result mana yang internal use-nya lebih baik?
- Result mana yang cash-out risk-nya lebih rendah?
- Result mana yang distribusinya lebih fair?
- Result mana yang data support-nya lebih kuat?
- Result mana yang layak jadi pilot baseline?

## Alur Compare

| Step | Area UI | Artinya |
| --- | --- | --- |
| 1 | Choose results to compare | Pilih 2 sampai 5 completed results. |
| 2 | Quick Score Chart | Visual scan saja. Jangan jadi sumber keputusan utama. |
| 3 | Summary | Ringkasan pilihan terkuat, treasury safety, dan data quality. |
| 4 | Result Cards | Satu card per result dengan money impact dan treasury pressure. |
| 5 | Money View / Money Comparison | Perbandingan cashflow. Baca ini sebelum tabel ALPHA. |
| 6 | Data Completeness / Source Detail Check | Mengecek apakah data support cukup kuat. |
| 7 | Recommended Setup | Setup terbaik dari selected results. |
| 8 | Parameter Guide / Parameter Ranges | Menunjukkan value yang diuji dan range yang lebih aman. |
| 9 | Open Decisions / Decision Notes | Melacak keputusan yang masih butuh approval owner. |
| 10 | ALPHA Flow / Treasury / Distribution / Goal / Phase Comparison | Tabel perbandingan lebih detail. |

## Selection Rules

| UI label | Artinya |
| --- | --- |
| Choose results to compare | Pilih completed runs untuk direview side-by-side. |
| 2-5 completed results | Jumlah yang disarankan agar chart dan table tetap mudah dibaca. |
| Page link updates | Run ID yang dipilih disimpan di URL, jadi compare yang sama bisa dibuka ulang. |
| Download Report PDF | Export compare report sebagai PDF. |
| Download Notes | Export compare report sebagai Markdown notes. |
| Download Data | Export compare report sebagai JSON data. |
| Change Results | Buka/tutup result selector. |
| Reset | Kembali ke pilihan result default. |

## Quick Score Chart

Radar chart hanya visual cepat.

| Radar dimension | Metric yang dipakai | Artinya | Arah bagus |
| --- | --- | --- | --- |
| Treasury Safety | `reserve_runway_months` | Runway lebih panjang berarti support treasury lebih aman. | Lebih tinggi lebih baik. |
| Fairness | `reward_concentration_top10_pct` | Konsentrasi top 10% lebih rendah berarti reward tidak terlalu terkumpul di sedikit member. | Lebih rendah lebih baik. |
| Internal Use | `sink_utilization_rate` | Share ALPHA yang dipakai di dalam ecosystem. | Lebih tinggi lebih baik. |
| Growth Support | `alpha_issued_total` | Total ALPHA issued untuk mendukung participation. | Lebih tinggi bisa mendukung growth, tetapi harus dicek ke treasury. |
| Cash-Out Risk | `payout_inflow_ratio` | Obligations dibanding revenue support. | Lebih rendah lebih baik. |

Catatan penting: radar menormalisasi metric yang berbeda supaya bisa dilihat bersama. Keputusan tetap harus dikonfirmasi di money dan treasury tables.

## Compare Sections

| UI section | Artinya |
| --- | --- |
| Summary | Ringkasan selected results dan posisi keputusan. |
| Status Memo | Memo singkat: ready, decision required, atau blocked. |
| Result Cards | Card ringkas untuk setiap selected result. |
| Money View by Result | Narasi money per result, termasuk tradeoff. |
| Money Comparison | Cashflow metrics side-by-side. |
| Data Completeness | Apakah uploaded data cukup kuat untuk tiap result. |
| Source Detail Check | Source-detail area mana yang tersedia atau hilang. |
| Recommended Setup | Setup terkuat dari selected results. |
| Parameter Guide | Arti setting, tested values, current default, suggested choice, dan owner. |
| Parameter Ranges | Range recommended, use-with-care, dan do-not-use. |
| Open Decisions | Pertanyaan yang butuh keputusan founder atau tim. |
| Next Build Steps | Work praktis yang perlu diselesaikan sebelum evidence pack final. |
| Decision Notes | Status keputusan dan owner per result. |
| Data vs Assumptions | Memisahkan imported data, editable levers, assumptions, locked values, dan calculated outputs. |
| ALPHA Flow Comparison | ALPHA issued, used, actual used, modeled used, held, cash-out, ending, dan burned. |
| Treasury Safety Comparison | Pressure, runway, internal use, dan reward concentration. |
| Distribution View | Largest member group, largest ALPHA source, dan source-level net cash. |
| Goal Comparison | Status strategic goal, score, evidence, dan alasan. |
| Phase Comparison | Status milestone, pressure, runway, payout, dan net cash. |
| Result Details | Run ref, scenario, snapshot, status, dan tanggal selesai. |

## Money Comparison Metrics

| Metric | Arah bagus | Artinya |
| --- | --- | --- |
| Cash In | Lebih tinggi | Total cash bisnis yang masuk lebih besar. |
| Revenue Kept | Lebih tinggi | Revenue yang dipegang perusahaan lebih besar. |
| Partner Payout | Lebih rendah untuk treasury, tetapi harus sesuai business model | Cash yang diteruskan ke partner/creator. |
| Direct Rewards Owed | Lebih rendah untuk treasury | Kewajiban direct reward. |
| Pool Funding Owed | Lebih rendah untuk treasury | Kewajiban pendanaan pool. |
| Cash Paid Out | Lebih rendah | Cash-equivalent yang benar-benar dibayar. |
| Fulfillment Cost | Lebih rendah untuk treasury | Nilai pemenuhan produk. |
| Net Cash Change | Lebih tinggi | Hasil net treasury lebih baik. |

## ALPHA Comparison Metrics

| Metric | Arah bagus | Artinya |
| --- | --- | --- |
| Total ALPHA Issued | Tergantung konteks | Issuance lebih besar bisa mendukung growth tetapi juga bisa menambah liability. |
| Total ALPHA Used | Lebih tinggi | Lebih banyak ALPHA dipakai internal. |
| Actual ALPHA Used | Lebih tinggi | Lebih kuat karena berasal dari uploaded data. |
| Modeled ALPHA Used | Berguna tapi ada caveat | Berasal dari asumsi, bukan histori upload. |
| Total ALPHA Held | Tergantung konteks | Held balance bisa berarti future liability atau user retention. |
| ALPHA Cash-Out | Lebih rendah | Lebih sedikit ALPHA masuk jalur cash-out. |
| Ending ALPHA Balance | Tergantung konteks | Sisa ALPHA setelah semua flow. |
| Expired / Burned ALPHA | Tergantung konteks | ALPHA yang dihapus jika ada burn/expiry policy. |

## Treasury Safety Metrics

| Metric | Arah bagus | Artinya |
| --- | --- | --- |
| Treasury Pressure | Lebih rendah | Di atas `1.0x` berarti obligations lebih besar dari recognized revenue support. |
| Reserve Runway | Lebih tinggi | Lebih banyak bulan reserve bisa menopang obligations. |
| Internal Use Rate | Lebih tinggi | Lebih banyak issued ALPHA dipakai di ecosystem. |
| Actual Internal Use Rate | Lebih tinggi | Lebih kuat karena berasal dari uploaded data. |
| Modeled Internal Use Rate | Lebih tinggi dengan caveat | Berasal dari asumsi forecast/adoption. |
| Top 10% Reward Share | Lebih rendah | Konsentrasi lebih rendah berarti distribusi lebih fair. |

## Status Labels

| UI label | Artinya |
| --- | --- |
| Recommended | Opsi terbaik saat ini dari selected results. |
| Needs Review | Berguna tetapi perlu review karena risiko, data gap, atau asumsi. |
| Blocked | Jangan dipakai sampai blocker diperbaiki. |
| Ready to Use | Compare cukup kuat untuk action. |
| Decision Required | Tim harus menjawab open questions sebelum action. |
| Current Baseline | Result ini sudah dipilih sebagai pilot baseline untuk scenario-nya. |
| Current strongest result | Result terbaik dalam selection compare saat ini. |

## Data And Evidence Labels

| UI label | Artinya |
| --- | --- |
| Strong | Data support cukup kuat untuk diskusi high-confidence. |
| Some Gaps | Data bisa dipakai, tetapi warnings harus tetap terlihat. |
| Weak | Data hanya mendukung diskusi, bukan final claims. |
| Available | Source detail tersedia untuk area tersebut. |
| Missing | Source detail belum tersedia. |
| Not available | Selected result tidak punya row tercatat untuk item itu. |
| Direct Data | Evidence datang langsung dari imported data. |
| Proxy Estimate | Evidence diestimasi dari data tidak langsung. |
| Checklist Only | Evidence masih level checklist. |

## Parameter Labels

| UI label | Artinya |
| --- | --- |
| Editable | Bisa diubah sebagai policy lever. |
| Assumption | Bisa diubah, tetapi result harus dianggap asumsi. |
| Locked | Dilindungi karena mengubahnya membuat result kurang reliable. |
| Recommended Values | Range yang terlihat terbaik dari selected runs. |
| Use With Care | Range yang bisa dipakai tetapi punya caveat. |
| Do Not Use | Range yang menghasilkan risiko atau output buruk. |
| Tested Values | Nilai yang ada di selected runs. |
| Current Default | Default kerja saat ini. |
| Suggested Choice | Nilai atau arah yang disarankan. |
| Decision Owner | Orang atau tim yang perlu approve setting. |

## Aturan Baca Penting

- Compare tidak membuktikan scenario benar. Compare hanya membandingkan completed results.
- Baca money sebelum ALPHA. Cashflow safety menentukan apakah policy ALPHA praktis.
- Radar hanya quick scan.
- Cash-out risk lebih rendah bagus hanya jika growth dan internal use masih acceptable.
- Result yang berat forecast harus diberi label forecast.
- Result dengan data quality lemah tidak seharusnya menang melawan result yang sedikit lebih lemah tapi data support-nya lebih kuat, kecuali ada approval eksplisit.
