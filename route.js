const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
const oracledb = require("oracledb")
dotenv.config();
const axios = require("axios")
const fs = require('fs');

const nomeApp = process.env.NOME_APP
const URL_PROCESSOS = process.env.URL_PROCESSOS
const URL_CANCELAMENTO_BASE = process.env.URL_PROCESSOS
const URL_DESPESAS = process.env.URL_DESPESAS
const URL_TASKID_BASE = process.env.URL_PROCESSOS
const URL_UPLOAD = process.env.URL_DOCUMENTOS
const URL_FATURAMENTO = process.env.URL_FATURAMENTO
const USAGE_ID = process.env.USAGE_ID_DESPESA
const PAYLOAD_CANCELAMENTO = process.env.PAYLOAD_CANCELAMENTO
const PAYLOAD_PROC = process.env.PAYLOAD_PROC
const token = process.env.API_KEY

router.get('/', (_req, res) => {
    res.render('index', { title: nomeApp });
});

router.get('/despesas', async (_req, res) => {
    res.render("despesas", { title: nomeApp, message: null, parsedResponses: null });
});

router.post('/despesas', async (_req, res) => {
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
                    console.log(`Propriedades ${property.value} não encontrada nos dados:`, data);
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
                                    console.error('Erro ao tentar ler o arquivo:', err);
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
                                'api_token': token,
                                'Content-Type': 'application/json',
                            },
                            data: data
                        };
  
                        const response = await axios.request(config);
                        const pdfId = response.data.id;
                        targetJson.documents = [{"usage_id": USAGE_ID, "file_id": pdfId}];
                    } catch (err) {
                        console.error(err.message);
                    }

                } catch (error) {
                    console.error('Erro ao tentar ler file_id do Holmes:', error.message);
                }
            }

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
                        'api_token': token,
                        'Content-Type': 'application/json'
                    }
                });

                apiResponses.push(response.data);

                const updateQuery = `UPDATE AD_DESP_HOLMES SET STATUS_LANC_HOLMES = 'S', REQUISICAO = ${up_REQUISICAO}, DATA_LANC_HOLMES = SYSDATE WHERE STATUS_LANC_HOLMES = 'N' AND CNPJ_CPF = ${up_CNPJ} AND NUMERO_NOTA_FISCAL = ${up_NUMERO_NOTA_FISCAL} AND VALOR = ${up_VALOR}`;
                console.log("Executando Update:", updateQuery);
                const result = await connection.execute(updateQuery);
                console.log("Update:", result);
                await connection.commit();
            } catch (error) {
                console.error('Erro ao enviar para o Holmes:', error.message);
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
        //res.render("despesas", { title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" }); //Para verificação manual
        res.json({title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos"});
        //é realizada a busca das tasks porem não são utilizadas no momento, mas pode ser feito novas consultas para processa-las
    } catch (err) {
        console.error(err.message);
        //res.render("despesas", { title: nomeApp, message: "Erro" }); //Para verificação manual
        res.json({title: nomeApp, parsedResponses: parsedResponses, message: err.message});
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

router.get('/cancelamento', async (_req, res) => {
    res.render("cancelamento", { title: nomeApp, message: null, responses: null });
});

router.post('/cancelamento', async (_req, res) => {
    try {
        const response = await axios.post(URL_PROCESSOS, PAYLOAD_PROC, {
            headers: {
                'api_token': token,
                'Content-Type': 'application/json'
            }
        });
        const processIds = response.data.processes
            .filter(process => process.status === 'opened')
            .map(process => process.id);

        const cancellationPromises = processIds.map(id => {
            if (id) {
                return cancelProcess(id);
            }
        }).filter(promise => promise);
        const cancellationResponses = await Promise.all(cancellationPromises);

        res.render("cancelamento", { title: nomeApp, responses: cancellationResponses, message: "Processos cancelados" });

    } catch (error) {
        res.status(500).json({ Error: "Falha para carregar as IDs de processos" });
    }
});

router.get('/faturamento', async (_req, res) => {
    res.render("faturamento",  { title: nomeApp, message: null, parsedResponses: null });
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
                    console.log(`Propriedades ${property.value} não encontrada nos dados:`, data);
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
                        up_CNPJ = property.value;
                    } else if (property.name === 'NRO_PROPOSTA') {
                        up_NRO_PROPOSTA = property.value;
                    } else if (property.name === 'CLIENTE') {
                        up_CLIENTE = property.value;
                    } 
                }

                const response = await axios.post(URL_FATURAMENTO, payload, {
                    headers: {
                        'api_token': token,
                        'Content-Type': 'application/json'
                    }
                });

                apiResponses.push(response.data);

                const updateQuery = `UPDATE AD_FAT_HOLMES SET STATUS_LANC_HOLMES = 'S', REQUISICAO = TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS') || PROPOSTA , DATA_LANC_HOLMES = SYSDATE WHERE STATUS_LANC_HOLMES = 'N' AND CNPJ_CPF = ${up_CNPJ} AND PROPOSTA = ${up_NRO_PROPOSTA} AND NOME_CLIENTE = '${up_CLIENTE}'`;
                console.log("Executando Update:", updateQuery);
                const result = await connection.execute(updateQuery);
                console.log("Update:", result);
                await connection.commit();
            } catch (error) {
                console.error('Erro ao enviar para o Holmes:', error.message);
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
        //res.render("despesas", { title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos" }); //Para verificação manual
        res.json({title: nomeApp, parsedResponses: parsedResponses, message: "Envios concluidos"});
        //é realizada a busca das tasks porem não são utilizadas no momento, mas pode ser feito novas consultas para processa-las
    } catch (err) {
        console.error(err.message);
        //res.render("despesas", { title: nomeApp, message: "Erro" }); //Para verificação manual
        res.json({title: nomeApp, parsedResponses: parsedResponses, message: err.message});
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
async function cancelProcess(id) {
    if (!id) {
        return;
    }
    const URL_CANCELAMENTO = `${URL_CANCELAMENTO_BASE}${id}/cancel`;

    try {
        const response = await axios.put(URL_CANCELAMENTO, PAYLOAD_CANCELAMENTO, {
            headers: {
                'api_token': token,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Cancelado processo ID: ${id}`);
        return { id, status: 'Sucesso', data: response.data };
    } catch (error) {
        console.error(`Erro ao cancelar processo ID: ${id}`, error);
        return { id, status: 'Erro', error: error.message };
    }
}

async function getTask(id) {
    if (!id) {
        return;
    }
    const URL_TASKID = `${URL_TASKID_BASE}${id}`;
    const PAYLOAD_DATA = '';
    try {
        const response = await axios.get(URL_TASKID, {
            headers: {
                'api_token': token,
                'Content-Type': 'application/json'
            }, data: PAYLOAD_DATA
        });
        return { id, status: 'Successo', data: response.data };
    } catch (error) {
        return { id, status: 'Erro', error: error.message };
    }
}

module.exports = router;