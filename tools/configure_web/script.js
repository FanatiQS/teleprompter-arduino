// Show hides configuration items on click
document.querySelectorAll('.config-container').forEach((node) => {
	node.onclick = function (event) {
		if (event.target === this.lastElementChild) return;
		this.classList.toggle("config-container-open");
	};
});

// Function to convert form to a configuration string
function serializeConfig(lf) {
	const textboxes = document.querySelectorAll(".config-container-open .config-textbox");
	let output = '';
	for (const textbox of textboxes) {
		output += `${textbox.name}=${textbox.value}${lf}`;
	}
	output += lf;
	return output;
}

// Logs a messsage to the on-screen TTY
const tty = document.querySelector('.config-console');
function log(msg) {
	const atBottom = (tty.parentNode.scrollTop >= tty.scrollHeight - tty.parentNode.clientHeight);
	tty.textContent += msg;
	if (atBottom) tty.parentNode.scrollTop = tty.scrollHeight;
}

// Clears log
document.querySelector('.config-console-clear').onclick = function () {
	tty.textContent = '';
};

// Reads logs from web-serial to console
let serialLogging = false;
document.querySelector("#webserial-read").onclick = async function () {
	try {
		if (!serialDevice) serialDevice = await new SerialDevice();
		serialLogging = true;
		for await (const msg of serialDevice) {
			log(msg);
		}
	}
	catch (err) {
		log("\nError: " + err.message + "\n");
	}
};

// Uploads configuration over web-serial
let serialDevice = null;
document.querySelector('#webserial-upload').onclick = async function () {
	if (!document.querySelectorAll(".config-container-open").length) {
		log("\nNo configuration to send\n");
		return;
	}
	try {
		// Connects to device and sends serialized data
		if (!serialDevice) serialDevice = await new SerialDevice();
		serialDevice.write(serializeConfig('\n'));
		log("\nConfiguration sent\n");

		// Reads response data up to configuration is done
		if (serialLogging) return;
		let firstMsg = true;
		for await (const msg of serialDevice) {
			const index = msg.indexOf("\r\nDone\r\n");
			if (index !== -1) {
				log(msg.slice(0, index + 8));
				serialDevice.close();
				serialDevice = null;
				document.querySelector('#webserial-disconnect').disabled = true;
				return;
			}
			if (firstMsg) {
				if (!msg.startsWith('[')) continue;
				firstMsg = false;
			}
			log(msg);
		}
	}
	catch (err) {
		log("\nError: " + err.message + "\n");
	}
};

// Disconnects curret web-serial device
document.querySelector('#webserial-disconnect').onclick = function () {
	serialDevice.close();
	serialDevice = null;
	this.disabled = true;
	log("\nDisconnected\n");
};



// Sets default OS for manual configuration
document.querySelector('#generate-os').selectIndex = navigator.platform.startsWith('Win') * 1 || !navigator.platform.startsWith('Mac') * 2;

// Generates manual configuration command
document.querySelector("#gen-conf").onclick = function () {
	const os = this.previousElementSibling.selectedOptions[0].value;
	let output = "Copy and paste this command into you command line tool:\n";
	switch (os) {
		case "macos": {
			output += `printf '${serializeConfig('\\n')}' > \`ls /dev/cu.usbserial-* | head -1\`; cat < \`ls /dev/cu.usbserial-* | head -1\``;
			break;
		}
		case "linux": {
			output += `printf '${serializeConfig('\\n')}' > \`ls /dev/ttyUSB* | head -1\`; cat < \`ls /dev/ttyUSB* | head -1\``;
			break;
		}
		case "windows": {
			log("\nWindows is currently not supported\n");
			return;
		}
	}
	log(output + '\n');
};



// Loads local file to config
document.querySelector('#config-load').onclick = function () {
	const loadHandler = document.createElement('input');
	loadHandler.setAttribute('type', 'file');
	loadHandler.onchange = function () {
		reader.readAsText(this.files[0]);
	};
	const reader = new FileReader();
	reader.onload = function (event) {
		event.target.result.split('\n').forEach((line) => {
			const [ key, value ] = line.split('=');
			if (!key) return;
			document.querySelector(`input[name=${key}]`).value = value;
		});
	};
	loadHandler.click();
};

// Save config to local file
document.querySelector('#config-save').onclick = function (event) {
	const saveHandler = document.createElement('a');
	saveHandler.setAttribute('download', 'config.txt');
	if (!confirm("Do you want to download your current configuration?")) return;
	saveHandler.setAttribute('href', `data:text/plain,${encodeURIComponent(serializeConfig('\n'))}`);
	saveHandler.click();
};
