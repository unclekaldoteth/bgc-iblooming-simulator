# Kamus Metric Meeting Version (Bahasa Indonesia)

Dokumen ini adalah versi ringkas dan non-teknis untuk membantu menjelaskan istilah-istilah penting di halaman `Snapshots`, `Run`, dan `Compare` saat meeting.

Prinsip membaca dokumen ini:

- fokus pada arti bisnis, bukan istilah engine
- gunakan definisi singkat yang mudah dijelaskan ke non-engineering audience
- kalau ada angka yang terlihat mirip, prioritaskan istilah yang benar-benar dipakai di layar

## Halaman `Snapshots`

| Istilah | Arti singkat untuk meeting | Cara baca cepat |
| --- | --- | --- |
| `Snapshot` | Satu versi dataset historis yang dipakai untuk simulasi. | Anggap sebagai "paket data historis" yang menjadi input run. |
| `Name` | Nama dataset/snapshot. | Biasanya dipakai untuk membedakan periode atau batch data. |
| `Source systems` | Sistem asal data, misalnya `bgc` dan `iblooming`. | Menjelaskan data ini dikumpulkan dari sistem mana saja. |
| `Date range` | Rentang waktu data historis yang dicakup snapshot. | Menjawab "data ini periode kapan?" |
| `CSV upload` | File CSV yang diunggah sebagai sumber data. | Input file mentah untuk import. |
| `File URI` | Lokasi file sumber, misalnya `file://`, `s3://`, atau `https://`. | Menjawab "file sumbernya ada di mana?" |
| `Record count` | Jumlah baris data yang dicatat saat snapshot didaftarkan. | Ini metadata awal, bukan bukti jumlah row yang berhasil diimport. |
| `Validation status` | Status apakah snapshot sudah layak dipakai atau belum. | Fokus utama: apakah statusnya sudah `APPROVED` atau belum. |
| `Validation issues` | Masalah yang ditemukan saat pengecekan metadata snapshot. | Kalau ada issue, snapshot belum siap dipakai. |
| `Import` | Status proses pembacaan CSV ke canonical facts. | Menunjukkan apakah file sudah benar-benar diproses ke sistem. |
| `Import issues` | Masalah yang ditemukan saat parsing/validasi CSV. | Biasanya terkait format kolom, nilai angka, boolean, atau duplikasi. |
| `rowCountRaw` | Jumlah baris mentah yang dibaca dari file CSV. | Ini jumlah row asli dari file sumber. |
| `rowCountImported` | Jumlah baris yang berhasil lolos import. | Ini jumlah row yang benar-benar berhasil diproses. |
| `importedFactCount` | Jumlah canonical facts aktif yang saat ini tersimpan di sistem. | Ini angka yang paling dekat dengan "berapa data aktif yang benar-benar siap dipakai simulasi sekarang". |
| `Approve` | Persetujuan akhir agar snapshot bisa dipakai untuk run. | Run tidak bisa jalan jika snapshot belum `APPROVED`. |

### Status snapshot yang penting

| Status | Arti meeting version |
| --- | --- |
| `DRAFT` | Snapshot baru didaftarkan, belum siap dipakai. |
| `VALIDATING` | Snapshot sedang dicek. |
| `INVALID` | Snapshot punya error yang harus diperbaiki. |
| `VALID` | Snapshot lolos validasi, tetapi belum disetujui. |
| `APPROVED` | Snapshot sudah resmi boleh dipakai untuk simulasi. |
| `ARCHIVED` | Snapshot disimpan untuk histori, bukan untuk penggunaan aktif. |

### Ringkasan penting untuk `Snapshots`

- `recordCount` = metadata saat pendaftaran
- `rowCountRaw` = jumlah row asli di file
- `rowCountImported` = jumlah row yang lolos import
- `importedFactCount` = jumlah data aktif yang benar-benar tersimpan

## Halaman `Run`

| Istilah | Arti singkat untuk meeting | Cara baca cepat |
| --- | --- | --- |
| `Run` | Satu eksekusi simulasi dari satu scenario terhadap satu snapshot. | Anggap sebagai "satu percobaan policy". |
| `Run status` | Status proses run. | Fokus utama: `COMPLETED` atau belum. |
| `Policy status` | Status rekomendasi akhir dari skenario. | Di UI founder biasanya tampil sebagai `Ready`, `Needs Review`, atau `Do Not Use`. |
| `Scenario` | Paket aturan/policy yang sedang diuji. | Menjawab "aturan apa yang sedang kita test?" |
| `Snapshot` | Dataset historis yang dipakai oleh run. | Menjawab "run ini memakai data yang mana?" |
| `Model` | Versi model baseline yang dipakai engine. | Menjawab "run ini memakai rulebook yang mana?" |
| `Engine version` | Versi engine simulasi yang menjalankan run. | Penting untuk auditability dan reproducibility. |
| `Seed hash` | Fingerprint deterministik dari kombinasi input run. | Menunjukkan run ini bisa ditelusuri ke input yang spesifik. |
| `Started` / `Completed` | Waktu mulai dan selesai run. | Menjelaskan kapan run dijalankan. |
| `Flags` | Peringatan ketika hasil run melewati threshold tertentu. | Tidak selalu berarti gagal, tapi berarti perlu perhatian. |
| `Recommendation` | Ringkasan kesimpulan decision pack. | Ini kalimat singkat yang menjawab apakah skenario layak dipertimbangkan. |
| `Evaluated Scenario Basis` | Ringkasan setup skenario yang sedang dinilai. | Ini bukan truth historis; ini basis evaluasi untuk run yang sedang dibahas. |
| `Blockers / Rejection Reasons` | Kondisi atau setup yang membuat skenario tertahan. | Menjelaskan kenapa skenario tidak ideal atau perlu revisi. |

## Summary metrics di halaman `Run`

| Metric | Arti singkat untuk meeting | Cara baca cepat |
| --- | --- | --- |
| `Gross Cash In` | Total kas bruto bisnis yang masuk. | Ini titik awal membaca arus uang perusahaan. |
| `Retained Revenue` | Revenue yang benar-benar tinggal di perusahaan. | Jangan campur dengan reward basis atau ALPHA. |
| `Net Treasury Delta` | Selisih bersih treasury setelah outflow aktual. | Ini salah satu angka terpenting untuk membaca sehat atau tidaknya skenario. |
| `Actual Payout Out` | Payout aktual yang benar-benar keluar. | Ini outflow nyata, bukan obligation yang baru tercipta. |
| `ALPHA Issued Total` | Total ALPHA yang diterbitkan dalam simulasi. | Menjawab "berapa besar output issuance?" |
| `ALPHA Spent Total` | Total ALPHA yang dipakai di dalam ekosistem. | Ini bukan cash-out; ini penggunaan untuk spend/utility/sink. |
| `ALPHA Held Total` | Total ALPHA yang masih ditahan, belum dipakai dan belum dicash-out. | Menunjukkan berapa banyak ALPHA yang masih tersimpan di user/system behavior. |
| `ALPHA Cashout Equivalent Total` | Jumlah setara cash-out yang dimodelkan. | Ini yang paling dekat dengan ALPHA keluar ke nilai setara uang. |
| `Sink Utilization Rate` | Persentase ALPHA issued yang masuk ke penggunaan di ekosistem. | Makin tinggi biasanya berarti utilitas ALPHA lebih kuat. |
| `Payout / Inflow Ratio` | Perbandingan tekanan payout terhadap inflow treasury. | Di atas `1.0` berarti payout pressure lebih besar dari inflow. |
| `Reserve Runway Months` | Estimasi berapa lama treasury bisa bertahan. | Makin tinggi biasanya makin aman. |
| `Reward Concentration Top 10%` | Porsi issuance yang terkonsentrasi di 10% member teratas. | Makin tinggi berarti distribusi makin terkonsentrasi. |

### Cara baca outcome metrics

- `Issued` = ALPHA yang dibuat
- `Spent` = ALPHA yang dipakai di ekosistem
- `Held` = ALPHA yang masih ditahan
- `Cashout Eq.` = ALPHA yang keluar ke nilai setara cash

### Cara baca health signals

- `Sink Use` = seberapa kuat ALPHA dipakai
- `Payout / Inflow` = seberapa berat tekanan payout dibanding arus masuk
- `Runway` = seberapa lama cadangan treasury bisa bertahan
- `Top 10% Share` = seberapa terkonsentrasi distribusi ke cohort atas

### Flag yang paling penting

| Flag | Arti meeting version |
| --- | --- |
| `reserve_runway_below_threshold` | Cadangan runway terlalu pendek. |
| `payout_pressure_exceeds_inflow` | Tekanan payout lebih besar dari inflow. |
| `reward_concentration_high` | Distribusi terlalu terkonsentrasi pada kelompok atas. |

### Policy status yang paling penting

| Status | Arti meeting version |
| --- | --- |
| `Ready` (`candidate`) | Skenario masih berada dalam batas yang aman dan layak dibahas untuk pilot. |
| `Needs Review` (`risky`) | Skenario belum gagal total, tapi ada warning yang perlu perhatian founder dan tim. |
| `Do Not Use` (`rejected`) | Skenario melanggar batas keselamatan utama dan sebaiknya tidak dipakai sebagai default pilot. |

## Halaman `Compare`

| Istilah | Arti singkat untuk meeting | Cara baca cepat |
| --- | --- | --- |
| `Compare Runs` | Halaman untuk membandingkan completed runs secara side by side. | Dipakai untuk memilih skenario terbaik, bukan untuk melihat detail satu run. |
| `Scenario Profile Radar` | Visual scan cepat antar skenario. | Jangan dijadikan sumber keputusan utama; pakai cashflow table untuk keputusan. |
| `Compare Decision Snapshot` | Kartu ringkas per run. | Lihat verdict, net treasury delta, payout out, pressure, dan runway per skenario. |
| `Business Cashflow Comparison` | Tabel cashflow perusahaan antar run. | Ini sumber baca utama untuk keputusan bisnis. |
| `ALPHA Policy Comparison` | Tabel layer ALPHA policy antar run. | Pakai untuk baca issuance, used, held, dan cash-out ALPHA, bukan cash perusahaan. |
| `Treasury Risk Comparison` | Tabel health signal antar run. | Dipakai untuk lihat pressure, runway, internal use, dan concentration risk. |
| `Scenario` | Nama skenario yang dibandingkan. | Menjawab "policy mana yang menang?" |
| `Snapshot` | Snapshot yang dipakai tiap run. | Pastikan perbandingan fair jika snapshot-nya sama. |
| `Completed At` | Waktu run selesai. | Membantu melihat run paling baru atau urutan eksperimen. |

## Metric utama di `Compare`

| Metric | Pertanyaan bisnis yang dijawab |
| --- | --- |
| `company_gross_cash_in_total` | Berapa kas bisnis bruto yang masuk? |
| `company_retained_revenue_total` | Berapa revenue yang benar-benar tinggal di perusahaan? |
| `company_net_treasury_delta_total` | Setelah payout aktual dan fulfillment, treasury bertambah atau berkurang berapa? |
| `company_actual_payout_out_total` | Berapa payout aktual yang benar-benar keluar? |
| `alpha_issued_total` | Seberapa besar ALPHA diterbitkan dalam skenario ini? |
| `alpha_spent_total` | Seberapa banyak ALPHA benar-benar dipakai di ekosistem? |
| `alpha_held_total` | Seberapa banyak ALPHA berakhir ditahan? |
| `payout_inflow_ratio` | Apakah tekanan payout masih tertutup oleh inflow? |
| `reserve_runway_months` | Apakah treasury cukup tahan lama? |
| `reward_concentration_top10_pct` | Apakah distribusinya terlalu berat ke top cohort? |

## Cara presentasi cepat per halaman

### Kalau sedang di `Snapshots`

Gunakan kalimat ini:

> "Di halaman Snapshots, kita fokus memastikan data historis sudah benar, sudah diimport, dan sudah `APPROVED` sebelum dipakai simulasi."

### Kalau sedang di `Run`

Gunakan kalimat ini:

> "Di halaman Run, kita lihat satu skenario secara detail: berapa ALPHA yang diterbitkan, dipakai, ditahan, tekanan payout-nya, runway treasury-nya, dan apakah hasil akhirnya aman atau berisiko."

### Kalau sedang di `Compare`

Gunakan kalimat ini:

> "Di halaman Compare, kita tidak lagi melihat satu run secara detail, tapi membandingkan beberapa skenario side by side untuk memilih opsi yang paling kuat dan paling aman."

Tambahan cara baca yang lebih tepat:

> "Mulai dari radar hanya untuk quick scan, lalu baca `Business Cashflow Comparison` sebagai sumber keputusan utama. Setelah itu baru cek ALPHA layer, treasury risk, strategic goals, dan milestone."

## Tiga kalimat kunci untuk meeting

- `Snapshots` = memastikan data historisnya siap dan terpercaya
- `Run` = melihat hasil satu skenario secara detail
- `Compare` = memilih skenario terbaik dengan membandingkan metrik utama
