const readline = require('readline');
const fs = require('fs');
const path = require('path');
const Excel = require('exceljs');
const config = require('./config.json');
let error = null;
let userPath = null;
const traductions = {};

const exportTrads = (traductions) => {
	var options = {
	    filename: config.export.filename,
	    useStyles: true,
	    useSharedStrings: true
	};
	const doc = new Excel.Workbook();

	Object.keys(traductions).forEach((page, idx) => {
		if (!page) return;

		const sheet = doc.addWorksheet(page);

		const pageColumns = [
			{ header: 'Traduction key', key: 'key', width: 32 }
		];

		Object.keys(traductions[page]).forEach((lang, lngIdx) => {
			pageColumns.push({ header: lang, key: lang, width: 20 });
		});

		sheet.columns = pageColumns;
		let currentCol = 2;
		const keyRows = {};

		Object.keys(traductions[page]).forEach((lang, lngIdx) => {
			Object.keys(traductions[page][lang]).forEach((key, keyIdx) => {
				if (!key) return;

				let currentRow;
				if (!keyRows[key]) {
					currentRow = sheet.addRow({id: Object.keys(keyRows).length + 1, key});
					keyRows[key] = Object.keys(keyRows).length + 1;
				} else {
					currentRow = sheet.getRow(keyRows[key]+1);
				}

				currentRow.getCell(currentCol).value = traductions[page][lang][key];
			});
			currentCol++;
		});

		if (Object.keys(traductions).length - 1 === idx) {
			return doc.xlsx.writeFile(options.filename)
		    	.then(function() {
		        	console.log('File has been successfully exported.')
		    	});
		}
	});
}

const parseFile = (filename, content, end) => {
	const sepIdx = filename.indexOf('_');
	const extIdx = filename.lastIndexOf('.');
	
	let page = null;
	let lang = 'default';
	if (sepIdx !== -1) {
		lang = filename.substring(sepIdx + 1, extIdx);
		page = filename.substring(0, sepIdx);
	} else {
		page = filename.substring(0, extIdx)
	}

	if (!traductions[page]) {
		traductions[page] = {};
	}
	if (lang.length && !traductions[page][lang]) {
		traductions[page][lang] = {};
	}

	content.split('\n').forEach((line) => { 
		const lineSepIdx = line.indexOf('=');
		const key = line.substring(0, lineSepIdx);
		const val = line.substring(lineSepIdx + 1);

		if (lang.length) {
			traductions[page][lang][key] = val;
		} else {
			traductions[page]['default'][key] = val;
		}

		return traductions;
	});

	if (end) {
		exportTrads(traductions);
	}
}

const readFiles = (dirname, onFileContent, onError) => {
	let filterReg;

	if (config.source.extensionFilter) {
		filterReg = new RegExp(config.source.extensionFilter,'i');
	}

  	return fs.readdir(dirname, (err, filenames) => {
    	if (err) {
	      	onError(err);
	      	return;
	    }
	    return filenames.forEach((filename, fileIdx) => {
	    	if (filterReg && !filename.match(filterReg)) return;

	      	return fs.readFile(`${dirname}/${filename}`, 'utf-8', (err, content) => {
	        	if (err) {
	          		onError(err);
	          		return;
	        	}
	        	return onFileContent(filename, content, filenames.length - 1 === fileIdx);
	    	});
    	});
  	});
}

const initRead = (path) => {
	if (!fs.existsSync(path)) {
	    error = 'Path not exist';
	    console.log(error);
	    return readUser();
	}

	return readFiles(path, 
		(filename, content, last) => {
			return parseFile(filename, content, last);
		},
		(err) => {
			console.log('Fail while reading file', err);
		});
} 

const readUser = () => {
	const rl = readline.createInterface({
	  	input: process.stdin,
	  	output: process.stdout
	});

	return rl.question('Path root for trads ', (answer) => {
		rl.close();
	  
	  	return initRead(answer);
	});
}

if (config.source.useDefault && config.source.default) {
	initRead(config.source.default);
} else {
	readUser();
}
