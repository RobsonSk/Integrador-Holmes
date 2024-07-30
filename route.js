const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
const oracledb = require("oracledb");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

dotenv.config();

const {
  NOME_APP,
  URL_DESPESAS,
  URL_UPLOAD,
  URL_FATURAMENTO,
  URL_PGTORH,
  URL_USUARIO,
  USAGE_ID_DESPESA,
  USAGE_ID_PGTORH,
  API_KEY_DESPESAS: TOKEN_DESPESAS,
  API_KEY_FATURAMENTO: TOKEN_FATURAMENTO,
  API_KEY_DESPESASRH: TOKEN_DESPESASRH,
  ORACLE_USER,
  ORACLE_PASSWORD,
  ORACLE_CONNECTION_STRING,
  LIB_DIR,
  QUERY_DESPESAS,
  QUERY_FATURAMENTO,
  QUERY_PGTORH,
  USUARIO_INTEGRACAO
} = process.env;

const logFilePath = path.join(__dirname, "error.log");
let isLocked = false;

const getConnection = async () => {
  try {
    oracledb.initOracleClient({ libDir: LIB_DIR });
    return await oracledb.getConnection({
      user: ORACLE_USER,
      password: ORACLE_PASSWORD,
      connectString: ORACLE_CONNECTION_STRING,
    });
  } catch (err) {
    console.error("Falha de conexão com o BD:", err.message);
    throw err;
  }
};

const logErrorToFile = (errorMsg) => {
  fs.appendFile(logFilePath, errorMsg, (err) => {
    if (err) {
      console.error("Falha ao logar o erro:", err.message);
    }
  });
};

const fetchResponsavelId = async (responsavel, token) => {
  try {
    const responsavelPayload = {
      filters: [
        { field: "active", type: "istrue" },
        { field: "name", type: "match_phrase", value: responsavel },
      ],
      sort_by: ["name", "asc"],
    };
    const responsavelResponse = await axios.post(URL_USUARIO, responsavelPayload, {
      headers: {
        api_token: token,
        "Content-Type": "application/json",
      },
    });
    return responsavelResponse.data.users[0]?.id || USUARIO_INTEGRACAO;
  } catch (error) {
    console.error("Erro ao consultar o responsavel ID:", error.message);
    return USUARIO_INTEGRACAO;
  }
};

const processApiRequest = async (payload, url, token, connection, updateQueryParams) => {
  try {
    const response = await axios.post(url, payload, {
      headers: {
        api_token: token,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200) {
      const { up_CNPJ, up_NUMERO_NOTA_FISCAL, up_VALOR, up_REQUISICAO } = updateQueryParams;
      const updateQuery = `UPDATE AD_DESP_HOLMES SET STATUS_LANC_HOLMES = 'S', REQUISICAO = '${up_REQUISICAO}', DATA_LANC_HOLMES = SYSDATE WHERE STATUS_LANC_HOLMES = 'N' AND CNPJ_CPF = '${up_CNPJ}' AND NUMERO_NOTA_FISCAL = ${up_NUMERO_NOTA_FISCAL} AND VALOR = ${up_VALOR}`;
      await connection.execute(updateQuery);
      await connection.commit();
      return response.data;
    } else {
      const errorMsg = `Erro ao enviar: ${response.status}, Status text: ${response.statusText}\n`;
      console.error(errorMsg);
      logErrorToFile(errorMsg);
      return null;
    }
  } catch (error) {
    console.error("Erro ao enviar:", error.message);
    throw error;
  }
};

const processRequestData = async (jsonData, jsonTemplate, token, url, usageId) => {
  const updatedJsonData = [];
  for (const data of jsonData) {
    const targetJson = JSON.parse(JSON.stringify(jsonTemplate));
    targetJson.property_values.forEach((property) => {
      if (data.hasOwnProperty(property.value)) {
        property.value = data[property.value] || "";
      } else {
        console.log(`Não encontrada propriedade ${property.value}:`, data);
      }
    });

    if (data.pdf && usageId) {
      try {
        const pastaBoleto = data.pasta_boleto.replace(/\s/g, "");
        const filePath = path.join(pastaBoleto, data.pdf);
        const fileName = data.pdf;

        const fileData = await new Promise((resolve, reject) => {
          fs.readFile(filePath, (err, data) => {
            if (err) {
              console.error("Error reading file:", err);
              reject(err);
            } else {
              const base64_content = Buffer.from(data).toString("base64");
              resolve(`{\n    "index": false,\n    "document": {\n"filename": "${fileName}",\n "base64_file": "${base64_content}" \n    }\n}`);
            }
          });
        });

        const config = {
          method: "post",
          maxBodyLength: Infinity,
          url: url,
          headers: {
            api_token: token,
            "Content-Type": "application/json",
          },
          data: fileData,
        };

        const response = await axios.request(config);

        targetJson.documents = [{ usage_id: usageId, file_id: response.data.id }];
		
      } catch (error) {
        console.error("Error uploading PDF:", error.message);
      }
    }

    const responsavelId = await fetchResponsavelId(data.responsavel, token);
    targetJson.property_values.forEach((property) => {
      if (property.name === "responsavel") {
        property.value = responsavelId;
      }
    });

    updatedJsonData.push(targetJson);
  }
  return updatedJsonData;
};

router.get("/", (_req, res) => {
  res.render("index", { title: NOME_APP });
});

router.get("/despesas", (_req, res) => {
  res.render("despesas", { title: NOME_APP, message: null, parsedResponses: null });
});

router.post("/despesas", async (_req, res) => {
  if (isLocked) {
    return res.status(429).json({ message: "Processo em andamento" });
  }
  isLocked = true;

  let connection;
  try {
    connection = await getConnection();
    const result_query = await connection.execute(QUERY_DESPESAS);
    const jsonData = result_query.rows.map((row) => {
      const jsonObj = {};
      result_query.metaData.forEach((meta, index) => {
        jsonObj[meta.name.toLowerCase()] = row[index];
      });
      return jsonObj;
    });

    const jsonTemplateDespesas = require("./jsonTemplateDespesas.js");
    const updatedJsonData = await processRequestData(jsonData, jsonTemplateDespesas, TOKEN_DESPESAS, URL_UPLOAD, USAGE_ID_DESPESA);

    const apiResponses = [];
    for (const payload of updatedJsonData) {
      const updateQueryParams = {
        up_CNPJ: payload.property_values.find((p) => p.name === "CNPJ")?.value,
        up_NUMERO_NOTA_FISCAL: payload.property_values.find((p) => p.name === "Número da Nota")?.value,
        up_VALOR: parseFloat(payload.property_values.find((p) => p.name === "Valor")?.value || 0).toFixed(2),
        up_REQUISICAO: payload.property_values.find((p) => p.name === "Número da Requisição")?.value,
      };
      const response = await processApiRequest(payload, URL_DESPESAS, TOKEN_DESPESAS, connection, updateQueryParams);
      if (response) {
        apiResponses.push(response);
      }
    }

    res.json({ title: NOME_APP, parsedResponses: apiResponses, message: "Envios concluidos" });
  } catch (err) {
    console.error(err.message);
    res.json({ title: NOME_APP, message: "Error" });
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

router.get("/faturamento", (_req, res) => {
  res.render("faturamento", { title: NOME_APP, message: null, parsedResponses: null });
});

router.post("/faturamento", async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result_query = await connection.execute(QUERY_FATURAMENTO);
    const jsonData = result_query.rows.map((row) => {
      const jsonObj = {};
      result_query.metaData.forEach((meta, index) => {
        jsonObj[meta.name.toLowerCase()] = row[index];
      });
      return jsonObj;
    });

    const jsonTemplateFaturamento = require("./jsonTemplateFaturamento.js");
    const updatedJsonData = await processRequestData(jsonData, jsonTemplateFaturamento, TOKEN_FATURAMENTO, URL_UPLOAD);

    const apiResponses = [];
    for (const payload of updatedJsonData) {
      const updateQueryParams = {
        up_CNPJ: payload.property_values.find((p) => p.name === "CNPJ")?.value,
        up_NUMERO_NOTA_FISCAL: payload.property_values.find((p) => p.name === "Número da Nota")?.value,
        up_VALOR: parseFloat(payload.property_values.find((p) => p.name === "Valor")?.value || 0).toFixed(2),
        up_REQUISICAO: payload.property_values.find((p) => p.name === "Número da Requisição")?.value,
      };
      const response = await processApiRequest(payload, URL_FATURAMENTO, TOKEN_FATURAMENTO, connection, updateQueryParams);
      if (response) {
        apiResponses.push(response);
      }
    }

    res.json({ title: NOME_APP, parsedResponses: apiResponses, message: "Envios concluidos" });
  } catch (err) {
    console.error(err.message);
    res.json({ title: NOME_APP, message: "Error" });
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

router.get("/pgtoRH", (_req, res) => {
  res.render("pgtoRH", { title: NOME_APP, message: null, parsedResponses: null });
});

router.post("/pgtoRH", async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result_query = await connection.execute(QUERY_PGTORH);
    const jsonData = result_query.rows.map((row) => {
      const jsonObj = {};
      result_query.metaData.forEach((meta, index) => {
        jsonObj[meta.name.toLowerCase()] = row[index];
      });
      return jsonObj;
    });

    const jsonTemplatePagamentoRH = require("./jsonTemplatePgtoRH.js");
    const updatedJsonData = await processRequestData(jsonData, jsonTemplatePagamentoRH, TOKEN_DESPESASRH, URL_UPLOAD, USAGE_ID_PGTORH);

    const apiResponses = [];
    for (const payload of updatedJsonData) {
      const updateQueryParams = {
        up_CNPJ: payload.property_values.find((p) => p.name === "CNPJ")?.value,
        up_NUMERO_NOTA_FISCAL: payload.property_values.find((p) => p.name === "Número da Nota")?.value,
        up_VALOR: parseFloat(payload.property_values.find((p) => p.name === "Valor")?.value || 0).toFixed(2),
        up_REQUISICAO: payload.property_values.find((p) => p.name === "Número da Requisição")?.value,
      };
      const response = await processApiRequest(payload, URL_PGTORH, TOKEN_DESPESASRH, connection, updateQueryParams);
      if (response) {
        apiResponses.push(response);
      }
    }

    res.json({ title: NOME_APP, parsedResponses: apiResponses, message: "Envios concluidos" });
  } catch (err) {
    console.error(err.message);
    res.json({ title: NOME_APP, message: "Error" });
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
