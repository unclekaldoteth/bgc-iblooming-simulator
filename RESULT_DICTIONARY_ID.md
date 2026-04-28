# Kamus Result

Dokumen ini menjelaskan halaman result: Summary, Distribution, Token Flow, Treasury, dan Decision Pack.

## Apa Itu Result

Result adalah output dari satu run yang sudah selesai.

Result menjawab:

- Scenario mana yang dipakai?
- Snapshot mana yang dipakai?
- Berapa ALPHA yang issued, used, held, atau masuk cash-out path?
- Berapa cash yang masuk, disimpan perusahaan, atau keluar?
- Apakah hasilnya siap, berisiko, atau tidak layak dipakai?

## Result Pages

| Page | Yang ditampilkan | Kapan dipakai |
| --- | --- | --- |
| Summary | Ringkasan money, ALPHA, safety, goals, dan phase. | Halaman pertama setelah run selesai. |
| Distribution | Konsentrasi ALPHA dan cash impact. | Mengecek konsentrasi member group/source. |
| Token Flow | ALPHA policy, ledger, forecast split, asumsi Web3, dan whitepaper evidence. | Mengecek token-flow logic dan kesiapan Web3. |
| Treasury | Cashflow perusahaan dan safety signals. | Mengecek apakah policy aman secara finansial. |
| Decision Pack | Rekomendasi, blocker, data quality, asumsi, dan export. | Bahan review founder dan decision meeting. |

## Urutan Baca Yang Disarankan

1. Baca **Money Summary** dulu.
2. Baca **ALPHA Flow** kedua.
3. Baca **Treasury Safety Signals** ketiga.
4. Baca **Data Completeness** sebelum membuat claim final.
5. Baca **Decision Pack** sebelum memilih pilot baseline.

## Run Status

| UI label | Nilai internal | Artinya |
| --- | --- | --- |
| Queued | `QUEUED` | Run sedang menunggu worker. |
| Running | `RUNNING` | Worker sedang menghitung result. |
| Completed | `COMPLETED` | Result sudah tersedia. |
| Failed | `FAILED` | Run berhenti karena error. |

## Recommendation Status

| UI label | Nilai internal | Artinya |
| --- | --- | --- |
| Ready | `candidate` | Result bisa dipakai sebagai kandidat setup. |
| Needs Review | `risky` | Result mungkin berguna, tetapi risiko atau asumsi perlu direview. |
| Do Not Use | `rejected` | Result tidak boleh dipakai sebagai policy baseline. |

## Money Metrics

Metric ini memakai USD dan harus dipisahkan dari pergerakan ALPHA.

| UI label | Metric key | Artinya |
| --- | --- | --- |
| Cash In | `company_gross_cash_in_total` | Total uang bisnis yang masuk sebelum payout, pass-through split, atau outflow lain. |
| Revenue Kept | `company_retained_revenue_total` | Revenue yang tetap dipegang perusahaan setelah bagian partner/creator dipisahkan. |
| Partner Payout | `company_partner_payout_out_total` | Cash yang diteruskan ke partner atau creator, misalnya creator share CP. |
| Direct Rewards Owed | `company_direct_reward_obligation_total` | Kewajiban direct reward dari uploaded business data. |
| Pool Funding Owed | `company_pool_funding_obligation_total` | Kewajiban pendanaan pool dari uploaded business data. |
| Cash Paid Out | `company_actual_payout_out_total` | Cash-equivalent payout yang dilepas oleh cash-out policy. |
| Fulfillment Cost | `company_product_fulfillment_out_total` | Nilai pemenuhan produk ketika PC ditebus di sisi BGC. |
| Net Cash Change | `company_net_treasury_delta_total` | Revenue kept dikurangi partner payout, cash paid out, dan fulfillment cost. |

Formula sederhana:

`Net Cash Change = Revenue Kept - Partner Payout - Cash Paid Out - Fulfillment Cost`

## ALPHA Metrics

Metric ini menjelaskan pergerakan ALPHA. Ini tidak sama dengan cash.

| UI label | Metric key | Artinya |
| --- | --- | --- |
| Total ALPHA Issued | `alpha_issued_total` | Total ALPHA yang dibuat scenario setelah conversion, caps, dan rules. |
| Total ALPHA Used | `alpha_spent_total` | ALPHA yang dipakai di dalam ecosystem. |
| Actual ALPHA Used | `alpha_actual_spent_total` | ALPHA use yang didukung uploaded internal-use data. |
| Modeled ALPHA Used | `alpha_modeled_spent_total` | Tambahan internal use dari asumsi scenario. |
| Total ALPHA Held | `alpha_held_total` | ALPHA yang masih dipegang setelah use dan cash-out path. |
| ALPHA Cash-Out | `alpha_cashout_equivalent_total` | ALPHA yang masuk ke cash-out path karena payout settings. |
| Opening ALPHA Balance | `alpha_opening_balance_total` | Saldo ALPHA di awal window ledger simulasi. |
| Ending ALPHA Balance | `alpha_ending_balance_total` | Saldo ALPHA setelah issued, used, cash-out, dan burn/expiry. |
| Expired / Burned ALPHA | `alpha_expired_burned_total` | ALPHA yang dihapus lewat expiry atau burn policy. Phase 1 default-nya nol sampai burn rule didefinisikan. |

Ledger check:

`Opening Balance + Issued - Used - Cash-Out - Expired/Burned = Ending Balance`

## Safety Metrics

| UI label | Metric key | Artinya | Arah bagus |
| --- | --- | --- | --- |
| Internal Use Rate | `sink_utilization_rate` | Share issued ALPHA yang dipakai di dalam ecosystem. | Lebih tinggi biasanya lebih baik. |
| Actual Internal Use Rate | `actual_sink_utilization_rate` | Internal use rate yang didukung uploaded `sink_spend_usd`. | Lebih tinggi bagus jika datanya kuat. |
| Modeled Internal Use Rate | `modeled_sink_utilization_rate` | Internal use rate dari asumsi forecast/adoption. | Berguna, tapi harus diberi label asumsi. |
| Treasury Pressure | `payout_inflow_ratio` | Kewajiban payout/reward dibanding revenue support. Di atas `1.0x` berarti kewajiban lebih besar dari support. | Lebih rendah lebih aman. |
| Reserve Runway | `reserve_runway_months` | Estimasi berapa bulan reserve bisa menopang payout obligations. | Lebih tinggi lebih aman. |
| Top 10% Reward Share | `reward_concentration_top10_pct` | Share reward yang diterima top 10% member. | Lebih rendah lebih fair. |
| Observed Months | `forecast_actual_period_count` | Jumlah bulan yang dibaca dari uploaded data. | Lebih tinggi berarti lebih banyak actual data. |
| Forecast Months | `forecast_projected_period_count` | Jumlah bulan yang dibuat dari asumsi. | Lebih tinggi berarti caveat forecast lebih besar. |

## Distribution Page Terms

| UI label | Artinya |
| --- | --- |
| Distribution Snapshot | Ringkasan cepat konsentrasi ALPHA dan total utama. |
| ALPHA Flow | ALPHA yang held, used, atau masuk cash-out. |
| ALPHA Issued by Member Group | Member group mana yang menerima share ALPHA terbesar. |
| ALPHA by Source | Source system mana yang menghasilkan ALPHA issuance terbesar. |
| Money by Source | Dampak cash per source system, dipisahkan dari ALPHA. |
| Largest Member Group | Member group dengan issued-share terbesar. |
| Largest ALPHA Source | Source system dengan share ALPHA issuance terbesar. |

## Token Flow Page Terms

| UI label | Artinya |
| --- | --- |
| Result Mode | Apakah run memakai imported data only atau memakai asumsi forecast. |
| ALPHA Policy | Cara ALPHA dijelaskan: credit, points, off-chain token, atau future on-chain token. |
| ALPHA Ledger | Tabel saldo ALPHA per periode. |
| Forecast Settings | Pemisahan uploaded data dan asumsi forecast. |
| Web3 Assumptions | Asumsi supply, liquidity, governance, legal, dan smart-contract. |
| Token Price Basis | Cara harga ALPHA dijelaskan atau diestimasi. |
| Whitepaper Evidence | Apakah result punya evidence cukup untuk mendukung bahasa whitepaper. |

## Treasury Page Terms

| UI label | Artinya |
| --- | --- |
| Treasury Summary | Ringkasan money: cash in, revenue kept, net cash, dan cash paid out. |
| Cash Owed and Paid | Kewajiban dan payout yang mengurangi treasury safety. |
| Treasury Health Signals | Pressure, runway, internal use, dan concentration signals. |
| Full Money Details | Breakdown cashflow lengkap untuk treasury dan decision logic. |
| Warnings | Risk flags dari engine. |

## Decision Pack Terms

| UI label | Artinya |
| --- | --- |
| Decision Summary | Rekomendasi utama dan konteks result. |
| ALPHA Evidence | Apakah claim ALPHA/token-flow sudah didukung data atau masih asumsi. |
| Money Basis | Bukti money di balik rekomendasi. |
| Data Completeness | Seberapa lengkap uploaded data. |
| Recommended Setup | Setup yang disarankan dari result ini. |
| Source Detail Check | Detail sumber mana yang tersedia atau hilang. |
| Decision Notes | Item yang perlu review, owner, dan status keputusan. |
| Data vs Assumptions | Memisahkan imported data, editable settings, asumsi, locked value, dan calculated output. |
| Goal Details | Scorecard strategic goal dan evidence level. |
| Phase Checkpoints | Status dan metric untuk tiap milestone/phase. |
| Settings Used | Scenario settings yang mendukung rekomendasi. |
| Blockers | Setting atau risiko yang menghalangi adoption. |
| Open Questions | Pertanyaan yang perlu keputusan sebelum dipakai final. |
| Export Report | Download file result. |

## Evidence Labels

| UI label | Artinya |
| --- | --- |
| Direct Data | Result didukung imported source data. |
| Proxy Estimate | Result memakai proxy atau estimasi tidak langsung. |
| Checklist Only | Evidence masih level checklist. |
| Imported Data | Data tetap dari approved snapshot. |
| Editable | Scenario setting yang bisa dituning. |
| Assumption | Asumsi forward-looking atau policy. |
| Locked | Nilai terlindungi yang tidak boleh diedit. |
| Calculated | Output yang dihitung engine. |

## Aturan Baca Penting

- Jangan campur dollar dan ALPHA. Money metrics adalah USD. ALPHA metrics adalah unit token/point/credit.
- `Actual ALPHA Used` berasal dari uploaded internal-use data.
- `Modeled ALPHA Used` berasal dari asumsi scenario.
- `Cash Paid Out` adalah payout cash-equivalent aktual, bukan total ALPHA issued.
- Result dengan forecast assumptions harus disebut estimate.
- Result dengan data quality lemah boleh dipakai untuk diskusi, tetapi belum layak jadi final evidence.
