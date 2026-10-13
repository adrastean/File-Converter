const { app, BrowserWindow } = require("electron");
const path = require("path");

// Paketlenmiş uygulamanın yazabileceği kullanıcı klasörünü sunucuya bildirir.
// Tell the server which user data folder is writable in the packaged app.
// Böylece uploads ve outputs app.asar içine yazılmaya çalışmaz.
// This prevents uploads and outputs from being written inside app.asar.
process.env.CONVERTER_DATA_DIR = app.getPath("userData");

const { startServer, PORT } = require("./server");

let server;

function createWindow() {
  const window = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    title: "Converter",
    // Geliştirme ve paketlenmiş sürümde ortak uygulama ikonu.
    // Use the same application icon in development and packaged builds.
    icon: path.join(__dirname, "build", "icon.ico")
  });

  window.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(() => {
  // Önce yerel Express sunucusunu, ardından arayüz penceresini açıyoruz.
  // Start the local Express server before opening the application window.
  server = startServer();
  server.once("listening", createWindow);
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
