// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
const windowStateKeeper = require('electron-window-state')
const isDev = require('electron-is-dev')

if (isDev) {
	require('electron-reloader')(module)
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {
	const mainWindowSize = windowStateKeeper({
		defaultWidth: 450,
		defaultHeight: 800,
	})
	const { x, y, width, height } = mainWindowSize

	// Create the browser window.
	mainWindow = new BrowserWindow({
		x,
		y,
		width,
		height,

		minWidth: 300,
		minHeight: 400,

		backgroundColor: '#333',
		show: false,
		webPreferences: {
			devTools: isDev,
			nodeIntegration: true,
			contextIsolation: false,
		},
		icon: './icon/icon.png',
	})

	mainWindowSize.manage(mainWindow)

	Menu.setApplicationMenu(null)

	// and load the index.html of the app.
	mainWindow.loadFile('public/index.html')

	// Open the DevTools.
	if (isDev) {
		mainWindow.webContents.openDevTools()
	}

	mainWindow.on('ready-to-show', () => {
		mainWindow.show()
	})

	// Emitted when the window is closed.
	mainWindow.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null
	})
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	ipcMain.handle('selectDirectory', selectDirectory)
	createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow()
	}
})

async function selectDirectory() {
	const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
		properties: [ 'openDirectory' ],
	})

	if (canceled) {
		return null
	} else {
		return filePaths[0]
	}
}
