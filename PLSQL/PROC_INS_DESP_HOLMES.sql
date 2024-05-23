CREATE OR REPLACE PROCEDURE PROC_INS_DESP_HOLMES IS
  CURSOR c_data IS
    SELECT EMPRESA,
           REVENDA,
           NUMERO_NOTA_FISCAL,
           SERIE_NOTA_FISCAL,
           CONTADOR,
           TIPO_TRANSACAO
      FROM FAT_MOVIMENTO_CAPA
     WHERE DTA_ENTRADA_SAIDA = TRUNC(SYSDATE)
       AND TIPO_TRANSACAO IN
           ('D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09',
            'D10', 'D11', 'D12', 'D27');

  V_EMPRESA            FAT_MOVIMENTO_CAPA.EMPRESA%TYPE;
  V_REVENDA            FAT_MOVIMENTO_CAPA.REVENDA%TYPE;
  V_NUMERO_NOTA_FISCAL FAT_MOVIMENTO_CAPA.NUMERO_NOTA_FISCAL%TYPE;
  V_SERIE_NOTA_FISCAL  FAT_MOVIMENTO_CAPA.SERIE_NOTA_FISCAL%TYPE;
  V_CONTADOR           FAT_MOVIMENTO_CAPA.CONTADOR%TYPE;
  V_TIPO_TRANSACAO     FAT_MOVIMENTO_CAPA.TIPO_TRANSACAO%TYPE;
  V_COUNT              NUMBER;
  
  V_ESTABELECIMENTO    VARCHAR2(14);
  P_FORNECEDOR         VARCHAR2(70);
  P_CNPJ_CPF           VARCHAR2(17);
  P_DEPARTAMENTO       VARCHAR2(50);
  P_DATA_EMISSAO       DATE;
  P_DATA_VENCIMENTO    DATE;
  P_CHAVE_NFE          VARCHAR2(44);
  P_NOTA_ORIGEM        VARCHAR2(100);
  P_COND_PGTO          NUMBER(4);
  P_COND_PGTO_DESC     VARCHAR2(100);
  V_QTDE_PARC          NUMBER(2);
  P_VALOR              NUMBER(17, 2);
  P_OBSERVACAO         VARCHAR2(300);
  P_PDF                VARCHAR2(3000);
  P_PASTA_BOLETO       VARCHAR2(3000);
  v_code               VARCHAR2(10);
  v_errm               VARCHAR2(3000);
  
BEGIN
  OPEN c_data;
  LOOP
    FETCH c_data
      INTO V_EMPRESA, V_REVENDA, V_NUMERO_NOTA_FISCAL, V_SERIE_NOTA_FISCAL, V_CONTADOR, V_TIPO_TRANSACAO;
    EXIT WHEN c_data%NOTFOUND;
  
    BEGIN
    
      SELECT COUNT(*)
        INTO V_COUNT
        FROM AD_DESP_HOLMES
       WHERE EMPRESA = V_EMPRESA
         AND REVENDA = V_REVENDA
         AND NUMERO_NOTA_FISCAL = V_NUMERO_NOTA_FISCAL
         AND SERIE_NOTA_FISCAL = V_SERIE_NOTA_FISCAL
         AND CONTADOR = V_CONTADOR
         AND TIPO_TRANSACAO = V_TIPO_TRANSACAO;
    
      IF V_COUNT = 0 THEN
        SELECT FMC.EMPRESA,
               FMC.REVENDA,
               GR.CNPJ AS ESTABELECIMENTO,
               FMC.TIPO_TRANSACAO,
               FC.NOME AS FORNECEDOR,
               CASE
                 WHEN FC.FISJUR = 'J' THEN
                  (SELECT FPJ.CGC
                     FROM FAT_PESSOA_JURIDICA FPJ
                    WHERE FPJ.CLIENTE = FC.CLIENTE)
                 WHEN FC.FISJUR = 'F' THEN
                  (SELECT TO_CHAR(FPF.CPF)
                     FROM FAT_PESSOA_FISICA FPF
                    WHERE FPF.CLIENTE = FC.CLIENTE)
                 ELSE
                  NULL
               END AS CNPJ_CPF,
               FMC.DEPARTAMENTO,
               FMC.NUMERO_NOTA_FISCAL AS NUMERO_DA_NOTA,
               TRUNC(FMC.DTA_DOCUMENTO) AS DATA_EMISSAO,
               CASE
                 WHEN FMC.NFE_CHAVE_ACESSO IS NULL THEN
                  'SEM CHAVE/NFSE'
                 ELSE
                  FMC.NFE_CHAVE_ACESSO
               END AS CHAVE_NFE,
               'NOTA ORIGEM',
               FMDL.DESCRICAO AS OBSERVACAO,
               FMC.NOME_ARQ_DANFE AS PDF,
               'C:\Apollo\PDF\' || FMC.EMPRESA || ' - ' || FMC.REVENDA ||
               ' - ' || FMC.NUMERO_NOTA_FISCAL || ' - ' ||
               FMC.SERIE_NOTA_FISCAL || ' - ' || FMC.CONTADOR || ' - ' ||
               FMC.TIPO_TRANSACAO || ' - ' || FMC.CLIENTE || '' AS PASTA_BOLETO,
               FMC.SERIE_NOTA_FISCAL,
               FMC.CONTADOR
          INTO V_EMPRESA,
               V_REVENDA,
               V_ESTABELECIMENTO,
               V_TIPO_TRANSACAO,
               P_FORNECEDOR,
               P_CNPJ_CPF,
               P_DEPARTAMENTO,
               V_NUMERO_NOTA_FISCAL,
               P_DATA_EMISSAO,
               P_CHAVE_NFE,
               P_NOTA_ORIGEM,
               P_OBSERVACAO,
               P_PDF,
               P_PASTA_BOLETO,
               V_SERIE_NOTA_FISCAL,
               V_CONTADOR
          FROM FAT_MOVIMENTO_CAPA       FMC,
               FAT_CLIENTE              FC,
               FAT_MOVIMENTO_DESC_LIVRE FMDL,
               GER_DEPARTAMENTO         GD,
               GER_REVENDA              GR
         WHERE FMC.CLIENTE = FC.CLIENTE
           AND FMC.EMPRESA = GR.EMPRESA
           AND FMC.REVENDA = GR.REVENDA
           AND FMC.NUMERO_NOTA_FISCAL = FMDL.NUMERO_NOTA_FISCAL
           AND FMC.SERIE_NOTA_FISCAL = FMDL.SERIE_NOTA_FISCAL
           AND FMC.EMPRESA = FMDL.EMPRESA
           AND FMC.REVENDA = FMDL.REVENDA
           AND FMC.CONTADOR = FMDL.CONTADOR
           AND FMC.TIPO_TRANSACAO = FMDL.TIPO_TRANSACAO
           AND FMDL.ORDEM <= 1
           AND FMC.DEPARTAMENTO = GD.DEPARTAMENTO
           AND FMC.EMPRESA = GD.EMPRESA
           AND FMC.REVENDA = GD.REVENDA
           AND FMC.NUMERO_NOTA_FISCAL = V_NUMERO_NOTA_FISCAL
           AND FMC.EMPRESA = V_EMPRESA
           AND FMC.REVENDA = V_REVENDA
           AND FMC.SERIE_NOTA_FISCAL = V_SERIE_NOTA_FISCAL
           AND FMC.CONTADOR = V_CONTADOR
           AND FMC.TIPO_TRANSACAO = V_TIPO_TRANSACAO;
      
        SELECT SUM(F.VAL_TITULO)
          INTO P_VALOR
          FROM FIN_TITULO F, FAT_MOVIMENTO_CAPA FC
         WHERE F.EMPRESA = FC.EMPRESA
           AND F.REVENDA = FC.REVENDA
           AND F.CLIENTE = FC.CLIENTE
           AND F.TITULO = FC.NUMERO_NOTA_FISCAL
           AND F.OPERACAO = FC.OPERACAO
           AND F.FATOPERACAO = FC.FATOPERACAO
           AND F.EMPRESA = V_EMPRESA
           AND F.REVENDA = V_REVENDA
           AND F.TITULO = V_NUMERO_NOTA_FISCAL
           AND FC.SERIE_NOTA_FISCAL = V_SERIE_NOTA_FISCAL
           AND FC.CONTADOR = V_CONTADOR;
      
        SELECT COUNT(F.DUPLICATA)
          INTO V_QTDE_PARC
          FROM FIN_TITULO F, FAT_MOVIMENTO_CAPA FC
         WHERE F.EMPRESA = FC.EMPRESA
           AND F.REVENDA = FC.REVENDA
           AND F.CLIENTE = FC.CLIENTE
           AND F.TITULO = FC.NUMERO_NOTA_FISCAL
           AND F.OPERACAO = FC.OPERACAO
           AND F.FATOPERACAO = FC.FATOPERACAO
           AND F.EMPRESA = V_EMPRESA
           AND F.REVENDA = V_REVENDA
           AND F.TITULO = V_NUMERO_NOTA_FISCAL
           AND FC.SERIE_NOTA_FISCAL = V_SERIE_NOTA_FISCAL
           AND FC.CONTADOR = V_CONTADOR;
      
        SELECT F.CONDICAO, F.DTA_VENCIMENTO, FP.des_CONDICAO
          INTO P_COND_PGTO, P_DATA_VENCIMENTO, P_COND_PGTO_DESC
          FROM FIN_TITULO             F,
               FAT_MOVIMENTO_CAPA     FC,
               FAT_CONDICAO_PAGAMENTO FP
         WHERE F.EMPRESA = FC.EMPRESA
           AND F.REVENDA = FC.REVENDA
           AND F.CLIENTE = FC.CLIENTE
           AND F.TITULO = FC.NUMERO_NOTA_FISCAL
           AND F.OPERACAO = FC.OPERACAO
           AND F.FATOPERACAO = FC.FATOPERACAO
           AND F.EMPRESA = FP.EMPRESA
           AND F.CONDICAO = FP.CONDICAO
           AND F.EMPRESA = V_EMPRESA
           AND F.REVENDA = V_REVENDA
           AND F.TITULO = V_NUMERO_NOTA_FISCAL
           AND FC.SERIE_NOTA_FISCAL = V_SERIE_NOTA_FISCAL
           AND FC.CONTADOR = V_CONTADOR
           AND ROWNUM <= 1
         ORDER BY F.DUPLICATA;
      
        INSERT INTO AD_DESP_HOLMES
          (STATUS_LANC_HOLMES,
           EMPRESA,
           REVENDA,
           ESTABELECIMENTO,
           TIPO_TRANSACAO,
           FORNECEDOR,
           CNPJ_CPF,
           DEPARTAMENTO,
           NUMERO_NOTA_FISCAL,
           DATA_EMISSAO,
           DATA_VENCIMENTO,
           CHAVE_NFE,
           NOTA_ORIGEM,
           CONDICAO_PGTO,
           COND_PGTO_DESC,
           QTDE_PARC,
           VALOR,
           OBSERVACAO,
           PDF,
           PASTA_BOLETO,
           SERIE_NOTA_FISCAL,
           CONTADOR)
        VALUES
          ('N',
           V_EMPRESA,
           V_REVENDA,
           V_ESTABELECIMENTO,
           V_TIPO_TRANSACAO,
           P_FORNECEDOR,
           P_CNPJ_CPF,
           P_DEPARTAMENTO,
           V_NUMERO_NOTA_FISCAL,
           P_DATA_EMISSAO,
           P_DATA_VENCIMENTO,
           P_CHAVE_NFE,
           P_NOTA_ORIGEM,
           P_COND_PGTO,
           P_COND_PGTO_DESC,
           V_QTDE_PARC,
           P_VALOR,
           P_OBSERVACAO,
           P_PDF,
           P_PASTA_BOLETO,
           V_SERIE_NOTA_FISCAL,
           V_CONTADOR);
      
        COMMIT;
      END IF;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
      v_code := SQLCODE;
      v_errm := SUBSTR(SQLERRM, 1, 255);
        INSERT INTO AD_LOG_ERROR_HOLMES
          (EMPRESA,
           REVENDA,
           NUMERO_NOTA_FISCAL,
           SERIE_NOTA_FISCAL,
           CONTADOR,
           TIPO_TRANSACAO,
           ERROR,
           DATA_HORA)
        VALUES
          (V_EMPRESA,
           V_REVENDA,
           V_NUMERO_NOTA_FISCAL,
           V_SERIE_NOTA_FISCAL,
           V_CONTADOR,
           V_TIPO_TRANSACAO,
           v_code || ':' || v_errm,
           SYSDATE);
      WHEN OTHERS THEN
       INSERT INTO AD_LOG_ERROR_HOLMES
        (EMPRESA,
         REVENDA,
         NUMERO_NOTA_FISCAL,
         SERIE_NOTA_FISCAL,
         CONTADOR,
         TIPO_TRANSACAO,
         ERROR,
         DATA_HORA) VALUES(V_EMPRESA,
                           V_REVENDA,
                           V_NUMERO_NOTA_FISCAL,
                           V_SERIE_NOTA_FISCAL,
                           V_CONTADOR,
                           V_TIPO_TRANSACAO,
                           v_code || ':' || v_errm,
                           SYSDATE);
    END;
  END LOOP;
  CLOSE c_data;
END PROC_INS_DESP_HOLMES;
