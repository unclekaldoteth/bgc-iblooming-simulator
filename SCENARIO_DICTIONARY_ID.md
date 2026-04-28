# Kamus Scenario

Dokumen ini menjelaskan step `Scenarios` dengan bahasa Indonesia yang sederhana.

Aturan bahasa:

- Tampilkan label UI bahasa Inggris terlebih dahulu.
- Tampilkan nilai internal dalam `backtick`.
- Pisahkan data import, pilihan policy yang bisa diedit, dan asumsi forecast.

## Apa Itu Scenario

Scenario adalah setup policy yang bisa dipakai ulang.

Scenario tidak mengubah data snapshot yang di-upload. Scenario memberi tahu engine aturan ALPHA apa yang ingin diuji di atas snapshot yang sudah approved.

Cara baca sederhana:

1. Snapshot = input data.
2. Scenario = aturan dan asumsi yang ingin dites.
3. Run = hasil perhitungan.
4. Compare = perbandingan beberapa run yang sudah selesai.

## Alur Membuat Scenario

| Step | Area UI | Yang dipilih user | Kenapa penting |
| --- | --- | --- | --- |
| 1 | Template | `Baseline`, `Conservative`, `Growth`, atau `Stress` | Memulai dari bentuk policy yang sudah dikenal. |
| 2 | Name | Nama scenario | Supaya setup mudah dicari lagi. |
| 3 | Baseline model | Contoh: `model-v1` | Memilih ruleset utama engine. |
| 4 | Default snapshot | Snapshot data yang approved | Data default saat scenario dijalankan. |
| 5 | Result mode | `Imported Data Only` atau `Add Forecast` | Menentukan apakah forecast boleh ditambahkan. |
| 6 | Policy parameters | Conversion, caps, sink, cash-out, asumsi Web3 | Mengatur perilaku run. |
| 7 | Save | Create/update scenario | Menyimpan setup. |
| 8 | Run | Jalankan simulasi | Menerapkan scenario ke snapshot approved. |

## Scenario Templates

| UI label | Nilai internal | Artinya | Kapan dipakai |
| --- | --- | --- | --- |
| Baseline | `Baseline` | Setup default yang seimbang. | Menguji policy standar. |
| Conservative | `Conservative` | Reward lebih rendah, cap lebih ketat, cash-out lebih dikontrol. | Mengurangi risiko treasury dan cash-out. |
| Growth | `Growth` | Reward support lebih tinggi dan growth posture lebih longgar. | Menguji potensi adoption naik. |
| Stress | `Stress` | Setting restriktif atau worst-case. | Menguji keamanan treasury dalam kondisi berat. |

## Scenario Modes

| UI label | Nilai internal | Artinya | Yang dikunci |
| --- | --- | --- | --- |
| Imported Data Only | `founder_safe` | Hanya memakai uploaded data. Tidak menambah growth sintetis. | Growth projection dan cohort forecast tetap off. |
| Add Forecast | `advanced_forecast` | Membolehkan asumsi masa depan. | Core reward math tetap terkunci. |

Catatan: `Add Forecast` tidak membuat forecast menjadi fakta. Mode ini hanya membuat engine memasukkan asumsi dan memberi label output sebagai estimasi.

## Guardrail Status

| UI label | Status internal | Artinya |
| --- | --- | --- |
| Editable | `allowed` | User boleh mengubah setting ini tanpa menulis ulang data bisnis yang di-import. |
| Assumption | `conditional` | User boleh mengubahnya, tetapi hasil harus dibaca sebagai asumsi scenario. |
| Locked | `not_safe` | Sebaiknya tidak diubah karena bisa menulis ulang arti reward utama atau membuat compare bias. |

## Core Scenario Fields

| Field | UI label | Status | Artinya |
| --- | --- | --- | --- |
| `scenario_mode` | Result Mode | Assumption | Mengontrol run imported-only vs forecast-enabled. |
| `k_pc` | PC to ALPHA multiplier | Editable | Mengubah imported PC activity menjadi ALPHA issuance. Makin tinggi, makin banyak ALPHA dari PC. |
| `k_sp` | SP to ALPHA multiplier | Editable | Mengubah imported SP/LTS basis menjadi ALPHA issuance. Makin tinggi, makin banyak ALPHA dari SP. |
| `reward_global_factor` | Global reward factor | Locked | Multiplier global dari baseline model. Dikunci agar named reward rule tidak berubah artinya. |
| `reward_pool_factor` | Pool reward factor | Locked | Multiplier pool dari baseline model. Dikunci agar named pool rule tidak berubah artinya. |
| `cap_user_monthly` | User monthly cap | Editable | Batas maksimum ALPHA yang bisa diterima satu member per bulan. |
| `cap_group_monthly` | Group monthly cap | Editable | Batas maksimum ALPHA yang bisa diterima satu group per bulan. |
| `sink_target` | Internal use target | Assumption | Target share ALPHA yang diharapkan dipakai di dalam ecosystem. |
| `projection_horizon_months` | Planning horizon | Assumption | Jumlah bulan yang diproyeksikan setelah data import. |
| `milestone_schedule` | Phases | Assumption | Fase policy berbasis waktu dengan override parameter terbatas. |

## Cash-Out Policy

Cash-out policy mengatur berapa banyak ALPHA yang bisa masuk ke jalur payout cash.

| Field | UI label | Values | Artinya |
| --- | --- | --- | --- |
| `cashout_mode` | Cash-out mode | `ALWAYS_OPEN`, `WINDOWS` | `ALWAYS_OPEN` berarti cash-out selalu boleh. `WINDOWS` berarti cash-out hanya boleh di jadwal tertentu. |
| `cashout_min_usd` | Minimum cash-out | Angka USD | Minimum ukuran payout. Saldo di bawah angka ini tidak cash out. |
| `cashout_fee_bps` | Cash-out fee | Basis points | Fee cash-out. `100 bps = 1%`. |
| `cashout_windows_per_year` | Windows per year | Integer positif | Jumlah periode cash-out per tahun jika mode `WINDOWS`. |
| `cashout_window_days` | Window length | Integer positif | Jumlah hari setiap window cash-out dibuka. |

## Growth Projection

Field ini dipakai hanya ketika forecast diizinkan.

| Field | Artinya |
| --- | --- |
| `new_members_per_month` | Estimasi member baru per bulan. |
| `monthly_churn_rate_pct` | Estimasi persentase member yang tidak aktif tiap bulan. |
| `monthly_reactivation_rate_pct` | Estimasi persentase inactive member yang aktif lagi. |
| `affiliate_new_member_share_pct` | Estimasi bagian member baru yang dianggap affiliate. |
| `cross_app_adoption_rate_pct` | Estimasi bagian member yang aktif lintas BGC dan iBLOOMING. |
| `new_member_value_factor` | Faktor value member baru dibanding member saat ini. |
| `reactivated_member_value_factor` | Faktor value member aktif kembali dibanding member saat ini. |

Dalam mode `Imported Data Only`, field ini di-reset ke default pasif karena growth projection bukan histori import.

## Internal Use Adoption

Bagian ini memodelkan internal use masa depan. Ini harus dipisahkan dari actual uploaded `sink_spend_usd`.

| Field | Artinya |
| --- | --- |
| `sink_adoption_rate_pct` | Estimasi bagian eligible member yang memakai ALPHA secara internal. |
| `eligible_member_share_pct` | Estimasi bagian member yang eligible untuk internal-use activity. |
| `avg_sink_ticket_usd` | Rata-rata nilai transaksi internal use dalam USD. |
| `sink_frequency_per_month` | Estimasi transaksi internal use per member per bulan. |
| `alpha_payment_share_pct` | Share pembayaran internal use yang memakai ALPHA. |
| `sink_growth_rate_pct` | Growth internal use model per bulan. |

## Forecast Policy

| Field | Values | Artinya |
| --- | --- | --- |
| `mode` | `snapshot_window`, `projection_overlay`, `cohort_projection` | Cara result memisahkan periode import dan periode forecast. |
| `actuals_through_period` | `YYYY-MM` atau kosong | Periode terakhir yang dianggap actual uploaded data. |
| `forecast_start_period` | `YYYY-MM` atau kosong | Periode pertama yang dianggap forecast. |
| `forecast_basis` | `none`, `repeat_snapshot`, `milestone_overlay`, `cohort_assumption` | Metode untuk membuat periode forecast. |
| `stress_case` | `none`, `base`, `downside`, `upside` | Sudut stress yang dipakai scenario. |

## ALPHA Policy

| Field | Values | Artinya |
| --- | --- | --- |
| `classification` | `internal_credit`, `points`, `off_chain_token`, `future_on_chain_token` | Cara ALPHA dijelaskan. Ini mempengaruhi token flow dan bahasa whitepaper. |
| `phase` | `phase_1_internal`, `phase_2_bridge`, `phase_3_on_chain` | Fase produk saat ini. |
| `transferability` | `non_transferable`, `platform_limited`, `externally_transferable` | Apakah ALPHA bisa berpindah ke luar platform. |
| `settlement_unit` | `alpha_internal`, `usd_equivalent`, `on_chain_token` | Unit yang dipakai dalam bahasa settlement. |
| `on_chain_status` | `not_on_chain`, `planned`, `testnet`, `mainnet` | Status on-chain saat ini. |
| `evidence_standard` | `simulation_backed`, `founder_decision_required`, `legal_review_required` | Level review sebelum claim dianggap final. |

## Web3 Tokenomics

Ini adalah asumsi untuk analisis public-token atau future-token. Ini bukan fakta historis snapshot.

| Area | Fields | Artinya |
| --- | --- | --- |
| Network | `network_status` | Apakah ALPHA internal only, planned, testnet, atau mainnet. |
| Supply | `supply_model`, `max_supply` | Apakah supply internal, uncapped, fixed, atau capped emission. |
| Allocation | `community_pct`, `treasury_pct`, `team_pct`, `investor_pct`, `liquidity_pct` | Persentase alokasi token. Untuk public token, totalnya harus 100%. |
| Vesting | `team_cliff_months`, `team_vesting_months`, `investor_cliff_months`, `investor_vesting_months` | Jadwal unlock alokasi team dan investor. |
| Liquidity | `enabled`, `reserve_pct`, `launch_pool_usd` | Setup liquidity dan asumsi reserve. |
| Market | `price_basis`, `alpha_usd_price`, `circulating_supply`, `treasury_reserve_usd`, `liquidity_pool_alpha`, `liquidity_pool_usd`, `monthly_buy_demand_usd`, `monthly_sell_pressure_alpha`, `monthly_burn_alpha`, `vesting_unlock_alpha` | Asumsi harga, demand, sell pressure, burn, dan reserve. |
| Governance | `mode`, `voting_token_enabled` | Siapa yang mengontrol keputusan: team admin, multisig, token voting, atau DAO. |
| Smart contract | `chain`, `standard`, `audit_status` | Chain, token standard, dan status audit contract. |
| Legal | `classification`, `kyc_required`, `jurisdiction_notes` | Status legal review dan catatan compliance. |

## Token Price Basis

| UI label | Nilai internal | Artinya |
| --- | --- | --- |
| Internal only / no market price | `not_applicable_internal` | Tidak memakai harga market publik. |
| Fixed internal rate | `fixed_accounting` | Tim menetapkan nilai accounting internal, contoh `1 ALPHA = $1`. |
| Oracle price feed | `oracle_feed` | Harga datang dari external price feed. Butuh source harga yang jelas. |
| Liquidity pool price | `liquidity_pool` | Harga dihitung dari reserve pool ALPHA dan USD. |
| Market forecast | `market_forecast` | Harga adalah estimasi market masa depan. Ini bukan observed data. |

## Run Readiness Rules

Scenario bisa dijalankan hanya kalau:

- scenario ada,
- snapshot yang dipilih ada,
- snapshot sudah approved,
- imported rows tersedia,
- P0 data fingerprint lengkap,
- locked scenario fields sama dengan default baseline model.

Kalau tombol Run disabled, cek dulu approval snapshot, data fingerprint, imported row count, dan locked-parameter validation.
