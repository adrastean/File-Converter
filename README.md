# Converter

Converter, Windows için hazırlanmış masaüstü dosya dönüştürme uygulamasıdır. Electron ve Node.js ile çalışır; dosyaları çevrim içi bir servise yüklemeden yerel olarak dönüştürmeyi amaçlar.

## Özellikler

- Video ve ses: MP4, MP3, WAV, M4A, FLAC ve OGG dönüşümleri
- Görseller: JPG, PNG ve WebP dönüşümleri
- Görsel → PDF
- Office ve metin dosyaları → PDF
- PDF → TXT, DOCX, PNG ve JPG
- 500 MB dosya boyutu sınırı
- Başarılı işlem bildirimi ve ses efekti
- Windows kurulum sihirbazı

## Kullanım

GitHub Releases bölümünden uygun kurulum dosyasını indirip çalıştırın:

- **Converter Full:** Office dönüşümleri için LibreOffice’i kurulum sırasında ekler.
- **Converter Lite:** Daha küçük kurulumdur; Office → PDF dönüşümleri için bilgisayarda LibreOffice bulunması gerekir.

Kurulumdan sonra dosyayı seçin, hedef formatı belirleyin ve **Dönüştür** düğmesine basın.

## Geliştirme

```powershell
npm install
npm start
```

PDF → DOCX yardımcı uygulamasını oluşturmak için Python ve PyInstaller gerekir:

```powershell
py -m pip install pdf2docx pyinstaller
py -m PyInstaller --onefile --clean --name pdf_to_docx pdf_to_docx.py
Copy-Item .\dist\pdf_to_docx.exe .\build\pdf_to_docx.exe -Force
```

Full kurulum dosyası için resmi LibreOffice Windows MSI dosyasını `build\LibreOffice.msi` adıyla yerleştirin. Bu büyük dosya ve oluşturulan kurulum dosyaları Git deposuna dahil edilmez.

```powershell
npm run build:lite
npm run build:full
```

## Proje yapısı

- `public/`: Arayüz dosyaları
- `server.js`: Dönüşüm sunucusu ve dosya işlemleri
- `electron.js`: Electron penceresi ve yerel sunucu başlatma
- `pdf_to_docx.py`: PDF → DOCX yardımcı uygulamasının kaynak kodu
- `electron-builder.*.json`: Lite ve Full paket ayarları

## Lisans

Bu proje MIT lisansı ile yayımlanmıştır. Kullanılan üçüncü taraf araçların kendi lisansları ayrıca geçerlidir.
