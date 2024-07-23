const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
const oracledb = require("oracledb")
dotenv.config();
const axios = require("axios")
const fs = require('fs');

const nomeApp = process.env.NOME_APP
const URL_DESPESAS = process.env.URL_DESPESAS
const URL_TASKID_BASE = process.env.URL_PROCESSOS
const URL_UPLOAD = process.env.URL_DOCUMENTOS
const URL_FATURAMENTO = process.env.URL_FATURAMENTO
const URL_PGTORH = process.env.URL_PGTORH
const URL_USUARIO = process.env.URL_USUARIO
const USAGE_ID_DESPESA = process.env.USAGE_ID_DESPESA
const USAGE_ID_PGTORH = process.env.USAGE_ID_PGTORH
const TOKEN_DESPESAS = process.env.API_KEY_DESPESAS
const TOKEN_FATURAMENTO = process.env.API_KEY_FATURAMENTO
const TOKEN_DESPESASRH = process.env.API_KEY_DESPESASRH

async function getTask(id) {
    if (!id) {
        return;
    }
    const URL_TASKID = `${URL_TASKID_BASE}${id}`;
    const PAYLOAD_DATA = '';
    try {
        const response = await axios.get(URL_TASKID, {
            headers: {
                'api_token': TOKEN_DESPESAS,
                'Content-Type': 'application/json'
            }, data: PAYLOAD_DATA
        });
        return { id, status: 'Successo', data: response.data };
    } catch (error) {
        return { id, status: 'Erro', error: error.message };
    }
}

router.get('/', (_req, res) => {
    res.render('index', { title: nomeApp });
});

router.get('/despesas', async (_req, res) => {
    res.render("despesas", { title: nomeApp, message: null, parsedResponses: null });
});

let isLocked = false;

router.post('/despesas', async (_req, res) => {
    if (isLocked) {
        return res.status(429).json({ message: 'Processo em andamento' });
    }
    isLocked = true;

    let connection;
    try {
        oracledb.initOracleClient({
            libDir: process.env.LIB_DIR
        });

        const connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectString: process.env.ORACLE_CONNECTION_STRING,
        });
        const query = process.env.QUERY_DESPESAS;
        const result_query = await connection.execute(query);
        const result_query_rows = result_query.rows;
        const jsonData = result_query_rows.map(row => {
            const jsonObj = {};
            result_query.metaData.forEach((meta, index) => {
                jsonObj[meta.name.toLowerCase()] = row[index];
            });
            return jsonObj;
        });

        const jsonTemplateDespesas = require('./jsonTemplateDespesas.js');

        const updatedJsonData = [];
        for (const data of jsonData) {
            const targetJson = JSON.parse(JSON.stringify(jsonTemplateDespesas));
            targetJson.property_values.forEach(property => {
                if (data.hasOwnProperty(property.value)) {
                    property.value = data[property.value] || "";
                } else {
                    console.log(`Propriedade: ${property.value} não encontrada:`, data);
                }
            });

            if (data.pdf) {
                try {
                    const pastaBoleto = data.pasta_boleto.replace(/\s/g, '');
                    const filePath = (pastaBoleto + '\\' + data.pdf);
                    const fileName = data.pdf;

                    try {
                        const file = filePath;
                        const fileData = await new Promise((resolve, reject) => {
                            fs.readFile(file, (err, data) => {
                                if (err) {
                                    console.error('Erro ao tentar ler arquivo:', err);
                                    reject(err);
                                } else {
                                    const base64_content = Buffer.from(data).toString('base64');
                                    resolve(`{\n    "index": false,\n    "document": {\n"filename": "${fileName}",\n "base64_file": "${base64_content}" \n    }\n}`);
                                }
                            });
                        });

                        const config = {
                            method: 'post',
                            maxBodyLength: Infinity,
                            url: URL_UPLOAD,
                            headers: {
                                'api_token': TOKEN_DESPESAS,
                                'Content-Type': 'application/json',
                            },
                            data: fileData
                        };

                        const response = await axios.request(config);
                        const pdfId = response.data.id;
                        targetJson.documents = [{ "usage_id": USAGE_ID_DESPESA, "file_id": pdfId }];
                    } catch (err) {
                        console.error(err.message);
                    }



                } catch (error) {
                    console.error('Erro ao enviar PDF:', error.message);
                }
            }
            const responsavel = data.responsavel;

            const responsavelPayload = {
                filters: [
                    {
                        field: "active",
                        type: "istrue"
                    },
                    {
                        field: "name",
                        type: "match_phrase",
                        value: responsavel,
                        nested: false
                    }
                ],
                sort_by: [
                    "name",
                    "asc"
                ]
            };

            const responsavelConfig = {
                method: 'post',
                url: URL_USUARIO,
                headers: {
                    'api_token': TOKEN_DESPESAS,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(responsavelPayload)
            };

            let responsavelId;
            try {
                const responsavelResponse = await axios.request(responsavelConfig);
                responsavelId = responsavelResponse.data.users[0]?.id || process.env.USUARIO_INTEGRACAO;
            } catch (error) {
                console.error("Erro ao pesquisar usuario responsável:", error.message);
                responsavelId = process.env.USUARIO_INTEGRACAO;
            }

            if (typeof responsavelId === "undefined") {
                responsavelId = process.env.USUARIO_INTEGRACAO;
            }

            targetJson.property_values.forEach(property => {
                if (property.name === "responsavel") {
                    property.value = responsavelId;
                }
            });
            updatedJsonData.push(targetJson);
        }

        const apiResponses = [];
        for (const payload of updatedJsonData) {
            try {
                let up_CNPJ;
                let up_NUMERO_NOTA_FISCAL;
                let up_VALOR;
                let up_REQUISICAO;

                for (const property of payload.property_values) {
                    if (property.name === 'CNPJ') {
                        up_CNPJ = property.value;
                    } else if (property.name === 'Número da Nota') {
                        up_NUMERO_NOTA_FISCAL = property.value;
                    } else if (property.name === 'Valor') {
                        up_VALOR = parseFloat(property.value).toFixed(2);
                    } else if (property.name === 'Número da Requisição') {
                        up_REQUISICAO = property.value;
                    }
                }

                const response = await axios.post(URL_DESPESAS, payload, {
                    headers: {
                        'api_token': TOKEN_DESPESAS,
                        'Content-Type': 'application/json'
                    }
                });

                apiResponses.push(response.data);

                const updateQuery = `UPDATE AD_DESP_HOLMES SET STATUS_LANC_HOLMES = 'S', REQUISICAO = '${up_REQUISICAO}', DATA_LANC_HOLMES = SYSDATE WHERE STATUS_LANC_HOLMES = 'N' AND CNPJ_CPF = '${up_CNPJ}' AND NUMERO_NOTA_FISCAL = ${up_NUMERO_NOTA_FISCAL} AND VALOR = ${up_VALOR}`;
                const result = await connection.execute(updateQuery);
                await connection.commit();
            } catch (error) {
                console.error('Erro ao enviar despesa:', error.message);
                throw error;
            }
        }

        const parsedResponses = apiResponses.map(response => ({
            id: response.id,
            createdAt: response.created_at,
            identifier: response.identifier,
            fluxo: response.name,
            status: response.status
        }));

        const taskPromises = parsedResponses.map(parsedResponse => getTask(parsedResponse.id));
        const taskResponses = await Promise.all(taskPromises);
        //res.render("despesas", { title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" }); 
        res.json({ title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" });

    } catch (err) {
        console.error(err.message);
        res.render("despesas", { title: nomeApp, message: "Error" });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err.message);
            }
        }
        isLocked = false;
    }
});

router.get('/faturamento', async (_req, res) => {
    res.render("faturamento", { title: nomeApp, message: null, parsedResponses: null });
});

router.post('/faturamento', async (_req, res) => {
    let connection;
    try {
        oracledb.initOracleClient({
            libDir: process.env.LIB_DIR
        });

        const connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectString: process.env.ORACLE_CONNECTION_STRING,
        });
        const query = process.env.QUERY_FATURAMENTO;
        const result_query = await connection.execute(query);
        const result_query_rows = result_query.rows;
        const jsonData = result_query_rows.map(row => {
            const jsonObj = {};
            result_query.metaData.forEach((meta, index) => {
                jsonObj[meta.name.toLowerCase()] = row[index];
            });
            return jsonObj;
        });

        const jsonTemplateFaturamento = require('./jsonTemplateFaturamento.js');

        const updatedJsonData = [];
        for (const data of jsonData) {
            const targetJson = JSON.parse(JSON.stringify(jsonTemplateFaturamento));
            targetJson.property_values.forEach(property => {
                if (data.hasOwnProperty(property.value)) {
                    property.value = data[property.value] || "";
                } else {
                    console.log(`Propriedade ${property.value} não encontrada:`, data);
                }
            });

            const responsavel = data.responsavel;

            const responsavelPayload = {
                filters: [
                    {
                        field: "active",
                        type: "istrue"
                    },
                    {
                        field: "name",
                        type: "match_phrase",
                        value: responsavel,
                        nested: false
                    }
                ],
                sort_by: [
                    "name",
                    "asc"
                ]
            };

            const responsavelConfig = {
                method: 'post',
                url: URL_USUARIO,
                headers: {
                    'api_token': TOKEN_FATURAMENTO,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(responsavelPayload)
            };

            let responsavelId;
            try {
                const responsavelResponse = await axios.request(responsavelConfig);
                responsavelId = responsavelResponse.data.users[0]?.id || process.env.USUARIO_INTEGRACAO;
            } catch (error) {
                console.error("Error fetching responsavel ID:", error.message);
                responsavelId = process.env.USUARIO_INTEGRACAO;
            }

            if (typeof responsavelId === "undefined") {
                responsavelId = process.env.USUARIO_INTEGRACAO;
            }

            targetJson.property_values.forEach(property => {
                if (property.name === "responsavel") {
                    property.value = responsavelId;
                }
            });

            updatedJsonData.push(targetJson);

        }

        const apiResponses = [];
        for (const payload of updatedJsonData) {
            try {
                let up_CNPJ;
                let up_NRO_PROPOSTA;
                let up_CLIENTE;

                for (const property of payload.property_values) {
                    if (property.name === 'CNPJ_CPF') {
                        up_CNPJ = property.value.trim() === '' ? null : property.value;
                    } else if (property.name === 'NRO_PROPOSTA') {
                        up_NRO_PROPOSTA = property.value;
                    } else if (property.name === 'CLIENTE') {
                        up_CLIENTE = property.value;
                    }
                }

                const response = await axios.post(URL_FATURAMENTO, payload, {
                    headers: {
                        'api_token': TOKEN_FATURAMENTO,
                        'Content-Type': 'application/json'
                    }
                });

                apiResponses.push(response.data);

                const updateQuery = `UPDATE AD_FAT_HOLMES SET STATUS_LANC_HOLMES = 'S', REQUISICAO = TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS') || PROPOSTA , DATA_LANC_HOLMES = SYSDATE WHERE STATUS_LANC_HOLMES = 'N' AND CNPJ_CPF = '${up_CNPJ}' AND PROPOSTA = '${up_NRO_PROPOSTA}' AND NOME_CLIENTE = '${up_CLIENTE}'`;
                const result = await connection.execute(updateQuery);
                await connection.commit();
            } catch (error) {
                console.error('Erro ao enviar faturamento:', error.message);
                throw error;
            }
        }

        const parsedResponses = apiResponses.map(response => ({
            id: response.id,
            createdAt: response.created_at,
            identifier: response.identifier,
            fluxo: response.name,
            status: response.status
        }));

        const taskPromises = parsedResponses.map(parsedResponse => getTask(parsedResponse.id));
        const taskResponses = await Promise.all(taskPromises);
        // res.render("faturamento", { title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" });
        res.json({ title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" });

    } catch (err) {
        console.error(err.message);
        res.render("faturamento", { title: nomeApp, message: "Error" });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err.message);
            }
        }
    }
});


router.get('/pgtorh', async (_req, res) => {
    res.render("pgtorh", { title: nomeApp, message: null, parsedResponses: null });
});

router.post('/pgtorh', async (_req, res) => {
    let connection;
    try {
        oracledb.initOracleClient({
            libDir: process.env.LIB_DIR
        });

        const connection = await oracledb.getConnection({
            user: process.env.ORACLE_USER,
            password: process.env.ORACLE_PASSWORD,
            connectString: process.env.ORACLE_CONNECTION_STRING,
        });
        const query = process.env.QUERY_PGTORH;
        const result_query = await connection.execute(query);
        const result_query_rows = result_query.rows;
        const jsonData = result_query_rows.map(row => {
            const jsonObj = {};
            result_query.metaData.forEach((meta, index) => {
                jsonObj[meta.name.toLowerCase()] = row[index];
            });
            return jsonObj;
        });

        const jsonTemplatePgtoRH = require('./jsonTemplatePgtoRH.js');

        const updatedJsonData = [];
        for (const data of jsonData) {
            const targetJson = JSON.parse(JSON.stringify(jsonTemplatePgtoRH));
            targetJson.property_values.forEach(property => {
                if (data.hasOwnProperty(property.value)) {
                    property.value = data[property.value] || "";
                } else {
                    console.log(`Propriedade ${property.value} não encontrada:`, data);
                }
            });

            if (data.pdf) {
                try {
                    const pastaBoleto = data.pasta_boleto.replace(/\s/g, '');
                    const filePath = (pastaBoleto + '\\' + data.pdf);
                    const fileName = data.pdf;

                    try {

                        const file = filePath;
                        const data = await new Promise((resolve, reject) => {
                            fs.readFile(file, (err, data) => {
                                if (err) {
                                    console.error('Erro ao ler arquivo:', err);
                                    reject(err);
                                } else {
                                    const base64_content = Buffer.from(data).toString('base64');

                                    resolve(`{\n    "index": false,\n    "document": {\n"filename": "${fileName}",\n "base64_file": "${base64_content}" \n    }\n}`);
                                }
                            });
                        });


                        const config = {
                            method: 'post',
                            maxBodyLength: Infinity,
                            url: URL_UPLOAD,
                            headers: {
                                'api_token': TOKEN_DESPESASRH,
                                'Content-Type': 'application/json',
                            },
                            data: data
                        };

                        const response = await axios.request(config);
                        const pdfId = response.data.id;
                        targetJson.documents = [{ "usage_id": USAGE_ID_PGTORH, "file_id": pdfId }];
                    } catch (err) {
                        console.error(err.message);
                    }

                } catch (error) {
                    console.error('Erro ao enviar PDF:', error.message);
                }
            }
            const responsavel = data.responsavel;

            const responsavelPayload = {
                filters: [
                    {
                        field: "active",
                        type: "istrue"
                    },
                    {
                        field: "name",
                        type: "match_phrase",
                        value: responsavel,
                        nested: false
                    }
                ],
                sort_by: [
                    "name",
                    "asc"
                ]
            };

            const responsavelConfig = {
                method: 'post',
                url: URL_USUARIO,
                headers: {
                    'api_token': TOKEN_DESPESASRH,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(responsavelPayload)
            };

            let responsavelId;
            try {
                const responsavelResponse = await axios.request(responsavelConfig);
                responsavelId = responsavelResponse.data.users[0]?.id || process.env.USUARIO_INTEGRACAO;
            } catch (error) {
                console.error("Erro ao pesquisar usuario responsável:", error.message);
                responsavelId = process.env.USUARIO_INTEGRACAO;
            }

            if (typeof responsavelId === "undefined") {
                responsavelId = process.env.USUARIO_INTEGRACAO;
            }

            targetJson.property_values.forEach(property => {
                if (property.name === "responsavel") {
                    property.value = responsavelId;
                }
            });
            updatedJsonData.push(targetJson);
        }

        const apiResponses = [];
        for (const payload of updatedJsonData) {
            try {
                let up_CNPJ;
                let up_NUMERO_NOTA_FISCAL;
                let up_VALOR;
                let up_REQUISICAO;

                for (const property of payload.property_values) {
                    if (property.name === 'CNPJ') {
                        up_CNPJ = property.value;
                    } else if (property.name === 'Número da Nota') {
                        up_NUMERO_NOTA_FISCAL = property.value;
                    } else if (property.name === 'Valor') {
                        up_VALOR = parseFloat(property.value).toFixed(2);
                    } else if (property.name === 'Número da Requisição') {
                        up_REQUISICAO = property.value;
                    }
                }
                console.log(payload)
                const response = await axios.post(URL_PGTORH, payload, {
                    headers: {
                        'api_token': TOKEN_DESPESASRH,
                        'Content-Type': 'application/json'
                    }
                });

                apiResponses.push(response.data);

                const updateQuery = `UPDATE AD_DESP_HOLMES SET STATUS_LANC_HOLMES = 'S', REQUISICAO = '${up_REQUISICAO}', DATA_LANC_HOLMES = SYSDATE WHERE STATUS_LANC_HOLMES = 'N' AND CNPJ_CPF = '${up_CNPJ}' AND NUMERO_NOTA_FISCAL = ${up_NUMERO_NOTA_FISCAL} AND VALOR = ${up_VALOR}`;
                const result = await connection.execute(updateQuery);
                await connection.commit();
            } catch (error) {
                console.error('Erro ao enviar pagamento RH:', error.message);
                throw error;
            }
        }

        const parsedResponses = apiResponses.map(response => ({
            id: response.id,
            createdAt: response.created_at,
            identifier: response.identifier,
            fluxo: response.name,
            status: response.status
        }));

        const taskPromises = parsedResponses.map(parsedResponse => getTask(parsedResponse.id));
        const taskResponses = await Promise.all(taskPromises);
        //res.render("pgtorh", { title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" });
        res.json({ title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" });

    } catch (err) {
        console.error(err.message);
        res.render("pgtorh", { title: nomeApp, message: "Error" });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err.message);
            }
        }
    }
});

module.exports = router;