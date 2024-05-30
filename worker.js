const fs = require('fs');
const readline = require('readline');
const { parentPort, workerData } = require('worker_threads');

async function txtToJson(filePath, outputPath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const writeStream = fs.createWriteStream(outputPath);
    writeStream.write('[');

    let headers;
    let isFirstLine = true;

    for await (const line of rl) {
        if (!headers) {
            headers = line.split(',');
        } else {
            const values = line.split(',');
            const jsonObject = {};
            headers.forEach((header, index) => {
                jsonObject[header.trim()] = values[index] ? values[index].trim() : null;
            });

            if (!isFirstLine) {
                writeStream.write(',');
            } else {
                isFirstLine = false;
            }

            writeStream.write(JSON.stringify(jsonObject));
        }
    }

    writeStream.write(']');
    writeStream.end();

    writeStream.on('finish', () => {
        parentPort.postMessage('done');
    });
}

txtToJson(workerData.filePath, workerData.outputPath).catch(err => {
    console.error('Erro ao converter o arquivo:', err);
    process.exit(1);
});
