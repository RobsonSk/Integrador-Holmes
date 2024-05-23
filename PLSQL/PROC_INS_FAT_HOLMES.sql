CREATE OR REPLACE PROCEDURE PROC_INS_FAT_HOLMES AS
  v_code NUMBER;
  v_errm VARCHAR2(255);

  v_empresa AD_FAT_HOLMES.EMPRESA%TYPE;
  v_revenda AD_FAT_HOLMES.REVENDA%TYPE;
  v_proposta AD_FAT_HOLMES.PROPOSTA%TYPE;
BEGIN
  FOR source_row IN (
    SELECT v.empresa,
           v.revenda,
           GR.CNPJ AS ESTABELECIMENTO,
           v.veiculo,
           fc.nome AS nome_cliente,
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
           END AS cnpj_cpf,
           CASE
             WHEN fc.e_mail_casa IS NOT NULL THEN
              fc.e_mail_casa
             ELSE
              fc.e_mail_trabalho
           END AS email,
           CASE
             WHEN FC.TELEFONE IS NOT NULL THEN
              FC.DDD_TELEFONE || FC.TELEFONE
             WHEN FC.CELULAR IS NOT NULL THEN
              FC.DDD_CELULAR || FC.CELULAR
             ELSE
              NULL
           END AS telefone,
           CASE
             WHEN FC.FISJUR = 'J' THEN 'PESSOA JURIDICA'
             WHEN FC.FISJUR = 'F' THEN 'PESSOA FISICA'
           END AS tipo_pessoa,
           V.PROPOSTA,
           CASE
             WHEN V.VEICULO IS NOT NULL THEN
              (SELECT CHASSI FROM VEI_VEICULO WHERE VEICULO = V.VEICULO)
             ELSE 'FROTISTA/VD'
           END AS chassi,
           CASE
             WHEN EXISTS (
                SELECT 1
                  FROM vei_pagamento VP
                 WHERE VP.proposta = V.proposta
                   AND VP.EMPRESA = V.EMPRESA
                   AND VP.REVENDA = V.REVENDA
                   AND VP.condicao = 140
             ) THEN 'S'
             ELSE 'N'
           END AS usado_troca,
           'FORMA PAGAMENTO' AS forma_pagamento,
           'CORTESIA' AS cortesia,
           DBMS_LOB.SUBSTR(V.OBSERVACAO, 4000, 1) AS observacao
      FROM vei_proposta v
      JOIN cac_contato c ON v.empresa = c.empresa AND v.revenda = c.revenda AND v.contato = c.contato
      JOIN fat_cliente fc ON c.cliente = fc.cliente
      JOIN GER_REVENDA GR ON v.empresa = gr.empresa and v.revenda = gr.revenda
     WHERE (v.SITUACAO = 0 OR v.SITUACAO = 1)
       AND v.dTA_EMISSAO >= SYSDATE - 30
  ) LOOP
    v_empresa := source_row.empresa;
    v_revenda := source_row.revenda;
    v_proposta := source_row.proposta;
    
    BEGIN
      MERGE INTO AD_FAT_HOLMES target
      USING (
        SELECT source_row.empresa AS empresa,
               source_row.revenda AS revenda,
               source_row.estabelecimento AS estabelecimento,
               source_row.veiculo AS veiculo,
               source_row.nome_cliente AS nome_cliente,
               source_row.cnpj_cpf AS cnpj_cpf,
               source_row.email AS email,
               source_row.telefone AS telefone,
               source_row.tipo_pessoa AS tipo_pessoa,
               source_row.proposta AS proposta,
               source_row.chassi AS chassi,
               source_row.usado_troca AS usado_troca,
               source_row.forma_pagamento AS forma_pagamento,
               source_row.cortesia AS cortesia,
               source_row.observacao AS observacao
        FROM DUAL
      ) source
      ON (target.empresa = source.empresa AND target.revenda = source.revenda AND target.proposta = source.proposta)
      WHEN NOT MATCHED THEN
        INSERT (
            STATUS_LANC_HOLMES,
            EMPRESA,
            REVENDA,
            ESTABELECIMENTO,
            VEICULO,
            NOME_CLIENTE,
            CNPJ_CPF,
            EMAIL,
            TELEFONE,
            TIPO_PESSOA,
            PROPOSTA,
            CHASSI,
            USADO_TROCA,
            FORMA_PAGAMENTO,
            CORTESIA,
            OBSERVACAO
        ) VALUES (
            'N',
            source.empresa,
            source.revenda,
            source.estabelecimento,
            source.veiculo,
            source.nome_cliente,
            source.cnpj_cpf,
            source.email,
            source.telefone,
            source.tipo_pessoa,
            source.proposta,
            source.chassi,
            source.usado_troca,
            source.forma_pagamento,
            source.cortesia,
           source.observacao
        );

    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_code := SQLCODE;
        v_errm := SUBSTR(SQLERRM, 1, 255);
        INSERT INTO AD_LOG_ERROR_HOLMES  (EMPRESA,
               REVENDA,
               NUMERO_NOTA_FISCAL,
               SERIE_NOTA_FISCAL,
               CONTADOR,
               TIPO_TRANSACAO,
               ERROR,
               DATA_HORA)
        VALUES  (v_empresa,
               v_revenda,
               v_proposta,
               null,
               null,
               null,
               v_code || ':' || v_errm,
               SYSDATE);
      WHEN OTHERS THEN
        v_code := SQLCODE;
        v_errm := SUBSTR(SQLERRM, 1, 255);
        INSERT INTO AD_LOG_ERROR_HOLMES  (EMPRESA,
               REVENDA,
               NUMERO_NOTA_FISCAL,
               SERIE_NOTA_FISCAL,
               CONTADOR,
               TIPO_TRANSACAO,
               ERROR,
               DATA_HORA)
        VALUES  (v_empresa,
               v_revenda,
               v_proposta,
               null,
               null,
               null,
               v_code || ':' || v_errm,
               SYSDATE);
    END;
  END LOOP;

END;
/
