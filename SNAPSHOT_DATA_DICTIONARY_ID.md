# Kamus Data Snapshot

Dokumen ini menjelaskan format data snapshot yang bisa dibaca simulator saat ini.

Aturan bahasa:

- Tampilkan label UI dalam bahasa Inggris terlebih dahulu, karena itu yang muncul di aplikasi.
- Tampilkan nilai internal dalam `backtick` untuk tim teknis.
- Jelaskan arti bisnisnya dalam bahasa Indonesia yang sederhana.

## Cara Engine Membaca Snapshot

Snapshot adalah satu versi data bisnis yang dipakai sebagai bahan baku simulasi.

Alurnya:

1. Buat record snapshot di halaman `Snapshots`.
2. Upload atau hubungkan file data.
3. Pilih `File type`.
4. Import file.
5. Jalankan `Data Check`.
6. Approve snapshot.
7. Pakai snapshot yang sudah approved untuk menjalankan scenario.

Catatan: snapshot bukan hasil simulasi. Snapshot adalah input data yang dipakai engine untuk menghitung hasil simulasi.

## Snapshot File Types

Ini adalah pilihan di dropdown `File type`.

| UI label | Nilai internal | Artinya | Kapan dipakai | Batas penting |
| --- | --- | --- | --- | --- |
| Monthly CSV | `compatibility_csv` | Satu row sudah berupa ringkasan satu member dalam satu bulan. | Paling cepat untuk simulasi dasar kalau tim hanya punya spreadsheet bulanan. | Hanya mengisi monthly simulation rows. Tidak bisa membuat semua checklist Source Detail hijau karena tidak ada detail event. |
| Full Detail CSV | `canonical_csv` | Satu CSV biasa dengan kolom `record_type`. Setiap row memberi tahu engine jenis detail sumbernya. | Pilihan terbaik untuk user non-teknis yang tetap ingin detail lengkap dalam CSV. | Kolom lebih banyak. Banyak row hanya memakai sebagian kolom dan kolom lain boleh kosong. |
| Full Detail JSON | `canonical_json` | Model data full-detail yang sama seperti Full Detail CSV, tetapi dalam JSON bertingkat. | Cocok untuk export dari sistem atau integrasi engineering. | Lebih sulit diedit manual oleh orang non-teknis. |
| Full Detail Bundle | `canonical_bundle` | Paket data full-detail yang bisa berasal dari beberapa source file terkontrol. | Cocok kalau data sumber tidak bisa digabung menjadi satu CSV. | Bundle tetap harus dipetakan ke model full-detail. |
| Hybrid Data | `hybrid_verified` | Campuran: sebagian data punya detail sumber, sebagian lagi hanya monthly aggregate untuk review. | Cocok saat migrasi dari spreadsheet bulanan ke data full-detail. | Bisa dipakai dan di-approve, tapi Source Detail masih bisa menunjukkan gap. |

Aturan cepat:

- Pakai **Monthly CSV** kalau hanya butuh simulasi cepat dari ringkasan bulanan.
- Pakai **Full Detail CSV** kalau ingin tetap pakai CSV tetapi Source Detail bisa lengkap.
- Pakai **Full Detail JSON** atau **Full Detail Bundle** kalau data datang dari sistem atau pipeline engineering.
- Pakai **Hybrid Data** kalau data masih campuran antara detail dan aggregate.

## Snapshot Check Methods

Ini adalah pilihan di dropdown `Check method`.

| UI label | Nilai internal | Artinya | Cocok dengan file type |
| --- | --- | --- | --- |
| Monthly data | `monthly_facts` | Mengecek file sebagai data member per bulan. | Monthly CSV |
| Event data | `canonical_events` | Mengecek file sebagai source-detail records. | Full Detail CSV dan Full Detail JSON |
| Hybrid check | `hybrid_validation` | Mengecek campuran source detail dan monthly aggregate. | Hybrid Data |

## Forecast Masuk Ke Mana?

Forecast bukan file type khusus. Engine menentukan file type dari bentuk datanya.

| Bentuk forecast | File type | Check method |
| --- | --- | --- |
| Forecast sudah diringkas per member per bulan | Monthly CSV / `compatibility_csv` | Monthly data / `monthly_facts` |
| Forecast berbasis detail event dan memakai `record_type` | Full Detail CSV / `canonical_csv` | Event data / `canonical_events` |
| Forecast dalam JSON full-detail | Full Detail JSON / `canonical_json` | Event data / `canonical_events` |
| Forecast bercampur dengan actual data atau aggregate | Hybrid Data / `hybrid_verified` | Hybrid check / `hybrid_validation` |

Catatan: Data Check hanya mengecek struktur dan integritas data. Data Check tidak membuktikan forecast akan benar-benar terjadi. Tandai forecast di `metadata`, misalnya `forecast: true`, `forecast_basis`, `payment_asset`, dan `payment_rail`.

## Snapshot Status Terms

| UI label | Nilai internal | Artinya |
| --- | --- | --- |
| Draft | `DRAFT` | Snapshot sudah dibuat, tetapi belum lolos Data Check. |
| Checking | `VALIDATING` | Sistem sedang memeriksa data import. |
| Ready to Approve | `VALID` | Data Check lolos. User dengan akses approval bisa approve. |
| Approved | `APPROVED` | Snapshot bisa dipakai untuk scenario run. |
| Needs Fixes | `INVALID` | Data Check menemukan masalah blocking. |
| Archived | `ARCHIVED` | Disembunyikan dari list aktif. Data tidak dihapus. |

## Data Quality Terms

| UI label | Artinya |
| --- | --- |
| Data Check OK | Snapshot punya P0 data fingerprint dan lolos integrity check. |
| Data Check Missing | Snapshot dibuat sebelum P0 atau belum di-import ulang, jadi fingerprint belum ada. Re-import sebelum dipakai sebagai bukti kuat. |
| Data Quality: Strong | Data cukup kuat untuk dipakai sebagai bukti simulasi. |
| Data Quality: Some Gaps | Data bisa dipakai, tetapi ada bagian yang belum lengkap. Warning tetap harus terlihat. |
| Data Quality: Weak | Data bisa dipakai untuk diskusi, tetapi belum layak dianggap final evidence. |
| Source Detail: Available | Detail sumber tersedia untuk area tersebut. |
| Source Detail: Some Gaps | Sebagian detail tersedia, tetapi belum cukup lengkap. |
| Source Detail: Missing | Engine tidak punya detail sumber untuk area tersebut. |

## Monthly CSV Columns

Monthly CSV adalah format input termudah. Satu row berarti: satu member, satu source system, satu bulan.

Kolom pertama sampai `active_member` wajib ada. Kolom setelah itu sangat disarankan karena membantu engine membaca revenue, margin, dan histori member.

| Kolom | Wajib | Artinya |
| --- | --- | --- |
| `period_key` | Ya | Bulan data. Format `YYYY-MM`, contoh `2025-01`. |
| `member_key` | Ya | ID member stabil di file bulanan. |
| `source_system` | Ya | Nama sistem sumber, contoh `bgc` atau `iblooming`. |
| `member_tier` | Ya, boleh kosong | Level atau tier member pada bulan itu, contoh `PATHFINDER`. |
| `group_key` | Ya, boleh kosong | Label grup/cohort, contoh `FOUNDERS` atau `CP_CREATORS`. |
| `pc_volume` | Ya | Jumlah PC untuk member-bulan itu. PC adalah nilai aktivitas produk/bisnis. |
| `sp_reward_basis` | Ya | Jumlah SP yang menjadi basis reward. SP adalah nilai hak reward atau incentive. |
| `global_reward_usd` | Ya | Nilai direct/global reward dalam USD-equivalent. |
| `pool_reward_usd` | Ya | Nilai reward dari pool dalam USD-equivalent. |
| `cashout_usd` | Ya | Jumlah cash-out yang dibayar atau diharapkan untuk member-bulan itu. Isi `0` kalau tidak ada cash-out. |
| `sink_spend_usd` | Ya | Nilai internal use dalam USD. Ini ALPHA/PC yang dipakai di ecosystem, bukan cash paid out. |
| `active_member` | Ya | Apakah member aktif di bulan itu. Nilai yang diterima: `true`, `false`, `1`, `0`, `yes`, `no`, `y`, `n`. |
| `recognized_revenue_usd` | Disarankan | Revenue yang diakui perusahaan dari row tersebut. Dipakai untuk cashflow dan treasury support. |
| `gross_margin_usd` | Opsional | Gross margin jika diketahui. Kosongkan kalau belum tahu. |
| `member_join_period` | Disarankan | Bulan pertama member join. Format `YYYY-MM`. |
| `is_affiliate` | Disarankan | Apakah member dianggap affiliate. Nilainya sama seperti `active_member`. |
| `cross_app_active` | Disarankan | Apakah member aktif lintas BGC dan iBLOOMING. Nilainya sama seperti `active_member`. |
| `extra_json` | Opsional | Catatan struktur JSON untuk breakdown, source note, dan accountability check. |

Catatan penting: `cashout_usd` wajib sebagai kolom di Monthly CSV. Kalau tidak ada cash-out, isi `0`, bukan dikosongkan.

## Full Detail CSV Basic Idea

Full Detail CSV tetap CSV biasa.

Bedanya ada di kolom pertama:

`record_type`

Nilai ini memberi tahu engine cara membaca row.

Contoh:

- `member` membuat satu member internal.
- `business_event` mencatat satu kejadian bisnis seperti join, sale, pool funding, atau cash-out event.
- `cashout_event` mencatat cash yang benar-benar dibayar atau disetujui.

Catatan: satu file Full Detail CSV memang punya banyak jenis row. Itu normal. Kolom yang tidak relevan untuk jenis row tertentu boleh kosong.

## Kenapa `member` Dan `member_alias` Dipisah?

`member` adalah orang/account internal yang dipakai simulator.

`member_alias` adalah ID orang tersebut di sistem sumber.

Dipisah karena satu orang bisa punya banyak ID di banyak sistem.

Contoh:

- Internal simulator member: `AFF-ALPHA`
- BGC source ID: `BGC-AFF-ALPHA`
- iBLOOMING creator ID: `IB-CP-ALPHA`
- Wallet address: bisa disimpan sebagai alias atau metadata ketika dibutuhkan

Kalau member hanya punya satu ID sumber, cukup isi `source_system`, `alias_key`, `alias_type`, dan `confidence` langsung di row `member`.

Pakai row `member_alias` tambahan hanya kalau satu member punya lebih dari satu ID sumber.

## Full Detail CSV Record Types

| Primary `record_type` | Alias diterima | Artinya | Kolom minimum penting |
| --- | --- | --- | --- |
| `member` | `members` | Satu member/account internal. | `stable_key`; disarankan `display_name`, `group_key`, `join_period`, `source_system`, `alias_key` |
| `member_alias` | `member_aliases`, `alias` | ID member di sistem sumber. | `member_stable_key`, `source_system`, `alias_key` |
| `role_history` | `member_role` | Status member dari waktu ke waktu, seperti affiliate level, CP status, WEC status, atau cross-app status. | `member_stable_key`, `role_type`, `role_value`, `effective_from` |
| `offer` | `offers` | Definisi produk, package, atau offer. | `offer_code`, `offer_type`, `source_system`; disarankan `label`, `price_fiat_usd` |
| `business_event` | `business_events`, `event` | Kejadian bisnis, seperti join, purchase, product sale, pool funding, atau reward accrual. | `event_ref`, `event_type`, `source_system`, `occurred_at`, `effective_period` |
| `pc_entry` | `pc_entries`, `pc_ledger` | Gerakan ledger PC. | `member_stable_key`, `entry_type`, `effective_period`, `amount_pc` |
| `sp_entry` | `sp_entries`, `sp_ledger` | Gerakan ledger SP. | `member_stable_key`, `entry_type`, `effective_period`, `amount_sp` |
| `reward_obligation` | `reward_obligations`, `reward` | Reward yang owed atau distributed ke member. | `member_stable_key`, `reward_source_code`, `distribution_cycle`, `effective_period`, `amount`, `unit` |
| `pool_entry` | `pool_entries`, `pool` | Funding, allocation, adjustment, atau distribution dari pool. | `pool_code`, `entry_type`, `distribution_cycle`, `effective_period`, `amount`, `unit` |
| `cashout_event` | `cashout_events`, `cashout` | Request, approval, payment, atau rejection cash-out. | `member_stable_key`, `event_type`, `occurred_at`, `effective_period`, `amount_usd` |
| `qualification_window` | `qualification_windows` | Periode waktu untuk qualification, contoh WEC 60-day window. | `member_stable_key`, `qualification_type`, `window_key`, `starts_at`, `ends_at` |
| `qualification_status` | `qualification_status_history` | Update status qualification di dalam atau setelah window. | `member_stable_key`, `qualification_type`, `status`, `effective_from` |

## Full Detail CSV Columns

| Kolom | Dipakai oleh | Artinya |
| --- | --- | --- |
| `record_type` | Semua | Memberi tahu engine jenis row. Wajib untuk setiap row. |
| `snapshot_id` | Semua | ID batch untuk file ini. Opsional, tetapi kalau diisi maka semua row harus memakai nilai yang sama. |
| `stable_key` | `member` | ID member internal di simulator. |
| `display_name` | `member` | Nama member yang mudah dibaca. |
| `group_key` | `member` | Label grup/cohort, contoh `FOUNDERS`. |
| `join_period` | `member` | Bulan pertama member join. Format `YYYY-MM`. |
| `member_stable_key` | Banyak detail row | Link kembali ke `member.stable_key`. |
| `source_system` | `member`, `member_alias`, `role_history`, `offer`, `business_event` | Sistem bisnis asal data. |
| `alias_key` | `member`, `member_alias` | ID member di sistem sumber. |
| `alias_type` | `member`, `member_alias` | Jenis source ID. Jika kosong, engine memakai `member_id`. |
| `confidence` | `member`, `member_alias` | Keyakinan bahwa alias cocok dengan member. Isi `1` kalau pasti. |
| `role_type` | `role_history` | Kategori status yang dicatat. |
| `role_value` | `role_history` | Nilai status, contoh `PATHFINDER` atau `CP`. |
| `effective_from` | `role_history`, `qualification_status` | Tanggal/status mulai berlaku. |
| `effective_to` | `role_history`, `qualification_status` | Tanggal/status berakhir. Kosongkan jika masih aktif. |
| `source_event_ref` | Detail rows | `business_event.event_ref` yang mendukung row ini. Disarankan untuk audit trail. |
| `offer_code` | `offer`, `business_event` | Kode produk/package/offer. |
| `offer_type` | `offer` | Kategori offer. |
| `label` | `offer` | Nama offer yang mudah dibaca. |
| `price_fiat_usd` | `offer` | Harga offer dalam USD. |
| `pc_grant` | `offer` | Jumlah PC sederhana yang diberikan offer. |
| `sp_accrual` | `offer` | Jumlah SP sederhana yang bertambah dari offer. |
| `pc_grant_rule` | `offer` | JSON advanced untuk rule PC. Mengalahkan `pc_grant` jika diisi. |
| `lts_generation_rule` | `offer` | JSON advanced untuk rule SP/LTS. Mengalahkan `sp_accrual` jika diisi. |
| `reward_rule_reference` | `offer` | Nama/reference business rule di balik reward offer. |
| `event_ref` | `business_event` | ID unik untuk business event. Row lain bisa menunjuk ke sini lewat `source_event_ref`. |
| `event_type` | `business_event`, `cashout_event` | Jenis event. Business event dan cash-out event punya pilihan nilai berbeda. |
| `occurred_at` | `business_event`, `cashout_event` | Tanggal/waktu event terjadi. |
| `effective_period` | Event dan ledger rows | Bulan di mana row dihitung. Format `YYYY-MM`. |
| `actor_member_stable_key` | `business_event` | Member yang melakukan action. |
| `beneficiary_member_stable_key` | `business_event` | Member yang menerima benefit atau reward. |
| `related_member_stable_key` | `business_event` | Member lain yang terkait, misalnya upline. |
| `quantity` | `business_event` | Jumlah item atau action. |
| `amount` | `business_event`, `reward_obligation`, `pool_entry` | Jumlah umum. Kolom `unit` menjelaskan satuannya. |
| `unit` | `business_event`, `reward_obligation`, `pool_entry` | Satuan amount, contoh `USD`, `PC`, atau `SP`. |
| `recognized_revenue_usd` | `business_event` | Revenue yang diakui perusahaan dari event ini. Dipakai di cashflow dan treasury metrics. |
| `gross_margin_usd` | `business_event` | Gross margin dari event jika diketahui. |
| `entry_type` | `pc_entry`, `sp_entry`, `pool_entry` | Jenis gerakan ledger. Pilihan nilainya tergantung row type. |
| `amount_pc` | `pc_entry` | Jumlah PC untuk satu gerakan ledger PC. |
| `amount_sp` | `sp_entry` | Jumlah SP untuk satu gerakan ledger SP. |
| `sink_spend_usd` | `pc_entry` | Nilai internal use dalam USD. Disarankan saat `entry_type=SPEND`. |
| `reward_source_code` | `reward_obligation` | Kode keluarga reward, contoh `BGC_RR` atau `IB_CPR`. |
| `distribution_cycle` | `reward_obligation`, `pool_entry` | Seberapa sering reward atau pool dihitung/dibagikan. |
| `obligation_status` | `reward_obligation` | Status reward obligation. Jika kosong, engine memakai `ACCRUED`. |
| `origin_join_level` | `reward_obligation` | Join level sumber untuk validasi reward BGC. |
| `tier` | `reward_obligation` | Nomor tier untuk formula reward tertentu. |
| `imatrix_plan` | `reward_obligation` | Kode plan iMatrix untuk reward iBLOOMING tertentu. |
| `eligibility_snapshot_key` | `reward_obligation`, `pool_entry` | Reference ke eligibility snapshot untuk reward atau pool. |
| `pool_code` | `pool_entry` | Identitas pool. |
| `recipient_member_stable_key` | `pool_entry` | Member penerima distribusi pool. Kosongkan untuk pool funding. |
| `share_count` | `pool_entry` | Jumlah share penerima dalam distribusi pool. |
| `pool_recipient_count` | `pool_entry` | Total penerima dalam snapshot distribusi pool. |
| `pool_share_total` | `pool_entry` | Total share dalam snapshot distribusi pool. |
| `amount_usd` | `cashout_event` | Jumlah cash-out dalam USD. Wajib untuk row cash-out. |
| `fee_usd` | `cashout_event` | Biaya cash-out dalam USD. Isi `0` kalau tidak ada fee. |
| `cashout_source_system` | `cashout_event` | Source system untuk cash-out. Jika kosong, engine mencoba infer lalu default ke BGC. |
| `breakdown_key` | `cashout_event` | Label untuk mengelompokkan cash-out breakdown. Jika kosong, engine memakai `CASHOUT`. |
| `scenario_code` | `cashout_event` | Label scenario cash-out untuk analisis. Opsional. |
| `policy_group` | `cashout_event` | Label policy group cash-out. Opsional. |
| `qualification_type` | `qualification_window`, `qualification_status` | Program atau rule qualification. |
| `window_key` | `qualification_window` | ID unik qualification window. |
| `starts_at` | `qualification_window` | Tanggal/waktu qualification window mulai. |
| `ends_at` | `qualification_window` | Tanggal/waktu qualification window selesai. |
| `threshold_amount` | `qualification_window` | Target jumlah untuk qualification. |
| `threshold_unit` | `qualification_window` | Satuan untuk `threshold_amount`. |
| `status` | `qualification_status` | Status qualification. |
| `source_window_key` | `qualification_status` | Link ke `qualification_window.window_key`. |
| `metadata` | Semua | JSON opsional untuk source notes, row ID, atau detail tambahan. |

## Columns With Fixed Choices

Gunakan uppercase untuk Full Detail CSV. Importer bisa mengubah beberapa field ke uppercase, tetapi uppercase membuat file lebih mudah diaudit.

| Kolom | Nilai yang diterima | Arti sederhana |
| --- | --- | --- |
| `source_system` | `BGC`, `IBLOOMING` | Sistem bisnis sumber. Importer juga menerima `I-BLOOMING` dan `I_BLOOMING`, lalu menyimpannya sebagai `IBLOOMING`. |
| `role_type` | `AFFILIATE_LEVEL`, `CP_STATUS`, `EXECUTIVE_CP_STATUS`, `WEC_STATUS`, `CROSS_APP_STATUS` | Kategori status member yang dicatat. |
| `offer_type` | `BGC_AFFILIATE_JOIN`, `BGC_AFFILIATE_UPGRADE`, `BGC_PHYSICAL_PRODUCT`, `IB_CP_DIGITAL_PRODUCT`, `IB_GIM_PRODUCT`, `IB_IMATRIX_PRODUCT` | Jenis produk, package, atau offer yang menghasilkan value. |
| `business_event.event_type` | `AFFILIATE_JOINED`, `AFFILIATE_UPGRADED`, `PHYSICAL_PRODUCT_PURCHASED`, `CP_PRODUCT_SOLD`, `GIM_SIGNUP_COMPLETED`, `IMATRIX_PURCHASE_COMPLETED`, `REWARD_ACCRUED`, `POOL_FUNDED`, `POOL_DISTRIBUTED`, `QUALIFICATION_WINDOW_OPENED`, `QUALIFICATION_ACHIEVED`, `CASHOUT_REQUESTED`, `CASHOUT_APPROVED`, `CASHOUT_PAID` | Kejadian yang terjadi di sistem bisnis. |
| `cashout_event.event_type` | `REQUESTED`, `APPROVED`, `PAID`, `REJECTED` | Status cash-out. Hanya `PAID` yang menjadi cash paid out aktual. |
| `unit` / `threshold_unit` | `USD`, `PC`, `SP`, `COUNT`, `SHARE` | Satuan jumlah. |
| `pc_entry.entry_type` | `GRANT`, `SPEND`, `ADJUSTMENT` | PC diberikan, dipakai internal, atau disesuaikan. |
| `sp_entry.entry_type` | `ACCRUAL`, `DISTRIBUTION`, `ADJUSTMENT` | SP bertambah, didistribusikan, atau disesuaikan. |
| `pool_entry.entry_type` | `FUNDING`, `DISTRIBUTION`, `ALLOCATION`, `ADJUSTMENT` | Pool didanai, didistribusikan, dialokasikan, atau disesuaikan. |
| `reward_source_code` | `BGC_RR`, `BGC_GR`, `BGC_MIRACLE_CASH`, `BGC_GPSP`, `BGC_WEC_POOL`, `IB_LR`, `IB_MIRACLE_CASH`, `IB_CPR`, `IB_GRR`, `IB_IRR`, `IB_GPS`, `IB_GMP`, `IB_GEC` | Identitas keluarga reward. Kode harus tepat supaya engine tidak kehilangan arti business rule. |
| `distribution_cycle` | `EVENT_BASED`, `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `YEARLY`, `ADHOC` | Seberapa sering reward atau pool dievaluasi/dibagikan. |
| `obligation_status` | `ACCRUED`, `ELIGIBLE`, `DISTRIBUTED`, `CANCELLED` | Status reward obligation. |
| `pool_code` | `BGC_GPSP_MONTHLY_POOL`, `BGC_WEC_QUARTERLY_POOL`, `IB_GPS_SEMIANNUAL_POOL`, `IB_WEC_USER_MONTHLY_POOL`, `IB_GMP_MONTHLY_POOL`, `IB_GEC_INTERNAL_POOL` | Identitas pool. |
| `qualification_type` | `WEC_60_DAY`, `CPR_YEAR_1`, `CPR_YEAR_2`, `EXECUTIVE_CP_APPOINTMENT`, `POOL_RECIPIENT_SNAPSHOT` | Rule qualification yang dilacak. |
| `qualification_status.status` | `OPEN`, `ELIGIBLE`, `ACHIEVED`, `ACTIVE`, `EXPIRED`, `CANCELLED` | Status qualification. |

## Web3 And Token Price Terms

Ini adalah scenario settings, bukan kolom snapshot. Istilah ini ada di sini karena snapshot data dan asumsi Web3 sering dibahas bersamaan.

| UI label | Nilai internal | Artinya |
| --- | --- | --- |
| ALPHA classification: Internal credit | `internal_credit` | ALPHA adalah credit internal akuntansi. Ini default paling aman untuk phase 1. |
| ALPHA classification: Points | `points` | ALPHA dijelaskan sebagai points, bukan transferable token. |
| ALPHA classification: Token off-chain | `off_chain_token` | ALPHA berperilaku seperti token di database platform, tetapi belum di public chain. |
| ALPHA classification: Future on-chain token | `future_on_chain_token` | ALPHA direncanakan menjadi token publik/on-chain nanti. Butuh review tokenomics, legal, dan implementation yang lebih kuat. |
| Price basis: Internal only / no market price | `not_applicable_internal` | Tidak memakai harga public token. |
| Price basis: Fixed internal rate | `fixed_accounting` | Tim menetapkan nilai internal tetap, contoh `1 ALPHA = $1`. Ini asumsi, bukan market price. |
| Price basis: Oracle price feed | `oracle_feed` | Harga berasal dari external price feed. Masuk akal hanya setelah ALPHA punya market atau source pricing yang approved. |
| Price basis: Liquidity pool price | `liquidity_pool` | Harga dihitung dari reserve pool, misalnya USDC dan ALPHA di liquidity pool. |
| Price basis: Market forecast | `market_forecast` | Harga adalah estimasi market masa depan. Ini bahasa forecast, bukan observed data. |

Catatan: kalau `ALPHA price ($)` diisi `1`, artinya scenario mengasumsikan 1 ALPHA = 1 USD. Engine bisa membaca angka itu, tetapi engine tidak membuktikan market benar-benar akan menghargai ALPHA sebesar 1 USD. Bukti market harus datang dari tokenomics, reserve, liquidity, atau market assumption.

## Recommended Files

- Template Full Detail CSV kosong: `examples/full-detail-csv-template.csv`
- Legend kolom CSV: `examples/full-detail-csv-glossary.csv`
- Contoh kecil all-green: `examples/sample-source-detail-all-green.csv`
- Contoh 24 bulan BGC + iBLOOMING: `examples/sample-24m-bgc-iblooming-full-detail.csv`
- Contoh forecast/on-chain: `examples/forecast-iboomie-alpha-onchain-12m.csv`
