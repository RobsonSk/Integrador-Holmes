
router.get('/upload', async (_req, res) => {
    res.render("upload", { title: nomeApp, message: null, responses: null });
});


router.post('/upload', async (req, res) => {
    try {
        const filePath = '1.pdf';
        const data = await new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    console.error('Error reading file:', err);
                    reject(err);
                } else {
                    const base64_content = Buffer.from(data).toString('base64');
                    resolve(`{\n    "index": false,\n    "document": {\n"filename": "teste de upload.pdf",\n "base64_file": "${base64_content}" \n    }\n}`);
                }
            });
        });

        const apiResponses = [];

        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://app-api.holmesdoc.io/v1/documents',
            headers: {
                'api_token': token,
                'Content-Type': 'application/json',
            },
            data: data
        };

        const response = await axios.request(config);
        apiResponses.push(response.data);


        res.render("upload", { title: nomeApp, message: "Processo enviado", responses: apiResponses });
    } catch (err) {
        console.error(err.headers);
        res.render("upload", { title: nomeApp, message: "Error", responses: null });
    }
});



router.get('/upload_file', async (_req, res) => {
    res.render("upload_file", { title: nomeApp, message: null, responses: null });
});

router.post('/upload_file', async (req, res) => {
    try {
        const filePath = '1.pdf';

        const fileData = fs.createReadStream(filePath);
        let data = new FormData();
        data.append('index', 'false');
        data.append('file', fileData);

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://app-api.holmesdoc.io/v1/documents',
            headers: {
                'api_token': token,
                ...data.getHeaders()
            },
            data: data
        };


        const response = await axios.request(config);
        console.log(JSON.stringify(response.data));

        res.render("upload_file", { title: nomeApp, message: "Processo enviado", responses: [response.data], });
    } catch (err) {
        console.error(err);
        res.render("upload_file", { title: nomeApp, message: "Error", responses: null });
    }
});