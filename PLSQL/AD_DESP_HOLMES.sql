-- Create table
create table AD_DESP_HOLMES
(
  STATUS_LANC_HOLMES VARCHAR2(1) default 'N' not null,
  EMPRESA            NUMBER(6) not null,
  REVENDA            NUMBER(2) not null,
  ESTABELECIMENTO    VARCHAR2(14),
  TIPO_TRANSACAO     VARCHAR2(4),
  FORNECEDOR         VARCHAR2(70) not null,
  CNPJ_CPF           VARCHAR2(17),
  DEPARTAMENTO       NUMBER(4),
  REQUISICAO         VARCHAR2(100),
  CHASSI_PLACA       VARCHAR2(4000),
  NUMERO_NOTA_FISCAL NUMBER(12) not null,
  DATA_EMISSAO       DATE not null,
  DATA_VENCIMENTO    DATE not null,
  CHAVE_NFE          VARCHAR2(300),
  NOTA_ORIGEM        VARCHAR2(4000),
  CONDICAO_PGTO      NUMBER(4),
  COND_PGTO_DESC     VARCHAR2(100),
  QTDE_PARC          NUMBER(2),
  VALOR              NUMBER(17,2) not null,
  OBSERVACAO         VARCHAR2(3000),
  PDF                VARCHAR2(3000),
  PASTA_BOLETO       VARCHAR2(3000),
  DATA_LANC_HOLMES   DATE,
  SERIE_NOTA_FISCAL  VARCHAR2(5),
  CONTADOR           NUMBER(5),
  CLIENTE            NUMBER(10),
  RESPONSAVEL        VARCHAR2(50)
)

-- Add comments to the columns 
comment on column AD_DESP_HOLMES.STATUS_LANC_HOLMES
  is 'Status do lançamento no holmes, default N para enviar após inserção';
comment on column AD_DESP_HOLMES.ESTABELECIMENTO
  is 'CNPJ da empresa/revenda para de-para com ID do holmes';
comment on column AD_DESP_HOLMES.TIPO_TRANSACAO
  is 'Tipo de transação para de-para no Holmes';
comment on column AD_DESP_HOLMES.REQUISICAO
  is 'Numero da requisicao gerada no envio para o Holmes (interna somente)';
comment on column AD_DESP_HOLMES.CHASSI_PLACA
  is 'para casos que precise ter registro de despesa para veiculo';
comment on column AD_DESP_HOLMES.NOTA_ORIGEM
  is 'Somente para CTE, necessário verificar transação específica';
comment on column AD_DESP_HOLMES.OBSERVACAO
  is 'Observação da descrição livre.';
comment on column AD_DESP_HOLMES.PDF
  is 'Nome do arquivo PDF salvo pelo Apollo';
comment on column AD_DESP_HOLMES.PASTA_BOLETO
  is 'Caminho do arquivo PDF salvo pelo Apollo';
comment on column AD_DESP_HOLMES.DATA_LANC_HOLMES
  is 'Data de envio para o Holmes';
comment on column AD_DESP_HOLMES.CLIENTE
  is 'Cliente para validação do financeiro';