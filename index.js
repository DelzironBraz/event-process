const express = require('express');
const path = require('path');
const fs = require('fs');
const { Worker, isMainThread, workerData } = require('worker_threads');
const { Transform } = require('stream');

const app = express();
const port = 3000;

app.get('/convert', (req, res) => {
    const txtFilePath = path.join(__dirname, 'data', 'example.txt'); // Altere para o caminho do seu arquivo
    const outputFilePath = path.join(__dirname, 'output.json');

    if (fs.existsSync(txtFilePath)) {
        const worker = new Worker(path.join(__dirname, 'worker.js'), {
            workerData: { filePath: txtFilePath, outputPath: outputFilePath }
        });

        worker.on('message', (message) => {
            if (message === 'done') {
                res.download(outputFilePath, 'output.json');
            }
        });

        worker.on('error', (err) => {
            console.error('Erro no worker:', err);
            res.status(500).send('Erro ao converter o arquivo');
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker finalizou com código ${code}`);
                res.status(500).send('Erro ao converter o arquivo');
            }
        });
    } else {
        res.status(404).send('Arquivo não encontrado');
    }
});

app.get('/read-json', (req, res) => {
    const jsonFilePath = path.join(__dirname, 'output.json');

    if (fs.existsSync(jsonFilePath)) {
        const readStream = fs.createReadStream(jsonFilePath, { encoding: 'utf8' });
        let buffer = '';
        let count = 0;
        let started = false;

        const transformStream = new Transform({
            transform(chunk, encoding, callback) {
                buffer += chunk;
                let boundary = buffer.indexOf('},{');

                while (boundary !== -1 && count < 200) {
                    const objectString = buffer.slice(0, boundary + 1) + '}';
                    buffer = buffer.slice(boundary + 2);

                    if (!started) {
                        this.push('[' + objectString);
                        started = true;
                    } else {
                        this.push(',' + objectString);
                    }

                    count++;
                    boundary = buffer.indexOf('},{');
                }

                if (count >= 200) {
                    this.push(']');
                    this.end();
                }

                callback();
            },
            flush(callback) {
                if (count < 200) {
                    if (started) {
                        this.push(buffer + ']');
                    } else {
                        this.push('[' + buffer + ']');
                    }
                }
                callback();
            }
        });

        res.setHeader('Content-Type', 'application/json');
        readStream.pipe(transformStream).pipe(res);
    } else {
        res.status(404).send('Arquivo JSON não encontrado');
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
