import ExcelJS from 'exceljs';

export interface LegalExportMetadata {
    docNo: string;
    effectiveDate: string;
    revNo: string;
    revDate: string;
}

export const exportToExcel = async (data: any[], metadata: LegalExportMetadata, logoUrl?: string) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Yasal Şartlar Takip Çizelgesi');

    // --- Sayfa Düzeni Ayarları ---
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.margins = {
        left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3
    };

    // --- Header (Logo ve Meta Veriler) ---
    // Header Yüksekliği
    worksheet.getRow(1).height = 40;
    worksheet.getRow(2).height = 40;

    // Logo (Sol Üst)
    if (logoUrl) {
        try {
            const response = await fetch(logoUrl);
            const buffer = await response.arrayBuffer();
            const imageId = workbook.addImage({
                buffer: buffer,
                extension: 'png',
            });
            // Hücrelere göre yerleştir (A1 - C2 arasını kaplasın)
            worksheet.addImage(imageId, {
                tl: { col: 0.1, row: 0.1 },
                ext: { width: 150, height: 80 }
            });
        } catch (err) {
            console.error('Logo ekleme hatası:', err);
        }
    }

    // Başlık (Orta)
    worksheet.mergeCells('D1:I2');
    const titleCell = worksheet.getCell('D1');
    titleCell.value = 'YASAL ŞARTLAR TAKİP ÇİZELGESİ';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' }
    };
    titleCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    // Meta Veriler (Sağ Üst)
    const metaBox = [
        ['Döküman No', metadata.docNo],
        ['Yürürlük Tarihi', metadata.effectiveDate],
        ['Revizyon Sayısı', metadata.revNo],
        ['Revizyon Tarihi', metadata.revDate]
    ];

    metaBox.forEach((row, idx) => {
        const cellLabel = worksheet.getCell(idx + 1, 12); // L kolonu
        const cellValue = worksheet.getCell(idx + 1, 13); // M kolonu
        cellLabel.value = row[0];
        cellValue.value = row[1];
        
        // Stiller
        [cellLabel, cellValue].forEach(c => {
            c.font = { size: 9, bold: idx === 0 || idx === 1 };
            c.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            c.alignment = { horizontal: 'left', vertical: 'middle' };
        });
        cellLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    });

    // Boşluk bırak (Header sonrası)
    worksheet.getRow(5).height = 20;

    // --- Tablo Başlıkları ---
    const headers = [
        'Resmi Gazete Tarihi',
        'Resmi Gazete Sayısı',
        'Son Değişiklik',
        'İlgili Kanun/Yönetmelik Adı',
        'Lokasyon',
        'Madde No',
        'Hükmü',
        'Yürürlük Tarihi',
        'Periyodu',
        'Mevcut Durumu',
        'Uygunluk Durumu',
        'Alınacak Aksiyon Kısmı',
        'Sorumlu Kişi',
        'Termin Tarihleri'
    ];

    const headerRow = worksheet.getRow(6);
    headerRow.values = headers;
    headerRow.height = 35;
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' } // Indigo-600
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Kolon Genişlikleri
    worksheet.columns = [
        { width: 15 }, // RG Tarihi
        { width: 15 }, // RG Sayı
        { width: 15 }, // Son Değiş
        { width: 30 }, // Kanun Adı
        { width: 20 }, // LOKASYON
        { width: 10 }, // Maddesi
        { width: 40 }, // Hükmü
        { width: 15 }, // Yürürlük
        { width: 15 }, // Periyot
        { width: 25 }, // Mevcut Durum
        { width: 15 }, // Uygunluk
        { width: 25 }, // Aksiyon
        { width: 20 }, // Sorumlu
        { width: 15 }, // Termin
    ];

    // --- Verileri Ekle ve Hucre Birleştirme Mantığı ---
    let currentRow = 7;
    let regStartRow = currentRow;
    let lastRegName = '';

    data.forEach((item, index) => {
        const row = worksheet.getRow(currentRow);
        row.values = [
            item.gazette_date || '-',
            item.gazette_number || '-',
            item.last_modification_date || '-',
            item.reg_name,
            item.location || '-',
            item.article_number,
            item.provision,
            item.reg_effective_date || '-',
            item.period || '-',
            item.current_status || '-',
            item.is_compliant === true ? 'UYGUN' : item.is_compliant === false ? 'UYGUN DEĞİL' : 'BEKLİYOR',
            item.action_required || '-',
            item.responsible_persons || '-',
            item.due_date || '-'
        ];

        // Zebra Şerit Efekti
        const isAlternate = Math.floor(index / 1) % 2 === 0;

        row.eachCell((cell, colNumber) => {
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: (colNumber <= 3 || colNumber === 5 || colNumber === 11) ? 'center' : 'left' };
            cell.font = { size: 9 };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            
            if (!isAlternate) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9FAFB' }
                };
            }

            // Uygunluk kolonuna renk ver
            if (colNumber === 11) {
                if (cell.value === 'UYGUN') {
                    cell.font = { bold: true, color: { argb: 'FF059669' } };
                } else if (cell.value === 'UYGUN DEĞİL') {
                    cell.font = { bold: true, color: { argb: 'FFDC2626' } };
                }
            }
        });

        row.height = 35;

        // --- Hücre Birleştirme (Merging) ---
        // Eğer yönetmelik adı değiştiyse veya listenin sonuna gelindiyse önceki grubu birleştir
        if (lastRegName !== '' && (item.reg_name !== lastRegName || index === data.length - 1)) {
            const endRow = (index === data.length - 1 && item.reg_name === lastRegName) ? currentRow : currentRow - 1;
            if (endRow > regStartRow) {
                // RG Tarihi, Sayısı, Son Değişiklik ve Yönetmelik Adı kolonlarını birleştir
                for (let col = 1; col <= 4; col++) {
                    worksheet.mergeCells(regStartRow, col, endRow, col);
                }
            }
            regStartRow = currentRow;
        }
        
        lastRegName = item.reg_name;
        currentRow++;
    });

    // Son satır için kontrol (Eğer döngü bittiğinde son grup birleştirilmemişse)
    if (currentRow - 1 > regStartRow) {
        for (let col = 1; col <= 4; col++) {
            worksheet.mergeCells(regStartRow, col, currentRow - 1, col);
        }
    }


    // --- Dosyayı Kaydet ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Yasal_Sartlar_Takibi_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
