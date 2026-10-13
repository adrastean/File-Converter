# File Converter

Windows için hazırlanmış, dosyaları yerel olarak dönüştüren masaüstü uygulaması.

A Windows desktop application for converting files locally.

## Özellikler | Features

- Video ve ses dönüşümleri: MP4, MP3, WAV, M4A, FLAC ve OGG
- Audio and video conversions: MP4, MP3, WAV, M4A, FLAC and OGG
- JPG, PNG ve WebP dönüşümleri
- JPG, PNG and WebP conversions
- Görsel → PDF
- Image → PDF
- Office ve metin dosyaları → PDF
- Office and text files → PDF
- PDF → TXT, DOCX, PNG ve JPG
- PDF → TXT, DOCX, PNG and JPG
- 500 MB dosya boyutu sınırı
- 500 MB file size limit
- Yerel dönüşüm; dosyalar çevrim içi bir servise yüklenmez
- Local conversion; files are not uploaded to an online service
- Windows kurulum sihirbazı ve başarı bildirimi
- Windows installer and conversion success notification

## İndirme | Download

GitHub Releases bölümünden uygun sürümü indirin:

Download the suitable version from the GitHub Releases section:

- **Converter Full:** LibreOffice’i kurulum sırasında ekler ve Office dönüşümlerini destekler.
- **Converter Full:** Includes LibreOffice during installation and supports Office conversions.
- **Converter Lite:** Daha küçük kurulumdur; Office → PDF için LibreOffice ayrıca gerekir.
- **Converter Lite:** Smaller installer; LibreOffice is required separately for Office → PDF.

## Kullanım | Usage

1. Uygulamayı açın. / Open the application.
2. Dönüştürülecek dosyayı seçin. / Select the file to convert.
3. Hedef formatı belirleyin. / Choose the target format.
4. **Dönüştür** düğmesine basın. / Click **Convert**.

## Geliştirme | Development

```powershell
npm install
npm start
```

PDF → DOCX yardımcı uygulamasını oluşturmak için Python ve PyInstaller gerekir.

Python and PyInstaller are required to build the PDF → DOCX helper.

```powershell
py -m pip install pdf2docx pyinstaller
py -m PyInstaller --onefile --clean --name pdf_to_docx pdf_to_docx.py
Copy-Item .\dist\pdf_to_docx.exe .\build\pdf_to_docx.exe -Force
```

Full kurulum için resmi LibreOffice Windows MSI dosyasını `build\LibreOffice.msi` adıyla yerleştirin.

For the Full installer, place the official LibreOffice Windows MSI file at `build\LibreOffice.msi`.

```powershell
npm run build:lite
npm run build:full
```

## Proje yapısı | Project structure

- `public/` — Arayüz / User interface
- `server.js` — Dönüşüm sunucusu / Conversion server
- `electron.js` — Electron penceresi / Electron window
- `pdf_to_docx.py` — PDF → DOCX kaynak kodu / PDF → DOCX source
- `electron-builder.*.json` — Paketleme ayarları / Packaging configuration

## Lisans | License

Bu proje MIT lisansı ile yayımlanmıştır. Kullanılan üçüncü taraf araçların kendi lisansları ayrıca geçerlidir.

This project is released under the MIT License. The licenses of third-party tools used by the project apply separately.
